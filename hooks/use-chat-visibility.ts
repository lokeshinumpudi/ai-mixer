'use client';

import { updateChatVisibility } from '@/app/(chat)/actions';
import type { ChatHistory } from '@/components/sidebar-history';
import type { VisibilityType } from '@/components/visibility-selector';
import { useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';

export function useChatVisibility({
  chatId,
  initialVisibilityType,
}: {
  chatId: string;
  initialVisibilityType: VisibilityType;
}) {
  const { mutate, cache } = useSWRConfig();
  // Find any first history page in cache (keys are user-scoped)
  let history: ChatHistory | undefined;
  try {
    for (const key of (cache as any).keys?.() || []) {
      if (typeof key === 'string' && key.startsWith('/api/history')) {
        const entry = (cache as any).get(key);
        history = entry?.data as ChatHistory | undefined;
        if (history) break;
      }
    }
  } catch {
    // no-op
  }

  const { data: localVisibility, mutate: setLocalVisibility } = useSWR(
    `${chatId}-visibility`,
    null,
    {
      fallbackData: initialVisibilityType,
    },
  );

  const visibilityType = useMemo(() => {
    if (!history) return localVisibility;
    const chat = history.chats.find((chat) => chat.id === chatId);
    if (!chat) return 'private';
    return chat.visibility;
  }, [history, chatId, localVisibility]);

  const setVisibilityType = (updatedVisibilityType: VisibilityType) => {
    setLocalVisibility(updatedVisibilityType);
    // Revalidate all history keys regardless of user scope
    mutate(
      (key) => typeof key === 'string' && key.startsWith('/api/history'),
      undefined,
      { revalidate: true },
    );

    updateChatVisibility({
      chatId: chatId,
      visibility: updatedVisibilityType,
    });
  };

  return { visibilityType, setVisibilityType };
}
