import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from 'ai';
import { auth, type UserType } from '@/app/(auth)/auth';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  upsertDailyUsage,
  upsertMonthlyUsage,
  getUserUsageAndLimits,
} from '@/lib/db/queries';
import { convertToUIMessages, generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { isProductionEnvironment } from '@/lib/constants';
import { getLanguageModel, modelSupports } from '@/lib/ai/providers';
import { getAllowedModelIdsForUser } from '@/lib/ai/entitlements';
import { validateModelAccess } from '@/lib/security';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import type { ChatModel } from '@/lib/ai/models';
import type { VisibilityType } from '@/components/visibility-selector';

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel['id'];
      selectedVisibilityType: VisibilityType;
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType: UserType = session.user.type;

    // Check usage and rate limits
    const usageInfo = await getUserUsageAndLimits({
      userId: session.user.id,
      userType,
    });

    if (usageInfo.isOverLimit) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    // Validate that the user has access to the selected model
    const allowedModelIds = getAllowedModelIdsForUser(userType);
    validateModelAccess(
      selectedChatModel,
      userType,
      session.user.id,
      allowedModelIds,
    );

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    const messagesFromDb = await getMessagesByChatId({ id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: 'user',
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    let dataStreamRef: any = null;

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        dataStreamRef = dataStream; // Store reference for onFinish callback

        const model = getLanguageModel(selectedChatModel);
        const supportsArtifacts = modelSupports(selectedChatModel, 'artifacts');
        const supportsReasoning = modelSupports(selectedChatModel, 'reasoning');

        const result = streamText({
          model,
          system: systemPrompt({
            selectedModel: {
              id: selectedChatModel,
              supportsArtifacts,
              supportsReasoning,
            },
            requestHints,
          }),
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          experimental_activeTools: supportsArtifacts
            ? [
                'getWeather',
                'createDocument',
                'updateDocument',
                'requestSuggestions',
              ]
            : ['getWeather'],
          experimental_transform: smoothStream({ chunking: 'word' }),
          tools: {
            getWeather,
            createDocument: createDocument({
              session,
              dataStream,
              selectedModel: {
                id: selectedChatModel,
                supportsArtifacts,
                supportsReasoning,
              },
            }),
            updateDocument: updateDocument({
              session,
              dataStream,
              selectedModel: {
                id: selectedChatModel,
                supportsArtifacts,
                supportsReasoning,
              },
            }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
              selectedModel: {
                id: selectedChatModel,
                supportsArtifacts,
                supportsReasoning,
              },
            }),
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: supportsReasoning,
          }),
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        await saveMessages({
          messages: messages.map((message) => ({
            id: message.id,
            role: message.role,
            parts: message.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
          })),
        });

        // Usage tracking and real-time usage update
        try {
          const getText = (msg: any) =>
            Array.isArray(msg?.parts)
              ? msg.parts
                  .filter((p: any) => p?.type === 'text')
                  .map((p: any) => String(p.text || ''))
                  .join('')
              : '';

          const lastUser = [...messages]
            .reverse()
            .find((m) => m.role === 'user');
          const lastAssistant = [...messages]
            .reverse()
            .find((m) => m.role === 'assistant');

          const inChars = lastUser ? getText(lastUser).length : 0;
          const outChars = lastAssistant ? getText(lastAssistant).length : 0;
          const toTokens = (n: number) => Math.ceil(n / 4);

          // Track daily usage (for all users - includes tokens for legacy and messages for new system)
          await upsertDailyUsage({
            userId: session.user.id,
            modelId: selectedChatModel,
            tokensIn: toTokens(inChars),
            tokensOut: toTokens(outChars),
            messages: 1, // Count this as 1 message interaction
          });

          // Track monthly usage for pro users
          if (userType === 'pro') {
            await upsertMonthlyUsage({
              userId: session.user.id,
              messages: 1,
            });
          }

          // Get updated usage info after tracking
          const updatedUsageInfo = await getUserUsageAndLimits({
            userId: session.user.id,
            userType,
          });

          // Send usage update to client via data stream (if available)
          if (dataStreamRef) {
            dataStreamRef.write({
              type: 'usage-update',
              content: updatedUsageInfo,
            });
          }
        } catch (err) {
          console.error('usage upsert failed', err);
        }
      },
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });

    const streamContext = getStreamContext();

    if (streamContext) {
      return new Response(
        await streamContext.resumableStream(streamId, () =>
          stream.pipeThrough(new JsonToSseTransformStream()),
        ),
      );
    } else {
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
