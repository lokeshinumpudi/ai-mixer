'use client';

import type { Chat } from '@/lib/db/schema';
import type { ChatMessage } from '@/lib/types';
import { fetcher } from '@/lib/utils';
import useSWR from 'swr';

export interface ChatData {
  chat: Chat | null;
  messages: ChatMessage[];
  isLoading: boolean;
  error: any;
  mutate: () => Promise<any>;
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

  // Fetch messages data
  const {
    data: messagesData,
    error: messagesError,
    isLoading: messagesLoading,
    mutate: mutateMessages,
  } = useSWR<{ messages: ChatMessage[] }>(
    chatId ? `/api/chat/${chatId}/messages` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    },
  );

  const mutate = async () => {
    await Promise.all([mutateChat(), mutateMessages()]);
  };

  return {
    chat: chat || null,
    messages: messagesData?.messages || [],
    isLoading: chatLoading || messagesLoading,
    error: chatError || messagesError,
    mutate,
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
