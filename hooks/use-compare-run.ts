'use client';

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

export function useCompareRun(chatId: string) {
  const [state, setState] = useState<CompareRunState>({
    runId: null,
    prompt: '',
    modelIds: [],
    status: 'idle',
    byModelId: {},
    isRunning: false,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // SWR for listing compare runs for this chat
  const {
    data: compareRuns,
    mutate: mutateCompareRuns,
    isLoading: isLoadingRuns,
  } = useSWR<CompareRunsListResponse>(
    chatId ? `/api/compare?chatId=${chatId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    },
  );

  // Start a new compare run
  const startCompare = useCallback(
    async ({ prompt, modelIds }: { prompt: string; modelIds: string[] }) => {
      if (!chatId || modelIds.length === 0) return;

      // Reset state
      const initialByModelId = modelIds.reduce(
        (acc, modelId) => {
          acc[modelId] = { ...initialModelState, status: 'running' };
          return acc;
        },
        {} as Record<string, CompareModelState>,
      );

      setState({
        runId: null,
        prompt,
        modelIds,
        status: 'running',
        byModelId: initialByModelId,
        isRunning: true,
      });

      try {
        // Create abort controller for this run
        abortControllerRef.current = new AbortController();

        // Start SSE stream
        const response = await fetch('/api/compare/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, prompt, modelIds }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        // Create EventSource-like reader for SSE
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
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
                handleSSEEvent(event);
              } catch (err) {
                console.warn('Failed to parse SSE event:', line);
              }
            }
          }
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Compare run failed:', error);
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
          // Capture the current state for optimistic updates
          let capturedState: CompareRunState | null = null;
          setState((prev) => {
            capturedState = {
              ...prev,
              status: 'completed',
              isRunning: false,
            };
            return capturedState;
          });

          // Optimistically add the completed run to the list instead of refreshing
          // This prevents layout shifts and provides smooth transitions
          setTimeout(() => {
            if (!capturedState) return;

            // Create the completed run object from captured state
            const completedRun = {
              id: capturedState.runId,
              prompt: capturedState.prompt,
              modelIds: capturedState.modelIds,
              status: 'completed' as const,
              createdAt: new Date().toISOString(),
              results: Object.entries(capturedState.byModelId).map(
                ([modelId, modelState]) => ({
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
                }),
              ),
            };

            // Optimistically update the compareRuns cache
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

            // Clear the active state
            setState({
              runId: null,
              prompt: '',
              modelIds: [],
              status: 'idle',
              byModelId: {},
              isRunning: false,
            });
          }, 500);
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
