import type { VisibilityType } from "@/components/visibility-selector";
import { getAllowedModelIdsForUser } from "@/lib/ai/entitlements";
import type { ChatModel } from "@/lib/ai/models";
import { getDefaultModelForUser } from "@/lib/ai/models";
import { systemPrompt, type RequestHints } from "@/lib/ai/prompts";
import { getLanguageModel, modelSupports } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { authenticatedRoute } from "@/lib/auth-decorators";
import { apiLogger } from "@/lib/logger";

import { isProductionEnvironment } from "@/lib/constants";
import {
  createAnonymousUserIfNotExists,
  createStreamId,
  deleteChatById,
  getChatById,
  getMessagesByChatId,
  getUserUsageAndLimits,
  saveChat,
  saveMessages,
  upsertDailyUsage,
  upsertMonthlyUsage,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { validateModelAccess } from "@/lib/security";
import type { UserType } from "@/lib/supabase/types";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";
import { after } from "next/server";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
import { generateTitleFromUserMessage } from "../../actions";
import { postRequestBodySchema, type PostRequestBody } from "./schema";

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes("REDIS_URL")) {
        apiLogger.warn(
          {},
          "Resumable streams disabled due to missing REDIS_URL"
        );
      } else {
        apiLogger.error(
          {
            error: error.message,
            stack: error.stack,
          },
          "Failed to create resumable stream context"
        );
      }
    }
  }

  return globalStreamContext;
}

export const POST = authenticatedRoute(async (request, _context, user) => {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError("bad_request:api").toResponse();
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
      selectedChatModel: ChatModel["id"];
      selectedVisibilityType: VisibilityType;
    } = requestBody;

    const userType: UserType = user.userType;

    // Check usage and rate limits
    const usageInfo = await getUserUsageAndLimits({
      userId: user.id,
      userType,
    });

    // Debug logging for rate limiting issues
    apiLogger.debug(
      {
        userId: user.id,
        userType,
        currentUsage: usageInfo.used,
        quota: usageInfo.quota,
        isOverLimit: usageInfo.isOverLimit,
      },
      "Rate limit check for chat request"
    );

    if (usageInfo.isOverLimit) {
      apiLogger.warn(
        {
          userId: user.id,
          currentUsage: usageInfo.used,
          quota: usageInfo.quota,
        },
        "Blocking user due to rate limit exceeded"
      );
      return new ChatSDKError("rate_limit:chat").toResponse();
    }

    // Validate that the user has access to the selected model
    const allowedModelIds = getAllowedModelIdsForUser(userType);

    // Use fallback to plan-based default if selected model is not allowed
    let effectiveModel = selectedChatModel;
    if (!allowedModelIds.includes(selectedChatModel)) {
      effectiveModel = getDefaultModelForUser(userType);
      apiLogger.warn(
        {
          userId: user.id,
          requestedModel: selectedChatModel,
          fallbackModel: effectiveModel,
          userType,
          allowedModels: allowedModelIds,
        },
        "User attempted to use unauthorized model, using fallback"
      );
    }

    // Final validation of the effective model
    validateModelAccess(effectiveModel, userType, user.id, allowedModelIds);

    // Ensure user exists in our database
    if (user.is_anonymous) {
      await createAnonymousUserIfNotExists(user.id);
    } else if (user.email) {
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: user.id,
        title,
        visibility: selectedVisibilityType,
      });
    } else {
      if (chat.userId !== user.id) {
        return new ChatSDKError("forbidden:chat").toResponse();
      }
    }

    const messagesFromDb = await getMessagesByChatId({
      id,
      excludeCompareMessages: true, // Exclude compare messages in regular chat mode
    });
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
          role: "user",
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

        const model = getLanguageModel(effectiveModel);
        const supportsArtifacts = modelSupports(effectiveModel, "artifacts");
        const supportsReasoning = modelSupports(effectiveModel, "reasoning");

        const result = streamText({
          model,
          system: systemPrompt({
            selectedModel: {
              id: effectiveModel,
              supportsArtifacts,
              supportsReasoning,
            },
            requestHints,
          }),
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          experimental_activeTools: supportsArtifacts
            ? [
                "getWeather",
                "createDocument",
                "updateDocument",
                "requestSuggestions",
              ]
            : ["getWeather"],
          experimental_transform: smoothStream({ chunking: "word" }),
          tools: {
            getWeather,
            createDocument: createDocument({
              user,
              dataStream,
              selectedModel: {
                id: selectedChatModel,
                supportsArtifacts,
                supportsReasoning,
              },
            }),
            updateDocument: updateDocument({
              user,
              dataStream,
              selectedModel: {
                id: selectedChatModel,
                supportsArtifacts,
                supportsReasoning,
              },
            }),
            requestSuggestions: requestSuggestions({
              user,
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
            functionId: "stream-text",
          },
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: supportsReasoning,
          })
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
                  .filter((p: any) => p?.type === "text")
                  .map((p: any) => String(p.text || ""))
                  .join("")
              : "";

          const lastUser = [...messages]
            .reverse()
            .find((m) => m.role === "user");
          const lastAssistant = [...messages]
            .reverse()
            .find((m) => m.role === "assistant");

          const inChars = lastUser ? getText(lastUser).length : 0;
          const outChars = lastAssistant ? getText(lastAssistant).length : 0;
          const toTokens = (n: number) => Math.ceil(n / 4);

          // Track daily usage (for all users - includes tokens for legacy and messages for new system)
          await upsertDailyUsage({
            userId: user.id,
            modelId: effectiveModel, // Use effectiveModel, not selectedChatModel
            tokensIn: toTokens(inChars),
            tokensOut: toTokens(outChars),
            messages: 1, // Count this as 1 message interaction
          });

          // Track monthly usage for pro users
          if (userType === "pro") {
            await upsertMonthlyUsage({
              userId: user.id,
              messages: 1,
            });
          }

          // Get updated usage info after tracking
          const updatedUsageInfo = await getUserUsageAndLimits({
            userId: user.id,
            userType,
          });

          // Send usage update to client via data stream (if available)
          if (dataStreamRef) {
            dataStreamRef.write({
              type: "usage-update",
              content: updatedUsageInfo,
            });
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          apiLogger.error(
            {
              error: error.message,
              stack: error.stack,
              userId: user.id,
              chatId: id,
            },
            "Usage upsert failed"
          );
        }
      },
      onError: () => {
        return "Oops, an error occurred!";
      },
    });

    const streamContext = getStreamContext();

    if (streamContext) {
      return new Response(
        await streamContext.resumableStream(streamId, () =>
          stream.pipeThrough(new JsonToSseTransformStream())
        )
      );
    } else {
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Internal server error"
    ).toResponse();
  }
});

export const DELETE = authenticatedRoute(async (request, context, user) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat.userId !== user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
});
