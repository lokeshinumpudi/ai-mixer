'use client';

import { PlusIcon } from '@/components/icons';
import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAnonymousAuth } from '@/hooks/use-anonymous-auth';
import { useModels } from '@/hooks/use-models';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GoogleLoginCTA } from './google-login-cta';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

export function AppSidebar() {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { user, messageCount } = useAnonymousAuth();
  const { mutate: mutateModels } = useModels();

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      <SidebarHeader>
        <SidebarMenu>
          <div className="flex flex-row justify-between items-center">
            <Link
              href="/"
              onClick={() => {
                setOpenMobile(false);
              }}
              className="flex flex-row gap-3 items-center"
            >
              <span className="text-lg font-semibold px-2 hover:bg-muted rounded-md cursor-pointer">
                Chatbot
              </span>
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  type="button"
                  className="p-2 h-fit"
                  onClick={async () => {
                    setOpenMobile(false);
                    // Force revalidation of models data for fresh user settings
                    console.log(
                      '🔄 Sidebar: Clicking New Chat, triggering mutateModels...',
                    );
                    const freshData = await mutateModels();
                    console.log(
                      '✅ Sidebar: Fresh models data received:',
                      freshData,
                    );
                    router.push('/');
                    router.refresh();
                  }}
                >
                  <PlusIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent align="end">New Chat</TooltipContent>
            </Tooltip>
          </div>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarHistory user={user} />
      </SidebarContent>
      <SidebarFooter>
        {user && !user.is_anonymous ? (
          <SidebarUserNav user={user} />
        ) : (
          <div className="p-2">
            <GoogleLoginCTA
              variant="outline"
              size="sm"
              className="w-full"
              showMessageCount={true}
            />
            {messageCount > 0 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {10 - messageCount} messages remaining
              </p>
            )}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
