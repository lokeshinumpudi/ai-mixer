'use client';

import { useState, useEffect } from 'react';
import { ChevronDownIcon, LoaderIcon } from './icons';
import { motion, AnimatePresence } from 'framer-motion';
import { Markdown } from './markdown';
import { cn } from '@/lib/utils';

interface MessageReasoningProps {
  isLoading: boolean;
  reasoning: string;
}

export function MessageReasoning({
  isLoading,
  reasoning,
}: MessageReasoningProps) {
  const [isExpanded, setIsExpanded] = useState(isLoading);

  // Auto-expand when loading starts, auto-collapse when done
  useEffect(() => {
    if (isLoading) {
      setIsExpanded(true);
    } else {
      // Auto-collapse after reasoning is complete
      const timer = setTimeout(() => {
        setIsExpanded(false);
      }, 1000); // Give user 1 second to see the completion

      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  const variants = {
    collapsed: {
      height: 0,
      opacity: 0,
    },
    expanded: {
      height: 'auto',
      opacity: 1,
    },
  };

  return (
    <div className="flex flex-col my-2">
      {/* Simplified inline header */}
      <button
        data-testid="message-reasoning-toggle"
        type="button"
        className={cn(
          'flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500',
          'hover:text-slate-500 dark:hover:text-slate-400 transition-colors duration-200',
          'w-fit cursor-pointer group',
          !isLoading && 'mb-1',
        )}
        onClick={() => {
          if (!isLoading) {
            setIsExpanded(!isExpanded);
          }
        }}
        disabled={isLoading}
      >
        {/* Simple thinking indicator */}
        {isLoading ? (
          <>
            <div className="animate-spin">
              <LoaderIcon size={12} />
            </div>
            <span>Thinking...</span>
          </>
        ) : (
          <>
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-slate-400 dark:text-slate-500"
            >
              <ChevronDownIcon size={12} />
            </motion.div>
            <span>Reasoned for a few seconds</span>
          </>
        )}
      </button>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            data-testid="message-reasoning"
            key="content"
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={variants}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="pl-4 border-l border-slate-200/60 dark:border-slate-700/60">
              <div
                className="max-h-[280px] overflow-y-auto pr-2 reasoning-scrollbar"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgb(148 163 184) transparent',
                }}
              >
                <div className="prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  <Markdown>{reasoning}</Markdown>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
