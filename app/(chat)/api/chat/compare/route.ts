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
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatToCompareMode,
} from '@/lib/db/queries';
import { convertToUIMessages, generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { geolocation } from '@vercel/functions';
import { ChatSDKError } from '@/lib/errors';
import { z } from 'zod';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';

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

const compareRequestSchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    role: z.enum(['user']),
    parts: z.array(
      z.union([
        z.object({
          type: z.enum(['text']),
          text: z.string().min(1).max(2000),
        }),
        z.object({
          type: z.enum(['file']),
          mediaType: z.enum(['image/jpeg', 'image/png']),
          name: z.string().min(1).max(100),
          url: z.string().url(),
        }),
      ]),
    ),
  }),
  selectedModels: z.array(z.string()).min(2).max(4),
  selectedVisibilityType: z.enum(['public', 'private']),
});

type CompareRequest = z.infer<typeof compareRequestSchema>;

export async function POST(request: Request) {
  let requestBody: CompareRequest;

  try {
    const json = await request.json();
    requestBody = compareRequestSchema.parse(json);
  } catch (_) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const { id, message, selectedModels, selectedVisibilityType } = requestBody;

    console.log('Compare API called with:', {
      id,
      selectedModels,
      selectedVisibilityType,
    });

    const session = await auth();

    console.log('Session:', session ? 'exists' : 'null', session?.user?.id);

    if (!session?.user) {
      console.log('No session or user found');
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType: UserType = session.user.type;

    // Check rate limits
    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    const chat = await getChatById({ id });

    if (!chat) {
      let title: string;
      try {
        title = await generateTitleFromUserMessage({ message });
      } catch (error) {
        console.error('Error generating title:', error);
        // Fallback title if generation fails
        title = 'Model Comparison';
      }

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
        isCompareMode: true,
        selectedModels,
      });
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }

      // Update existing chat to compare mode
      await updateChatToCompareMode({ chatId: id, selectedModels });
    }

    // Get existing messages for context
    const messagesFromDb = await getMessagesByChatId({ id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    // Save the user message first
    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: 'user',
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
          modelId: null,
          tokenUsage: null,
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    // Use the same pattern as regular chat API but handle multiple models
    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        // Create parallel streams for each model
        selectedModels.forEach((modelId) => {
          const result = streamText({
            model: myProvider.languageModel(modelId),
            system: systemPrompt({ selectedChatModel: modelId, requestHints }),
            messages: convertToModelMessages(uiMessages),
            stopWhen: stepCountIs(5),
            experimental_activeTools:
              modelId === 'chat-model-reasoning'
                ? []
                : [
                    'getWeather',
                    'createDocument',
                    'updateDocument',
                    'requestSuggestions',
                  ],
            experimental_transform: smoothStream({ chunking: 'word' }),
            tools: {
              getWeather,
              createDocument: createDocument({ session, dataStream }),
              updateDocument: updateDocument({ session, dataStream }),
              requestSuggestions: requestSuggestions({
                session,
                dataStream,
              }),
            },
            experimental_telemetry: {
              isEnabled: isProductionEnvironment,
              functionId: `stream-text-compare-${modelId}`,
            },
          });

          result.consumeStream();

          // Convert to UI message stream and add model identification
          const modelStream = result.toUIMessageStream({
            sendReasoning: true,
          });

          // Transform the stream to add modelId to messages
          const transformedStream = modelStream.pipeThrough(
            new TransformStream({
              transform(chunk, controller) {
                // Add modelId to text-delta chunks
                if (chunk.type === 'text-delta') {
                  const enhancedChunk = {
                    ...chunk,
                    experimental_modelId: modelId, // Add model identification
                  };
                  controller.enqueue(enhancedChunk);
                } else {
                  // For all other chunk types, just pass them through
                  controller.enqueue(chunk);
                }
              },
            }),
          );

          dataStream.merge(transformedStream);
        });
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        // Save all assistant messages with their model IDs
        const messagesToSave = messages
          .filter((msg) => msg.role === 'assistant')
          .map((msg) => ({
            id: msg.id,
            role: msg.role,
            parts: msg.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
            modelId: (msg as any).experimental_modelId || selectedModels[0],
            tokenUsage:
              (msg as any).experimental_providerMetadata?.usage || null,
          }));

        if (messagesToSave.length > 0) {
          await saveMessages({ messages: messagesToSave });
        }
      },
      onError: () => {
        return 'Error occurred during model comparison';
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
    console.error('Compare mode error:', error);
    return new ChatSDKError('bad_request:api').toResponse();
  }
}
