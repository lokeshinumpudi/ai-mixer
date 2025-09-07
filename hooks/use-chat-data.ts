'use client';

import type { Chat } from '@/lib/db/schema';
import type { ChatMessage } from '@/lib/types';
import useSWR from 'swr';
import { useOptimizedChatData } from './use-optimized-chat-data';

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
  // 🚀 UNIFIED COMPARE ARCHITECTURE: Always use optimized data for existing chats
  const shouldFetchData =
    chatId &&
    chatId.length > 0 &&
    typeof window !== 'undefined' &&
    // Only fetch for existing chat pages, not root page with new UUIDs
    (window.location.pathname.startsWith('/chat/') ||
      (window.location.pathname !== '/' && chatId.length === 36)); // UUID length check

  const chatData = useOptimizedChatData(shouldFetchData ? chatId : '');

  // 🚀 UNIFIED COMPARE ARCHITECTURE: Everything is a compare run, no regular messages
  return {
    chat: chatData.chat || null,
    messages: [], // Always empty - everything is a compare run
    hasMore: false, // No regular message pagination
    nextCursor: null, // No regular message pagination
    isLoading: chatData.isLoading,
    error: null, // Errors handled by chatData
    mutate: chatData.mutate,
    loadMore: async () => {}, // No-op - no regular messages to load
    isLoadingMore: false, // No regular message pagination
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
