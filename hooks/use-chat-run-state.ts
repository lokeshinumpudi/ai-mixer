'use client';

import { useMemo } from 'react';
import { useHistoricalChatData } from './use-historical-chat';
import { useStreamingCompare } from './use-streaming-compare';

export function useChatRunState(chatId: string, enableHistorical: boolean) {
  const historical = useHistoricalChatData(chatId, enableHistorical);
  const streaming = useStreamingCompare(chatId);

  // Merge historical runs with streaming runs (chronological): historical first, then streaming
  const items = useMemo(() => {
    const hist = historical.compareRuns.items || [];
    const live = streaming.items || [];
    return [...hist, ...live];
  }, [historical.compareRuns.items, streaming.items]);

  return {
    chat: historical.chat,
    compareRuns: {
      items,
      hasMore: historical.compareRuns.hasMore,
      nextCursor: historical.compareRuns.nextCursor,
    },
    votes: historical.votes,
    isLoading: historical.isLoading,
    error: historical.error,
    mutate: historical.mutate,
    // Streaming API surface for consumers
    addCompareRunFromStream: streaming.add,
    updateCompareRunFromStream: streaming.update,
    clearStreaming: streaming.clear,
    isStreamingMode: streaming.isStreaming,
  };
}
