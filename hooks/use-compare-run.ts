'use client';

import { compareLogger } from '@/lib/logger';
import { fetcher } from '@/lib/utils';
import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';

export interface CompareModelState {
  status: 'pending' | 'running' | 'completed' | 'canceled' | 'failed';
  content: string;
  reasoning?: string; // AI reasoning/thinking content
  usage?: any;
  error?: string;
  // Server-side timing (authoritative)
  serverStartedAt?: string; // ISO timestamp
  serverCompletedAt?: string; // ISO timestamp
  inferenceTimeMs?: number; // Pure inference time in milliseconds
}

export interface CompareRunState {
  runId: string | null;
  prompt: string;
  modelIds: string[];
  status: 'idle' | 'running' | 'completed' | 'canceled' | 'failed';
  byModelId: Record<string, CompareModelState>;
  isRunning: boolean;
  isTransitioning: boolean; // Prevents UI flashes during completion
}

interface CompareRunsListResponse {
  items: any[];
  nextCursor: string | null;
  hasMore: boolean;
}

const initialModelState: CompareModelState = {
  status: 'pending',
  content: '',
  reasoning: '',
};

export function useCompareRun(
  chatId: string,
  options?: { listOnMount?: boolean; disableOptimisticUpdates?: boolean },
) {
  compareLogger.debug(
    {
      chatId,
    },
    'useCompareRun hook initialized',
  );

  const pendingHandoffRunIdRef = useRef<string | null>(null);

  const [state, setState] = useState<CompareRunState>({
    runId: null,
    prompt: '',
    modelIds: [],
    status: 'idle',
    byModelId: {},
    isRunning: false,
    isTransitioning: false,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // SWR for listing compare runs for this chat
  const {
    data: compareRuns,
    mutate: mutateCompareRuns,
    isLoading: isLoadingRuns,
  } = useSWR<CompareRunsListResponse>(
    chatId && options?.listOnMount !== false
      ? `/api/compare?chatId=${chatId}`
      : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    },
  );

  // Handoff: when compareRuns updates and includes the pending completed run, clear active state
  useEffect(() => {
    const pendingId = pendingHandoffRunIdRef.current;
    if (!pendingId) return;

    const exists = !!compareRuns?.items?.some((r: any) => r.id === pendingId);
    if (exists) {
      setState({
        runId: null,
        prompt: '',
        modelIds: [],
        status: 'idle',
        byModelId: {},
        isRunning: false,
        isTransitioning: false,
      });
      pendingHandoffRunIdRef.current = null;
    }
  }, [compareRuns?.items]);

  // Start a new compare run
  const startCompare = useCallback(
    async ({ prompt, modelIds }: { prompt: string; modelIds: string[] }) => {
      compareLogger.info(
        {
          modelIds,
          modelCount: modelIds.length,
          chatId,
        },
        'Starting compare run',
      );

      if (!chatId || modelIds.length === 0) {
        compareLogger.error(
          {
            chatId,
            modelIdsLength: modelIds.length,
          },
          'Invalid parameters for startCompare',
        );
        return;
      }

      // Reset state
      const initialByModelId = modelIds.reduce(
        (acc, modelId) => {
          acc[modelId] = { ...initialModelState, status: 'running' };
          return acc;
        },
        {} as Record<string, CompareModelState>,
      );

      compareLogger.debug(
        {
          modelCount: modelIds.length,
          chatId,
        },
        'Setting initial compare state',
      );

      setState({
        runId: null,
        prompt,
        modelIds,
        status: 'running',
        byModelId: initialByModelId,
        isRunning: true,
        isTransitioning: false,
      });

      try {
        // Create abort controller for this run
        abortControllerRef.current = new AbortController();

        compareLogger.debug(
          {
            chatId,
            modelIds,
            promptLength: prompt.length,
          },
          'Starting fetch to compare stream API',
        );
        // Start SSE stream
        const response = await fetch('/api/compare/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, prompt, modelIds }),
          signal: abortControllerRef.current.signal,
        });

        compareLogger.debug(
          {
            status: response.status,
            statusText: response.statusText,
            chatId,
          },
          'Fetch response received',
        );

        if (!response.ok) {
          // Try to parse error response for specific error types
          let errorData: any = null;
          let errorText = '';
          try {
            errorText = await response.text();
            errorData = JSON.parse(errorText);
          } catch (parseError: any) {
            // Log parsing errors for debugging
            compareLogger.warn(
              {
                status: response.status,
                statusText: response.statusText,
                errorText: errorText.substring(0, 200), // First 200 chars
                parseError: parseError.message,
              },
              'Failed to parse error response as JSON',
            );
          }

          compareLogger.error(
            {
              status: response.status,
              statusText: response.statusText,
              chatId,
              errorCode: errorData?.code,
              errorMessage: errorData?.message,
              hasErrorData: !!errorData,
              errorTextLength: errorText.length,
            },
            'Fetch failed',
          );

          // Special handling for login-required errors
          if (errorData?.code === 'login_required:compare') {
            compareLogger.info(
              {
                chatId,
                modelCount: modelIds.length,
                errorCode: errorData.code,
                errorMessage: errorData.message,
              },
              'Showing login prompt for anonymous user rate limit',
            );
            throw new Error('LOGIN_REQUIRED_COMPARE');
          }

          // Special handling for rate limit errors
          if (errorData?.code === 'rate_limit:chat') {
            compareLogger.info(
              {
                chatId,
                modelCount: modelIds.length,
                errorCode: errorData.code,
                errorMessage: errorData.message,
              },
              'Showing upgrade prompt for authenticated user rate limit',
            );
            throw new Error('RATE_LIMIT_CHAT');
          }

          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (!response.body) {
          compareLogger.error(
            {
              chatId,
            },
            'No response body from server',
          );
          throw new Error('No response body');
        }

        compareLogger.debug(
          {
            chatId,
          },
          'Response body available, starting SSE reader',
        );

        // Create EventSource-like reader for SSE
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let eventCount = 0;

        compareLogger.debug(
          {
            chatId,
          },
          'Starting SSE reading loop',
        );

        while (true) {
          eventCount++;
          if (eventCount % 50 === 0) {
            compareLogger.debug(
              {
                eventCount,
                chatId,
              },
              'Processed SSE events',
            );
          }
          const { done, value } = await reader.read();
          if (done) break;

          // Append new chunk to buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete lines
          const lines = buffer.split('\n');
          // Keep the last line in buffer (might be incomplete)
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));
                compareLogger.debug(
                  {
                    eventType: event.type,
                    runId: event.runId,
                    modelId: event.modelId,
                  },
                  'Received SSE event',
                );
                handleSSEEvent(event);
              } catch (err) {
                compareLogger.error(
                  {
                    error: err instanceof Error ? err.message : String(err),
                    line: line.substring(0, 200), // First 200 chars for debugging
                  },
                  'Failed to parse SSE event',
                );
              }
            }
          }
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          // Special handling for login-required errors
          if (error.message === 'LOGIN_REQUIRED_COMPARE') {
            compareLogger.info(
              {
                chatId,
                modelCount: modelIds.length,
              },
              'Showing login toast for anonymous user rate limit',
            );

            // Show login prompt instead of error
            const { upgradeToast } = await import('@/components/toast');

            upgradeToast({
              title: 'Sign in to unlock unlimited comparisons',
              description:
                'Create an account to compare multiple AI models and get higher usage limits.',
              actionText: 'Sign In',
            });

            setState((prev) => ({
              ...prev,
              status: 'idle', // Reset to idle instead of failed
              isRunning: false,
            }));
            return;
          }

          // Special handling for rate limit errors (logged-in users)
          if (error.message === 'RATE_LIMIT_CHAT') {
            compareLogger.info(
              {
                chatId,
                modelCount: modelIds.length,
              },
              'Showing upgrade toast for authenticated user rate limit',
            );

            // Show upgrade prompt instead of error
            const { upgradeToast } = await import('@/components/toast');

            upgradeToast({
              title: "You've reached your daily message limit",
              description:
                'Upgrade to Pro for unlimited AI conversations and premium model access.',
              actionText: 'Upgrade to Pro',
            });

            setState((prev) => ({
              ...prev,
              status: 'idle', // Reset to idle instead of failed
              isRunning: false,
            }));
            return;
          }

          compareLogger.error(
            {
              error: error.message,
              stack: error.stack,
              chatId,
              modelCount: modelIds.length,
            },
            'Compare run failed',
          );

          setState((prev) => ({
            ...prev,
            status: 'failed',
            isRunning: false,
          }));
        }
      }
    },
    [chatId],
  );

  // Handle SSE events
  const handleSSEEvent = useCallback(
    (event: any) => {
      compareLogger.debug(
        {
          eventType: event.type,
          runId: event.runId,
          modelId: event.modelId,
        },
        'Processing SSE event',
      );

      switch (event.type) {
        case 'run_start':
          setState((prev) => ({
            ...prev,
            runId: event.runId,
          }));
          break;

        case 'model_start':
          setState((prev) => ({
            ...prev,
            byModelId: {
              ...prev.byModelId,
              [event.modelId]: {
                ...prev.byModelId[event.modelId],
                status: 'running',
                serverStartedAt: event.serverStartedAt,
              },
            },
          }));
          break;

        case 'delta':
          setState((prev) => {
            const newContent =
              (prev.byModelId[event.modelId]?.content || '') + event.textDelta;
            return {
              ...prev,
              byModelId: {
                ...prev.byModelId,
                [event.modelId]: {
                  ...prev.byModelId[event.modelId],
                  content: newContent,
                },
              },
            };
          });
          break;

        case 'reasoning_delta':
          setState((prev) => {
            const newReasoning =
              (prev.byModelId[event.modelId]?.reasoning || '') +
              event.reasoningDelta;
            return {
              ...prev,
              byModelId: {
                ...prev.byModelId,
                [event.modelId]: {
                  ...prev.byModelId[event.modelId],
                  reasoning: newReasoning,
                },
              },
            };
          });
          break;

        case 'model_end':
          setState((prev) => {
            const modelState = prev.byModelId[event.modelId];

            return {
              ...prev,
              byModelId: {
                ...prev.byModelId,
                [event.modelId]: {
                  ...modelState,
                  status: 'completed',
                  usage: event.usage,
                  serverCompletedAt: event.serverCompletedAt,
                  inferenceTimeMs: event.inferenceTimeMs,
                },
              },
            };
          });
          break;

        case 'model_error':
          setState((prev) => ({
            ...prev,
            byModelId: {
              ...prev.byModelId,
              [event.modelId]: {
                ...prev.byModelId[event.modelId],
                status: 'failed',
                error: event.error,
              },
            },
          }));
          break;

        case 'run_end': {
          compareLogger.info(
            {
              runId: event.runId,
              chatId,
              modelCount: event.results?.length || 0,
            },
            'Compare run completed',
          );

          // Capture the current state for optimistic updates
          let capturedState: CompareRunState | null = null;
          setState((prev) => {
            const newState = {
              ...prev,
              status: 'completed' as const,
              isRunning: false,
              isTransitioning: true, // Prevent UI flashes during transition
            };
            capturedState = newState;
            return newState;
          });

          // Immediately add the completed run to cache to prevent gap
          if (capturedState) {
            // Create the completed run object from captured state
            const completedRun = {
              id: (capturedState as CompareRunState).runId,
              prompt: (capturedState as CompareRunState).prompt,
              modelIds: (capturedState as CompareRunState).modelIds,
              status: 'completed' as const,
              createdAt: new Date().toISOString(),
              results: Object.entries(
                (capturedState as CompareRunState).byModelId,
              ).map(([modelId, modelState]) => ({
                modelId,
                status: (modelState as CompareModelState).status,
                content: (modelState as CompareModelState).content,
                reasoning: (modelState as CompareModelState).reasoning,
                usage: (modelState as CompareModelState).usage,
                error: (modelState as CompareModelState).error,
                serverStartedAt: (modelState as CompareModelState)
                  .serverStartedAt,
                serverCompletedAt: (modelState as CompareModelState)
                  .serverCompletedAt,
                inferenceTimeMs: (modelState as CompareModelState)
                  .inferenceTimeMs,
              })),
            };

            // Optimistically update the compareRuns cache immediately (unless disabled)
            if (!options?.disableOptimisticUpdates) {
              mutateCompareRuns(
                (currentData: CompareRunsListResponse | undefined) => {
                  if (!currentData) return currentData;

                  // Add the new completed run to the end of the list (chronological order)
                  return {
                    ...currentData,
                    items: [...currentData.items, completedRun],
                  };
                },
                false, // Don't revalidate from server
              );
            }

            // Preserve active card after completion; no auto-clear.
            // Still record for potential future uses (e.g., manual clear).
            pendingHandoffRunIdRef.current = (
              capturedState as CompareRunState
            ).runId;
          }
          break;
        }

        case 'heartbeat':
          // Keep-alive, no action needed
          break;
      }
    },
    [mutateCompareRuns],
  );

  // Cancel specific model
  const cancelModel = useCallback(
    async (modelId: string) => {
      if (!state.runId) return;

      try {
        await fetch('/api/compare/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runId: state.runId, modelId }),
        });

        setState((prev) => ({
          ...prev,
          byModelId: {
            ...prev.byModelId,
            [modelId]: {
              ...prev.byModelId[modelId],
              status: 'canceled',
            },
          },
        }));
      } catch (error) {
        console.error('Failed to cancel model:', error);
      }
    },
    [state.runId],
  );

  // Cancel all models
  const cancelAll = useCallback(async () => {
    if (!state.runId) return;

    try {
      // Abort the fetch request
      abortControllerRef.current?.abort();

      // Cancel on server
      await fetch('/api/compare/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: state.runId }),
      });

      setState((prev) => ({
        ...prev,
        status: 'canceled',
        isRunning: false,
        byModelId: Object.fromEntries(
          Object.entries(prev.byModelId).map(([modelId, modelState]) => [
            modelId,
            modelState.status === 'running'
              ? { ...modelState, status: 'canceled' as const }
              : modelState,
          ]),
        ),
      }));
    } catch (error) {
      console.error('Failed to cancel compare run:', error);
    }
  }, [state.runId]);

  // Load a specific compare run
  const loadCompareRun = useCallback(async (runId: string) => {
    try {
      const response = await fetch(`/api/compare/${runId}`);
      if (!response.ok) throw new Error('Failed to load compare run');

      const { run, results } = await response.json();

      const byModelId = results.reduce(
        (acc: Record<string, CompareModelState>, result: any) => {
          acc[result.modelId] = {
            status: result.status,
            content: result.content || '',
            reasoning: result.reasoning || '',
            usage: result.usage,
            error: result.error,
            serverStartedAt: result.serverStartedAt,
            serverCompletedAt: result.serverCompletedAt,
            inferenceTimeMs: result.inferenceTimeMs,
          };
          return acc;
        },
        {},
      );

      setState({
        runId: run.id,
        prompt: run.prompt,
        modelIds: run.modelIds,
        status: run.status,
        byModelId,
        isRunning: run.status === 'running',
        isTransitioning: false,
      });
    } catch (error) {
      console.error('Failed to load compare run:', error);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    // State
    ...state,
    compareRuns: compareRuns?.items || [],
    isLoadingRuns,

    // Actions
    startCompare,
    cancelModel,
    cancelAll,
    loadCompareRun,
    mutateCompareRuns,
  };
}
