'use client';

import { ChatHeader } from '@/components/chat-header';

import { useAnonymousAuth } from '@/hooks/use-anonymous-auth';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { useAutoResume } from '@/hooks/use-auto-resume';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { useCompareRun } from '@/hooks/use-compare-run';
import { getDefaultModelForUser } from '@/lib/ai/models';
import type { Vote } from '@/lib/db/schema';
import { ChatSDKError } from '@/lib/errors';
import type { AppUser } from '@/lib/supabase/types';
import type { Attachment, ChatMessage } from '@/lib/types';
import { fetcher, fetchWithErrorHandlers, generateUUID } from '@/lib/utils';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { unstable_serialize } from 'swr/infinite';
import { useModels } from '../hooks/use-models';
import { Artifact } from './artifact';
import { useDataStream } from './data-stream-provider';
import { GoogleLoginCTA } from './google-login-cta';
import { Messages } from './messages';
import { MultimodalInput } from './multimodal-input';
import { getChatHistoryPaginationKey } from './sidebar-history';
import { toast, upgradeToast } from './toast';
type VisibilityType = 'private' | 'public';

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  user,
  autoResume,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  user: AppUser | null;
  autoResume: boolean;
}) {
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const {
    messageCount,
    incrementMessageCount,
    shouldShowLoginPrompt,
    user: authUser,
  } = useAnonymousAuth();

  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();

  // Use integrated models API that includes user settings
  const {
    userSettings,
    models,
    userType,
    compareModels,
    mode,
    isLoading: isModelsLoading,
  } = useModels();

  // Get current model from settings with fallbacks
  // Don't use initialChatModel while API is loading to avoid race conditions
  const currentModel = !isModelsLoading
    ? userSettings?.defaultModel ||
      initialChatModel ||
      getDefaultModelForUser(userType ?? 'anonymous')
    : userSettings?.defaultModel ||
      getDefaultModelForUser(userType ?? 'anonymous');

  const [input, setInput] = useState<string>('');

  // Compare mode state - default to true for seamless model selection
  const [isCompareMode, setIsCompareMode] = useState(true);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Reset initialization flag when chat changes
  useEffect(() => {
    setHasInitialized(false);
    setSelectedModelIds([]); // Clear selected models when changing chats
  }, [id]); // Reset when chatId changes

  // Initialize selectedModelIds from compareModels only after API data is loaded
  useEffect(() => {
    // Only initialize once the API data has loaded and we haven't initialized yet
    if (!isModelsLoading && !hasInitialized) {
      if (compareModels && compareModels.length > 0) {
        // Always prioritize compareModels from API response
        setSelectedModelIds(compareModels);
      } else if (currentModel) {
        // Fallback to current model if no compareModels are set
        setSelectedModelIds([currentModel]);
      }
      setHasInitialized(true);
    }
  }, [isModelsLoading, compareModels, currentModel, hasInitialized]);

  // Compare run hook
  const {
    startCompare,
    cancelModel,
    cancelAll,
    loadCompareRun,
    compareRuns,
    isLoadingRuns,
    ...compareState
  } = useCompareRun(id);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: '/api/chat', // All authenticated users (including anonymous) use the same API
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest({ messages, id, body }) {
        return {
          body: {
            id,
            message: messages.at(-1),
            selectedChatModel: currentModel,
            selectedVisibilityType: visibilityType,
            ...body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
      // Increment message count for anonymous users
      if (authUser?.is_anonymous !== false) {
        incrementMessageCount();
      }
    },
    onError: (error) => {
      console.error('Chat error:', error);

      if (error instanceof ChatSDKError) {
        if (error.type === 'rate_limit') {
          // Show upgrade toast for rate limiting errors
          upgradeToast({
            title: 'Message limit reached',
            description: error.message,
            actionText: 'Upgrade to Pro',
          });
        } else {
          toast({
            type: 'error',
            description: error.message,
          });
        }
      } else {
        // Handle non-ChatSDKError cases
        const errorMessage = error?.message || 'An unexpected error occurred';
        if (
          errorMessage.includes('rate_limit') ||
          errorMessage.includes('exceeded')
        ) {
          upgradeToast({
            title: 'Message limit reached',
            description: errorMessage,
            actionText: 'Upgrade to Pro',
          });
        } else {
          toast({
            type: 'error',
            description: errorMessage,
          });
        }
      }
    },
  });

  const searchParams = useSearchParams();
  const query = searchParams.get('query');

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  // Initialize compare mode with current model when available
  useEffect(() => {
    if (currentModel && selectedModelIds.length === 0) {
      setSelectedModelIds([currentModel]);
    }
  }, [currentModel, selectedModelIds.length]);

  const { data: votes } = useSWR<Array<Vote>>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher,
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);

  // Compare mode handlers
  const handleCompareModeChange = (enabled: boolean) => {
    setIsCompareMode(enabled);
    if (!enabled) {
      // When disabling compare mode (rare case), keep only the current model selected
      setSelectedModelIds(currentModel ? [currentModel] : []);
    } else {
      // When enabling compare mode, ensure current model is selected
      if (currentModel && !selectedModelIds.includes(currentModel)) {
        setSelectedModelIds((prev) =>
          prev.length > 0 ? [...prev, currentModel] : [currentModel],
        );
      }
    }
  };

  const handleSelectedModelIdsChange = (modelIds: string[]) => {
    setSelectedModelIds(modelIds);
    // Keep compare mode enabled - users can select 1, 2, or 3 models as needed
  };

  const handleStartCompare = useCallback(
    async (prompt: string, modelIds: string[]) => {
      try {
        if (modelIds.length === 1) {
          // Single model - use regular chat flow for normal experience
          sendMessage({
            role: 'user' as const,
            parts: [{ type: 'text', text: prompt }],
          });
        } else {
          // Multiple models - use compare API
          await startCompare({ prompt, modelIds });
        }
        // Clear input after starting
        setInput('');
      } catch (error) {
        console.error('Failed to start chat/comparison:', error);

        // Check if it's a rate limit error for compare functionality
        if (error instanceof Error && error.message.includes('429')) {
          upgradeToast({
            title: 'Compare limit reached',
            description:
              'Upgrade to Pro for unlimited model comparisons and 1000 messages per month.',
            actionText: 'Upgrade to Pro',
          });
        } else {
          toast({
            type: 'error',
            description: 'Failed to start chat. Please try again.',
          });
        }
      }
    },
    [startCompare, sendMessage, setInput],
  );

  const handleContinueWithModels = (modelIds: string[]) => {
    // Update selected models and keep compare mode enabled
    setSelectedModelIds(modelIds);
    // Focus on input for continuation
    // The input will be ready for the user to type their follow-up
  };

  // Handle query parameter from URL (e.g., shared links)
  useEffect(() => {
    if (query && !hasAppendedQuery) {
      // Use compare mode logic if multiple models are selected
      if (isCompareMode && selectedModelIds.length > 1) {
        handleStartCompare(query, selectedModelIds);
      } else {
        sendMessage({
          role: 'user' as const,
          parts: [{ type: 'text', text: query }],
        });
      }

      setHasAppendedQuery(true);
      window.history.replaceState({}, '', `/chat/${id}`);
    }
  }, [
    query,
    sendMessage,
    hasAppendedQuery,
    id,
    isCompareMode,
    selectedModelIds,
    handleStartCompare,
  ]);

  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader
          chatId={id}
          selectedVisibilityType={initialVisibilityType}
          isReadonly={isReadonly}
          user={user}
        />

        <Messages
          chatId={id}
          status={status}
          votes={votes}
          messages={messages}
          setMessages={setMessages}
          regenerate={regenerate}
          isReadonly={isReadonly}
          isArtifactVisible={isArtifactVisible}
          compareState={compareState}
          compareRuns={compareRuns}
          cancelModel={cancelModel}
          cancelAll={cancelAll}
          startCompare={startCompare}
        />

        {/* Google Login Prompt for Anonymous Users */}
        {shouldShowLoginPrompt && authUser?.is_anonymous !== false && (
          <div className="mx-auto px-6 py-4 w-full md:max-w-3xl">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                    You're almost at your message limit!
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    {messageCount >= 10
                      ? 'Sign in with Google to continue chatting with unlimited messages.'
                      : `${
                          10 - messageCount
                        } messages remaining. Sign in for unlimited access to all models.`}
                  </p>
                </div>
                <GoogleLoginCTA
                  variant="default"
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                />
              </div>
            </div>
          </div>
        )}

        <form className="flex mx-auto px-6 bg-background/95 backdrop-blur-sm pb-6 md:pb-8 gap-2 w-full md:max-w-3xl border-t border-border/30">
          {!isReadonly && messageCount < 10 && (
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              status={status}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages}
              setMessages={setMessages}
              sendMessage={sendMessage}
              selectedVisibilityType={visibilityType}
              user={user}
              selectedModelId={currentModel}
              isCompareMode={isCompareMode}
              onCompareModeChange={handleCompareModeChange}
              selectedModelIds={selectedModelIds}
              onSelectedModelIdsChange={handleSelectedModelIdsChange}
              onStartCompare={handleStartCompare}
              compareRuns={compareRuns}
              activeCompareMessage={compareState.status !== 'idle'}
              isModelsLoading={isModelsLoading}
            />
          )}
          {!isReadonly &&
            messageCount >= 10 &&
            authUser?.is_anonymous !== false && (
              <div className="flex-1 flex items-center justify-center py-4">
                <div className="text-center">
                  <p className="text-muted-foreground mb-4">
                    You've reached your message limit. Sign in to continue.
                  </p>
                  <GoogleLoginCTA />
                </div>
              </div>
            )}
        </form>
      </div>

      <Artifact
        chatId={id}
        input={input}
        setInput={setInput}
        status={status}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        sendMessage={sendMessage}
        messages={messages}
        setMessages={setMessages}
        regenerate={regenerate}
        votes={votes}
        isReadonly={isReadonly}
        selectedVisibilityType={visibilityType}
        user={user}
        selectedModelId={initialChatModel}
      />
    </>
  );
}
