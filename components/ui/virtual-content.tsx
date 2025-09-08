'use client';

import { cn } from '@/lib/utils';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

interface VirtualContentProps {
  content: string;
  className?: string;
  maxHeight?: number;
  threshold?: number; // Content length threshold to enable virtualization
}

// Virtualized content component for very long text content
export const VirtualContent = memo(function VirtualContent({
  content,
  className,
  maxHeight = 400,
  threshold = 10000, // 10k characters
}: VirtualContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVirtualized, setIsVirtualized] = useState(false);
  const [visibleContent, setVisibleContent] = useState('');

  // Check if content needs virtualization
  useEffect(() => {
    if (content.length > threshold) {
      setIsVirtualized(true);
      // Initially show first portion of content
      setVisibleContent(`${content.substring(0, 2000)}...`);
    } else {
      setIsVirtualized(false);
      setVisibleContent(content);
    }
  }, [content, threshold]);

  const handleShowMore = useCallback(() => {
    if (isVirtualized) {
      setVisibleContent(content);
      setIsVirtualized(false);
    }
  }, [content, isVirtualized]);

  const handleShowLess = useCallback(() => {
    if (!isVirtualized && content.length > threshold) {
      setVisibleContent(`${content.substring(0, 2000)}...`);
      setIsVirtualized(true);
      // Scroll back to top of content
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
      }
    }
  }, [content, threshold, isVirtualized]);

  return (
    <div className={cn('relative', className)}>
      <div
        ref={containerRef}
        className="overflow-y-auto"
        style={{ maxHeight: `${maxHeight}px` }}
      >
        <div className="whitespace-pre-wrap">{visibleContent}</div>
      </div>

      {/* Show controls only for long content */}
      {content.length > threshold && (
        <div className="mt-3 flex justify-center">
          {isVirtualized ? (
            // biome-ignore lint/a11y/useButtonType: <explanation>
            <button
              onClick={handleShowMore}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium px-3 py-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
            >
              Show full content ({Math.round(content.length / 1000)}k chars)
            </button>
          ) : (
            // biome-ignore lint/a11y/useButtonType: <explanation>
            <button
              onClick={handleShowLess}
              className="text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium px-3 py-1 rounded-md hover:bg-gray-50 dark:hover:bg-gray-950/20 transition-colors"
            >
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  );
});
