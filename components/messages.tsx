import { useMessages } from '@/hooks/use-messages';
import type { Vote } from '@/lib/db/schema';
import type { ChatMessage } from '@/lib/types';
import { cn } from '@/lib/utils';
import type { UseChatHelpers } from '@ai-sdk/react';
import equal from 'fast-deep-equal';
import { motion } from 'framer-motion';
import { memo, useEffect, useMemo, useRef } from 'react';
import { CompareMessage, type CompareMessageData } from './compare-message';
import { useDataStream } from './data-stream-provider';
import { Greeting } from './greeting';
import { PreviewMessage, ThinkingMessage } from './message';
import { SuggestedActions } from './suggested-actions';

interface MessagesProps {
  chatId: string;
  status: UseChatHelpers<ChatMessage>['status'];
  votes: Array<Vote> | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  regenerate: UseChatHelpers<ChatMessage>['regenerate'];
  isReadonly: boolean;
  isArtifactVisible: boolean;
  // Compare state props
  compareState: {
    runId: string | null;
    prompt: string;
    status: 'idle' | 'running' | 'completed' | 'canceled' | 'failed';
    modelIds: string[];
    byModelId: Record<
      string,
      {
        status: string;
        content: string;
        reasoning?: string;
        usage?: any;
        error?: string;
      }
    >;
    isTransitioning?: boolean;
  };
  compareRuns: any[];
  cancelModel: (modelId: string) => void;
  cancelAll: () => void;
  startCompare: (params: { prompt: string; modelIds: string[] }) => void;
  isLoadingRuns?: boolean;
  // Progressive loading props
  hasMore?: boolean;
  loadMore?: () => Promise<void>;
  isLoadingMore?: boolean;
  // SuggestedActions props
  sendMessage?: UseChatHelpers<ChatMessage>['sendMessage'];
  selectedVisibilityType: 'private' | 'public';
  selectedModelIds?: string[];
  onStartCompare?: (prompt: string, modelIds: string[]) => void;
}

function PureMessages({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  regenerate,
  isReadonly,
  compareState,
  compareRuns,
  cancelModel,
  cancelAll,
  startCompare,
  isLoadingRuns = false,
  hasMore = false,
  loadMore,
  isLoadingMore = false,
  sendMessage,
  selectedVisibilityType,
  selectedModelIds = [],
  onStartCompare,
}: MessagesProps) {
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    onViewportEnter,
    onViewportLeave,
    hasSentMessage,
    scrollToBottom,
  } = useMessages({
    chatId,
    status,
  });

  // 🚀 UNIFIED COMPARE ARCHITECTURE: Everything is a compare run
  // Data comes from parent Chat component via props (no fallbacks needed)
  const hasAnyCompareRuns = compareRuns.length > 0;
  const effectiveMessages = useMemo(
    () => (hasAnyCompareRuns ? [] : messages),
    [hasAnyCompareRuns, messages],
  );

  // Compare state is now passed from parent Chat component

  useDataStream();
  // Create compare message data from active compare state
  const activeCompareMessage: CompareMessageData | null = useMemo(() => {
    if (compareState.status === 'idle') return null;

    const activeId = compareState.runId;
    // Always keep the active card visible even after completion.
    // Historical list below will exclude this run to avoid duplication.

    return {
      id: activeId ? `active-${activeId}` : 'active-compare',
      prompt: compareState.prompt || '',
      modelIds: compareState.modelIds,
      status: compareState.status,
      results: compareState.byModelId as any, // Type cast for now
    };
  }, [
    compareState.status,
    compareState.runId,
    compareState.prompt,
    compareState.modelIds,
    compareState.byModelId,
  ]);

  // Smart scroll management for compare messages
  const prevActiveMessageRef = useRef<CompareMessageData | null>(null);

  useEffect(() => {
    // Scroll to active compare message when it first appears or when it starts running
    if (activeCompareMessage && !prevActiveMessageRef.current) {
      // New active compare message appeared - scroll to it
      setTimeout(() => scrollToBottom('smooth'), 100);
    } else if (
      activeCompareMessage &&
      prevActiveMessageRef.current &&
      activeCompareMessage.status === 'running' &&
      prevActiveMessageRef.current.status !== 'running'
    ) {
      // Compare message transitioned to running state - scroll to it
      setTimeout(() => scrollToBottom('smooth'), 100);
    }

    // Update ref for next comparison
    prevActiveMessageRef.current = activeCompareMessage;
  }, [activeCompareMessage, scrollToBottom]);

  // Progressive loading: Load more messages when scrolling to top
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || !loadMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 },
    );

    if (topRef.current) {
      observer.observe(topRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadMore, isLoadingMore]);

  // Don't auto-scroll when historical compare runs are loaded
  // This prevents jarring behavior after compare completion

  // Memoize the greeting condition to prevent unnecessary remounts
  // Only show greeting when we're absolutely sure the app is stable
  const shouldShowGreeting = useMemo(() => {
    // Only show greeting if we have no content AND we're not in any loading states
    const hasNoMessages = effectiveMessages.length === 0;
    const hasNoCompareRuns = compareRuns.length === 0;
    const hasNoActiveCompare = !activeCompareMessage;
    const isNotLoadingRuns = !isLoadingRuns;
    const isNotTransitioning = !compareState.isTransitioning;

    // Extra conservative check: only show if we've been stable for a while
    // This prevents flickering during initial data loading
    return (
      hasNoMessages &&
      hasNoCompareRuns &&
      hasNoActiveCompare &&
      isNotLoadingRuns &&
      isNotTransitioning &&
      compareState.status === 'idle' // Only show when completely idle
    );
  }, [
    effectiveMessages.length,
    compareRuns.length,
    activeCompareMessage,
    isLoadingRuns,
    compareState.isTransitioning,
    compareState.status, // Added this to make it more conservative
  ]);

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col min-w-0 gap-8 flex-1 overflow-y-scroll pt-6 pb-4 relative"
    >
      {/* Invisible element at top for scroll detection */}
      {hasMore && (
        <div ref={topRef} className="h-4 flex items-center justify-center">
          {isLoadingMore && (
            <div className="animate-spin rounded-full size-4 border-b-2 border-gray-900" />
          )}
        </div>
      )}

      {shouldShowGreeting && (
        <div className="flex flex-col items-center gap-8 py-8">
          <Greeting key={`greeting-${chatId}`} />
          <div className="w-full max-w-2xl px-4">
            <SuggestedActions
              chatId={chatId}
              selectedVisibilityType={selectedVisibilityType}
              selectedModelIds={selectedModelIds}
              onStartCompare={onStartCompare}
              key={`suggestions-${chatId}`} // Stable key to prevent remounts
            />
          </div>
        </div>
      )}

      {/* Regular messages */}
      {useMemo(
        () =>
          effectiveMessages.map((message, index) => (
            <PreviewMessage
              key={`msg-${message.id}`}
              chatId={chatId}
              message={message}
              isLoading={
                status === 'streaming' && effectiveMessages.length - 1 === index
              }
              vote={
                votes
                  ? votes.find((vote) => vote.messageId === message.id)
                  : undefined
              }
              setMessages={setMessages}
              regenerate={regenerate}
              isReadonly={isReadonly}
              requiresScrollPadding={
                hasSentMessage && index === effectiveMessages.length - 1
              }
            />
          )),
        [
          effectiveMessages,
          status,
          votes,
          hasSentMessage,
          chatId,
          setMessages,
          regenerate,
          isReadonly,
        ],
      )}

      {/* Historical compare runs (older first) - exclude active run to avoid duplication */}
      {useMemo(
        () =>
          compareRuns
            .filter((run: any) => run.id !== compareState.runId)
            .map((run) => (
              <motion.div
                key={`historical-${run.id}`}
                initial={{ y: 8, opacity: 0, scale: 0.98 }}
                animate={{
                  y: 0,
                  opacity: 1,
                  scale: 1,
                  transition: {
                    duration: 0.5,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  },
                }}
                className={cn(
                  'w-full mx-auto',
                  // For single model, use full width on mobile, max-width on desktop
                  run.modelIds.length === 1
                    ? 'max-w-[100vw] px-2 md:max-w-4xl md:px-4'
                    : 'max-w-5xl px-4',
                )}
              >
                <CompareMessage
                  data={{
                    id: run.id,
                    prompt: run.prompt,
                    modelIds: run.modelIds,
                    status: run.status,
                    results:
                      run.results?.reduce(
                        (acc: CompareMessageData['results'], result: any) => {
                          acc[result.modelId] = {
                            status: result.status,
                            content: result.content || '',
                            reasoning: result.reasoning || '',
                            usage: result.usage,
                            error: result.error,
                            serverStartedAt: result.serverStartedAt,
                            serverCompletedAt: result.serverCompletedAt,
                            inferenceTimeMs: result.inferenceTimeMs,
                          };
                          return acc;
                        },
                        {} as CompareMessageData['results'],
                      ) || {},
                  }}
                />
              </motion.div>
            )),
        [compareRuns, compareState.runId],
      )}

      {/* Active compare run (always at bottom) */}
      {activeCompareMessage && (
        <motion.div
          key={`active-${activeCompareMessage.id}`}
          initial={{ y: 8, opacity: 0, scale: 0.98 }}
          animate={{
            y: 0,
            opacity: 1,
            scale: 1,
            transition: {
              duration: 0.5,
              ease: [0.25, 0.46, 0.45, 0.94],
            },
          }}
          className={cn(
            'w-full mx-auto',
            // For single model, use full width on mobile, max-width on desktop
            activeCompareMessage.modelIds.length === 1
              ? 'max-w-[100vw] px-2 md:max-w-4xl md:px-4'
              : 'max-w-5xl px-4',
          )}
        >
          <CompareMessage
            data={activeCompareMessage}
            onCancelModel={cancelModel}
            onCancelAll={cancelAll}
            onRetry={() =>
              startCompare({
                prompt: activeCompareMessage.prompt,
                modelIds: activeCompareMessage.modelIds,
              })
            }
          />
        </motion.div>
      )}

      {status === 'submitted' &&
        messages.length > 0 &&
        messages[messages.length - 1].role === 'user' && <ThinkingMessage />}

      <motion.div
        ref={messagesEndRef}
        className="shrink-0 min-w-[24px] min-h-[120px]"
        onViewportLeave={onViewportLeave}
        onViewportEnter={onViewportEnter}
      />
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isArtifactVisible && nextProps.isArtifactVisible) return true;

  if (prevProps.status !== nextProps.status) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;
  if (!equal(prevProps.votes, nextProps.votes)) return false;
  if (!equal(prevProps.compareRuns, nextProps.compareRuns)) return false;
  if (!equal(prevProps.compareState, nextProps.compareState)) return false;
  if (prevProps.selectedModelIds !== nextProps.selectedModelIds) return false;

  return false;
});
