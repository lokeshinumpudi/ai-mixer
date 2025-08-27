'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function BillingFailurePage() {
  const params = useSearchParams();
  const reason =
    params.get('error[description]') ||
    params.get('error_description') ||
    'Payment was cancelled or failed.';

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 text-center px-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Payment Failed</h1>
        <p className="text-muted-foreground">{reason}</p>
      </div>
      <div className="flex gap-4">
        <Button asChild>
          <Link href="/pricing">Try Again</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Back to Chat</Link>
        </Button>
      </div>
    </div>
  );
}
