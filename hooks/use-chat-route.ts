'use client';

import { useParams, usePathname } from 'next/navigation';

export function useChatRoute() {
  const params = useParams();
  const pathname = usePathname();

  const chatId = (params as any)?.id as string | undefined;
  const isChatRoute = pathname?.startsWith('/chat/') ?? false;

  return { chatId, pathname: pathname || '', isChatRoute };
}
