"use client";

import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  Loader2,
  Maximize2,
  RotateCcw,
  StopCircle,
  X,
  XCircle,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Markdown } from "./markdown";
import { ExpandableModal } from "./ui/expandable-modal";
import { MobileScrollContainer } from "./ui/mobile-scroll-container";

// Provider-based color mapping for model chips - memoized for performance
const getModelChipColor = (modelId: string): string => {
  const provider = modelId.split("/")[0]?.toLowerCase();

  switch (provider) {
    case "openai":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800";
    case "anthropic":
      return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-800";
    case "google":
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800";
    case "meta":
      return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-800";
    case "mistral":
      return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800";
    case "cohere":
      return "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-400 dark:border-teal-800";
    case "perplexity":
      return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-400 dark:border-indigo-800";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950/50 dark:text-slate-400 dark:border-slate-800";
  }
};

// Memoized utility functions for performance
const getModelDisplayName = (modelId: string): string => {
  const parts = modelId.split("/");
  if (parts.length === 2) {
    const [provider, model] = parts;
    const capitalizedProvider =
      provider.charAt(0).toUpperCase() + provider.slice(1);
    return `${capitalizedProvider} ${model}`;
  }
  return modelId;
};

export interface CompareMessageData {
  id: string;
  prompt: string;
  modelIds: string[];
  status: "running" | "completed" | "canceled" | "failed";
  results: {
    [modelId: string]: {
      status: "pending" | "running" | "completed" | "canceled" | "failed";
      content: string;
      reasoning?: string; // AI reasoning/thinking content
      usage?: any;
      error?: string;
      // Server-side timing (authoritative)
      serverStartedAt?: string; // ISO timestamp
      serverCompletedAt?: string; // ISO timestamp
      inferenceTimeMs?: number; // Pure inference time in milliseconds
    };
  };
}

interface CompareMessageProps {
  data: CompareMessageData;
  onCancelModel?: (modelId: string) => void;
  onCancelAll?: () => void;
  onRetry?: () => void;
  className?: string;
}

function getStatusIcon(
  status: CompareMessageData["results"][string]["status"]
) {
  switch (status) {
    case "pending":
      return <div className="size-4 rounded-full bg-gray-300" />;
    case "running":
      return <Loader2 className="size-4 animate-spin text-blue-500" />;
    case "completed":
      return <CheckCircle className="size-4 text-green-500" />;
    case "canceled":
      return <StopCircle className="size-4 text-yellow-500" />;
    case "failed":
      return <XCircle className="size-4 text-red-500" />;
    default:
      return null;
  }
}

function getStatusColor(
  status: CompareMessageData["results"][string]["status"]
) {
  switch (status) {
    case "pending":
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    case "running":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    case "completed":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    case "canceled":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "failed":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

const CompareResultCard = memo(function CompareResultCard({
  modelId,
  result,
  onCancel,
  onExpand,
  className,
  isOnlyModel = false,
}: {
  modelId: string;
  result: CompareMessageData["results"][string];
  onCancel?: () => void;
  onExpand?: () => void;
  className?: string;
  isOnlyModel?: boolean;
}) {
  const modelName = useMemo(() => getModelDisplayName(modelId), [modelId]);
  const canCancel = result.status === "running" && onCancel;

  function resolveTokenCounts(usage: any | undefined): {
    inTokens: number | null;
    outTokens: number | null;
  } {
    if (!usage) return { inTokens: null, outTokens: null };
    const inTokens =
      usage.promptTokens ?? usage.inputTokens ?? usage.prompt_tokens ?? null;
    const outTokens =
      usage.completionTokens ??
      usage.outputTokens ??
      usage.completion_tokens ??
      null;
    return { inTokens, outTokens };
  }

  // For single model, render without card styling to blend into chat
  if (isOnlyModel) {
    return (
      <div className={cn("flex flex-col", className)}>
        {/* Minimal header for single model - only show when running or has timing */}
        {(result.status === "running" ||
          (result.status === "completed" && result.inferenceTimeMs) ||
          canCancel ||
          onExpand) && (
          <div className="flex items-center justify-between mb-4 px-0">
            <div className="flex items-center gap-3">
              {/* Status icon and timing */}
              <div className="flex items-center gap-2">
                {result.status === "running" && (
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.status)}
                    <span className="text-xs text-muted-foreground">
                      Thinking...
                    </span>
                  </div>
                )}

                {/* Time indicator - only show for completed states */}
                {result.status === "completed" && result.inferenceTimeMs && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="font-mono">
                      {`${(result.inferenceTimeMs / 1000).toFixed(1)}s`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons on the right */}
            <div className="flex items-center gap-1">
              {/* Expand button */}
              {onExpand && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onExpand}
                  className="size-7 p-0 text-muted-foreground hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                  title="Expand for better readability"
                >
                  <Maximize2 className="size-3" />
                </Button>
              )}

              {/* Cancel button */}
              {canCancel && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  className="size-7 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                  title="Cancel this model"
                >
                  <X className="size-3" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Content area without card styling */}
        <div className="flex-1">
          {result.status === "failed" && result.error ? (
            <div className="text-red-600 text-sm">
              <p className="font-medium mb-1">Error:</p>
              <p className="text-red-500">{result.error}</p>
            </div>
          ) : result.content || result.reasoning ? (
            <div className="space-y-4">
              {/* Reasoning section - collapsible using AI Elements */}
              {result.reasoning && (
                <Reasoning
                  isStreaming={result.status === "running"}
                  className="w-full"
                  variant="grey"
                >
                  <ReasoningTrigger />
                  <ReasoningContent>{result.reasoning}</ReasoningContent>
                </Reasoning>
              )}

              {/* Main content */}
              {result.content && (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <Markdown>{result.content}</Markdown>
                </div>
              )}
            </div>
          ) : result.status === "running" ? (
            <div className="text-muted-foreground text-sm">
              Generating response...
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">
              Waiting to start...
            </div>
          )}
        </div>
      </div>
    );
  }

  // For multiple models, use card styling
  return (
    <Card className={cn("flex h-full flex-col overflow-hidden", className)}>
      {/* Clean header with model info, status icon, and timing */}
      <CardHeader className="shrink-0 px-4 py-3 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Model name and status icon */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {modelName}
              </span>
              <div className="flex items-center">
                {getStatusIcon(result.status)}
              </div>
            </div>

            {/* Time indicator - only show for running or completed states */}
            {((result.status === "completed" && result.inferenceTimeMs) ||
              (result.status === "running" && result.serverStartedAt)) && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
                <span className="font-mono">
                  {result.status === "running" && result.serverStartedAt ? (
                    <LiveTimer startTime={result.serverStartedAt} />
                  ) : result.inferenceTimeMs ? (
                    `${(result.inferenceTimeMs / 1000).toFixed(2)}s`
                  ) : (
                    "0.00s"
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Action buttons on the right */}
          <div className="flex items-center gap-1">
            {/* Expand button */}
            {onExpand && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onExpand}
                className="size-7 p-0 text-muted-foreground hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                title="Expand for better readability"
              >
                <Maximize2 className="size-3" />
              </Button>
            )}

            {/* Cancel button */}
            {canCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="size-7 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                title="Cancel this model"
              >
                <X className="size-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
        {/* Main content area */}
        <div className="flex-1 overflow-y-auto p-4">
          {result.status === "failed" && result.error ? (
            <div className="text-red-600 text-sm">
              <p className="font-medium mb-1">Error:</p>
              <p className="text-red-500">{result.error}</p>
            </div>
          ) : result.content || result.reasoning ? (
            <div className="space-y-3">
              {/* Reasoning section - collapsible using AI Elements */}
              {result.reasoning && (
                <Reasoning
                  isStreaming={result.status === "running"}
                  className="w-full"
                  variant="grey"
                >
                  <ReasoningTrigger />
                  <ReasoningContent>{result.reasoning}</ReasoningContent>
                </Reasoning>
              )}

              {/* Main content */}
              {result.content && (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <Markdown>{result.content}</Markdown>
                </div>
              )}
            </div>
          ) : result.status === "running" ? (
            <div className="text-muted-foreground text-sm">
              Generating response...
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">
              Waiting to start...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

// Component for modal header content with timing and usage info
const ModalHeaderContent = memo(function ModalHeaderContent({
  result,
  onCancel,
}: {
  result: CompareMessageData["results"][string];
  onCancel?: () => void;
}) {
  const tokenCounts = useMemo(() => {
    if (!result.usage) return { inTokens: null, outTokens: null };
    const inTokens =
      result.usage.promptTokens ??
      result.usage.inputTokens ??
      result.usage.prompt_tokens ??
      null;
    const outTokens =
      result.usage.completionTokens ??
      result.usage.outputTokens ??
      result.usage.completion_tokens ??
      null;
    return { inTokens, outTokens };
  }, [result.usage]);

  const canCancel = result.status === "running" && onCancel;

  return (
    <div className="flex items-center gap-4">
      {/* Status icon */}
      <div className="flex items-center">{getStatusIcon(result.status)}</div>

      {/* Time indicator */}
      {((result.status === "completed" && result.inferenceTimeMs) ||
        (result.status === "running" && result.serverStartedAt)) && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {result.status === "running" ? "Running for" : "Time"}
          </span>
          <span className="font-mono font-medium">
            {result.status === "running" && result.serverStartedAt ? (
              <LiveTimer startTime={result.serverStartedAt} />
            ) : result.inferenceTimeMs ? (
              `${(result.inferenceTimeMs / 1000).toFixed(2)}s`
            ) : (
              "0.00s"
            )}
          </span>
        </div>
      )}

      {/* Usage info if available */}
      {result.usage && (
        <div className="flex items-center gap-2 text-sm">
          {tokenCounts.inTokens && (
            <span className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">↑</span>
              <span className="font-mono">
                {tokenCounts.inTokens.toLocaleString()}
              </span>
            </span>
          )}
          {tokenCounts.outTokens && (
            <span className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">↓</span>
              <span className="font-mono">
                {tokenCounts.outTokens.toLocaleString()}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Cancel button in header */}
      {canCancel && (
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 ml-2"
        >
          <X className="size-4" />
          Cancel
        </Button>
      )}
    </div>
  );
});

// Memoized expanded version of the compare result for modal view
const ExpandedCompareResult = memo(function ExpandedCompareResult({
  modelId,
  result,
  onCancel,
}: {
  modelId: string;
  result: CompareMessageData["results"][string];
  onCancel?: () => void;
}) {
  return (
    <div className="h-full flex flex-col">
      {/* Content area without the header (moved to modal) */}
      <div className="flex-1 overflow-y-auto p-6">
        {result.status === "failed" && result.error ? (
          <div className="text-red-600">
            <p className="font-medium mb-3 text-lg">Error occurred:</p>
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-700 dark:text-red-300">{result.error}</p>
            </div>
          </div>
        ) : result.content || result.reasoning ? (
          <div className="space-y-6">
            {/* Reasoning section - more prominent in expanded view */}
            {result.reasoning && (
              <Reasoning
                isStreaming={result.status === "running"}
                className="w-full"
                variant="grey"
              >
                <ReasoningTrigger />
                <ReasoningContent>{result.reasoning}</ReasoningContent>
              </Reasoning>
            )}

            {/* Main content with enhanced typography */}
            {result.content && (
              <div className="prose prose-base max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-code:text-foreground">
                <Markdown>{result.content}</Markdown>
              </div>
            )}
          </div>
        ) : result.status === "running" ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="size-8 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">
                Generating response...
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground text-lg">Waiting to start...</p>
          </div>
        )}
      </div>
    </div>
  );
});

function LiveTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startTime).getTime();

    const updateElapsed = () => {
      const now = Date.now();
      const elapsedMs = now - start;
      setElapsed(elapsedMs);
    };

    // Update immediately
    updateElapsed();

    // Update every 100ms for smooth animation
    const interval = setInterval(updateElapsed, 100);

    return () => clearInterval(interval);
  }, [startTime]);

  return <span>{(elapsed / 1000).toFixed(1)}s</span>;
}

export const CompareMessage = memo(function CompareMessage({
  data,
  onCancelModel,
  onCancelAll,
  onRetry,
  className,
}: CompareMessageProps) {
  const { modelIds, status, results, prompt } = data;
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null);

  const isRunning = status === "running";
  const canCancelAll = isRunning && onCancelAll;
  const canRetry = (status === "failed" || status === "canceled") && onRetry;

  const handleExpandCard = useCallback((modelId: string) => {
    setExpandedModelId(modelId);
  }, []);

  const handleCloseExpanded = useCallback(() => {
    setExpandedModelId(null);
  }, []);

  // Memoize the expanded model display name to avoid recalculation
  const expandedModelDisplayName = useMemo(() => {
    return expandedModelId ? getModelDisplayName(expandedModelId) : "";
  }, [expandedModelId]);

  // Memoize the expanded result to prevent unnecessary re-renders
  const expandedResult = useMemo(() => {
    return expandedModelId && results[expandedModelId]
      ? results[expandedModelId]
      : null;
  }, [expandedModelId, results]);

  return (
    <div className={cn("w-full mx-auto max-w-5xl overflow-hidden", className)}>
      {/* User Query Display */}
      <div className="mb-6 flex justify-end px-4 md:px-0">
        <div className="bg-primary text-primary-foreground px-4 py-3 rounded-2xl shadow-sm max-w-2xl">
          <div className="text-sm">{prompt}</div>
        </div>
      </div>

      {/* Action buttons */}
      {(canRetry || canCancelAll) && (
        <div className="mb-4 flex justify-end gap-2 px-4 md:px-0">
          {canRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="gap-2"
            >
              <RotateCcw className="size-4" />
              Retry
            </Button>
          )}

          {canCancelAll && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCancelAll}
              className="gap-2 text-red-600 hover:text-red-700"
            >
              <StopCircle className="size-4" />
              Cancel All
            </Button>
          )}
        </div>
      )}

      {/* Results Grid - Mobile horizontal scroll, Desktop grid */}
      <div className="relative">
        {/* Mobile: Enhanced horizontal scrollable cards */}
        <div className="md:hidden">
          <MobileScrollContainer
            itemCount={modelIds.length}
            itemIds={modelIds}
            showIndicators={modelIds.length > 1}
          >
            {modelIds.map((modelId) => {
              const result = results[modelId];
              if (!result) return null;

              return (
                <CompareResultCard
                  key={modelId}
                  modelId={modelId}
                  result={result}
                  onCancel={
                    onCancelModel ? () => onCancelModel(modelId) : undefined
                  }
                  onExpand={() => handleExpandCard(modelId)}
                  className="min-h-[400px] w-[80vw] max-w-[320px] shrink-0 snap-start"
                  isOnlyModel={modelIds.length === 1}
                />
              );
            })}
          </MobileScrollContainer>
        </div>

        {/* Desktop: Flexible grid layout based on model count */}
        <div
          className={cn(
            "hidden md:grid gap-4",
            modelIds.length === 1 && "md:grid-cols-1",
            modelIds.length === 2 && "md:grid-cols-2",
            modelIds.length === 3 && "md:grid-cols-3",
            modelIds.length === 4 && "md:grid-cols-4",
            modelIds.length === 5 && "md:grid-cols-5"
          )}
        >
          {modelIds.map((modelId) => {
            const result = results[modelId];
            if (!result) return null;

            return (
              <CompareResultCard
                key={modelId}
                modelId={modelId}
                result={result}
                onCancel={
                  onCancelModel ? () => onCancelModel(modelId) : undefined
                }
                onExpand={() => handleExpandCard(modelId)}
                className="min-h-[300px]"
                isOnlyModel={modelIds.length === 1}
              />
            );
          })}
        </div>
      </div>

      {modelIds.length === 1 && (
        <div className="mt-4 text-center text-sm text-muted-foreground px-4 md:px-0">
          Add more models to compare responses side-by-side
        </div>
      )}

      {/* Expandable Modal - Only render when needed */}
      {expandedModelId && (
        <ExpandableModal
          isOpen={true}
          onClose={handleCloseExpanded}
          title={expandedModelDisplayName}
          headerContent={
            expandedResult && (
              <ModalHeaderContent
                result={expandedResult}
                onCancel={
                  onCancelModel
                    ? () => onCancelModel(expandedModelId)
                    : undefined
                }
              />
            )
          }
        >
          {expandedResult && (
            <ExpandedCompareResult
              modelId={expandedModelId}
              result={expandedResult}
              onCancel={
                onCancelModel ? () => onCancelModel(expandedModelId) : undefined
              }
            />
          )}
        </ExpandableModal>
      )}
    </div>
  );
});
