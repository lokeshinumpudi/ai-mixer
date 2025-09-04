'use client';

import { Button } from '@/components/ui/button';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
  const { isAuthenticated, loading, signInWithGoogle } = useSupabaseAuth();
  const router = useRouter();

  // Redirect to home if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex h-dvh w-screen items-center justify-center">
        <div className="w-full max-w-md overflow-hidden rounded-2xl flex flex-col gap-6 bg-background/80 backdrop-blur-md shadow-xl ring-1 ring-border/50 p-6 sm:p-8">
          <div className="flex flex-col items-center justify-center gap-3 px-4 text-center sm:px-16">
            <div className="animate-spin rounded-full size-8 border-b-2 border-gray-900 dark:border-gray-100 mx-auto" />
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              Checking authentication...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Don't render login form if authenticated (will redirect)
  if (isAuthenticated) {
    return null;
  }

  // Show login form for unauthenticated users
  return (
    <div className="flex h-dvh w-screen items-start pt-12 md:pt-0 md:items-center justify-center">
      <div className="w-full max-w-md overflow-hidden rounded-2xl flex flex-col gap-6 bg-background/80 backdrop-blur-md shadow-xl ring-1 ring-border/50 p-6 sm:p-8">
        <div className="flex flex-col items-center justify-center gap-3 px-4 text-center sm:px-16">
          <h3 className="text-xl font-semibold dark:text-zinc-50">Sign in</h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Continue to unlock more messages and all models
          </p>
        </div>

        <Button onClick={() => signInWithGoogle()} className="w-full">
          Continue with Google
        </Button>
      </div>
    </div>
  );
}
