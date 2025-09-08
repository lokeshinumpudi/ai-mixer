"use client";

import type { UIMessage } from "ai";
import cx from "classnames";
import type React from "react";
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { useLocalStorage, useWindowSize } from "usehooks-ts";

import { useModels } from "@/hooks/use-models";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { uiLogger } from "@/lib/logger";
import type { AppUser } from "@/lib/supabase/types";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ArrowUpIcon, PaperclipIcon, StopIcon } from "./icons";
import { ModelPicker } from "./model-picker";
import { PreviewAttachment } from "./preview-attachment";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { MobileFriendlyTooltip } from "./ui/mobile-friendly-tooltip";
import { Textarea } from "./ui/textarea";

// Provider-based color mapping for model chips
function getModelChipColor(modelId: string): string {
  const provider = modelId.split("/")[0]?.toLowerCase();

  switch (provider) {
    case "openai":
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800";
    case "anthropic":
      return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800";
    case "google":
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
    case "meta":
      return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800";
    case "mistral":
      return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800";
    case "cohere":
      return "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800";
    case "perplexity":
      return "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800";
  }
}

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  sendMessage,
  className,
  selectedVisibilityType,
  user,
  selectedModelId,
  selectedModelIds = [],
  onSelectedModelIdsChange,
  onStartCompare,
  compareRuns = [],
  activeCompareMessage = false,
  isModelsLoading = false,
  isLoadingRuns = false,
  readOnly = false,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<UIMessage>;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage?: UseChatHelpers<ChatMessage>["sendMessage"];
  className?: string;
  selectedVisibilityType: "private" | "public";
  user: AppUser | null;
  selectedModelId: string;
  selectedModelIds?: string[];
  onSelectedModelIdsChange?: (modelIds: string[]) => void;
  onStartCompare?: (prompt: string, modelIds: string[]) => void;
  compareRuns?: any[];
  activeCompareMessage?: boolean;
  isModelsLoading?: boolean;
  isLoadingRuns?: boolean;
  readOnly?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const { userType } = useModels();

  // Avoid fetching usage on the new-chat root page where no rate decision is needed yet
  const shouldFetchUsage =
    typeof window !== "undefined" && window.location.pathname !== "/";
  const { data: usageData } = useSWR(
    shouldFetchUsage ? "/api/usage?page=1&limit=100" : null,
    (url) => fetch(url).then((res) => res.json()),
    {
      revalidateOnFocus: false,
      // Prefer event-driven cache invalidation from DataStreamHandler over polling
      refreshInterval: 0,
    }
  );
  const { width } = useWindowSize();

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${
        textareaRef.current.scrollHeight + 2
      }px`;
    }
  };

  const resetHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = "98px";
    }
  };

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    "input",
    ""
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || "";
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  const submitForm = useCallback(() => {
    // Prevent submission if chat is read-only
    if (readOnly) {
      toast.error("Read-only chat", {
        description:
          "This shared chat is read-only. You can view messages but cannot send new ones.",
        duration: 5000,
      });
      return;
    }

    // Check rate limits before sending using new usage system
    const todayUsed = usageData?.items
      ? usageData.items.filter((item: any) => {
          const itemDate = new Date(item.createdAt);
          const today = new Date();
          return itemDate.toDateString() === today.toDateString();
        }).length
      : 0;
    const quota = usageData?.limits?.quota || 50;
    const isOverLimit = todayUsed >= quota;
    if (isOverLimit) {
      toast.error("Message limit reached", {
        description: `You've reached your ${
          usageData?.limits?.type || "daily"
        } limit. Upgrade to continue.`,
        action: {
          label: "Upgrade",
          onClick: () => {
            const paymentUrl =
              process.env.NEXT_PUBLIC_RAZORPAY_PAYMENT_PAGE_URL || "";
            if (paymentUrl) {
              window.open(paymentUrl, "_blank");
            } else {
              uiLogger.error(
                {
                  chatId,
                  selectedModelIds,
                },
                "Payment URL not configured"
              );
              router.push("/settings");
            }
          },
        },
      });
      return;
    }

    window.history.replaceState({}, "", `/chat/${chatId}`);

    // Always use compare mode for unified architecture
    if (selectedModelIds.length > 0 && onStartCompare) {
      // Start with selected models (1, 2, or 3) - always use compare infrastructure
      onStartCompare(input.trim(), selectedModelIds);
    } else {
      // This should not happen in unified architecture
      uiLogger.warn(
        {
          chatId,
          inputLength: input.length,
          hasAttachments: attachments.length > 0,
        },
        "No models selected or compare infrastructure unavailable"
      );
    }

    setAttachments([]);
    setLocalStorageInput("");
    resetHeight();
    setInput("");

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    setInput,
    attachments,
    sendMessage,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
    usageData,
    router,
    selectedModelIds,
    onStartCompare,
  ]);

  const uploadFile = useCallback(
    async (file: File) => {
      // Gate uploads for free users
      if (userType !== "pro") {
        toast.error(
          "File uploads are a Pro feature. Upgrade to enable uploads."
        );
        const paymentUrl =
          process.env.NEXT_PUBLIC_RAZORPAY_PAYMENT_PAGE_URL || "";
        if (paymentUrl) {
          window.open(paymentUrl, "_blank");
        } else {
          uiLogger.error(
            {
              fileName: file.name,
              fileSize: file.size,
            },
            "Payment URL not configured for file upload"
          );
          router.push("/settings");
        }
        return undefined;
      }

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          const { url, pathname, contentType } = data;

          return {
            url,
            name: pathname,
            contentType: contentType,
          };
        }
        const { error } = await response.json();
        toast.error(error);
      } catch (error) {
        toast.error("Failed to upload file, please try again!");
      }
    },
    [userType, router]
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error: any) {
        uiLogger.error(
          {
            error: error.message,
            stack: error.stack,
            chatId,
            filesCount: uploadQueue.length,
          },
          "File upload failed"
        );
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  const { isAtBottom, scrollToBottom } = useScrollToBottom();

  useEffect(() => {
    if (status === "submitted") {
      scrollToBottom();
    }
  }, [status, scrollToBottom]);

  return (
    <div className="relative w-full flex flex-col gap-4">
      <AnimatePresence>
        {!isAtBottom && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="absolute left-1/2 bottom-36 -translate-x-1/2 z-50"
          >
            <Button
              data-testid="scroll-to-bottom-button"
              className="rounded-full"
              size="icon"
              variant="outline"
              onClick={(event) => {
                event.preventDefault();
                scrollToBottom();
              }}
            >
              <ArrowDown />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <input
        type="file"
        className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />

      {(attachments.length > 0 || uploadQueue.length > 0) && (
        <div
          data-testid="attachments-preview"
          className="flex flex-row gap-2 overflow-x-scroll items-end"
        >
          {attachments.map((attachment) => (
            <PreviewAttachment key={attachment.url} attachment={attachment} />
          ))}

          {uploadQueue.map((filename) => (
            <PreviewAttachment
              key={filename}
              attachment={{
                url: "",
                name: filename,
                contentType: "",
              }}
              isUploading={true}
            />
          ))}
        </div>
      )}

      <div
        className={cx(
          "relative luxury-input glass rounded-3xl w-full",
          className
        )}
      >
        {/* Model chips display - always show in unified compare architecture */}
        <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1">
          {isModelsLoading ? (
            // Loading state - show skeleton chips
            <div className="flex gap-2">
              <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
              <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
            </div>
          ) : selectedModelIds.length > 0 ? (
            // Loaded state - show actual model chips
            selectedModelIds.map((modelId) => (
              <Badge
                key={modelId}
                variant="outline"
                className={`flex items-center gap-1 text-xs font-medium border ${getModelChipColor(
                  modelId
                )}`}
              >
                {modelId.split("/").pop()}
                {onSelectedModelIdsChange && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectedModelIdsChange(
                        selectedModelIds.filter((id) => id !== modelId)
                      );
                    }}
                    className="ml-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5 transition-colors"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </Badge>
            ))
          ) : null}
        </div>

        <Textarea
          data-testid="multimodal-input"
          ref={textareaRef}
          placeholder={
            readOnly
              ? "This shared chat is read-only"
              : selectedModelIds.length > 1
              ? `Compare with ${selectedModelIds.length} models...`
              : "Send a message..."
          }
          value={input}
          onChange={readOnly ? undefined : handleInput}
          disabled={readOnly}
          className={cx(
            "min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none text-base bg-transparent pb-10 md:pb-12 px-4 placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-0 focus:outline-none focus:ring-0 focus:shadow-none border-0",
            selectedModelIds.length > 0 ? "pt-2" : "pt-4",
            readOnly && "cursor-not-allowed opacity-60"
          )}
          rows={2}
          autoFocus={!readOnly}
          onKeyDown={(event) => {
            if (readOnly) return;

            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();

              if (status !== "ready") {
                toast.error(
                  "Please wait for the model to finish its response!"
                );
              } else {
                submitForm();
              }
            }
          }}
        />
      </div>

      <div className="absolute bottom-0 left-0 p-2 md:p-3 w-fit flex flex-row justify-start items-center gap-2">
        <AttachmentsButton
          fileInputRef={fileInputRef}
          status={status}
          disabled={readOnly}
        />

        <ModelPicker
          user={user}
          selectedModelId={selectedModelId}
          disabled={status !== "ready" || readOnly}
          compact={true}
          selectedModelIds={selectedModelIds}
          onSelectedModelIdsChange={onSelectedModelIdsChange}
        />
      </div>

      <div className="absolute bottom-0 right-0 p-2 md:p-3 w-fit flex flex-row justify-end">
        {status === "submitted" ? (
          <StopButton stop={stop} setMessages={setMessages} />
        ) : (
          <SendButton
            input={input}
            submitForm={submitForm}
            uploadQueue={uploadQueue}
            disabled={readOnly}
          />
        )}
      </div>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.status !== nextProps.status) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
      return false;
    if (prevProps.selectedModelId !== nextProps.selectedModelId) return false;
    if (!equal(prevProps.selectedModelIds, nextProps.selectedModelIds))
      return false;

    return true;
  }
);

function PureAttachmentsButton({
  fileInputRef,
  status,
  disabled = false,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>["status"];
  disabled?: boolean;
}) {
  return (
    <MobileFriendlyTooltip
      content={
        disabled
          ? "This shared chat is read-only"
          : "Attach files, images, or documents to your message"
      }
      side="top"
      showIcon={false}
    >
      <Button
        data-testid="attachments-button"
        className="luxury-button rounded-xl p-2 size-9 border-0 hover:bg-accent/80"
        onClick={(event) => {
          if (disabled) return;
          event.preventDefault();
          fileInputRef.current?.click();
        }}
        disabled={status !== "ready" || disabled}
        variant="ghost"
      >
        <PaperclipIcon size={16} />
      </Button>
    </MobileFriendlyTooltip>
  );
}

const AttachmentsButton = memo(
  PureAttachmentsButton,
  (prevProps, nextProps) => {
    if (prevProps.status !== nextProps.status) return false;
    if (prevProps.disabled !== nextProps.disabled) return false;
    return true;
  }
);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
}) {
  return (
    <MobileFriendlyTooltip
      content="Stop the current AI response generation"
      side="top"
      showIcon={false}
    >
      <Button
        data-testid="stop-button"
        className="luxury-button rounded-full p-2 size-9 border border-border/50 bg-background hover:bg-destructive hover:text-destructive-foreground"
        onClick={(event) => {
          event.preventDefault();
          stop();
          setMessages((messages) => messages);
        }}
      >
        <StopIcon size={16} />
      </Button>
    </MobileFriendlyTooltip>
  );
}

const StopButton = memo(PureStopButton);

function PureSendButton({
  submitForm,
  input,
  uploadQueue,
  disabled = false,
}: {
  submitForm: () => void;
  input: string;
  uploadQueue: Array<string>;
  disabled?: boolean;
}) {
  const canSend = input.length > 0 && uploadQueue.length === 0 && !disabled;
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <Button
      ref={buttonRef}
      data-testid="send-button"
      className={cx(
        "luxury-button rounded-full p-2 h-9 w-9 border-0 transition-all duration-300",
        canSend
          ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
          : "bg-muted text-muted-foreground cursor-not-allowed"
      )}
      onClick={(event) => {
        event.preventDefault();
        if (canSend) submitForm();
      }}
      disabled={!canSend || disabled}
    >
      <ArrowUpIcon size={16} />
    </Button>
  );
}

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length)
    return false;
  if (prevProps.input !== nextProps.input) return false;
  return true;
});
