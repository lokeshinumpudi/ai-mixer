'use client';

import { useRouter } from 'next/navigation';
import { useWindowSize } from 'usehooks-ts';

import { SidebarToggle } from '@/components/sidebar-toggle';
import { Button } from '@/components/ui/button';
import type { Session } from 'next-auth';
import { memo, useEffect, useRef } from 'react';
import { DiamondIcon, PlusIcon } from './icons';
import { useSidebar } from './ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { type VisibilityType, VisibilitySelector } from './visibility-selector';

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly,
  session,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session;
}) {
  const router = useRouter();
  const { open } = useSidebar();

  const { width: windowWidth } = useWindowSize();
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    let raf = 0;
    let compressed = false;

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const shouldCompress = window.scrollY > 8;
        if (shouldCompress !== compressed && headerRef.current) {
          compressed = shouldCompress;
          if (shouldCompress) {
            headerRef.current.style.paddingTop = '4px';
            headerRef.current.style.paddingBottom = '4px';
            headerRef.current.classList.add('backdrop-blur-sm', 'shadow-sm');
          } else {
            headerRef.current.style.paddingTop = '6px';
            headerRef.current.style.paddingBottom = '6px';
            headerRef.current.classList.remove('backdrop-blur-sm', 'shadow-sm');
          }
        }
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <header
      ref={headerRef}
      className="flex sticky top-0 bg-background py-1.5 items-center px-2 md:px-2 gap-2"
    >
      <SidebarToggle />

      {(!open || windowWidth < 768) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="order-2 md:order-1 md:px-2 px-2 md:h-fit ml-auto md:ml-0"
              onClick={() => {
                router.push('/');
                router.refresh();
              }}
            >
              <PlusIcon />
              <span className="md:sr-only">New Chat</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Chat</TooltipContent>
        </Tooltip>
      )}

      {!isReadonly && (
        <VisibilitySelector
          chatId={chatId}
          selectedVisibilityType={selectedVisibilityType}
          className="order-1 md:order-2"
        />
      )}

      {/* Upgrade button for free users */}
      {session.user.type === 'free' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              size="sm"
              className="order-3 hidden md:flex items-center gap-1.5 text-xs bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
              onClick={() => router.push('/pricing')}
            >
              <DiamondIcon size={12} />
              Upgrade to Pro
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-center">
              <div className="font-medium">Unlock all models</div>
              <div className="text-xs text-muted-foreground">
                Higher limits + premium features
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return prevProps.selectedVisibilityType === nextProps.selectedVisibilityType;
});
