"use client";

import { ChatHeader } from "@/components/chat-header";

import { useAnonymousAuth } from "@/hooks/use-anonymous-auth";
import { useArtifactSelector } from "@/hooks/use-artifact";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import { useCompareRun } from "@/hooks/use-compare-run";
import { getDefaultModelForUser } from "@/lib/ai/models";
import type { Vote } from "@/lib/db/schema";
import { uiLogger } from "@/lib/logger";
import type { AppUser } from "@/lib/supabase/types";
import type { Attachment, ChatMessage } from "@/lib/types";
import { fetcher } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { useModels } from "../hooks/use-models";
import { Artifact } from "./artifact";
import { useDataStream } from "./data-stream-provider";
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
  const currentModel =
    userSettings?.defaultModel ||
    getDefaultModelForUser(userType ?? "anonymous");

  const [input, setInput] = useState<string>("");

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

  // Auto-enable compare mode if this chat has compare runs (even when reloading)
  useEffect(() => {
    if (!isLoadingRuns && compareRuns.length > 0 && !isCompareMode) {
      setIsCompareMode(true);
      // Also set the selected models from the first compare run
      if (compareRuns[0]?.modelIds && selectedModelIds.length === 0) {
        setSelectedModelIds(compareRuns[0].modelIds);
      }
    }
  }, [isLoadingRuns, compareRuns, isCompareMode, selectedModelIds.length, id]);

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
    if (currentModel && selectedModelIds.length === 0) {
      setSelectedModelIds([currentModel]);
    }
  }, [currentModel, selectedModelIds.length]);

  const { data: votes } = useSWR<Array<Vote>>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher
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
          prev.length > 0 ? [...prev, currentModel] : [currentModel]
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

  const handleContinueWithModels = (modelIds: string[]) => {
    // Update selected models and keep compare mode enabled
    setSelectedModelIds(modelIds);
    // Focus on input for continuation
    // The input will be ready for the user to type their follow-up
  };

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
          isLoadingRuns={isLoadingRuns}
          hasMore={hasMore}
          loadMore={loadMore}
          isLoadingMore={isLoadingMore}
          selectedVisibilityType={visibilityType}
          isCompareMode={isCompareMode}
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

        <form className="absolute bottom-0 left-0 right-0 flex mx-auto px-4 pb-4 md:px-6 md:pb-6 gap-2 w-full md:max-w-3xl">
          {/* Backdrop blur background only behind the input area */}
          <div className="absolute inset-x-4 md:inset-x-6 inset-y-0 bg-background/95 backdrop-blur-sm border-t border-border/30 rounded-t-lg -z-10" />
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
              isCompareMode={isCompareMode}
              onCompareModeChange={handleCompareModeChange}
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
