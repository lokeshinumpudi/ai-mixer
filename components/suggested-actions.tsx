'use client';

import { uiLogger } from '@/lib/logger';
import type { ChatMessage } from '@/lib/types';
import type { UseChatHelpers } from '@ai-sdk/react';
import { motion } from 'framer-motion';
import { memo, useRef } from 'react';
import { Button } from './ui/button';
type VisibilityType = 'private' | 'public';

interface SuggestedActionsProps {
  chatId: string;
  sendMessage?: UseChatHelpers<ChatMessage>['sendMessage'];
  selectedVisibilityType: VisibilityType;
  // Compare mode props
  isCompareMode?: boolean;
  selectedModelIds?: string[];
  onStartCompare?: (prompt: string, modelIds: string[]) => void;
}

function PureSuggestedActions({
  chatId,
  sendMessage,
  selectedVisibilityType,
  isCompareMode = false,
  selectedModelIds = [],
  onStartCompare,
}: SuggestedActionsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestedActions = [
    {
      title: 'What are the advantages',
      label: 'of using Next.js?',
      action: 'What are the advantages of using Next.js?',
    },
    {
      title: 'Write code to',
      label: `demonstrate djikstra's algorithm`,
      action: `Write code to demonstrate djikstra's algorithm`,
    },
    {
      title: 'Help me write an essay',
      label: `about silicon valley`,
      action: `Help me write an essay about silicon valley`,
    },
    {
      title: 'What is the weather',
      label: 'in San Francisco?',
      action: 'What is the weather in San Francisco?',
    },
  ];

  return (
    <div
      ref={containerRef}
      data-testid="suggested-actions"
      className="grid sm:grid-cols-2 gap-3 w-full"
    >
      {suggestedActions.map((suggestedAction, index) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 * index }}
          key={`suggested-action-${suggestedAction.title}-${index}`}
          className={index > 1 ? 'hidden sm:block' : 'block'}
        >
          <Button
            variant="ghost"
            onClick={async () => {
              window.history.replaceState({}, '', `/chat/${chatId}`);

              // Always use compare mode for unified architecture (1-N models)
              if (selectedModelIds.length > 0 && onStartCompare) {
                onStartCompare(suggestedAction.action, selectedModelIds);
              } else {
                // This should not happen in unified architecture
                uiLogger.warn(
                  {
                    chatId,
                    action: suggestedAction.action,
                    selectedModelIds,
                  },
                  'No models selected for suggested action',
                );
              }
            }}
            className="luxury-button text-left border border-border/50 rounded-2xl px-5 py-4 text-sm flex-1 gap-2 sm:flex-col w-full h-auto justify-start items-start hover:border-border hover:shadow-sm"
          >
            <span className="font-medium">{suggestedAction.title}</span>
            <span className="text-muted-foreground">
              {suggestedAction.label}
            </span>
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) return false;
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
      return false;
    if (prevProps.isCompareMode !== nextProps.isCompareMode) return false;
    if (
      prevProps.selectedModelIds?.length !== nextProps.selectedModelIds?.length
    )
      return false;

    return true;
  },
);
