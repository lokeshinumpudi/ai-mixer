'use client';

import type { Chat } from '@/lib/db/schema';
import type { ChatMessage } from '@/lib/types';
import { fetcher } from '@/lib/utils';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';

export interface ChatData {
  chat: Chat | null;
  messages: ChatMessage[];
  isLoading: boolean;
  error: any;
  hasMore: boolean;
  nextCursor: string | null;
  mutate: () => Promise<any>;
  loadMore: () => Promise<void>;
  isLoadingMore: boolean;
}

export function useChatData(chatId: string): ChatData {
  // Fetch chat data
  const {
    data: chat,
    error: chatError,
    isLoading: chatLoading,
    mutate: mutateChat,
  } = useSWR<Chat | null>(chatId ? `/api/chat/${chatId}` : null, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  });

  // First, check if this chat has compare runs
  const { data: compareRunsCheck, isLoading: isLoadingCompareCheck } = useSWR<{
    items: any[];
  }>(chatId ? `/api/compare?chatId=${chatId}&limit=1` : null, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  });

  const hasCompareRuns = (compareRunsCheck?.items?.length ?? 0) > 0;

  // Only fetch messages if there are NO compare runs
  // This prevents duplicate content when compare mode is active
  const {
    data: messagesData,
    error: messagesError,
    isLoading: messagesLoading,
    mutate: mutateMessages,
    size,
    setSize,
  } = useSWRInfinite<{
    messages: ChatMessage[];
    hasMore: boolean;
    nextCursor: string | null;
  }>(
    (pageIndex, previousPageData) => {
      if (!chatId) return null;

      // 🚫 SKIP regular message loading if compare runs exist
      if (hasCompareRuns) return null;

      // If this is the first page, don't pass a cursor
      if (pageIndex === 0) {
        return `/api/chat/${chatId}/messages?limit=20`;
      }

      // If there's no more data, don't fetch
      if (!previousPageData?.hasMore) return null;

      // Use the nextCursor from the previous page
      return `/api/chat/${chatId}/messages?limit=20&before=${previousPageData.nextCursor}`;
    },
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      // Start with the latest messages first
      initialSize: 1,
    },
  );

  // Flatten messages from all pages
  const allMessages = messagesData
    ? messagesData.flatMap((page) => page.messages)
    : [];

  const hasMore = messagesData?.[messagesData.length - 1]?.hasMore ?? false;
  const nextCursor =
    messagesData?.[messagesData.length - 1]?.nextCursor ?? null;
  const isLoadingMore = size > (messagesData?.length ?? 0);

  const loadMore = async () => {
    if (hasMore && !isLoadingMore) {
      await setSize(size + 1);
    }
  };

  const mutate = async () => {
    await Promise.all([mutateChat(), mutateMessages()]);
  };

  return {
    chat: chat || null,
    messages: hasCompareRuns ? [] : allMessages, // Return empty messages if compare runs exist
    isLoading:
      chatLoading ||
      isLoadingCompareCheck ||
      (!hasCompareRuns && messagesLoading),
    error: chatError || messagesError,
    hasMore: hasCompareRuns ? false : hasMore, // No pagination for compare mode
    nextCursor: hasCompareRuns ? null : nextCursor,
    mutate,
    loadMore: hasCompareRuns ? async () => {} : loadMore, // No-op for compare mode
    isLoadingMore: hasCompareRuns ? false : isLoadingMore,
  };
}

// Hook for creating new chats
export function useCreateChat() {
  const { mutate } = useSWR('/api/chat');

  const createChat = async (data: {
    title: string;
    visibility: 'public' | 'private';
  }) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to create chat');
    }

    const newChat = await response.json();

    // Invalidate the chat list to refetch
    mutate();

    return newChat;
  };

  return { createChat };
}
