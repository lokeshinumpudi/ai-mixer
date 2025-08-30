'use client';

import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { memo, useEffect, useRef } from 'react';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { VisibilityType } from './visibility-selector';
import type { ChatMessage } from '@/lib/types';
import { useAnimeControls } from '@/hooks/use-anime';

interface SuggestedActionsProps {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  selectedVisibilityType: VisibilityType;
}

function PureSuggestedActions({
  chatId,
  sendMessage,
  selectedVisibilityType,
}: SuggestedActionsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { staggerAnimation } = useAnimeControls();

  useEffect(() => {
    if (containerRef.current) {
      staggerAnimation(
        Array.from(containerRef.current.children),
        {
          opacity: [0, 1],
          translateY: [20, 0],
          scale: [0.95, 1],
          duration: 600,
          ease: 'outQuart',
        },
        100,
      );
    }
  }, []);

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

              sendMessage({
                role: 'user',
                parts: [{ type: 'text', text: suggestedAction.action }],
              });
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

    return true;
  },
);
