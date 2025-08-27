'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function BillingSuccessPage() {
  const params = useSearchParams();
  const paymentId =
    params.get('payment_id') || params.get('razorpay_payment_id') || '';
  const orderId =
    params.get('order_id') || params.get('razorpay_order_id') || '';
  const referenceId = params.get('reference_id') || '';
  const [verified, setVerified] = useState<'pending' | 'confirmed' | 'timeout'>(
    'pending',
  );
  const [count, setCount] = useState<number>(0);

  const pollUrl = useMemo(() => '/api/billing/status?lookbackSeconds=300', []);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 12; // ~60s at 5s interval

    async function poll() {
      try {
        const res = await fetch(pollUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error('status failed');
        const json = await res.json();
        if (cancelled) return;
        setCount(json.count || 0);
        if (json.hasRecentPurchaseCredit) {
          setVerified('confirmed');
          return;
        }
      } catch (_) {
        // ignore and retry
      }
      attempts += 1;
      if (attempts >= maxAttempts) {
        setVerified('timeout');
      } else {
        setTimeout(poll, 5000);
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [pollUrl]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 text-center px-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Payment Successful</h1>
        <p className="text-muted-foreground">
          Thank you! Your payment has been received. It can take a few seconds
          to reflect on your account.
        </p>
      </div>
      <div className="text-sm text-muted-foreground">
        {paymentId ? (
          <div>
            Payment ID: <span className="font-mono">{paymentId}</span>
          </div>
        ) : null}
        {orderId ? (
          <div>
            Order ID: <span className="font-mono">{orderId}</span>
          </div>
        ) : null}
        {referenceId ? (
          <div>
            Reference: <span className="font-mono">{referenceId}</span>
          </div>
        ) : null}
      </div>
      <div className="text-sm">
        {verified === 'pending' ? (
          <div>Verifying payment… (this can take a few seconds)</div>
        ) : null}
        {verified === 'confirmed' ? (
          <div className="text-green-600">
            Payment verified.{' '}
            {count > 0 ? `${count} credit entry found.` : null}
          </div>
        ) : null}
        {verified === 'timeout' ? (
          <div className="text-amber-600">
            We could not verify yet. You can refresh this page in a moment or
            check Settings.
          </div>
        ) : null}
      </div>
      <div className="flex gap-4 mt-4">
        <Button asChild>
          <Link href="/settings">Go to Settings</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Back to Chat</Link>
        </Button>
      </div>
    </div>
  );
}
