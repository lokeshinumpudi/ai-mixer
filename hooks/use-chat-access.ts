'use client';

import { useSupabaseAuth } from '@/hooks/use-supabase-auth';
import type { Chat } from '@/lib/db/schema';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export interface ChatAccessResult {
  hasAccess: boolean;
  isLoading: boolean;
  isOwner: boolean;
  error: string | null;
}

export function useChatAccess(
  chat: Chat | null,
  chatId: string,
  chatError?: any,
): ChatAccessResult {
  const { user, loading } = useSupabaseAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const isLoading = loading;

  // Check access based on chat visibility and ownership
  const hasAccess = (() => {
    if (isLoading) return false;
    if (!user) return false;
    if (chatError) return false; // If there's an error fetching chat, no access
    if (!chat) return false; // If chat doesn't exist, no access

    if (chat.visibility === 'public') return true;
    if (chat.visibility === 'private' && chat.userId === user.id) return true;

    return false;
  })();

  const isOwner = chat && user ? chat.userId === user.id : false;

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        // Redirect to login if not authenticated
        router.push('/login');
        setError('Authentication required');
      } else if (chatError) {
        // Handle API errors (404, 403, etc.)
        if (chatError.status === 404) {
          setError('Chat not found');
        } else if (chatError.status === 403) {
          setError('Access denied');
        } else {
          setError('Failed to load chat');
        }
      } else if (chat && !hasAccess) {
        // Chat exists but user doesn't have access
        setError('Access denied');
      } else {
        setError(null);
      }
    }
  }, [isLoading, user, chat, hasAccess, chatError, router]);

  return {
    hasAccess,
    isLoading,
    isOwner,
    error,
  };
}

// Hook for determining read-only status
export function useChatReadOnly(chat: Chat | null, user: any): boolean {
  if (!chat || !user) return true;

  // Chat owner can always edit
  if (chat.userId === user.id) return false;

  // Non-owners can only view public chats in read-only mode
  return chat.visibility !== 'public';
}

// Hook for creating new chats with proper navigation
export function useChatNavigation() {
  const router = useRouter();

  const navigateToChat = (chatId: string) => {
    router.push(`/chat/${chatId}`);
  };

  const navigateToNewChat = () => {
    // Generate a new UUID for the chat
    const newChatId = crypto.randomUUID();
    router.push(`/chat/${newChatId}`);
  };

  const navigateHome = () => {
    router.push('/');
  };

  return {
    navigateToChat,
    navigateToNewChat,
    navigateHome,
  };
}
