'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { getModelCapabilities } from '@/lib/constants';
import { cn } from '@/lib/utils';
import {
  CheckCircle,
  Loader2,
  RotateCcw,
  StopCircle,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Markdown } from './markdown';

// Provider-based color mapping for model chips
function getModelChipColor(modelId: string): string {
  const provider = modelId.split('/')[0]?.toLowerCase();

  switch (provider) {
    case 'openai':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800';
    case 'anthropic':
      return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-800';
    case 'google':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800';
    case 'meta':
      return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-800';
    case 'mistral':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800';
    case 'cohere':
      return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-400 dark:border-teal-800';
    case 'perplexity':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-400 dark:border-indigo-800';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950/50 dark:text-slate-400 dark:border-slate-800';
  }
}

export interface CompareMessageData {
  id: string;
  prompt: string;
  modelIds: string[];
  status: 'running' | 'completed' | 'canceled' | 'failed';
  results: {
    [modelId: string]: {
      status: 'pending' | 'running' | 'completed' | 'canceled' | 'failed';
      content: string;
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

function getModelDisplayName(modelId: string): string {
  const parts = modelId.split('/');
  if (parts.length === 2) {
    const [provider, model] = parts;
    const capitalizedProvider =
      provider.charAt(0).toUpperCase() + provider.slice(1);
    return `${capitalizedProvider} ${model}`;
  }
  return modelId;
}

function getStatusIcon(
  status: CompareMessageData['results'][string]['status'],
) {
  switch (status) {
    case 'pending':
      return <div className="h-4 w-4 rounded-full bg-gray-300" />;
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'canceled':
      return <StopCircle className="h-4 w-4 text-yellow-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return null;
  }
}

function getStatusColor(
  status: CompareMessageData['results'][string]['status'],
) {
  switch (status) {
    case 'pending':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    case 'running':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'completed':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    case 'canceled':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'failed':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }
}

function CompareResultCard({
  modelId,
  result,
  onCancel,
  className,
}: {
  modelId: string;
  result: CompareMessageData['results'][string];
  onCancel?: () => void;
  className?: string;
}) {
  const modelName = getModelDisplayName(modelId);
  const capabilities = getModelCapabilities(modelId);
  const canCancel = result.status === 'running' && onCancel;

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

  return (
    <Card className={cn('flex h-full flex-col', className)}>
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-xs font-medium border ${getModelChipColor(
                modelId,
              )}`}
            >
              {modelName}
            </Badge>
            <Badge
              className={cn('text-xs', getStatusColor(result.status))}
              variant="secondary"
            >
              <div className="flex items-center gap-1">
                {getStatusIcon(result.status)}
                <span className="capitalize">{result.status}</span>
              </div>
            </Badge>
          </div>

          <div className="flex items-center gap-1">
            {canCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                title="Cancel this model"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Model capabilities */}
        {/* {capabilities && (
          <div className="flex items-center gap-1 mt-1">
            {capabilities.supportsReasoning && (
              <Badge variant="outline" className="text-xs">
                Reasoning
              </Badge>
            )}
            {capabilities.supportsArtifacts && (
              <Badge variant="outline" className="text-xs">
                Artifacts
              </Badge>
            )}
          </div>
        )} */}
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 p-4 overflow-hidden">
        <div className="h-full overflow-y-auto">
          {result.status === 'failed' && result.error ? (
            <div className="text-red-600 text-sm">
              <p className="font-medium">Error:</p>
              <p>{result.error}</p>
            </div>
          ) : result.content ? (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <Markdown>{result.content}</Markdown>
            </div>
          ) : result.status === 'running' ? (
            <div className="text-muted-foreground text-sm">
              Generating response...
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">
              Waiting to start...
            </div>
          )}
        </div>

        {/* Usage and timing info - show whenever we have data */}
        {(result.usage ||
          result.inferenceTimeMs != null ||
          result.serverStartedAt) && (
          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground space-y-1">
            {(() => {
              const { inTokens, outTokens } = resolveTokenCounts(result.usage);
              if (inTokens == null && outTokens == null) return null;
              return (
                <div className="flex items-center justify-between">
                  <span>Tokens:</span>
                  <span>
                    {inTokens ?? 0} in, {outTokens ?? 0} out
                  </span>
                </div>
              );
            })()}
            {result.status === 'completed' && result.inferenceTimeMs && (
              <div className="flex items-center justify-between">
                <span>Inference time:</span>
                <span>{(result.inferenceTimeMs / 1000).toFixed(2)}s</span>
              </div>
            )}
            {result.status === 'running' && result.serverStartedAt && (
              <div className="flex items-center justify-between">
                <span>Running for:</span>
                <LiveTimer startTime={result.serverStartedAt} />
              </div>
            )}
            {result.status === 'completed' &&
              result.inferenceTimeMs &&
              (() => {
                const { outTokens } = resolveTokenCounts(result.usage);
                if (outTokens == null) return null;
                const speed = outTokens / (result.inferenceTimeMs / 1000);
                return (
                  <div className="flex items-center justify-between font-medium">
                    <span>Speed:</span>
                    <span>{speed.toFixed(1)} tok/s</span>
                  </div>
                );
              })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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

export function CompareMessage({
  data,
  onCancelModel,
  onCancelAll,
  onRetry,
  className,
}: CompareMessageProps) {
  const { modelIds, status, results, prompt } = data;

  const isRunning = status === 'running';
  const canCancelAll = isRunning && onCancelAll;
  const canRetry = (status === 'failed' || status === 'canceled') && onRetry;

  const completedResults = modelIds.filter(
    (modelId) => results[modelId]?.status === 'completed',
  );

  return (
    <div className={cn('w-full mx-auto max-w-5xl', className)}>
      {/* User Query Display */}
      <div className="mb-6 flex justify-end">
        <div className="bg-primary text-primary-foreground px-4 py-3 rounded-2xl shadow-sm max-w-2xl">
          <div className="text-sm">{prompt}</div>
        </div>
      </div>

      {/* Action buttons */}
      {(canRetry || canCancelAll) && (
        <div className="mb-4 flex justify-end gap-2">
          {canRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
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
              <StopCircle className="h-4 w-4" />
              Cancel All
            </Button>
          )}
        </div>
      )}

      {/* Results Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
              className="min-h-[300px]"
            />
          );
        })}
      </div>

      {modelIds.length === 1 && (
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Add more models to compare responses side-by-side
        </div>
      )}
    </div>
  );
}
