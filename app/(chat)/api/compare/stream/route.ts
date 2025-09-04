import { getAllowedModelIdsForUser } from '@/lib/ai/entitlements';
import { systemPrompt, type RequestHints } from '@/lib/ai/prompts';
import { getLanguageModel } from '@/lib/ai/providers';
import { authenticatedRoute } from '@/lib/auth-decorators';
import {
  registerStreamController,
  unregisterStreamController,
} from '@/lib/cache/stream-registry';
import { COMPARE_MAX_MODELS } from '@/lib/constants';
import {
  cancelCompareRun,
  completeCompareResult,
  completeCompareRun,
  createCompareRun,
  failCompareResult,
  getChatById,
  getMessagesByChatId,
  getUserUsageAndLimits,
  saveChat,
  startCompareResultInference,
  upsertDailyUsage,
} from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import type { UserType } from '@/lib/supabase/types';
import { convertToUIMessages } from '@/lib/utils';
import { geolocation } from '@vercel/functions';
import { convertToModelMessages, streamText } from 'ai';
import { after } from 'next/server';
import { compareStreamRequestSchema } from '../schema';

export const maxDuration = 60;

// SSE event types for compare streaming
interface CompareSSEEvent {
  type:
    | 'run_start'
    | 'model_start'
    | 'delta'
    | 'reasoning_delta'
    | 'model_end'
    | 'model_error'
    | 'run_end'
    | 'heartbeat';
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
  let requestBody: any;

  try {
    const json = await request.json();
    requestBody = compareStreamRequestSchema.parse(json);
  } catch (_) {
    return new ChatSDKError(
      'bad_request:api',
      'Invalid request body',
    ).toResponse();
  }

  try {
    const { chatId, prompt, modelIds, runId: existingRunId } = requestBody;
    const userType: UserType = user.userType;

    // Validate model count
    if (modelIds.length > COMPARE_MAX_MODELS) {
      return new ChatSDKError(
        'bad_request:api',
        `Maximum ${COMPARE_MAX_MODELS} models allowed for comparison`,
      ).toResponse();
    }

    // Check usage and rate limits - each model counts as a message
    const usageInfo = await getUserUsageAndLimits({
      userId: user.id,
      userType,
    });

    // Check if user has enough quota for all models
    const requiredQuota = modelIds.length;
    if (usageInfo.used + requiredQuota > usageInfo.quota) {
      console.log(
        `[COMPARE_RATE_LIMIT] User ${
          user.id
        } needs ${requiredQuota} but only has ${
          usageInfo.quota - usageInfo.used
        } remaining`,
      );
      return new ChatSDKError(
        'rate_limit:chat',
        'Insufficient quota for compare run',
      ).toResponse();
    }

    // Validate model access
    const allowedModelIds = getAllowedModelIdsForUser(userType);
    const unauthorizedModels = modelIds.filter(
      (id: string) => !allowedModelIds.includes(id),
    );

    if (unauthorizedModels.length > 0) {
      return new ChatSDKError(
        'forbidden:model',
        `Access denied to models: ${unauthorizedModels.join(', ')}`,
      ).toResponse();
    }

    // Validate chat access - create chat if it doesn't exist (same logic as regular chat API)
    const chat = await getChatById({ id: chatId });
    if (!chat) {
      // Import generateTitleFromUserMessage for chat creation
      const { generateTitleFromUserMessage } = await import('../../../actions');

      const title = await generateTitleFromUserMessage({
        message: {
          id: 'temp',
          role: 'user',
          parts: [{ type: 'text', text: prompt }],
        },
      });

      await saveChat({
        id: chatId,
        userId: user.id,
        title,
        visibility: 'private', // Default to private for compare runs
      });
    } else if (chat.userId !== user.id) {
      return new ChatSDKError(
        'forbidden:chat',
        'Access denied to chat',
      ).toResponse();
    }

    // Create or reuse compare run
    let runId = existingRunId;
    if (!runId) {
      const { run } = await createCompareRun({
        userId: user.id,
        chatId,
        prompt,
        modelIds,
      });
      runId = run.id;
    }

    const { longitude, latitude, city, country } = geolocation(request);
    const requestHints: RequestHints = { longitude, latitude, city, country };

    // Load prior chat history and convert to model messages (bounded)
    // History is shared across models for this compare run
    const MAX_HISTORY_MESSAGES = 24;
    let priorCoreMessages: any[] = [];
    try {
      const dbMessages = await getMessagesByChatId({ id: chatId });
      if (dbMessages?.length) {
        const uiMessages = convertToUIMessages(dbMessages);
        const trimmed = uiMessages.slice(-MAX_HISTORY_MESSAGES);
        priorCoreMessages = convertToModelMessages(trimmed) as any[];
      }
    } catch (e) {
      console.warn('Failed to load/convert prior messages for compare run', e);
    }

    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        // Send run start event
        controller.enqueue(
          new TextEncoder().encode(
            createSSEMessage({
              type: 'run_start',
              runId,
              chatId,
              models: modelIds,
            }),
          ),
        );

        // Start processing all models in parallel
        const modelPromises = modelIds.map(async (modelId: string) => {
          const abortController = new AbortController();

          try {
            if (!runId) {
              throw new Error('Run ID is required');
            }

            // Register for cancellation
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
                  type: 'model_start',
                  runId,
                  modelId,
                  serverStartedAt: serverStartedAt.toISOString(),
                }),
              ),
            );

            const model = getLanguageModel(modelId);

            // Stream with no tools (plain text only for compare)
            const result = streamText({
              model,
              system: systemPrompt({
                selectedModel: {
                  id: modelId,
                  supportsArtifacts: false, // Disabled for compare
                  supportsReasoning: true, // Disabled for compare
                },
                requestHints,
              }),
              messages: [
                ...priorCoreMessages,
                { role: 'user', content: prompt },
              ] as any,
              abortSignal: abortController.signal,
              // No tools for compare mode
              tools: {},
            });

            let fullContent = '';
            let reasoningContent = '';

            // Stream the full result to capture both text and reasoning
            for await (const part of result.fullStream) {
              if (abortController.signal.aborted) break;

              if (part.type === 'text') {
                fullContent += part.text;

                // Send text delta to client
                controller.enqueue(
                  new TextEncoder().encode(
                    createSSEMessage({
                      type: 'delta',
                      runId,
                      modelId,
                      textDelta: part.text,
                    }),
                  ),
                );
              } else if (part.type === 'reasoning') {
                reasoningContent += part.text;

                // Send reasoning delta to client
                controller.enqueue(
                  new TextEncoder().encode(
                    createSSEMessage({
                      type: 'reasoning_delta',
                      runId,
                      modelId,
                      reasoningDelta: part.text,
                    }),
                  ),
                );
              }

              // Optionally append to database (for reliability)
              // await appendCompareResultContent({ runId: runId!, modelId, delta });
            }

            if (!abortController.signal.aborted) {
              // Calculate server-side timing
              const serverCompletedAt = new Date();
              const inferenceTimeMs =
                serverCompletedAt.getTime() - serverStartedAt.getTime();

              // Complete the result with timing data
              const usage = await result.usage;
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

              // Send model end event with server timing
              controller.enqueue(
                new TextEncoder().encode(
                  createSSEMessage({
                    type: 'model_end',
                    runId,
                    modelId,
                    usage,
                    serverStartedAt: serverStartedAt.toISOString(),
                    serverCompletedAt: serverCompletedAt.toISOString(),
                    inferenceTimeMs,
                  }),
                ),
              );

              // Track usage
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
                    messages: 1,
                  });
                } catch (err) {
                  console.error('Usage tracking failed for compare:', err);
                }
              });
            }
          } catch (error: any) {
            if (!abortController.signal.aborted) {
              // Mark as failed in database
              await failCompareResult({
                runId,
                modelId,
                error: error.message || 'Unknown error',
              });

              // Send error event
              controller.enqueue(
                new TextEncoder().encode(
                  createSSEMessage({
                    type: 'model_error',
                    runId,
                    modelId,
                    error: error.message || 'Unknown error',
                  }),
                ),
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

            // Send run end event
            controller.enqueue(
              new TextEncoder().encode(
                createSSEMessage({
                  type: 'run_end',
                  runId,
                }),
              ),
            );

            controller.close();
          })
          .catch(async (error) => {
            console.error('Compare run failed:', error);

            // Cancel the run in database
            await cancelCompareRun({ runId });

            controller.close();
          });

        // Heartbeat to keep connection alive
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(
              new TextEncoder().encode(createSSEMessage({ type: 'heartbeat' })),
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
        request.signal?.addEventListener('abort', cleanup);

        return () => cleanup();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Compare stream error:', error);

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return new ChatSDKError(
      'bad_request:api',
      'Internal server error',
    ).toResponse();
  }
});
