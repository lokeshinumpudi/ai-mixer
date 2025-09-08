'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export interface NavigationState {
  currentPath: string;
  isChatPage: boolean;
  chatId: string | null;
  isNewChat: boolean;
  queryParams: URLSearchParams;
}

export function useClientNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse current navigation state
  const navigationState: NavigationState = {
    currentPath: pathname,
    isChatPage: pathname.startsWith('/chat/'),
    chatId: pathname.startsWith('/chat/')
      ? pathname.split('/')[2] || null
      : null,
    isNewChat: pathname === '/',
    queryParams: searchParams,
  };

  // Navigation functions
  const navigateToChat = useCallback(
    (chatId: string, options?: { replace?: boolean }) => {
      const url = `/chat/${chatId}`;
      if (options?.replace) {
        router.replace(url);
      } else {
        router.push(url);
      }
    },
    [router],
  );

  const navigateToNewChat = useCallback(
    (options?: { replace?: boolean }) => {
      if (options?.replace) {
        router.replace('/');
      } else {
        router.push('/');
      }
    },
    [router],
  );

  const navigateToSettings = useCallback(
    (options?: { replace?: boolean }) => {
      const url = '/settings';
      if (options?.replace) {
        router.replace(url);
      } else {
        router.push(url);
      }
    },
    [router],
  );

  const navigateToPricing = useCallback(
    (options?: { replace?: boolean }) => {
      const url = '/pricing';
      if (options?.replace) {
        router.replace(url);
      } else {
        router.push(url);
      }
    },
    [router],
  );

  const navigateBack = useCallback(() => {
    router.back();
  }, [router]);

  const navigateForward = useCallback(() => {
    router.forward();
  }, [router]);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  // Utility functions
  const isActiveRoute = useCallback(
    (route: string) => {
      return pathname === route;
    },
    [pathname],
  );

  const getQueryParam = useCallback(
    (key: string) => {
      return searchParams.get(key);
    },
    [searchParams],
  );

  const setQueryParam = useCallback(
    (key: string, value: string) => {
      const newSearchParams = new URLSearchParams(searchParams.toString());
      newSearchParams.set(key, value);
      router.replace(`${pathname}?${newSearchParams.toString()}`);
    },
    [searchParams, router, pathname],
  );

  const removeQueryParam = useCallback(
    (key: string) => {
      const newSearchParams = new URLSearchParams(searchParams.toString());
      newSearchParams.delete(key);
      router.replace(`${pathname}?${newSearchParams.toString()}`);
    },
    [searchParams, router, pathname],
  );

  return {
    // State
    navigationState,

    // Navigation functions
    navigateToChat,
    navigateToNewChat,
    navigateToSettings,
    navigateToPricing,
    navigateBack,
    navigateForward,
    refresh,

    // Utility functions
    isActiveRoute,
    getQueryParam,
    setQueryParam,
    removeQueryParam,
  };
}

// Hook for managing chat-specific navigation
export function useChatNavigation() {
  const { navigationState, navigateToChat, navigateToNewChat } =
    useClientNavigation();

  const createNewChat = useCallback(() => {
    // Generate a new UUID for the chat
    const newChatId = crypto.randomUUID();
    navigateToChat(newChatId);
  }, [navigateToChat]);

  const switchToChat = useCallback(
    (chatId: string) => {
      if (chatId !== navigationState.chatId) {
        navigateToChat(chatId);
      }
    },
    [navigateToChat, navigationState.chatId],
  );

  const goToNewChat = useCallback(() => {
    navigateToNewChat();
  }, [navigateToNewChat]);

  return {
    currentChatId: navigationState.chatId,
    isInChat: navigationState.isChatPage,
    isNewChatPage: navigationState.isNewChat,
    createNewChat,
    switchToChat,
    goToNewChat,
  };
}
