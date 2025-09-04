'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { CompareRunState } from '@/hooks/use-compare-run';
import { cn } from '@/lib/utils';
import { RotateCcw, StopCircle } from 'lucide-react';
import { CompareCard } from './compare-card';

interface CompareCanvasProps {
  compareState: CompareRunState;
  onCancelModel?: (modelId: string) => void;
  onCancelAll?: () => void;
  onRetry?: () => void;
  className?: string;
}

export function CompareCanvas({
  compareState,
  onCancelModel,
  onCancelAll,
  onRetry,
  className,
}: CompareCanvasProps) {
  const { modelIds, byModelId, status, isRunning, prompt } = compareState;

  if (!modelIds.length) {
    return null;
  }

  const canCancelAll = isRunning && onCancelAll;
  const canRetry = (status === 'failed' || status === 'canceled') && onRetry;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">AI Model Comparison</CardTitle>
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{prompt}</p>
          </div>

          <div className="flex items-center gap-2">
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
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="p-4">
        <div
          className={cn(
            'grid gap-4',
            modelIds.length === 1 && 'grid-cols-1',
            modelIds.length === 2 && 'grid-cols-2',
            modelIds.length === 3 && 'grid-cols-3',
            modelIds.length === 4 && 'grid-cols-4',
            modelIds.length === 5 && 'grid-cols-5',
          )}
        >
          {modelIds.map((modelId) => {
            const modelState = byModelId[modelId];
            if (!modelState) return null;

            return (
              <CompareCard
                key={modelId}
                modelId={modelId}
                modelState={modelState}
                onCancel={
                  onCancelModel ? () => onCancelModel(modelId) : undefined
                }
                className="min-h-[400px]"
              />
            );
          })}
        </div>

        {modelIds.length === 1 && (
          <div className="mt-4 text-center text-sm text-gray-500">
            Add more models to compare responses side-by-side
          </div>
        )}
      </CardContent>
    </Card>
  );
}
