import { Chat } from '@/components/chat';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { getDefaultModelForUser } from '@/lib/ai/models';
import { createClient } from '@/lib/supabase/server';
import { generateUUID } from '@/lib/utils';

export default async function Page() {
  const supabase = await createClient();

  // Try to get existing user
  let { data, error } = await supabase.auth.getUser();

  // If no user exists, create anonymous user
  if (error || !data?.user) {
    const { data: anonData, error: anonError } =
      await supabase.auth.signInAnonymously();

    if (anonError) {
      console.error('Failed to create anonymous user:', anonError);
      // Fallback to guest mode without Supabase user
      data = { user: null };
    } else {
      data = anonData;
    }
  }

  const id = generateUUID();
  const defaultModel = getDefaultModelForUser('anonymous');

  // Transform Supabase user to our AppUser format or create guest user
  const user = data?.user
    ? {
        id: data.user.id,
        email: data.user.email,
        user_metadata: {
          user_type: data.user.is_anonymous
            ? ('anonymous' as const)
            : ('free' as const),
          created_via: data.user.is_anonymous
            ? ('anonymous' as const)
            : ('google' as const),
        },
        is_anonymous: data.user.is_anonymous || false,
      }
    : {
        id: `guest-${Date.now()}`,
        email: undefined,
        user_metadata: {
          user_type: 'anonymous' as const,
          created_via: 'anonymous' as const,
        },
        is_anonymous: true,
      };

  return (
    <>
      <Chat
        key={id}
        id={id}
        initialMessages={[]}
        initialChatModel={defaultModel}
        initialVisibilityType="private"
        isReadonly={false}
        user={user}
        autoResume={false}
      />
      <DataStreamHandler />
    </>
  );
}
