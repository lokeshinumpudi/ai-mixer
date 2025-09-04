'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { CompareModelState } from '@/hooks/use-compare-run';
import { getModelCapabilities } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { CheckCircle, Loader2, StopCircle, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Markdown } from '../markdown';

interface CompareCardProps {
  modelId: string;
  modelState: CompareModelState;
  onCancel?: () => void;
  className?: string;
}

function getModelDisplayName(modelId: string): string {
  // Extract the model name from the provider/model format
  const parts = modelId.split('/');
  if (parts.length === 2) {
    const [provider, model] = parts;
    // Capitalize provider and format model name
    const capitalizedProvider =
      provider.charAt(0).toUpperCase() + provider.slice(1);
    return `${capitalizedProvider} ${model}`;
  }
  return modelId;
}

function getStatusIcon(status: CompareModelState['status']) {
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

function getStatusColor(status: CompareModelState['status']) {
  switch (status) {
    case 'pending':
      return 'bg-gray-100 text-gray-700';
    case 'running':
      return 'bg-blue-100 text-blue-700';
    case 'completed':
      return 'bg-green-100 text-green-700';
    case 'canceled':
      return 'bg-yellow-100 text-yellow-700';
    case 'failed':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

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

function LiveTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startTime).getTime();

    const updateElapsed = () => {
      const now = Date.now();
      const elapsedMs = now - start;
      setElapsed(elapsedMs);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 100);
    return () => clearInterval(interval);
  }, [startTime]);

  return <span>{(elapsed / 1000).toFixed(1)}s</span>;
}

export function CompareCard({
  modelId,
  modelState,
  onCancel,
  className,
}: CompareCardProps) {
  const modelName = getModelDisplayName(modelId);
  const capabilities = getModelCapabilities(modelId);
  const canCancel = modelState.status === 'running' && onCancel;

  return (
    <Card className={cn('flex h-full flex-col', className)}>
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(modelState.status)}
            <h3 className="font-semibold text-sm">{modelName}</h3>
          </div>
          {canCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-8 w-8 p-0 text-gray-500 hover:text-red-500"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={cn('text-xs', getStatusColor(modelState.status))}
          >
            {modelState.status}
          </Badge>

          {capabilities.supportsReasoning && (
            <Badge variant="outline" className="text-xs">
              Reasoning
            </Badge>
          )}

          {capabilities.supportsVision && (
            <Badge variant="outline" className="text-xs">
              Vision
            </Badge>
          )}
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 overflow-hidden p-4">
        {modelState.status === 'failed' && modelState.error ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-red-600">
              <XCircle className="mx-auto h-8 w-8 mb-2" />
              <p className="text-sm font-medium">Failed</p>
              <p className="text-xs text-red-500 mt-1">{modelState.error}</p>
            </div>
          </div>
        ) : modelState.status === 'canceled' ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-yellow-600">
              <StopCircle className="mx-auto h-8 w-8 mb-2" />
              <p className="text-sm font-medium">Canceled</p>
            </div>
          </div>
        ) : modelState.content ? (
          <div className="h-full overflow-y-auto">
            <Markdown>{modelState.content}</Markdown>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-gray-500">
              {modelState.status === 'running' ? (
                <>
                  <Loader2 className="mx-auto h-8 w-8 mb-2 animate-spin" />
                  <p className="text-sm">Generating response...</p>
                </>
              ) : (
                <p className="text-sm">Waiting to start...</p>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {(modelState.usage ||
        modelState.inferenceTimeMs != null ||
        modelState.serverStartedAt) && (
        <>
          <Separator />
          <div className="flex-shrink-0 px-4 py-2 text-xs text-gray-500 space-y-1">
            {(() => {
              const { inTokens, outTokens } = resolveTokenCounts(
                modelState.usage,
              );
              if (inTokens == null && outTokens == null) return null;
              return (
                <div className="flex justify-between">
                  <span>Tokens:</span>
                  <span>
                    {inTokens ?? 0} → {outTokens ?? 0}
                  </span>
                </div>
              );
            })()}

            {modelState.status === 'completed' &&
              modelState.inferenceTimeMs != null && (
                <div className="flex items-center justify-between">
                  <span>Inference time:</span>
                  <span>{(modelState.inferenceTimeMs / 1000).toFixed(2)}s</span>
                </div>
              )}

            {modelState.status === 'running' && modelState.serverStartedAt && (
              <div className="flex items-center justify-between">
                <span>Running for:</span>
                <LiveTimer startTime={modelState.serverStartedAt} />
              </div>
            )}

            {modelState.status === 'completed' &&
              modelState.inferenceTimeMs != null &&
              (() => {
                const { outTokens } = resolveTokenCounts(modelState.usage);
                if (outTokens == null) return null;
                const speed = outTokens / (modelState.inferenceTimeMs / 1000);
                return (
                  <div className="flex items-center justify-between font-medium">
                    <span>Speed:</span>
                    <span>{speed.toFixed(1)} tok/s</span>
                  </div>
                );
              })()}
          </div>
        </>
      )}
    </Card>
  );
}
