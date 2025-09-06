"use client";

import { useRouter } from "next/navigation";
import { useWindowSize } from "usehooks-ts";

import { SidebarToggle } from "@/components/sidebar-toggle";
import { Button } from "@/components/ui/button";
import { useChatAccess } from "@/hooks/use-chat-access";
import { useModels } from "@/hooks/use-models";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import type { Chat } from "@/lib/db/schema";
import type { AppUser } from "@/lib/supabase/types";
import { memo, useEffect, useRef } from "react";
import { GoogleLoginCTA } from "./google-login-cta";
import { DiamondIcon, PlusIcon } from "./icons";
import { ShareButtonSimple } from "./share-button-simple";
import { MobileFriendlyTooltip } from "./ui/mobile-friendly-tooltip";
import { useSidebar } from "./ui/sidebar";
// We no longer render the visibility selector UI, but keep a lightweight
// type locally to avoid coupling to the old component.
type VisibilityType = "private" | "public";

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly,
  user,
  chat,
  isOwner,
  onVisibilityChange,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  user?: AppUser | null;
  chat?: Chat | null;
  isOwner?: boolean;
  onVisibilityChange?: (visibility: VisibilityType) => void;
}) {
  const { mutate: mutateModels, userType } = useModels();
  const { isAnonymous } = useSupabaseAuth();
  const router = useRouter();
  const { open } = useSidebar();
  const { isOwner: hookIsOwner } = useChatAccess(chat || null, chatId);

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
            headerRef.current.style.paddingTop = "4px";
            headerRef.current.style.paddingBottom = "4px";
            headerRef.current.classList.add("backdrop-blur-sm", "shadow-sm");
          } else {
            headerRef.current.style.paddingTop = "6px";
            headerRef.current.style.paddingBottom = "6px";
            headerRef.current.classList.remove("backdrop-blur-sm", "shadow-sm");
          }
        }
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
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

      {/* Right actions (mobile-optimized) */}
      <div className="ml-auto flex items-center gap-2 mr-2">
        {(!open || windowWidth < 768) && (
          <Button
            variant="outline"
            className="px-2 md:h-fit"
            onClick={async () => {
              // Force revalidation of models data for fresh user settings
              console.log(
                "🔄 Header: Clicking New Chat, triggering mutateModels..."
              );
              const freshData = await mutateModels();
              console.log("✅ Header: Fresh models data received:", freshData);
              router.push("/");
              router.refresh();
            }}
          >
            <PlusIcon />
            <span className="md:sr-only">New Chat</span>
          </Button>
        )}
        <ShareButtonSimple
          chatId={chatId}
          currentVisibility={selectedVisibilityType}
          onVisibilityChange={(visibility: VisibilityType) => {
            onVisibilityChange?.(visibility);
          }}
          isOwner={isOwner ?? hookIsOwner}
        />
      </div>

      {/* Upgrade button for free users */}
      {userType === "free" && (
        <MobileFriendlyTooltip
          content="Unlock all AI models with higher limits and premium features"
          side="bottom"
          showIcon={false}
        >
          <Button
            variant="default"
            size="sm"
            className="order-3 hidden md:flex items-center gap-1.5 text-xs bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
            onClick={() => {
              const paymentUrl =
                process.env.NEXT_PUBLIC_RAZORPAY_PAYMENT_PAGE_URL || "";
              if (paymentUrl) {
                window.open(paymentUrl, "_blank");
              } else {
                console.error(
                  "Payment URL not configured. Set NEXT_PUBLIC_RAZORPAY_PAYMENT_PAGE_URL."
                );
                router.push("/settings");
              }
            }}
          >
            <DiamondIcon size={12} />
            Upgrade to Pro
          </Button>
        </MobileFriendlyTooltip>
      )}
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return prevProps.selectedVisibilityType === nextProps.selectedVisibilityType;
});
