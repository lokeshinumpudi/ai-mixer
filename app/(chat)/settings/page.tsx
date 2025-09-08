'use client';

import { useAuth } from '@/components/auth-provider';
import { IdentityManager } from '@/components/identity-manager';
import { OnboardingModal } from '@/components/onboarding-modal';
import { SystemPromptForm } from '@/components/settings/SystemPromptForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MobileFriendlyTooltip } from '@/components/ui/mobile-friendly-tooltip';
import { Progress } from '@/components/ui/progress';
import { useSidebar } from '@/components/ui/sidebar';
import { UsageDashboard } from '@/components/usage/usage-dashboard';
import { useOnboarding } from '@/hooks/use-onboarding';
import { fetcher } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';

type TabId =
  | 'account'
  | 'identities'
  | 'customization'
  | 'history'
  | 'models'
  | 'api'
  | 'attachments'
  | 'contact';

const tabs: { id: TabId; label: string }[] = [
  // { id: "account", label: "Account" },
  { id: 'history', label: 'Usage & Analytics' },
  { id: 'customization', label: 'Customization' },
  { id: 'identities', label: 'Linked Accounts' },
  // { id: "models", label: "Models" },
  // { id: "api", label: "API Keys" },
  // { id: "attachments", label: "Attachments" },
  // { id: "contact", label: "Contact Us" },
];

export default function SettingsPage() {
  // All hooks must be called at the top level, before any conditional logic
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>('customization');

  // Onboarding state management
  const { shouldShowOnboarding, markOnboardingComplete, resetOnboarding } =
    useOnboarding();
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  // Always fetch usage data since it's displayed in the sidebar
  const isUsageTab = activeTab === 'history';
  const {
    data: usageData,
    mutate: mutateUsage,
    error: usageError,
  } = useSWR('/api/usage?page=1&limit=100', fetcher, {
    revalidateOnFocus: false,
    // Refresh more frequently when on usage tab, less frequently otherwise
    refreshInterval: isUsageTab ? 30000 : 120000, // 30s on usage tab, 2min otherwise
    // onError: (error) => {
    //   console.error("Usage API Error:", error);
    // },
    // onSuccess: (data) => {
    //   console.log("Usage API Success:", {
    //     itemCount: data?.items?.length,
    //     total: data?.total,
    //   });
    // },
  });

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
      try {
        const currentHref = window.location.href;
        if (
          currentHref &&
          typeof currentHref === 'string' &&
          currentHref.trim()
        ) {
          const url = new URL(currentHref);
          url.searchParams.delete('refresh');
          window.history.replaceState({}, '', url.pathname + url.search);
        }
      } catch (error) {
        // Silently ignore URL construction errors
        console.warn('Failed to clean up URL parameters:', error);
      }
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

  // Extract plan-like data from new usage system
  const plan = usageData
    ? {
        type: usageData.limits?.type || 'daily',
        quota: usageData.limits?.quota || 50,
        // Calculate daily message count from usage records (each record = 1 message)
        used: (() => {
          if (!usageData.items) return 0;
          const today = new Date();
          const todayStr = today.toDateString();
          return usageData.items.filter((item: any) => {
            const itemDate = new Date(item.createdAt);
            return itemDate.toDateString() === todayStr;
          }).length;
        })(),
        remaining: (() => {
          const quota = usageData.limits?.quota || 50;
          const todayUsed = usageData.items
            ? usageData.items.filter((item: any) => {
                const itemDate = new Date(item.createdAt);
                const today = new Date();
                return itemDate.toDateString() === today.toDateString();
              }).length
            : 0;
          return Math.max(0, quota - todayUsed);
        })(),
        resetInfo: usageData.limits?.resetInfo || '',
      }
    : null;

  // Show loading state with more details
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 overflow-hidden" />
        </div>
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <p className="text-sm text-muted-foreground">Loading user session…</p>
        </div>
      </div>
    );
  }

  // Always wait for usage data since it's displayed in sidebar
  if (!usageData || !plan) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 overflow-hidden" />
        </div>
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <p className="text-sm text-muted-foreground">Loading usage data…</p>
        </div>
      </div>
    );
  }

  const displayPlan = plan || {
    type: 'daily',
    quota: 50,
    used: 0,
    remaining: 50,
    resetInfo: 'tomorrow at 5:29 AM',
  };
  const isProUser = displayPlan.type === 'monthly';
  const userType = isProUser ? 'pro' : 'free';

  const usedPct = Math.min(
    100,
    Math.round(((displayPlan.used ?? 0) / displayPlan.quota) * 100),
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboardingModal}
        onClose={() => setShowOnboardingModal(false)}
      />
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
        {/* Mobile: Priority content first, Desktop: Sidebar layout */}
        <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-8 gap-6">
          {/* Mobile: User info and usage at top, Desktop: Sidebar */}
          <div className="space-y-4 lg:space-y-6 lg:col-span-4 lg:order-2 order-1">
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

            {/* Quick Usage Overview */}
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

                {/* Link to detailed analytics */}
                <div className="pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setActiveTab('history')}
                  >
                    View Detailed Analytics →
                  </Button>
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
                <MobileFriendlyTooltip
                  content="Quickly search through your chat history and conversations"
                  side="left"
                  showIcon={false}
                >
                  <div className="flex justify-between text-sm">
                    <span>Search</span>
                    <div className="flex gap-1">
                      <kbd className="px-2 py-1 bg-muted rounded text-xs">
                        ⌘
                      </kbd>
                      <kbd className="px-2 py-1 bg-muted rounded text-xs">
                        K
                      </kbd>
                    </div>
                  </div>
                </MobileFriendlyTooltip>

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

                <MobileFriendlyTooltip
                  content="Show or hide the sidebar with your chat history"
                  side="left"
                  showIcon={false}
                >
                  <div className="flex justify-between text-sm">
                    <span>Toggle Sidebar</span>
                    <div className="flex gap-1">
                      <kbd className="px-2 py-1 bg-muted rounded text-xs">
                        ⌘
                      </kbd>
                      <kbd className="px-2 py-1 bg-muted rounded text-xs">
                        B
                      </kbd>
                    </div>
                  </div>
                </MobileFriendlyTooltip>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-8 lg:order-1 order-2">
            {/* Mobile: Dropdown selector, Desktop: Tab navigation */}
            <div className="mb-4 sm:mb-6">
              {/* Mobile: Simple dropdown */}
              <div className="lg:hidden">
                <label htmlFor="mobile-tab-select" className="sr-only">
                  Select settings section
                </label>
                <select
                  id="mobile-tab-select"
                  value={activeTab}
                  onChange={(e) => setActiveTab(e.target.value as TabId)}
                  className="w-full p-3 rounded-lg border border-border bg-background text-foreground text-base font-medium shadow-sm focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  {tabs.map((tab) => (
                    <option key={tab.id} value={tab.id}>
                      {tab.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Desktop: Traditional tab navigation */}
              <div
                role="tablist"
                aria-label="Settings sections"
                className="hidden lg:block"
              >
                <div className="bg-muted p-1 rounded-lg">
                  <div className="flex gap-1">
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
                          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap flex-1 ${
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
            </div>

            {/* Tab Panels: keep mounted for better accessibility */}
            <section
              id="panel-history"
              role="tabpanel"
              aria-labelledby="tab-history"
              hidden={activeTab !== 'history'}
            >
              <HistoryTab />
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
              id="panel-identities"
              role="tabpanel"
              aria-labelledby="tab-identities"
              hidden={activeTab !== 'identities'}
            >
              <IdentitiesTab />
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

function HistoryTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Usage & Analytics</h2>
        <p className="text-muted-foreground">
          Detailed usage analytics and token consumption across all your
          conversations.
        </p>
      </div>
      <UsageDashboard />
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
  const { resetOnboarding } = useOnboarding();
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

  const handleShowOnboarding = () => {
    setShowOnboardingModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboardingModal}
        onClose={() => setShowOnboardingModal(false)}
      />

      <div>
        <h2 className="text-2xl font-bold">Customization</h2>
        <p className="text-muted-foreground">
          Personalize your AI experience with custom settings and preferences.
        </p>
      </div>

      {/* Onboarding Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">App Tutorial</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            New to AI Mixer? Take a guided tour to learn about our multi-model
            comparison features, settings, and capabilities.
          </p>
          <Button
            onClick={handleShowOnboarding}
            variant="outline"
            className="w-full sm:w-auto"
          >
            🚀 Replay App Tutorial
          </Button>
        </CardContent>
      </Card>

      <SystemPromptForm />
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

function IdentitiesTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Linked Accounts</h2>
      <IdentityManager />
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
