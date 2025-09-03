'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function ErrorPage() {
  return (
    <div className="flex h-dvh w-screen items-start pt-12 md:pt-0 md:items-center justify-center">
      <div className="w-full max-w-md overflow-hidden rounded-2xl flex flex-col gap-12 bg-background/80 backdrop-blur-md shadow-xl ring-1 ring-border/50 p-6 sm:p-8">
        <div className="flex flex-col items-center justify-center gap-3 px-4 text-center sm:px-16">
          <h3 className="text-xl font-semibold dark:text-zinc-50">
            Authentication Error
          </h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Sorry, we couldn't complete your authentication. This might be due
            to:
          </p>
          <ul className="text-sm text-gray-500 dark:text-zinc-400 list-disc list-inside space-y-1">
            <li>Invalid email or password</li>
            <li>Account doesn't exist (try signing up instead)</li>
            <li>Network connection issues</li>
            <li>Temporary server issues</li>
          </ul>
          <Button asChild className="w-full">
            <Link href="/login">Try Again</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
