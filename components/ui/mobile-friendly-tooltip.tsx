'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

// Hook to detect touch devices
function useIsTouchDevice() {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const checkTouchDevice = () => {
      setIsTouchDevice(
        'ontouchstart' in window ||
          navigator.maxTouchPoints > 0 ||
          // @ts-ignore - for older browsers
          navigator.msMaxTouchPoints > 0,
      );
    };

    checkTouchDevice();

    // Listen for changes in case device capabilities change
    window.addEventListener('touchstart', checkTouchDevice, { once: true });

    return () => {
      window.removeEventListener('touchstart', checkTouchDevice);
    };
  }, []);

  return isTouchDevice;
}

export interface MobileFriendlyTooltipProps {
  /** The tooltip content text */
  content: string;
  /** The trigger element - can be text, icon, or any React node */
  children: React.ReactNode;
  /** Whether to show an info icon alongside the trigger */
  showIcon?: boolean;
  /** Icon size when showIcon is true */
  iconSize?: 'sm' | 'md' | 'lg';
  /** Tooltip positioning */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Tooltip alignment */
  align?: 'start' | 'center' | 'end';
  /** Distance from trigger element */
  sideOffset?: number;
  /** Auto-close timeout in milliseconds (mobile only) */
  autoCloseDelay?: number;
  /** Custom CSS classes for the trigger wrapper */
  triggerClassName?: string;
  /** Custom CSS classes for the tooltip content */
  contentClassName?: string;
  /** Whether the trigger should be a button (for better accessibility) */
  asButton?: boolean;
  /** Button type when asButton is true */
  buttonType?: 'button' | 'submit' | 'reset';
  /** Disabled state */
  disabled?: boolean;
  /** Callback when tooltip opens/closes */
  onOpenChange?: (open: boolean) => void;
}

export function MobileFriendlyTooltip({
  content,
  children,
  showIcon = true,
  iconSize = 'sm',
  side = 'top',
  align = 'center',
  sideOffset = 5,
  autoCloseDelay = 5000,
  triggerClassName = '',
  contentClassName = '',
  asButton = true,
  buttonType = 'button',
  disabled = false,
  onOpenChange,
}: MobileFriendlyTooltipProps) {
  const isTouchDevice = useIsTouchDevice();
  const [isOpen, setIsOpen] = useState(false);
  const tooltipRef = useRef<HTMLElement>(null);

  // Icon size mapping
  const iconSizeMap = {
    sm: 'size-3',
    md: 'size-4',
    lg: 'size-5',
  };

  // Handle open/close state changes
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };

  // Close tooltip when clicking outside on touch devices
  useEffect(() => {
    if (!isTouchDevice || !isOpen) return;

    const handleClickOutside = (event: TouchEvent | MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node)
      ) {
        handleOpenChange(false);
      }
    };

    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isTouchDevice, isOpen]);

  // Touch event handlers
  const handleClick = (e: React.MouseEvent) => {
    if (disabled) return;

    if (isTouchDevice) {
      e.preventDefault();
      e.stopPropagation();
      handleOpenChange(!isOpen);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (disabled) return;

    if (isTouchDevice) {
      e.preventDefault();
      e.stopPropagation();
      handleOpenChange(!isOpen);
    }
  };

  // Auto-close tooltip after specified delay on touch devices
  useEffect(() => {
    if (!isTouchDevice || !isOpen || autoCloseDelay <= 0) return;

    const timer = setTimeout(() => {
      handleOpenChange(false);
    }, autoCloseDelay);

    return () => clearTimeout(timer);
  }, [isTouchDevice, isOpen, autoCloseDelay]);

  // Check if children is already an interactive element (button, input, etc.)
  const isChildInteractive =
    React.isValidElement(children) &&
    (children.type === 'button' ||
      (typeof children.type === 'function' &&
        children.type.name?.includes('Button')) ||
      children.props?.onClick ||
      children.props?.onTouchEnd);

  // If child is already interactive, use asChild to avoid nesting
  if (isChildInteractive) {
    return (
      <Tooltip
        open={isTouchDevice ? isOpen : undefined}
        onOpenChange={isTouchDevice ? handleOpenChange : undefined}
      >
        <TooltipTrigger asChild>
          {React.cloneElement(children as React.ReactElement, {
            ref: tooltipRef,
            onClick: (e: React.MouseEvent) => {
              // Call original onClick if it exists
              const originalOnClick = (children as React.ReactElement).props
                ?.onClick;
              if (originalOnClick) originalOnClick(e);

              // Add our touch handling
              handleClick(e);
            },
            onTouchEnd: (e: React.TouchEvent) => {
              // Call original onTouchEnd if it exists
              const originalOnTouchEnd = (children as React.ReactElement).props
                ?.onTouchEnd;
              if (originalOnTouchEnd) originalOnTouchEnd(e);

              // Add our touch handling
              handleTouchEnd(e);
            },
          })}
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          className={`max-w-xs text-xs z-50 pointer-events-auto ${contentClassName}`}
          sideOffset={sideOffset}
          onPointerDownOutside={(e) => {
            if (isTouchDevice) {
              e.preventDefault();
            }
          }}
        >
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // For non-interactive children, create our own wrapper
  const baseTriggerClasses = `
    flex items-center gap-1 cursor-help
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    ${triggerClassName}
  `.trim();

  const buttonClasses = `
    ${baseTriggerClasses}
    text-left bg-transparent border-none p-0 font-inherit text-inherit 
    hover:bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-sm
  `.trim();

  const TriggerElement = asButton ? 'button' : 'div';
  const triggerProps = asButton
    ? {
        type: buttonType,
        onClick: handleClick,
        onTouchEnd: handleTouchEnd,
        disabled,
        className: buttonClasses,
      }
    : {
        onClick: handleClick,
        onTouchEnd: handleTouchEnd,
        className: baseTriggerClasses,
      };

  return (
    <Tooltip
      open={isTouchDevice ? isOpen : undefined}
      onOpenChange={isTouchDevice ? handleOpenChange : undefined}
    >
      <TooltipTrigger asChild>
        <TriggerElement ref={tooltipRef as any} {...triggerProps}>
          {children}
          {showIcon && (
            <Info
              className={`${iconSizeMap[iconSize]} text-muted-foreground hover:text-foreground transition-colors`}
            />
          )}
        </TriggerElement>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        className={`max-w-xs text-xs z-50 pointer-events-auto ${contentClassName}`}
        sideOffset={sideOffset}
        onPointerDownOutside={(e) => {
          if (isTouchDevice) {
            e.preventDefault();
          }
        }}
      >
        <p>{content}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// Provider wrapper component for easy setup
export interface MobileFriendlyTooltipProviderProps {
  children: React.ReactNode;
  /** Delay before tooltip appears on hover (desktop) */
  delayDuration?: number;
  /** Skip delay when moving between tooltips */
  skipDelayDuration?: number;
  /** Whether to disable hoverable content */
  disableHoverableContent?: boolean;
}

export function MobileFriendlyTooltipProvider({
  children,
  delayDuration = 0,
  skipDelayDuration = 0,
  disableHoverableContent = false,
}: MobileFriendlyTooltipProviderProps) {
  return (
    <TooltipProvider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      disableHoverableContent={disableHoverableContent}
    >
      {children}
    </TooltipProvider>
  );
}

// Convenience component for common use cases
export interface InfoTooltipProps {
  /** The tooltip content text */
  content: string;
  /** Icon size */
  size?: 'sm' | 'md' | 'lg';
  /** Custom classes for the icon */
  className?: string;
  /** All other MobileFriendlyTooltip props */
  tooltipProps?: Partial<MobileFriendlyTooltipProps>;
}

export function InfoTooltip({
  content,
  size = 'sm',
  className = '',
  tooltipProps = {},
}: InfoTooltipProps) {
  return (
    <MobileFriendlyTooltip
      content={content}
      showIcon={true}
      iconSize={size}
      triggerClassName={className}
      {...tooltipProps}
    >
      <span className="sr-only">More information</span>
    </MobileFriendlyTooltip>
  );
}

// Text with tooltip component
export interface TextWithTooltipProps {
  /** The visible text */
  text: string;
  /** The tooltip content */
  tooltip: string;
  /** Whether to show info icon */
  showIcon?: boolean;
  /** Text element type */
  as?: 'span' | 'div' | 'p' | 'label';
  /** Custom classes for the text */
  className?: string;
  /** All other MobileFriendlyTooltip props */
  tooltipProps?: Partial<MobileFriendlyTooltipProps>;
}

export function TextWithTooltip({
  text,
  tooltip,
  showIcon = true,
  as: Element = 'span',
  className = '',
  tooltipProps = {},
}: TextWithTooltipProps) {
  return (
    <MobileFriendlyTooltip
      content={tooltip}
      showIcon={showIcon}
      asButton={false}
      triggerClassName={className}
      {...tooltipProps}
    >
      <Element>{text}</Element>
    </MobileFriendlyTooltip>
  );
}
