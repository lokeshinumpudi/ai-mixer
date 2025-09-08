'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ExpandableModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  headerContent?: React.ReactNode; // Additional content for the header
  children: React.ReactNode;
  className?: string;
}

export function ExpandableModal({
  isOpen,
  onClose,
  title,
  headerContent,
  children,
  className,
}: ExpandableModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Memoize event handlers to prevent unnecessary re-renders
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose],
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  // Handle escape key press and body scroll
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Store original overflow to restore later
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = originalOverflow || 'unset';
      };
    }
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200"
        aria-hidden="true"
        role="presentation"
        onClick={handleBackdropClick}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className={cn(
          'relative w-full max-w-4xl max-h-[90vh] bg-background rounded-lg shadow-xl',
          'animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200',
          'border border-border',
          // Mobile optimizations
          'mx-2 sm:mx-4 md:mx-auto',
          'max-h-[95vh] sm:max-h-[90vh]',
          'rounded-lg sm:rounded-xl',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {title && (
              <h2 className="text-lg font-semibold text-foreground truncate">
                {title}
              </h2>
            )}
            {headerContent && (
              <div className="flex items-center gap-4 ml-auto">
                {headerContent}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground ml-2 flex-shrink-0"
            title="Close modal"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(95vh-80px)] sm:max-h-[calc(90vh-80px)]">
          {children}
        </div>
      </div>
    </div>
  );

  // Render modal in portal to ensure it's on top
  return createPortal(modalContent, document.body);
}
