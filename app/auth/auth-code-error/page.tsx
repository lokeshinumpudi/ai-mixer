'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function AuthCodeErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const description = searchParams.get('description');

  const getErrorMessage = () => {
    switch (error) {
      case 'access_denied':
        return 'You cancelled the sign-in process. Please try again if you want to continue.';
      case 'exchange_failed':
        return 'Failed to complete the sign-in process. This might be a temporary issue.';
      case 'callback_error':
        return 'An unexpected error occurred during sign-in.';
      case 'no_code':
        return 'The sign-in process was incomplete. Please try again.';
      default:
        return "Sorry, we couldn't complete your sign-in. Please try again.";
    }
  };

  return (
    <div className="flex h-dvh w-screen items-start pt-12 md:pt-0 md:items-center justify-center">
      <div className="w-full max-w-md overflow-hidden rounded-2xl flex flex-col gap-12 bg-background/80 backdrop-blur-md shadow-xl ring-1 ring-border/50 p-6 sm:p-8">
        <div className="flex flex-col items-center justify-center gap-3 px-4 text-center sm:px-16">
          <h3 className="text-xl font-semibold dark:text-zinc-50">
            Authentication Error
          </h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            {getErrorMessage()}
          </p>
          {description && process.env.NODE_ENV === 'development' && (
            <details className="text-xs text-gray-400 mt-2 w-full">
              <summary className="cursor-pointer">Technical Details</summary>
              <p className="mt-1 text-left bg-gray-100 dark:bg-gray-800 p-2 rounded">
                Error: {error}
                <br />
                Description: {description}
              </p>
            </details>
          )}
          <div className="flex flex-col gap-2 w-full">
            <Button asChild className="w-full">
              <Link href="/">Try Again</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Back to Login</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthCodeError() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh w-screen items-center justify-center">
          <div className="text-center">Loading...</div>
        </div>
      }
    >
      <AuthCodeErrorContent />
    </Suspense>
  );
}
