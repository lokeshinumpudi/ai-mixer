"use client";

import { ChatHeader } from "@/components/chat-header";

import { useAuth } from "@/components/auth-provider";
import { useArtifactSelector } from "@/hooks/use-artifact";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import { useCompareRun } from "@/hooks/use-compare-run";
import { useOptimizedChatData } from "@/hooks/use-optimized-chat-data";
import { getDefaultModelForUser } from "@/lib/ai/models";
import type { Chat as ChatType, Vote } from "@/lib/db/schema";
import { uiLogger } from "@/lib/logger";
import type { AppUser } from "@/lib/supabase/types";
import type { Attachment, ChatMessage } from "@/lib/types";
import { fetcher } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { useModels } from "../hooks/use-models";
import { Artifact } from "./artifact";
import { GoogleLoginCTA } from "./google-login-cta";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { toast, upgradeToast } from "./toast";

export function Chat({
  id,
  initialMessages,
  initialVisibilityType,
  isReadonly,
  user,
  autoResume,
  hasMore,
  loadMore,
  isLoadingMore,
  chat,
  isOwner,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialVisibilityType: "private" | "public";
  isReadonly: boolean;
  user: AppUser | null;
  autoResume: boolean;
  hasMore?: boolean;
  loadMore?: () => Promise<void>;
  isLoadingMore?: boolean;
  chat?: ChatType | null;
  isOwner?: boolean;
}) {
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const { user: authUser, isAnonymous } = useAuth();

  // Anonymous message tracking (moved from useAnonymousAuth)
  const [messageCount, setMessageCount] = useState(0);
  const [shouldShowLoginPrompt, setShouldShowLoginPrompt] = useState(false);

  // Load message count from localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && isAnonymous) {
      const stored = localStorage.getItem("anonymous_message_count");
      const count = stored ? Number.parseInt(stored, 10) : 0;
      setMessageCount(count);
      setShouldShowLoginPrompt(count >= 5); // MAX_ANONYMOUS_MESSAGES = 5
    }
  }, [isAnonymous]);

  const incrementMessageCount = useCallback(() => {
    if (isAnonymous) {
      const newCount = messageCount + 1;
      setMessageCount(newCount);
      localStorage.setItem("anonymous_message_count", newCount.toString());
      setShouldShowLoginPrompt(newCount >= 5);
    }
  }, [isAnonymous, messageCount]);

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
  const currentModel =
    userSettings?.defaultModel ||
    getDefaultModelForUser(userType ?? "anonymous");

  const [input, setInput] = useState<string>("");

  // Unified compare architecture - always in compare mode
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [currentVisibility, setCurrentVisibility] = useState<
    "private" | "public"
  >(initialVisibilityType);

  // Reset initialization flag when chat changes
  useEffect(() => {
    setHasInitialized(false);
  }, [id]); // Reset when chatId changes

  // Initialize selectedModelIds from compareModels only after API data is loaded
  useEffect(() => {
    // Only initialize once the API data has loaded and we haven't initialized yet
    if (!isModelsLoading && !hasInitialized && selectedModelIds.length === 0) {
      if (compareModels && compareModels.length > 0) {
        // Always prioritize compareModels from API response
        setSelectedModelIds(compareModels);
        setHasInitialized(true);
      } else if (currentModel) {
        // Fallback to current model if no compareModels are set
        setSelectedModelIds([currentModel]);
        setHasInitialized(true);
      }
    }
  }, [
    isModelsLoading,
    compareModels,
    currentModel,
    hasInitialized,
    selectedModelIds.length,
  ]);

  // 🚀 UNIFIED COMPARE ARCHITECTURE: Always use optimized data for existing chats
  const shouldFetchData =
    id &&
    id.length > 0 &&
    typeof window !== "undefined" &&
    // Only fetch for existing chat pages, not root page with new UUIDs
    (window.location.pathname.startsWith("/chat/") ||
      (window.location.pathname !== "/" && id.length === 36)); // UUID length check

  // Compare run hook - only for streaming, data comes from chatData
  const {
    startCompare,
    cancelModel,
    cancelAll,
    loadCompareRun,
    mutateCompareRuns,
    ...compareState
  } = useCompareRun(id, {
    // Never list on mount - data comes from optimized chatData
    listOnMount: false,
  });

  const chatData = useOptimizedChatData(
    shouldFetchData || (compareState as any).status !== "idle" ? id : ""
  );

  // 🚀 UNIFIED COMPARE ARCHITECTURE: Always use chatData (no fallbacks needed)
  const compareRuns = chatData.compareRuns?.items || [];
  const isLoadingRuns = chatData.isLoading;

  // Auto-set models if this chat has compare runs (even when reloading)
  useEffect(() => {
    if (!isLoadingRuns && compareRuns.length > 0 && !hasInitialized) {
      // Set the selected models from the first compare run if none are selected
      if (compareRuns[0]?.modelIds && selectedModelIds.length === 0) {
        setSelectedModelIds(compareRuns[0].modelIds);
        setHasInitialized(true);
      }
    }
  }, [isLoadingRuns, compareRuns, selectedModelIds.length, hasInitialized]);

  // When a run completes, revalidate consolidated data to pull final results
  useEffect(() => {
    if (compareState.status === "completed") {
      const t = setTimeout(() => {
        void chatData.mutate();
      }, 300);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [compareState.status]);

  // For unified compare architecture, we don't need the regular useChat hook
  // since all interactions go through compare infrastructure
  const messages = initialMessages;
  const setMessages = () => {}; // No-op since we don't use regular chat
  const sendMessage = async (_message?: any) => Promise.resolve(); // No-op since we don't use regular chat
  const status = "ready" as const;
  const stop = async () => {};
  const regenerate = async () => {};
  const resumeStream = async () => {};

  const searchParams = useSearchParams();
  const query = searchParams.get("query");

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  // Initialize compare mode with current model when available
  useEffect(() => {
    if (currentModel && selectedModelIds.length === 0 && !hasInitialized) {
      setSelectedModelIds([currentModel]);
      setHasInitialized(true);
    }
  }, [currentModel, selectedModelIds.length, hasInitialized]);

  const { data: votes } = useSWR<Array<Vote>>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);

  // Model selection handler - unified compare architecture
  const handleSelectedModelIdsChange = (modelIds: string[]) => {
    setSelectedModelIds(modelIds);
  };

  const handleStartCompare = useCallback(
    async (prompt: string, modelIds: string[]) => {
      try {
        // Always use compare infrastructure for unified architecture (1-N models)
        await startCompare({ prompt, modelIds });
        // Clear input after starting
        setInput("");
      } catch (error: any) {
        uiLogger.error(
          {
            error: error.message,
            stack: error.stack,
            chatId: id,
            modelIds,
            promptLength: prompt.length,
          },
          "Failed to start chat/comparison"
        );

        // Check if it's a rate limit error for compare functionality
        if (error instanceof Error && error.message.includes("429")) {
          upgradeToast({
            title: "Compare limit reached",
            description:
              "Upgrade to Pro for unlimited model comparisons and 1000 messages per month.",
            actionText: "Upgrade to Pro",
          });
        } else {
          toast({
            type: "error",
            description: "Failed to start chat. Please try again.",
          });
        }
      }
    },
    [startCompare, setInput]
  );

  // Handle query parameter from URL (e.g., shared links)
  useEffect(() => {
    if (query && !hasAppendedQuery) {
      // Always use compare mode for unified architecture (1-N models)
      if (selectedModelIds.length > 0) {
        handleStartCompare(query, selectedModelIds);
      } else {
        sendMessage({
          role: "user" as const,
          parts: [{ type: "text", text: query }],
        });
      }

      setHasAppendedQuery(true);
      window.history.replaceState({}, "", `/chat/${id}`);
    }
  }, [
    query,
    sendMessage,
    hasAppendedQuery,
    id,
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
          selectedVisibilityType={currentVisibility}
          isReadonly={isReadonly}
          user={user}
          chat={chat}
          isOwner={isOwner}
          onVisibilityChange={setCurrentVisibility}
        />

        {/* Read-only indicator for shared chats */}
        {!isOwner && chat?.visibility === "public" && (
          <div className="mx-auto px-6 py-3 w-full md:max-w-3xl">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-blue-700">
                <svg
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                <span className="text-sm font-medium">
                  Viewing shared chat (read-only)
                </span>
              </div>
            </div>
          </div>
        )}

        <Messages
          chatId={id}
          status={status}
          votes={chatData.votes || votes}
          messages={[]} // No longer using messages in unified compare mode
          setMessages={setMessages}
          regenerate={regenerate}
          isReadonly={isReadonly}
          isArtifactVisible={isArtifactVisible}
          compareState={compareState}
          compareRuns={compareRuns}
          cancelModel={cancelModel}
          cancelAll={cancelAll}
          startCompare={startCompare}
          isLoadingRuns={isLoadingRuns}
          hasMore={false} // No message pagination in unified compare mode
          loadMore={async () => {}} // No-op function for unified compare mode
          isLoadingMore={isLoadingMore}
          selectedVisibilityType={visibilityType}
          selectedModelIds={selectedModelIds}
          onStartCompare={handleStartCompare}
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
                      ? "Sign in with Google to continue chatting with unlimited messages."
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

        <div className="absolute bottom-0 inset-x-0 flex justify-center px-4 pb-4 md:px-6 md:pb-6">
          <form className="relative flex gap-2 w-full max-w-3xl">
            {/* Backdrop blur background only behind the input area */}
            <div className="absolute inset-0 bg-background/95 backdrop-blur-sm border-t border-border/30 rounded-t-lg -z-10" />
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
                selectedVisibilityType={visibilityType}
                user={user}
                selectedModelId={currentModel}
                selectedModelIds={selectedModelIds}
                onSelectedModelIdsChange={handleSelectedModelIdsChange}
                onStartCompare={handleStartCompare}
                compareRuns={compareRuns}
                activeCompareMessage={compareState.status !== "idle"}
                isModelsLoading={isModelsLoading}
                isLoadingRuns={isLoadingRuns}
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
        selectedModelId={currentModel}
      />
    </>
  );
}
