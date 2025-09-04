import { useMessages } from '@/hooks/use-messages';
import type { Vote } from '@/lib/db/schema';
import type { ChatMessage } from '@/lib/types';
import type { UseChatHelpers } from '@ai-sdk/react';
import equal from 'fast-deep-equal';
import { motion } from 'framer-motion';
import { memo, useEffect } from 'react';
import { CompareMessage, type CompareMessageData } from './compare-message';
import { useDataStream } from './data-stream-provider';
import { Greeting } from './greeting';
import { PreviewMessage, ThinkingMessage } from './message';

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
      { status: string; content: string; usage?: any; error?: string }
    >;
  };
  compareRuns: any[];
  cancelModel: (modelId: string) => void;
  cancelAll: () => void;
  startCompare: (params: { prompt: string; modelIds: string[] }) => void;
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

  // Compare state is now passed from parent Chat component

  useDataStream();

  // Scroll to bottom when compare runs are updated (after completion)
  useEffect(() => {
    if (compareRuns.length > 0) {
      // Small delay to ensure DOM is updated
      setTimeout(() => scrollToBottom('smooth'), 100);
    }
  }, [compareRuns.length, scrollToBottom]);

  // Create compare message data from active compare state
  const activeCompareMessage: CompareMessageData | null =
    compareState.status !== 'idle'
      ? {
          id: compareState.runId || 'active-compare',
          prompt: compareState.prompt || '',
          modelIds: compareState.modelIds,
          status: compareState.status,
          results: compareState.byModelId as any, // Type cast for now
        }
      : null;

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col min-w-0 gap-8 flex-1 overflow-y-scroll pt-6 pb-4 relative"
    >
      {messages.length === 0 &&
        compareRuns.length === 0 &&
        !activeCompareMessage && <Greeting />}

      {messages.map((message, index) => (
        <PreviewMessage
          key={message.id}
          chatId={chatId}
          message={message}
          isLoading={status === 'streaming' && messages.length - 1 === index}
          vote={
            votes
              ? votes.find((vote) => vote.messageId === message.id)
              : undefined
          }
          setMessages={setMessages}
          regenerate={regenerate}
          isReadonly={isReadonly}
          requiresScrollPadding={
            hasSentMessage && index === messages.length - 1
          }
        />
      ))}

      {/* Active compare run */}
      {activeCompareMessage && (
        <motion.div
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
          className="w-full mx-auto max-w-5xl px-4"
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

      {/* Historical compare runs */}
      {compareRuns.map((run) => (
        <motion.div
          key={run.id}
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
          className="w-full mx-auto max-w-5xl px-4"
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
      ))}

      {status === 'submitted' &&
        messages.length > 0 &&
        messages[messages.length - 1].role === 'user' && <ThinkingMessage />}

      <motion.div
        ref={messagesEndRef}
        className="shrink-0 min-w-[24px] min-h-[24px]"
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

  return false;
});
