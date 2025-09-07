'use client';

import { useAuth } from '@/components/auth-provider';
import { Chat } from '@/components/chat';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { generateUUID } from '@/lib/utils';
import { useMemo } from 'react';

export default function Page() {
  const { user } = useAuth();
  // Generate UUID only once per component lifecycle to prevent chat replacement
  const id = useMemo(() => generateUUID(), []);

  return (
    <>
      <Chat
        key={id}
        id={id}
        initialMessages={[]}
        initialVisibilityType="private"
        isReadonly={false}
        user={user}
        autoResume={false}
      />
      <DataStreamHandler />
    </>
  );
}
