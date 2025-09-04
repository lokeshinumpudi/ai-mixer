import { getAllowedModelIdsForUser } from "@/lib/ai/entitlements";
import { systemPrompt, type RequestHints } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { authenticatedRoute } from "@/lib/auth-decorators";
import {
  registerStreamController,
  unregisterStreamController,
} from "@/lib/cache/stream-registry";
import { COMPARE_MAX_MODELS } from "@/lib/constants";
import {
  cancelCompareRun,
  completeCompareResult,
  completeCompareRun,
  createAnonymousUserIfNotExists,
  createCompareRun,
  createOAuthUserIfNotExists,
  failCompareResult,
  getChatById,
  getCompareRun,
  getMessagesByChatId,
  getUserUsageAndLimits,
  saveChat,
  saveMessages,
  startCompareResultInference,
  upsertDailyUsage,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { apiLogger } from "@/lib/logger";
import type { UserType } from "@/lib/supabase/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { geolocation } from "@vercel/functions";
import { convertToModelMessages, streamText } from "ai";
import { after } from "next/server";
import { compareStreamRequestSchema } from "../schema";

export const maxDuration = 60;

// SSE event types for compare streaming
interface CompareSSEEvent {
  type:
    | "run_start"
    | "model_start"
    | "delta"
    | "reasoning_delta"
    | "model_end"
    | "model_error"
    | "run_end"
    | "heartbeat";
  runId?: string;
  chatId?: string;
  modelId?: string;
  models?: string[];
  textDelta?: string;
  reasoningDelta?: string;
  usage?: any;
  error?: string;
  status?: string;
  // Server-side timing
  serverStartedAt?: string; // ISO timestamp
  serverCompletedAt?: string; // ISO timestamp
  inferenceTimeMs?: number; // Pure inference time in milliseconds
}

function createSSEMessage(event: CompareSSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export const POST = authenticatedRoute(async (request, _context, user) => {
  apiLogger.info(
    {
      userId: user.id,
      userType: user.userType,
      url: request.url,
    },
    "Compare stream request started"
  );

  let requestBody: any;
  let chatId: string;

  try {
    const json = await request.json();
    apiLogger.debug({ requestBody: json }, "Raw request body received");
    requestBody = compareStreamRequestSchema.parse(json);
    chatId = requestBody.chatId; // Store for use in catch blocks
    apiLogger.info(
      {
        chatId: requestBody.chatId,
        modelCount: requestBody.modelIds.length,
        promptLength: requestBody.prompt?.length || 0,
        models: requestBody.modelIds,
      },
      "Request parsed successfully"
    );
  } catch (error) {
    const parsedError =
      error instanceof Error ? error : new Error(String(error));
    apiLogger.error(
      {
        error: parsedError.message,
        userId: user.id,
        stack: parsedError.stack,
      },
      "Request parsing failed"
    );
    return new ChatSDKError(
      "bad_request:api",
      "Invalid request body"
    ).toResponse();
  }

  try {
    const { prompt, modelIds, runId: existingRunId } = requestBody;
    const userType: UserType = user.userType;

    apiLogger.info(
      {
        chatId,
        modelCount: modelIds.length,
        models: modelIds,
        userId: user.id,
      },
      "Processing compare stream request"
    );

    // Validate model count
    apiLogger.debug(
      {
        modelCount: modelIds.length,
        maxModels: COMPARE_MAX_MODELS,
      },
      "Validating model count"
    );

    if (modelIds.length > COMPARE_MAX_MODELS) {
      apiLogger.error(
        {
          requestedCount: modelIds.length,
          maxAllowed: COMPARE_MAX_MODELS,
          userId: user.id,
        },
        "Too many models requested"
      );
      return new ChatSDKError(
        "bad_request:api",
        `Maximum ${COMPARE_MAX_MODELS} models allowed for comparison`
      ).toResponse();
    }

    // Check usage and rate limits - each model counts as a message
    apiLogger.debug(
      {
        userId: user.id,
        userType,
      },
      "Checking user usage and limits"
    );
    const usageInfo = await getUserUsageAndLimits({
      userId: user.id,
      userType,
    });

    apiLogger.info(
      {
        userId: user.id,
        currentUsage: usageInfo.used,
        quota: usageInfo.quota,
        userType,
        remaining: usageInfo.quota - usageInfo.used,
      },
      "User usage information retrieved"
    );

    // Check if user has enough quota for all models
    const requiredQuota = modelIds.length;
    if (usageInfo.used + requiredQuota > usageInfo.quota) {
      apiLogger.warn(
        {
          userId: user.id,
          requiredQuota,
          currentUsage: usageInfo.used,
          quota: usageInfo.quota,
          remaining: usageInfo.quota - usageInfo.used,
          userType,
          isAnonymous: user.is_anonymous,
        },
        "Rate limit exceeded for compare request"
      );

      // For anonymous users, suggest login instead of showing generic rate limit error
      if (user.is_anonymous) {
        apiLogger.info(
          {
            userId: user.id,
            modelCount: modelIds.length,
            requiredQuota,
            currentUsage: usageInfo.used,
          },
          "Anonymous user hit rate limit on compare mode - prompting login"
        );
        return new ChatSDKError(
          "login_required:compare",
          "Sign in to unlock unlimited model comparisons and higher limits"
        ).toResponse();
      }

      // For authenticated users, show standard rate limit error
      return new ChatSDKError(
        "rate_limit:chat",
        "Insufficient quota for compare run"
      ).toResponse();
    }

    // Validate model access
    apiLogger.debug(
      {
        userType,
        chatId,
        userId: user.id,
      },
      "Validating model access"
    );
    const allowedModelIds = getAllowedModelIdsForUser(userType);
    apiLogger.debug(
      {
        allowedModels: allowedModelIds,
        userType,
        chatId,
      },
      "Retrieved allowed models for user"
    );
    apiLogger.debug(
      {
        requestedModels: modelIds,
        chatId,
      },
      "Models requested in compare"
    );

    const unauthorizedModels = modelIds.filter(
      (id: string) => !allowedModelIds.includes(id)
    );

    if (unauthorizedModels.length > 0) {
      apiLogger.error(
        {
          unauthorizedModels,
          requestedModels: modelIds,
          allowedModels: allowedModelIds,
          userType,
          chatId,
          userId: user.id,
        },
        "Unauthorized models requested"
      );
      return new ChatSDKError(
        "forbidden:model",
        `Access denied to models: ${unauthorizedModels.join(", ")}`
      ).toResponse();
    }

    apiLogger.info(
      {
        modelCount: modelIds.length,
        models: modelIds,
        userType,
        chatId,
      },
      "All models authorized for compare"
    );

    // Ensure user exists in our database before creating/accessing chats
    apiLogger.debug(
      {
        userId: user.id,
        isAnonymous: user.is_anonymous,
        email: user.email,
        chatId,
      },
      "Ensuring user exists in database"
    );
    if (user.is_anonymous) {
      apiLogger.debug(
        {
          userId: user.id,
          chatId,
        },
        "Creating anonymous user"
      );
      await createAnonymousUserIfNotExists(user.id);
    } else if (user.email) {
      apiLogger.debug(
        {
          userId: user.id,
          email: user.email,
          chatId,
        },
        "Creating OAuth user"
      );
      await createOAuthUserIfNotExists(user.id, user.email);
    }

    // Validate chat access - create chat if it doesn't exist (same logic as regular chat API)
    apiLogger.debug(
      {
        chatId,
        userId: user.id,
      },
      "Checking if chat exists"
    );
    const chat = await getChatById({ id: chatId });
    if (!chat) {
      apiLogger.info(
        {
          chatId,
          userId: user.id,
          promptLength: prompt.length,
        },
        "Chat not found, creating new chat"
      );
      // Import generateTitleFromUserMessage for chat creation
      const { generateTitleFromUserMessage } = await import("../../../actions");

      const title = await generateTitleFromUserMessage({
        message: {
          id: "temp",
          role: "user",
          parts: [{ type: "text", text: prompt }],
        },
      });

      apiLogger.debug(
        {
          chatId,
          title,
          userId: user.id,
        },
        "Generated title for new chat"
      );

      await saveChat({
        id: chatId,
        userId: user.id,
        title,
        visibility: "private", // Default to private for compare runs
      });
      apiLogger.info(
        {
          chatId,
          title,
          userId: user.id,
        },
        "Chat created successfully"
      );
    } else {
      apiLogger.debug(
        {
          chatId,
          userId: user.id,
        },
        "Chat exists, proceeding with existing chat"
      );
      // Validate chat ownership
      if (chat.userId !== user.id) {
        apiLogger.error(
          {
            chatId,
            chatUserId: chat.userId,
            requestUserId: user.id,
          },
          "Chat ownership mismatch"
        );
        return new ChatSDKError(
          "forbidden:chat",
          "Access denied to chat"
        ).toResponse();
      }
    }

    // Create or reuse compare run
    apiLogger.info(
      {
        chatId,
        userId: user.id,
        existingRunId,
      },
      "Creating or reusing compare run"
    );
    let runId = existingRunId;
    if (!runId) {
      apiLogger.debug(
        {
          chatId,
          userId: user.id,
          modelCount: modelIds.length,
        },
        "No existing runId provided, creating new run"
      );
      const { run } = await createCompareRun({
        userId: user.id,
        chatId,
        prompt,
        modelIds,
      });
      runId = run.id;
      apiLogger.info(
        {
          runId,
          chatId,
          userId: user.id,
          modelCount: modelIds.length,
        },
        "Created new compare run"
      );
    } else {
      apiLogger.debug(
        {
          runId,
          chatId,
          userId: user.id,
        },
        "Reusing existing compare run"
      );
    }

    const { longitude, latitude, city, country } = geolocation(request);
    const requestHints: RequestHints = { longitude, latitude, city, country };

    // Load prior chat history and add new user message (like regular chat)
    // History is shared across models for this compare run
    const MAX_HISTORY_MESSAGES = 24;
    let allMessages: any[] = [];
    let uiMessagesWithMetadata: any[] = [];

    apiLogger.debug(
      {
        chatId,
        userId: user.id,
      },
      "Loading chat history for compare run"
    );
    try {
      const dbMessages = await getMessagesByChatId({
        id: chatId,
        excludeCompareMessages: false, // Keep compare messages for context in compare mode
      });

      apiLogger.debug(
        {
          chatId,
          messageCount: dbMessages.length,
          userId: user.id,
        },
        "Loaded chat history from database"
      );

      // Create user message object for the new prompt
      const userMessage = {
        id: generateUUID(),
        role: "user" as const,
        parts: [{ type: "text" as const, text: prompt }],
        metadata: {
          createdAt: new Date().toISOString(),
        },
      };

      // Combine existing messages with new user message (like regular chat)
      const uiMessages = [...convertToUIMessages(dbMessages), userMessage];

      // Save the new user message to database for conversation continuity
      await saveMessages({
        messages: [
          {
            chatId,
            id: userMessage.id,
            role: "user",
            parts: userMessage.parts,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });

      // Trim to last N messages for context window management
      const trimmed = uiMessages.slice(-MAX_HISTORY_MESSAGES);

      // Keep UI messages with metadata for model-specific filtering
      uiMessagesWithMetadata = trimmed;
      allMessages = convertToModelMessages(trimmed) as any[];
    } catch (e) {
      const parsedError = e instanceof Error ? e : new Error(String(e));
      apiLogger.warn(
        {
          error: parsedError.message,
          chatId,
          userId: user.id,
        },
        "Failed to load prior messages for compare run, using fallback"
      );
      // Fallback: just use the prompt as user message
      allMessages = [{ role: "user", content: prompt }];
      uiMessagesWithMetadata = [
        { role: "user", parts: [{ type: "text", text: prompt }] },
      ];
    }

    // Create SSE stream
    apiLogger.info(
      {
        runId,
        chatId,
        modelCount: modelIds.length,
      },
      "Setting up SSE stream for compare run"
    );
    const stream = new ReadableStream({
      start(controller) {
        apiLogger.debug(
          {
            runId,
            chatId,
          },
          "Starting SSE stream"
        );
        // Send run start event
        controller.enqueue(
          new TextEncoder().encode(
            createSSEMessage({
              type: "run_start",
              runId,
              chatId,
              models: modelIds,
            })
          )
        );
        apiLogger.debug(
          {
            runId,
            chatId,
            modelCount: modelIds.length,
          },
          "Sent run_start SSE event"
        );

        // Build model-specific context with intelligent truncation
        const buildModelSpecificContext = (
          targetModelId: string,
          uiMessages: any[]
        ) => {
          // Filter messages to only include:
          // 1. User messages (always relevant)
          // 2. Assistant messages from the SAME model (avoid competitor responses)
          const filteredUIMessages = uiMessages.filter((msg) => {
            if (msg.role === "user") return true;
            if (msg.role === "assistant") {
              // Check if this assistant message came from the target model
              const msgMetadata = msg.metadata;
              return msgMetadata?.modelId === targetModelId;
            }
            return true; // Keep other message types
          });

          // Apply intelligent context window management
          const contextOptimizedMessages =
            optimizeContextWindow(filteredUIMessages);

          // Convert filtered UI messages to model messages
          return convertToModelMessages(contextOptimizedMessages) as any[];
        };

        // Intelligent context window optimization with dynamic sizing
        const optimizeContextWindow = (messages: any[]) => {
          // Dynamic limits based on message complexity
          const OPTIMAL_CONTEXT_TOKENS = 2000; // Target context size
          const MIN_RECENT_PAIRS = 2; // Always keep at least 2 recent pairs
          const MAX_RECENT_PAIRS = 5; // Never exceed 5 recent pairs

          // Group messages into conversation pairs
          const pairs: Array<{
            user: any;
            assistant?: any;
            tokenEstimate: number;
          }> = [];
          let currentPair: {
            user: any;
            assistant?: any;
            tokenEstimate: number;
          } | null = null;

          for (const msg of messages) {
            if (msg.role === "user") {
              // Start new pair
              if (currentPair) pairs.push(currentPair);
              currentPair = {
                user: msg,
                tokenEstimate: estimateTokens(getMessageText(msg)),
              };
            } else if (msg.role === "assistant" && currentPair) {
              // Complete current pair
              currentPair.assistant = msg;
              currentPair.tokenEstimate += estimateTokens(getMessageText(msg));
            }
          }
          if (currentPair) pairs.push(currentPair);

          // If total estimated tokens are within limit, return all
          const totalTokens = pairs.reduce(
            (sum, pair) => sum + pair.tokenEstimate,
            0
          );
          if (totalTokens <= OPTIMAL_CONTEXT_TOKENS) {
            return messages;
          }

          // Use sliding window approach - prioritize recent context
          const selectedPairs: typeof pairs = [];
          let currentTokens = 0;

          // Start from most recent and work backwards
          for (let i = pairs.length - 1; i >= 0; i--) {
            const pair = pairs[i];
            const wouldExceedLimit =
              currentTokens + pair.tokenEstimate > OPTIMAL_CONTEXT_TOKENS;
            const hasMinimumRecent = selectedPairs.length >= MIN_RECENT_PAIRS;

            if (wouldExceedLimit && hasMinimumRecent) {
              break; // Stop adding older context
            }

            selectedPairs.unshift(pair); // Add to beginning
            currentTokens += pair.tokenEstimate;

            // Respect maximum recent pairs limit
            if (selectedPairs.length >= MAX_RECENT_PAIRS) {
              break;
            }
          }

          // Convert back to messages
          const optimizedMessages: any[] = [];
          for (const pair of selectedPairs) {
            optimizedMessages.push(pair.user);
            if (pair.assistant) optimizedMessages.push(pair.assistant);
          }

          return optimizedMessages;
        };

        // Estimate token count (rough approximation: 4 chars = 1 token)
        const estimateTokens = (text: string): number => {
          return Math.ceil(text.length / 4);
        };

        // Extract text content from message
        const getMessageText = (message: any): string => {
          if (!message.parts) return "";
          return message.parts
            .filter((p: any) => p.type === "text")
            .map((p: any) => p.text || "")
            .join(" ");
        };

        // Start processing all models in parallel
        apiLogger.info(
          {
            runId,
            chatId,
            modelCount: modelIds.length,
            models: modelIds,
          },
          "Starting parallel processing for models"
        );
        const modelPromises = modelIds.map(async (modelId: string) => {
          apiLogger.debug(
            {
              modelId,
              runId,
              chatId,
            },
            "Setting up streaming for model"
          );
          const abortController = new AbortController();

          try {
            if (!runId) {
              apiLogger.error(
                {
                  modelId,
                  chatId,
                },
                "Run ID is required for model processing"
              );
              throw new Error("Run ID is required");
            }

            // Register for cancellation
            apiLogger.debug(
              {
                modelId,
                runId,
              },
              "Registering controller for model"
            );
            registerStreamController(runId, modelId, abortController);

            // Mark server-side inference start time
            const serverStartedAt = new Date();
            await startCompareResultInference({
              runId,
              modelId,
            });

            // Send model start event with server timestamp
            controller.enqueue(
              new TextEncoder().encode(
                createSSEMessage({
                  type: "model_start",
                  runId,
                  modelId,
                  serverStartedAt: serverStartedAt.toISOString(),
                })
              )
            );

            apiLogger.debug(
              {
                modelId,
                runId,
              },
              "Getting language model"
            );
            const model = getLanguageModel(modelId);

            // Build model-specific context to avoid token waste
            apiLogger.debug(
              {
                modelId,
                runId,
                messageCount: uiMessagesWithMetadata.length,
              },
              "Building model-specific context"
            );
            const modelSpecificMessages = buildModelSpecificContext(
              modelId,
              uiMessagesWithMetadata
            );
            apiLogger.debug(
              {
                modelId,
                runId,
                originalCount: uiMessagesWithMetadata.length,
                filteredCount: modelSpecificMessages.length,
              },
              "Context built for model"
            );

            // Stream with no tools (plain text only for compare)
            apiLogger.debug(
              {
                modelId,
                runId,
              },
              "Starting streamText for model"
            );
            const result = streamText({
              model,
              system: systemPrompt({
                selectedModel: {
                  id: modelId,
                  supportsArtifacts: false, // Disabled for compare
                  supportsReasoning: true,
                },
                requestHints,
              }),
              messages: modelSpecificMessages, // Use filtered context
              abortSignal: abortController.signal,
              // No tools for compare mode
              tools: {},
            });
            console.log(
              `[COMPARE_STREAM_MODEL] streamText initialized for ${modelId}`
            );

            let fullContent = "";
            let reasoningContent = "";

            // Stream the full result to capture both text and reasoning
            console.log(
              `[COMPARE_STREAM_MODEL] Starting streaming loop for ${modelId}`
            );
            let partCount = 0;
            for await (const part of result.fullStream) {
              if (abortController.signal.aborted) {
                console.log(
                  `[COMPARE_STREAM_MODEL] Stream aborted for ${modelId}`
                );
                break;
              }

              partCount++;
              if (partCount % 10 === 0) {
                console.log(
                  `[COMPARE_STREAM_MODEL] Processed ${partCount} parts for ${modelId}`
                );
              }

              if (part.type === "text") {
                fullContent += part.text;

                // Send text delta to client
                controller.enqueue(
                  new TextEncoder().encode(
                    createSSEMessage({
                      type: "delta",
                      runId,
                      modelId,
                      textDelta: part.text,
                    })
                  )
                );
              } else if (part.type === "reasoning") {
                reasoningContent += part.text;

                // Send reasoning delta to client
                controller.enqueue(
                  new TextEncoder().encode(
                    createSSEMessage({
                      type: "reasoning_delta",
                      runId,
                      modelId,
                      reasoningDelta: part.text,
                    })
                  )
                );
              }

              // Optionally append to database (for reliability)
              // await appendCompareResultContent({ runId: runId!, modelId, delta });
            }

            if (!abortController.signal.aborted) {
              console.log(
                `[COMPARE_STREAM_MODEL] Completing ${modelId}: ${fullContent.length} chars content, ${reasoningContent.length} chars reasoning`
              );

              // Calculate server-side timing
              const serverCompletedAt = new Date();
              const inferenceTimeMs =
                serverCompletedAt.getTime() - serverStartedAt.getTime();

              console.log(
                `[COMPARE_STREAM_MODEL] ${modelId} inference time: ${inferenceTimeMs}ms`
              );

              // Complete the result with timing data
              const usage = await result.usage;
              console.log(`[COMPARE_STREAM_MODEL] ${modelId} usage:`, usage);

              await completeCompareResult({
                runId,
                modelId,
                content: fullContent,
                reasoning: reasoningContent,
                usage,
                serverStartedAt,
                serverCompletedAt,
                inferenceTimeMs,
              });

              console.log(
                `[COMPARE_STREAM_MODEL] ${modelId} result completed successfully`
              );

              // Send model end event with server timing
              controller.enqueue(
                new TextEncoder().encode(
                  createSSEMessage({
                    type: "model_end",
                    runId,
                    modelId,
                    usage,
                    serverStartedAt: serverStartedAt.toISOString(),
                    serverCompletedAt: serverCompletedAt.toISOString(),
                    inferenceTimeMs,
                  })
                )
              );

              // Track usage - each model in compare mode counts as 1 message
              after(async () => {
                try {
                  const inChars = prompt.length;
                  const outChars = fullContent.length;
                  const toTokens = (n: number) => Math.ceil(n / 4);

                  await upsertDailyUsage({
                    userId: user.id,
                    modelId,
                    tokensIn: toTokens(inChars),
                    tokensOut: toTokens(outChars),
                    messages: 1, // Each model counts as 1 message (so 2 models = 2 messages, 3 models = 3 messages)
                  });
                } catch (err) {
                  const parsedErr =
                    err instanceof Error ? err : new Error(String(err));
                  apiLogger.error(
                    {
                      error: parsedErr.message,
                      stack: parsedErr.stack,
                      chatId,
                      runId,
                      modelId,
                    },
                    "Usage tracking failed for compare"
                  );
                }
              });
            }
          } catch (error: any) {
            const parsedError =
              error instanceof Error ? error : new Error(String(error));
            apiLogger.error(
              {
                modelId,
                error: parsedError.message,
                stack: parsedError.stack,
                chatId,
                runId,
              },
              "Model failed during streaming"
            );

            if (!abortController.signal.aborted) {
              apiLogger.warn(
                {
                  modelId,
                  chatId,
                  runId,
                },
                "Marking model as failed in database"
              );

              // Mark as failed in database
              await failCompareResult({
                runId,
                modelId,
                error: error.message || "Unknown error",
              });

              console.log(`[COMPARE_STREAM_ERROR] ${modelId} marked as failed`);

              // Send error event
              controller.enqueue(
                new TextEncoder().encode(
                  createSSEMessage({
                    type: "model_error",
                    runId,
                    modelId,
                    error: error.message || "Unknown error",
                  })
                )
              );
            }
          } finally {
            unregisterStreamController(runId, modelId);
          }
        });

        // Wait for all models to complete
        Promise.all(modelPromises)
          .then(async () => {
            // Mark run as completed
            await completeCompareRun({ runId });

            // Save assistant message to maintain conversation continuity
            // This ensures follow-up messages have context from AI responses
            try {
              // Get completed compare run with results
              const completedRun = await getCompareRun({ runId });

              if (completedRun && completedRun.results.length > 0) {
                // Create model-specific assistant messages for efficient context
                // Each model's response is saved separately to avoid token waste
                for (const result of completedRun.results) {
                  if (result.status === "completed" && result.content) {
                    const modelSpecificMessage = {
                      id: generateUUID(),
                      role: "assistant" as const,
                      parts: [] as any[],
                      metadata: {
                        compareRunId: runId,
                        modelId: result.modelId, // Track which model this came from
                        createdAt: new Date().toISOString(),
                      },
                    };

                    // Add reasoning if present
                    if (result.reasoning) {
                      modelSpecificMessage.parts.push({
                        type: "reasoning" as const,
                        text: result.reasoning,
                      });
                    }

                    // Add main content without model attribution (since it's in metadata)
                    modelSpecificMessage.parts.push({
                      type: "text" as const,
                      text: result.content,
                    });

                    // Add metadata as a special part for identification
                    modelSpecificMessage.parts.push({
                      type: "metadata" as const,
                      compareRunId: runId,
                      modelId: result.modelId,
                      createdAt: new Date().toISOString(),
                    });

                    // Save individual model response with metadata in parts
                    await saveMessages({
                      messages: [
                        {
                          chatId,
                          id: modelSpecificMessage.id,
                          role: "assistant",
                          parts: modelSpecificMessage.parts,
                          attachments: [], // Keep attachments empty for now
                          createdAt: new Date(),
                        },
                      ],
                    });
                  }
                }
              }
            } catch (error) {
              console.warn(
                "Failed to save assistant message for conversation continuity:",
                error
              );
              // Don't fail the entire request if this fails
            }

            // Send run end event
            controller.enqueue(
              new TextEncoder().encode(
                createSSEMessage({
                  type: "run_end",
                  runId,
                })
              )
            );

            controller.close();
          })
          .catch(async (error) => {
            console.error("Compare run failed:", error);

            // Cancel the run in database
            await cancelCompareRun({ runId });

            controller.close();
          });

        // Heartbeat to keep connection alive
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(
              new TextEncoder().encode(createSSEMessage({ type: "heartbeat" }))
            );
          } catch (err) {
            clearInterval(heartbeatInterval);
          }
        }, 10000);

        // Cleanup on close
        const cleanup = () => {
          clearInterval(heartbeatInterval);
          // Cancel any remaining streams
          modelIds.forEach((modelId: string) => {
            unregisterStreamController(runId, modelId);
          });
        };

        // Handle client disconnect
        request.signal?.addEventListener("abort", cleanup);

        return () => cleanup();
      },
    });

    apiLogger.info(
      {
        runId,
        chatId,
        modelCount: modelIds.length,
      },
      "Returning SSE stream for compare run"
    );
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    const parsedError =
      error instanceof Error ? error : new Error(String(error));
    apiLogger.error(
      {
        error: parsedError.message,
        stack: parsedError.stack,
        userId: user.id,
        chatId,
      },
      "Fatal error in compare stream"
    );

    if (error instanceof ChatSDKError) {
      apiLogger.info(
        {
          errorType: error.type,
          userId: user.id,
          chatId,
        },
        "Returning ChatSDKError response"
      );
      return error.toResponse();
    }

    return new ChatSDKError(
      "bad_request:api",
      "Internal server error"
    ).toResponse();
  }
});
