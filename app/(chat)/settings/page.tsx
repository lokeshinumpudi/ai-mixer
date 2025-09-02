'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useSidebar } from '@/components/ui/sidebar';
import { useUsage } from '@/hooks/use-usage';
import { fetcher } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';

const tabs = [
  { id: 'account', label: 'Account' },
  { id: 'customization', label: 'Customization' },
  { id: 'history', label: 'History & Sync' },
  { id: 'models', label: 'Models' },
  { id: 'api', label: 'API Keys' },
  { id: 'attachments', label: 'Attachments' },
  { id: 'contact', label: 'Contact Us' },
];

export default function SettingsPage() {
  // All hooks must be called at the top level, before any conditional logic
  const { data: session, update: updateSession } = useSession();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('history');
  const { plan, usageHistory, mutate: mutateUsage } = useUsage();

  // Check for refresh parameter to force fresh billing status check
  const shouldRefreshBilling = searchParams.get('refresh') === 'billing';

  // Only check billing status once when component mounts, or when refresh is requested
  const { data: billingStatus, mutate: mutateBillingStatus } = useSWR(
    '/api/billing/status',
    fetcher,
    {
      // Force revalidation if refresh parameter is present
      revalidateOnMount: shouldRefreshBilling,
    },
  );
  const { setOpen, setOpenMobile } = useSidebar();

  // Close sidebar whenever we land on settings (mobile or desktop)
  useEffect(() => {
    try {
      setOpen(false);
      setOpenMobile(false);
    } catch (_) {
      // no-op: sidebar context always exists under (chat) layout
    }
  }, [setOpen, setOpenMobile]);

  // Clean up refresh parameter from URL after handling it
  useEffect(() => {
    if (shouldRefreshBilling && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('refresh');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, [shouldRefreshBilling]);

  // Refresh session and data when payment is detected
  useEffect(() => {
    if (billingStatus?.hasRecentPurchaseCredit) {
      console.log('💳 Recent payment detected, refreshing session and data...');
      // Refresh session to get updated user type
      updateSession();
      // Refresh usage data to get updated plan info
      mutateUsage();
    }
  }, [billingStatus?.hasRecentPurchaseCredit, updateSession, mutateUsage]);

  const usage = usageHistory;

  // Rely solely on API plan data; avoid default flash
  if (!plan) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 overflow-hidden" />
        </div>
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <p className="text-sm text-muted-foreground">Loading plan…</p>
        </div>
      </div>
    );
  }

  const displayPlan = plan;
  const isProUser = displayPlan.type === 'monthly';
  const userType = isProUser ? 'pro' : 'free';

  const usedPct = Math.min(
    100,
    Math.round(((displayPlan.used ?? 0) / displayPlan.quota) * 100),
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">Back to Chat</span>
                <span className="sm:hidden">Back</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 overflow-hidden">
        {/* Mobile Layout - Stack vertically */}
        <div className="lg:hidden space-y-4 w-full">
          {/* Mobile User Profile Header */}
          <Card className="w-full">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="size-12 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center text-white text-base font-bold flex-shrink-0">
                {session?.user?.name?.[0] || 'G'}
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <h2 className="text-base font-semibold truncate">
                  {session?.user?.name || 'Guest User'}
                </h2>
                <p className="text-xs text-muted-foreground truncate">
                  {session?.user?.email || 'guest@example.com'}
                </p>
                <Badge
                  variant={isProUser ? 'default' : 'secondary'}
                  className="mt-1 text-xs"
                >
                  {isProUser ? 'Pro Plan' : 'Free Plan'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Mobile Usage Summary */}
          <Card className="w-full">
            <CardContent className="p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Message Usage</span>
                <span className="text-sm text-muted-foreground">
                  {displayPlan.used}/{displayPlan.quota}
                </span>
              </div>
              <Progress value={usedPct} className="h-2 mb-2" />
              <div className="flex justify-between items-center text-xs text-muted-foreground mb-3">
                <span>{displayPlan.quota - displayPlan.used} remaining</span>
                <span className="truncate ml-2 max-w-[120px]">
                  Resets {displayPlan.resetInfo}
                </span>
              </div>
              {!isProUser && (
                <Link href="/pricing" className="block">
                  <Button className="w-full" size="sm">
                    Upgrade to Pro
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Mobile Tab Navigation - Horizontal Scroll */}
          <div className="w-full -mx-4 px-4">
            <div className="bg-muted p-1 rounded-lg">
              <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex-shrink-0 min-w-fit ${
                      activeTab === tab.id
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Tab Content */}
          <div className="w-full overflow-hidden">
            {activeTab === 'history' && <HistoryTab usage={usage} />}
            {activeTab === 'models' && <ModelsTab userType={userType} />}
            {activeTab === 'account' && <AccountTab />}
            {activeTab === 'customization' && <CustomizationTab />}
            {activeTab === 'api' && <APIKeysTab />}
            {activeTab === 'attachments' && <AttachmentsTab />}
            {activeTab === 'contact' && <ContactTab />}
          </div>
        </div>

        {/* Desktop Layout - Original Grid */}
        <div className="hidden lg:grid grid-cols-12 gap-8">
          {/* Left Sidebar - User Info & Usage */}
          <div className="col-span-3 space-y-6">
            {/* User Profile */}
            <Card>
              <CardContent className="p-6 text-center">
                <div className="size-24 rounded-full bg-gradient-to-br from-blue-500 to-green-500 mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold">
                  {session?.user?.name?.[0] || 'G'}
                </div>
                <h2 className="text-xl font-semibold mb-1">
                  {session?.user?.name || 'Guest User'}
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {session?.user?.email || 'guest@example.com'}
                </p>
                <Badge variant={isProUser ? 'default' : 'secondary'}>
                  {isProUser ? 'Pro Plan' : 'Free Plan'}
                </Badge>
              </CardContent>
            </Card>

            {/* Message Usage */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Message Usage</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Resets {displayPlan.resetInfo}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>{isProUser ? 'Pro Plan' : 'Free Plan'}</span>
                    <span>
                      {displayPlan.used}/{displayPlan.quota}
                    </span>
                  </div>
                  <Progress value={usedPct} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {displayPlan.quota - displayPlan.used} messages remaining
                  </p>
                </div>

                {!isProUser && (
                  <div className="pt-4 border-t">
                    <Link href="/pricing">
                      <Button className="w-full" size="sm">
                        Upgrade to Pro
                      </Button>
                    </Link>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      Get 1000 messages/month + all models
                    </p>
                  </div>
                )}

                {isProUser && (
                  <div className="pt-4 border-t">
                    <div className="text-center">
                      <p className="text-sm font-medium text-green-600 mb-2">
                        ✅ Pro Plan Active
                      </p>
                      <p className="text-xs text-muted-foreground mb-3">
                        1000 messages/month + access to all AI models
                      </p>
                      <Link href="/pricing">
                        <Button variant="outline" className="w-full" size="sm">
                          Manage Subscription
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Keyboard Shortcuts */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Keyboard Shortcuts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Search</span>
                  <div className="flex gap-1">
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">⌘</kbd>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">K</kbd>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span>New Chat</span>
                  <div className="flex gap-1">
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">⌘</kbd>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">
                      Shift
                    </kbd>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">O</kbd>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Toggle Sidebar</span>
                  <div className="flex gap-1">
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">⌘</kbd>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs">B</kbd>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="col-span-9">
            {/* Tab Navigation */}
            <div className="flex space-x-1 mb-8 bg-muted p-1 rounded-lg">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === tab.id
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'history' && <HistoryTab usage={usage} />}
            {activeTab === 'models' && <ModelsTab userType={userType} />}
            {activeTab === 'account' && <AccountTab />}
            {activeTab === 'customization' && <CustomizationTab />}
            {activeTab === 'api' && <APIKeysTab />}
            {activeTab === 'attachments' && <AttachmentsTab />}
            {activeTab === 'contact' && <ContactTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryTab({ usage }: { usage: any[] }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">History</h2>
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">History coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}

function ModelsTab({ userType }: { userType: string }) {
  const isProUser = userType === 'pro';

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Models</h2>
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Models coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}

function AccountTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Account Settings</h2>
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">
            Account settings coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CustomizationTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Customization</h2>
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">
            Customization options coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function APIKeysTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">API Keys</h2>
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">
            API key management coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function AttachmentsTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Attachments</h2>
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">
            Attachment settings coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ContactTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Contact Us</h2>
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">
            Contact information coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
