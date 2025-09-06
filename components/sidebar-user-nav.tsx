'use client';

import { useSupabaseAuth } from '@/hooks/use-supabase-auth';
import { createClient } from '@/lib/supabase/client';
import { ChevronUp } from 'lucide-react';
import { useTheme } from 'next-themes';
import Image from 'next/image';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useRouter } from 'next/navigation';
import { LoaderIcon } from './icons';
import { toast } from './toast';
import { MobileFriendlyTooltip } from './ui/mobile-friendly-tooltip';
export function SidebarUserNav({ user }: { user: any }) {
  const router = useRouter();
  const { loading, signOut } = useSupabaseAuth();
  const { setTheme, resolvedTheme } = useTheme();
  const { setOpenMobile, setOpen } = useSidebar();
  const supabase = createClient();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {loading ? (
              <SidebarMenuButton className="data-[state=open]:bg-sidebar-accent bg-background data-[state=open]:text-sidebar-accent-foreground h-10 justify-between">
                <div className="flex flex-row gap-2">
                  <div className="size-6 bg-zinc-500/30 rounded-full animate-pulse" />
                  <span className="bg-zinc-500/30 text-transparent rounded-md animate-pulse">
                    Loading auth status
                  </span>
                </div>
                <div className="animate-spin text-zinc-500">
                  <LoaderIcon />
                </div>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                data-testid="user-nav-button"
                className="data-[state=open]:bg-sidebar-accent bg-background data-[state=open]:text-sidebar-accent-foreground h-10"
              >
                <Image
                  src={`https://avatar.vercel.sh/${user.email}`}
                  alt={user.email ?? 'User Avatar'}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
                <span data-testid="user-email" className="truncate">
                  {user?.email}
                </span>
                <ChevronUp className="ml-auto" />
              </SidebarMenuButton>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            data-testid="user-nav-menu"
            side="top"
            className="w-[--radix-popper-anchor-width]"
          >
            <MobileFriendlyTooltip
              content={`Switch to ${
                resolvedTheme === 'light' ? 'dark' : 'light'
              } theme for better viewing experience`}
              side="left"
              showIcon={false}
            >
              <DropdownMenuItem
                data-testid="user-nav-item-theme"
                className="cursor-pointer"
                onSelect={() =>
                  setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
                }
              >
                {`Toggle ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
              </DropdownMenuItem>
            </MobileFriendlyTooltip>
            <MobileFriendlyTooltip
              content="Access your account settings, usage analytics, and customization options"
              side="left"
              showIcon={false}
            >
              <DropdownMenuItem
                data-testid="user-nav-item-settings"
                className="cursor-pointer"
                onSelect={() => {
                  // Close the left panel on both mobile and desktop before navigating
                  setOpen(false);
                  setOpenMobile(false);
                  router.push('/settings');
                }}
              >
                Settings
              </DropdownMenuItem>
            </MobileFriendlyTooltip>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild data-testid="user-nav-item-auth">
              <button
                type="button"
                className="w-full cursor-pointer"
                onClick={async () => {
                  if (loading) {
                    toast({
                      type: 'error',
                      description:
                        'Checking authentication status, please try again!',
                    });

                    return;
                  }

                  // Sign out using Supabase auth
                  const { error } = await signOut();
                  if (error) {
                    toast({
                      type: 'error',
                      description: 'Failed to sign out. Please try again.',
                    });
                  }
                }}
              >
                Sign out
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
