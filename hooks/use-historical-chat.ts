'use client';

import type { Chat } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';
import useSWR from 'swr';

export interface HistoricalChatData {
  chat: Chat | null;
  compareRuns: { items: any[]; hasMore: boolean; nextCursor: string | null };
  votes: any[];
  isLoading: boolean;
  error: any;
  mutate: () => Promise<any>;
}

export function useHistoricalChatData(
  chatId: string | undefined,
  enabled: boolean,
): HistoricalChatData {
  const key =
    enabled && chatId && chatId.length === 36
      ? `/api/chat/${chatId}/data`
      : null;

  const { data, error, isLoading, mutate } = useSWR<{
    chat: Chat;
    compareRuns: { items: any[]; hasMore: boolean; nextCursor: string | null };
    votes: any[];
  }>(key, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    keepPreviousData: true,
  });

  return {
    chat: data?.chat || null,
    compareRuns: data?.compareRuns || {
      items: [],
      hasMore: false,
      nextCursor: null,
    },
    votes: data?.votes || [],
    isLoading: Boolean(isLoading),
    error,
    mutate,
  };
}
