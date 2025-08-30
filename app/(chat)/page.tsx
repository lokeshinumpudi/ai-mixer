import { cookies } from 'next/headers';

import { Chat } from '@/components/chat';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { getDefaultModelForUser } from '@/lib/ai/models';
import { generateUUID } from '@/lib/utils';
import { redirect } from 'next/navigation';
import { auth } from '../(auth)/auth';

export default async function Page() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const id = generateUUID();

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get('chat-model');

  // Get default model based on user's plan
  const defaultModel = getDefaultModelForUser(session.user.type);

  if (!modelIdFromCookie) {
    return (
      <>
        <Chat
          key={id}
          id={id}
          initialMessages={[]}
          initialChatModel={defaultModel}
          initialVisibilityType="private"
          isReadonly={false}
          session={session}
          autoResume={false}
        />
        <DataStreamHandler />
      </>
    );
  }

  return (
    <>
      <Chat
        key={id}
        id={id}
        initialMessages={[]}
        initialChatModel={modelIdFromCookie.value}
        initialVisibilityType="private"
        isReadonly={false}
        session={session}
        autoResume={false}
      />
      <DataStreamHandler />
    </>
  );
}
