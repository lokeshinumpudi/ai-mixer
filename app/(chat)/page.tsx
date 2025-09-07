'use client';

import { useAuth } from '@/components/auth-provider';
import { Chat } from '@/components/chat';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { generateUUID } from '@/lib/utils';

export default function Page() {
  const { user } = useAuth();
  const id = generateUUID();

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
