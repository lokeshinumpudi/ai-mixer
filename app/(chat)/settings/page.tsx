'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';

export default function SettingsPage() {
  const { data } = useSWR('/api/usage/summary', fetcher);

  const usage = data?.usage ?? [];
  const plan = data?.plan ?? { name: 'Free', quota: 3000, used: 0 };

  const usedPct = Math.min(
    100,
    Math.round(((plan.used ?? 0) / plan.quota) * 100),
  );

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Settings</h1>
        <Link href="/pricing">
          <Button>Upgrade Plan</Button>
        </Link>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Current Plan
            <span className="text-lg font-semibold">{plan.name}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Token Usage</span>
              <span>
                {plan.used} / {plan.quota} tokens
              </span>
            </div>
            <Progress value={usedPct} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {plan.quota - plan.used} tokens remaining this month
            </p>
          </div>

          {plan.name === 'Free' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Ready to do more?</strong> Upgrade to Pro for 50,000
                tokens/month and priority support.
              </p>
              <Link href="/pricing" className="inline-block mt-2">
                <Button size="sm">View Plans</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Details */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Details (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {usage.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No usage data available yet. Start chatting to see your usage!
            </p>
          ) : (
            <div className="space-y-3">
              {usage.map((d: any) => (
                <div
                  key={`${d.day}-${d.modelId}`}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">{d.day}</p>
                    <p className="text-xs text-muted-foreground">{d.modelId}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {(d.tokensIn + d.tokensOut).toLocaleString()} tokens
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {d.tokensIn} in • {d.tokensOut} out
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing & Payments */}
      <Card>
        <CardHeader>
          <CardTitle>Billing & Payments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Payment History</p>
              <p className="text-sm text-muted-foreground">
                View your payment history and download invoices
              </p>
            </div>
            <Button variant="outline" disabled>
              Coming Soon
            </Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Buy Credits</p>
              <p className="text-sm text-muted-foreground">
                Purchase additional tokens that never expire
              </p>
            </div>
            <Link href="/pricing">
              <Button variant="outline">Buy Credits</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Test Mode Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800">
          <strong>Test Mode:</strong> This application is running in test mode.
          All payments are processed through Razorpay's test environment.
        </p>
      </div>
    </main>
  );
}
