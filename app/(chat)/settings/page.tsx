'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

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
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState('history');
  const { data } = useSWR('/api/usage/summary', fetcher);

  const usage = data?.usage ?? [];
  const plan = data?.plan ?? {
    name: 'Free',
    quota: 20,
    used: 1,
    resetInfo: 'tomorrow at 5:29 AM',
    type: 'daily',
  };
  const userType = session?.user?.type || 'free';
  const isProUser = userType === 'pro';

  const usedPct = Math.min(
    100,
    Math.round(((plan.used ?? 0) / plan.quota) * 100),
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft size={16} />
                Back to Chat
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-8">
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
                  Resets {plan.resetInfo}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>{isProUser ? 'Pro' : 'Standard'}</span>
                    <span>
                      {plan.used}/{plan.quota}
                    </span>
                  </div>
                  <Progress value={usedPct} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {plan.quota - plan.used} messages remaining
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
                    <Link href="/pricing">
                      <Button variant="outline" className="w-full" size="sm">
                        View Plans
                      </Button>
                    </Link>
                  </div>
                )}

                {/* <div className="text-xs text-muted-foreground">
                  ℹ️ Each tool call (e.g. search grounding) used in a reply
                  consumes an additional standard credit. Models may not always
                  utilize enabled tools.
                </div> */}
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
