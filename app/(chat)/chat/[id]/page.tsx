'use client';

import { useSupabaseAuth } from '@/hooks/use-supabase-auth';
import { useParams, useRouter } from 'next/navigation';

import { Chat } from '@/components/chat';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { useChatAccess, useChatReadOnly } from '@/hooks/use-chat-access';
import { useChatData } from '@/hooks/use-chat-data';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';

export default function Page() {
  const params = useParams();
  const router = useRouter();
  const { user, loading } = useSupabaseAuth();
  const id = params.id as string;

  const { chat, messages, isLoading, error, hasMore, loadMore, isLoadingMore } =
    useChatData(id);
  const {
    hasAccess,
    isLoading: accessLoading,
    error: accessError,
  } = useChatAccess(chat, id, error);
  const isReadonly = useChatReadOnly(chat, user);

  // Show loading state
  if (loading || isLoading || accessLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full size-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  // Show error state
  if (error || accessError) {
    const errorMessage =
      accessError || error?.message || error || 'An error occurred';

    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {accessError === 'Chat not found'
              ? 'Chat Not Found'
              : 'Access Error'}
          </h2>
          <p className="text-gray-600 mb-6 max-w-md">{errorMessage}</p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Don't render until we have user, access, and chat data
  if (!user || !hasAccess || !chat) {
    return null;
  }

  return (
    <>
      <Chat
        id={chat.id}
        initialMessages={messages}
        initialChatModel={DEFAULT_CHAT_MODEL}
        initialVisibilityType={chat.visibility}
        isReadonly={isReadonly}
        user={user}
        autoResume={true}
        hasMore={hasMore}
        loadMore={loadMore}
        isLoadingMore={isLoadingMore}
      />
      <DataStreamHandler />
    </>
  );
}
