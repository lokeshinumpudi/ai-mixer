'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useSidebar } from '@/components/ui/sidebar';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';
import { useUsage } from '@/hooks/use-usage';
import { fetcher } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';

type TabId =
  | 'account'
  | 'customization'
  | 'history'
  | 'models'
  | 'api'
  | 'attachments'
  | 'contact';

const tabs: { id: TabId; label: string }[] = [
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
  const { user, loading } = useSupabaseAuth();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>('history');
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

  // Refresh data when payment is detected
  useEffect(() => {
    if (billingStatus?.hasRecentPurchaseCredit) {
      console.log('💳 Recent payment detected, refreshing data...');
      // Refresh usage data to get updated plan info
      mutateUsage();
    }
  }, [billingStatus?.hasRecentPurchaseCredit, mutateUsage]);

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

      <div className="w-full max-w-7xl mx-auto p-4 sm:px-6 sm:py-8 overflow-hidden">
        {/* Mobile-first responsive grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Usage and Upgrade (main focus) */}
          <div className="space-y-4 lg:space-y-6 lg:col-span-4 order-2 lg:order-1">
            {/* Compact Profile Header */}
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <div className="size-10 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center text-white text-sm font-bold">
                {user?.email?.[0]?.toUpperCase() || 'G'}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold truncate">
                  {user?.email?.split('@')[0] || 'Guest User'}
                </h2>
                <Badge
                  variant={isProUser ? 'default' : 'secondary'}
                  className="text-xs mt-1"
                >
                  {isProUser ? 'Pro Plan' : 'Free Plan'}
                </Badge>
              </div>
            </div>

            {/* Usage */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base font-semibold">
                  Message Usage
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Resets {displayPlan.resetInfo}
                </p>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-4">
                <div>
                  <div className="flex justify-between text-xs sm:text-sm mb-2">
                    <span>{isProUser ? 'Pro Plan' : 'Free Plan'}</span>
                    <span>
                      {displayPlan.used}/{displayPlan.quota}
                    </span>
                  </div>
                  <Progress value={usedPct} className="h-2" />
                  <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
                    {displayPlan.quota - displayPlan.used} messages remaining
                  </p>
                </div>

                {!isProUser && (
                  <div className="pt-4 border-t">
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 p-5 rounded-xl border border-amber-200/50 dark:border-amber-800/30 shadow-sm">
                      <div className="text-center space-y-4">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-3xl">⚡</span>
                          <h4 className="text-xl font-bold text-amber-900 dark:text-amber-100">
                            Upgrade to Pro
                          </h4>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-green-600 font-bold text-lg">
                              ✓
                            </span>
                            <span className="font-medium text-green-700 dark:text-green-400">
                              1000 messages/month
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-green-600 font-bold text-lg">
                              ✓
                            </span>
                            <span className="font-medium text-green-700 dark:text-green-400">
                              Access to all AI models
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-green-600 font-bold text-lg">
                              ✓
                            </span>
                            <span className="font-medium text-green-700 dark:text-green-400">
                              Priority support
                            </span>
                          </div>
                        </div>

                        <div className="bg-white/60 dark:bg-black/20 rounded-lg p-3 my-4">
                          <div className="flex items-baseline justify-center gap-1">
                            <span className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                              ₹249
                            </span>
                            <span className="text-sm text-muted-foreground">
                              /month
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Cancel anytime
                          </p>
                        </div>

                        <Button
                          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 font-bold text-base h-12 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                          onClick={() => {
                            const paymentUrl =
                              process.env
                                .NEXT_PUBLIC_RAZORPAY_PAYMENT_PAGE_URL || '';
                            if (paymentUrl) {
                              window.open(paymentUrl, '_blank');
                            } else {
                              console.error(
                                'Payment URL not configured. Set NEXT_PUBLIC_RAZORPAY_PAYMENT_PAGE_URL.',
                              );
                            }
                          }}
                        >
                          ⚡ Upgrade Now
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {isProUser && (
                  <div className="pt-4 border-t">
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 p-4 rounded-lg border border-green-200/50 dark:border-green-800/30">
                      <div className="text-center space-y-2">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-2xl">🎉</span>
                          <p className="text-lg font-semibold text-green-700 dark:text-green-300">
                            Pro Plan Active
                          </p>
                        </div>
                        <p className="text-sm text-green-600 dark:text-green-400 mb-3">
                          Enjoying unlimited access to all features!
                        </p>
                        <Button
                          variant="outline"
                          className="w-full border-green-300 hover:bg-green-50 dark:border-green-700 dark:hover:bg-green-950/30"
                          size="sm"
                          onClick={() => {
                            const paymentUrl =
                              process.env
                                .NEXT_PUBLIC_RAZORPAY_PAYMENT_PAGE_URL || '';
                            if (paymentUrl) {
                              window.open(paymentUrl, '_blank');
                            } else {
                              console.error(
                                'Payment URL not configured. Set NEXT_PUBLIC_RAZORPAY_PAYMENT_PAGE_URL.',
                              );
                            }
                          }}
                        >
                          Manage Subscription
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Shortcuts (desktop emphasis, minimal on mobile) */}
            <Card className="hidden sm:block">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base">Keyboard Shortcuts</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
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
          <div className="lg:col-span-8 order-1 lg:order-2">
            {/* Tab Navigation - mobile scrollable, desktop segmented */}
            <div
              role="tablist"
              aria-label="Settings sections"
              className="mb-4 sm:mb-6"
            >
              <div className="bg-muted p-1 rounded-lg -mx-4 px-4 lg:mx-0 lg:px-1">
                <div className="flex gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
                  {tabs.map((tab) => {
                    const selected = activeTab === tab.id;
                    const tabId = `tab-${tab.id}`;
                    const panelId = `panel-${tab.id}`;
                    return (
                      <button
                        key={tab.id}
                        id={tabId}
                        role="tab"
                        aria-selected={selected}
                        aria-controls={panelId}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 min-w-fit ${
                          selected
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Tab Panels: keep mounted for better accessibility */}
            <section
              id="panel-history"
              role="tabpanel"
              aria-labelledby="tab-history"
              hidden={activeTab !== 'history'}
            >
              <HistoryTab usage={usage} />
            </section>
            <section
              id="panel-models"
              role="tabpanel"
              aria-labelledby="tab-models"
              hidden={activeTab !== 'models'}
            >
              <ModelsTab userType={userType} />
            </section>
            <section
              id="panel-account"
              role="tabpanel"
              aria-labelledby="tab-account"
              hidden={activeTab !== 'account'}
            >
              <AccountTab />
            </section>
            <section
              id="panel-customization"
              role="tabpanel"
              aria-labelledby="tab-customization"
              hidden={activeTab !== 'customization'}
            >
              <CustomizationTab />
            </section>
            <section
              id="panel-api"
              role="tabpanel"
              aria-labelledby="tab-api"
              hidden={activeTab !== 'api'}
            >
              <APIKeysTab />
            </section>
            <section
              id="panel-attachments"
              role="tabpanel"
              aria-labelledby="tab-attachments"
              hidden={activeTab !== 'attachments'}
            >
              <AttachmentsTab />
            </section>
            <section
              id="panel-contact"
              role="tabpanel"
              aria-labelledby="tab-contact"
              hidden={activeTab !== 'contact'}
            >
              <ContactTab />
            </section>
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
