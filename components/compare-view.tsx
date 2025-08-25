'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { BoxIcon, LoaderIcon } from '@/components/icons';
import { chatModels } from '@/lib/ai/models';
import { cn } from '@/lib/utils';
import { Messages } from './messages';
import type { ChatMessage } from '@/lib/types';

interface CompareColumnData {
  modelId: string;
  messages: ChatMessage[];
  status: 'loading' | 'streaming' | 'completed' | 'error';
  error?: string;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
}

interface CompareViewProps {
  chatId: string;
  selectedModels: string[];
  onClose: () => void;
  onContinueWithModel: (modelId: string) => void;
  initialMessages: ChatMessage[];
}

export function CompareView({
  chatId,
  selectedModels,
  onClose,
  onContinueWithModel,
  initialMessages,
}: CompareViewProps) {
  const [columns, setColumns] = useState<CompareColumnData[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Update columns with latest messages filtered by model
    const updatedColumns = selectedModels.map((modelId) => {
      const modelMessages = initialMessages.filter((msg) => {
        // Include all user messages
        if (msg.role === 'user') return true;

        // For assistant messages, only include if they have the matching modelId
        // If no modelId is set, don't include (these are from single-model mode)
        if (msg.role === 'assistant') {
          const messageModelId = (msg as any).modelId;
          return messageModelId === modelId;
        }

        return false;
      });

      // Determine status based on messages
      const hasAssistantResponse = modelMessages.some(
        (msg) => msg.role === 'assistant' && (msg as any).modelId === modelId,
      );

      return {
        modelId,
        messages: modelMessages,
        status: hasAssistantResponse
          ? ('completed' as const)
          : ('loading' as const),
        tokenUsage: { input: 0, output: 0, total: 0 },
      };
    });

    setColumns(updatedColumns);
  }, [selectedModels, initialMessages]);

  const getModelName = (modelId: string) => {
    const model = chatModels.find((m) => m.id === modelId);
    return model?.name || modelId;
  };

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -320, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 320, behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/50">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Compare Mode</h2>
          <div className="text-sm text-muted-foreground">
            {selectedModels.length} models
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={scrollLeft}>
            ←
          </Button>
          <Button variant="ghost" size="sm" onClick={scrollRight}>
            →
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <BoxIcon size={16} />
          </Button>
        </div>
      </div>

      {/* Horizontal Scrollable Columns */}
      <div className="flex-1 overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="h-full flex gap-4 p-4 overflow-x-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600"
          style={{ scrollbarWidth: 'thin' }}
        >
          {columns.map((column) => (
            <CompareColumn
              key={column.modelId}
              column={column}
              modelName={getModelName(column.modelId)}
              chatId={chatId}
              onContinueWithModel={() => onContinueWithModel(column.modelId)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface CompareColumnProps {
  column: CompareColumnData;
  modelName: string;
  chatId: string;
  onContinueWithModel: () => void;
}

function CompareColumn({
  column,
  modelName,
  chatId,
  onContinueWithModel,
}: CompareColumnProps) {
  return (
    <div className="flex flex-col w-80 min-w-80 h-full border rounded-lg bg-card">
      {/* Column Header */}
      <div className="flex flex-col p-3 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">{modelName}</h3>
          <div
            className={cn(
              'text-xs px-2 py-1 rounded-full',
              column.status === 'loading' &&
                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
              column.status === 'streaming' &&
                'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
              column.status === 'completed' &&
                'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
              column.status === 'error' &&
                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
            )}
          >
            {column.status === 'loading' && (
              <div className="flex items-center gap-1">
                <div className="animate-spin">
                  <LoaderIcon size={10} />
                </div>
                Loading
              </div>
            )}
            {column.status === 'streaming' && (
              <div className="flex items-center gap-1">
                <div className="animate-spin">
                  <LoaderIcon size={10} />
                </div>
                Streaming
              </div>
            )}
            {column.status === 'completed' && 'Completed'}
            {column.status === 'error' && 'Error'}
          </div>
        </div>

        {/* Token Usage */}
        {column.tokenUsage && column.tokenUsage.total > 0 && (
          <div className="mt-2 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>In: {column.tokenUsage.input}</span>
              <span>Out: {column.tokenUsage.output}</span>
              <span>Total: {column.tokenUsage.total}</span>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {column.status === 'error' ? (
          <div className="p-4 text-center">
            <p className="text-red-500 text-sm">
              {column.error || 'An error occurred.'}
            </p>
          </div>
        ) : (
          <Messages
            chatId={chatId}
            status={'awaiting_message' as any}
            messages={column.messages}
            votes={[]}
            setMessages={() => Promise.resolve()}
            regenerate={() => Promise.resolve()}
            isReadonly={true}
            isArtifactVisible={false}
          />
        )}
      </div>

      {/* Column Footer */}
      <div className="p-3 border-t bg-muted/30">
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={onContinueWithModel}
          disabled={column.status !== 'completed'}
        >
          Continue with {modelName}
        </Button>
      </div>
    </div>
  );
}
