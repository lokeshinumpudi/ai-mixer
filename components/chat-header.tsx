'use client';

import { useRouter } from 'next/navigation';
import { useWindowSize } from 'usehooks-ts';

import { SidebarToggle } from '@/components/sidebar-toggle';
import { Button } from '@/components/ui/button';
import { PlusIcon } from './icons';
import { useSidebar } from './ui/sidebar';
import { memo, useEffect, useRef } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { type VisibilityType, VisibilitySelector } from './visibility-selector';
import type { Session } from 'next-auth';
import { useAnimeControls } from '@/hooks/use-anime';

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
  const { createAnimation } = useAnimeControls();

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
            createAnimation(headerRef.current, {
              paddingTop: 4,
              paddingBottom: 4,
              duration: 200,
              ease: 'outQuad',
            });
            headerRef.current.classList.add('backdrop-blur-sm', 'shadow-sm');
          } else {
            createAnimation(headerRef.current, {
              paddingTop: 6,
              paddingBottom: 6,
              duration: 200,
              ease: 'outQuad',
            });
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
  }, [createAnimation]);

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
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return prevProps.selectedVisibilityType === nextProps.selectedVisibilityType;
});
