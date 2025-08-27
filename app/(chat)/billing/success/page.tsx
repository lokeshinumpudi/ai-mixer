'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function BillingSuccessPage() {
  const params = useSearchParams();
  const paymentId =
    params.get('payment_id') || params.get('razorpay_payment_id') || '';
  const orderId =
    params.get('order_id') || params.get('razorpay_order_id') || '';
  const referenceId = params.get('reference_id') || '';

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
      <div className="flex gap-4">
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
