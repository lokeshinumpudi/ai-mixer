'use client';

import { useAuth } from '@/components/auth-provider';
import type { Chat } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';
import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';

// No localStorage needed - pure in-memory approach

/**
 * 🚀 STREAM-FIRST CHAT ARCHITECTURE
 *
 * Simple in-memory approach that eliminates race conditions:
 * - New chat: Stream data → In-memory state → Continue chatting in memory
 * - Switch chat: New in-memory state for new chat
 * - Load existing chat: API call → Load history → Continue in memory
 * - No localStorage complexity, pure in-memory state management
 */

export interface StreamFirstChatData {
  chat: Chat | null;
  compareRuns: {
    items: any[];
    hasMore: boolean;
    nextCursor: string | null;
  };
  votes: any[];
  isLoading: boolean;
  error: any;
  // Stream-first methods
  addCompareRunFromStream: (run: any) => void;
  updateCompareRunFromStream: (runId: string, updates: any) => void;
  mutate: () => Promise<any>; // For manual refresh when needed
  isStreamingMode: boolean; // True when actively streaming
}

export function useStreamFirstChat(chatId: string): StreamFirstChatData {
  const { user, loading: authLoading } = useAuth();

  // 🧠 Pure in-memory state - no persistence needed
  const [clientCompareRuns, setClientCompareRuns] = useState<any[]>([]);
  const [isStreamingMode, setIsStreamingMode] = useState(false);
  const [hasLoadedHistorical, setHasLoadedHistorical] = useState(false);

  // Track previous chatId to avoid unnecessary resets
  const prevChatIdRef = useRef<string>('');

  // Determine if we're on a /chat/[id] route AFTER mount to avoid timing issues on first navigation
  const [isOnChatRoute, setIsOnChatRoute] = useState<boolean>(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnChatRoute(window.location.pathname.startsWith('/chat/'));
    }
  }, []);

  // Always fetch historical data on /chat/[id] routes with a valid UUID.
  // Streaming/new-chat will simply return empty history (which is fine).
  const shouldFetchHistorical =
    !!chatId && chatId.length === 36 && isOnChatRoute;

  // Historical data fetch (only on page load)
  const { data, error, isLoading, mutate } = useSWR<{
    chat: Chat;
    compareRuns: { items: any[]; hasMore: boolean; nextCursor: string | null };
    votes: any[];
  }>(shouldFetchHistorical ? `/api/chat/${chatId}/data` : null, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false, // Don't refetch during active session
    dedupingInterval: 60000, // 1 minute
    onSuccess: (data) => {
      if (data?.compareRuns?.items) {
        // Load historical data into in-memory state
        setClientCompareRuns(data.compareRuns.items);
        setHasLoadedHistorical(true);
      }
    },
  });

  // Fallback hydration: if SWR returns data via cache, ensure we populate state
  useEffect(() => {
    if (data?.compareRuns?.items && data.compareRuns.items.length > 0) {
      setClientCompareRuns(data.compareRuns.items);
      setHasLoadedHistorical(true);
    }
  }, [data?.compareRuns?.items]);

  // 🔄 Reset state when switching to a DIFFERENT chat
  useEffect(() => {
    const prevChatId = prevChatIdRef.current;

    // Only reset if we're switching between different chats AND both are actual chat IDs
    // This prevents reset when navigating from root (new UUID) to existing chat
    if (prevChatId && prevChatId !== chatId) {
      const isPrevChatReal =
        typeof window !== 'undefined' &&
        window.location.pathname.includes(prevChatId);
      const isCurrentChatReal =
        typeof window !== 'undefined' &&
        window.location.pathname.includes(chatId);

      console.log('🔄 Chat ID change detected:', {
        prevChatId,
        chatId,
        isPrevChatReal,
        isCurrentChatReal,
        pathname: window.location.pathname,
        willReset: isPrevChatReal && isCurrentChatReal,
      });

      // Only reset when switching between two real chats (not from root to chat)
      if (isPrevChatReal && isCurrentChatReal) {
        console.log('🔄 Resetting state for chat switch');
        // Clear in-memory state when switching between different existing chats
        setClientCompareRuns([]);
        setIsStreamingMode(false);
        setHasLoadedHistorical(false);
      }
    }

    // Update the ref for next comparison
    prevChatIdRef.current = chatId;
  }, [chatId]);

  // Add compare run from stream (during active chat)
  const addCompareRunFromStream = useCallback((run: any) => {
    setIsStreamingMode(true);
    setClientCompareRuns((prev) => [...prev, run]);
  }, []);

  // Update compare run from stream (during streaming)
  const updateCompareRunFromStream = useCallback(
    (runId: string, updates: any) => {
      setClientCompareRuns((prev) =>
        prev.map((run) => (run.id === runId ? { ...run, ...updates } : run)),
      );
    },
    [],
  );

  // Listen for completed compare runs from stream
  useEffect(() => {
    const handleCompareRunCompleted = (event: CustomEvent) => {
      const { chatId: eventChatId, completedRun } = event.detail;

      // Only handle events for this chat
      if (eventChatId === chatId) {
        addCompareRunFromStream(completedRun);
      }
    };

    window.addEventListener(
      'compare-run-completed',
      handleCompareRunCompleted as EventListener,
    );

    return () => {
      window.removeEventListener(
        'compare-run-completed',
        handleCompareRunCompleted as EventListener,
      );
    };
  }, [chatId, addCompareRunFromStream]);

  // Reset streaming mode after a delay (when stream completes)
  useEffect(() => {
    if (isStreamingMode) {
      const timer = setTimeout(() => {
        setIsStreamingMode(false);
      }, 3000); // 3 seconds after last stream activity

      return () => clearTimeout(timer);
    }
  }, [isStreamingMode, clientCompareRuns.length]);

  const result = {
    chat: data?.chat || null,
    compareRuns: {
      items: clientCompareRuns,
      hasMore: data?.compareRuns?.hasMore || false,
      nextCursor: data?.compareRuns?.nextCursor || null,
    },
    votes: data?.votes || [],
    isLoading: authLoading || isLoading,
    error: error,
    // Stream-first methods
    addCompareRunFromStream,
    updateCompareRunFromStream,
    mutate: mutate, // Expose SWR mutate for manual refresh
    isStreamingMode,
  };

  return result;
}
