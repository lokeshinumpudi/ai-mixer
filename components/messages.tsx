import { useMessages } from "@/hooks/use-messages";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { motion } from "framer-motion";
import { memo, useEffect, useRef } from "react";
import { CompareMessage, type CompareMessageData } from "./compare-message";
import { useDataStream } from "./data-stream-provider";
import { Greeting } from "./greeting";
import { PreviewMessage, ThinkingMessage } from "./message";
import { SuggestedActions } from "./suggested-actions";

interface MessagesProps {
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  votes: Array<Vote> | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  isArtifactVisible: boolean;
  // Compare state props
  compareState: {
    runId: string | null;
    prompt: string;
    status: "idle" | "running" | "completed" | "canceled" | "failed";
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
  sendMessage?: UseChatHelpers<ChatMessage>["sendMessage"];
  selectedVisibilityType: "private" | "public";
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

  // Compare state is now passed from parent Chat component

  useDataStream();
  // Create compare message data from active compare state
  const activeCompareMessage: CompareMessageData | null =
    compareState.status !== "idle"
      ? {
          id: compareState.runId || "active-compare",
          prompt: compareState.prompt || "",
          modelIds: compareState.modelIds,
          status: compareState.status,
          results: compareState.byModelId as any, // Type cast for now
        }
      : null;

  // Smart scroll management for compare messages
  const prevActiveMessageRef = useRef<CompareMessageData | null>(null);

  useEffect(() => {
    // Scroll to active compare message when it first appears or when it starts running
    if (activeCompareMessage && !prevActiveMessageRef.current) {
      // New active compare message appeared - scroll to it
      setTimeout(() => scrollToBottom("smooth"), 100);
    } else if (
      activeCompareMessage &&
      prevActiveMessageRef.current &&
      activeCompareMessage.status === "running" &&
      prevActiveMessageRef.current.status !== "running"
    ) {
      // Compare message transitioned to running state - scroll to it
      setTimeout(() => scrollToBottom("smooth"), 100);
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
      { threshold: 0.1 }
    );

    if (topRef.current) {
      observer.observe(topRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadMore, isLoadingMore]);

  // Don't auto-scroll when historical compare runs are loaded
  // This prevents jarring behavior after compare completion

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

      {messages.length === 0 &&
        compareRuns.length === 0 &&
        !activeCompareMessage &&
        !isLoadingRuns && (
          <div className="flex flex-col items-center gap-8 py-8">
            <Greeting />
            <div className="w-full max-w-2xl px-4">
              <SuggestedActions
                chatId={chatId}
                selectedVisibilityType={selectedVisibilityType}
                selectedModelIds={selectedModelIds}
                onStartCompare={onStartCompare}
              />
            </div>
          </div>
        )}

      {/* Regular messages */}
      {messages.map((message, index) => (
        <PreviewMessage
          key={message.id}
          chatId={chatId}
          message={message}
          isLoading={status === "streaming" && messages.length - 1 === index}
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

      {/* Historical compare runs (older first) */}
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
          className={cn(
            "w-full mx-auto",
            // For single model, use full width on mobile, max-width on desktop
            run.modelIds.length === 1
              ? "max-w-[100vw] px-2 md:max-w-4xl md:px-4"
              : "max-w-5xl px-4"
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
                  (acc: CompareMessageData["results"], result: any) => {
                    acc[result.modelId] = {
                      status: result.status,
                      content: result.content || "",
                      reasoning: result.reasoning || "",
                      usage: result.usage,
                      error: result.error,
                      serverStartedAt: result.serverStartedAt,
                      serverCompletedAt: result.serverCompletedAt,
                      inferenceTimeMs: result.inferenceTimeMs,
                    };
                    return acc;
                  },
                  {} as CompareMessageData["results"]
                ) || {},
            }}
          />
        </motion.div>
      ))}

      {/* Active compare run (always at bottom) */}
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
          className={cn(
            "w-full mx-auto",
            // For single model, use full width on mobile, max-width on desktop
            activeCompareMessage.modelIds.length === 1
              ? "max-w-[100vw] px-2 md:max-w-4xl md:px-4"
              : "max-w-5xl px-4"
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

      {status === "submitted" &&
        messages.length > 0 &&
        messages[messages.length - 1].role === "user" && <ThinkingMessage />}

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

  return false;
});
