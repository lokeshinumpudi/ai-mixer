'use client';

import { useRouter } from 'next/navigation';
import { useWindowSize } from 'usehooks-ts';

import { SidebarToggle } from '@/components/sidebar-toggle';
import { Button } from '@/components/ui/button';
import { useModels } from '@/hooks/use-models';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';
import type { AppUser } from '@/lib/supabase/types';
import { memo, useEffect, useRef } from 'react';
import { GoogleLoginCTA } from './google-login-cta';
import { DiamondIcon, PlusIcon } from './icons';
import { useSidebar } from './ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
// We no longer render the visibility selector UI, but keep a lightweight
// type locally to avoid coupling to the old component.
type VisibilityType = 'private' | 'public';

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly,
  user,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  user?: AppUser | null;
}) {
  const { mutate: mutateModels, userType } = useModels();
  const { isAnonymous } = useSupabaseAuth();
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

      {/* Google Login CTA for anonymous users - show when sidebar is closed or on mobile */}
      {isAnonymous && (!open || windowWidth < 768) && (
        <GoogleLoginCTA variant="outline" size="sm" className="order-1" />
      )}

      {(!open || windowWidth < 768) && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="order-2 md:order-1 md:px-2 px-2 md:h-fit ml-auto md:ml-0"
              onClick={async () => {
                // Force revalidation of models data for fresh user settings
                console.log(
                  '🔄 Header: Clicking New Chat, triggering mutateModels...',
                );
                const freshData = await mutateModels();
                console.log(
                  '✅ Header: Fresh models data received:',
                  freshData,
                );
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

      {/* Visibility selector temporarily removed from UI */}

      {/* Upgrade button for free users */}
      {userType === 'free' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              size="sm"
              className="order-3 hidden md:flex items-center gap-1.5 text-xs bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
              onClick={() => {
                const paymentUrl =
                  process.env.NEXT_PUBLIC_RAZORPAY_PAYMENT_PAGE_URL || '';
                if (paymentUrl) {
                  window.open(paymentUrl, '_blank');
                } else {
                  console.error(
                    'Payment URL not configured. Set NEXT_PUBLIC_RAZORPAY_PAYMENT_PAGE_URL.',
                  );
                  router.push('/settings');
                }
              }}
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
