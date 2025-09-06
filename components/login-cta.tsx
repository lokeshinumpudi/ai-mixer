'use client';

import { Button } from '@/components/ui/button';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';
import { useRouter } from 'next/navigation';

interface LoginCTAProps {
  variant?: 'sidebar' | 'inline' | 'toast';
  className?: string;
  onClick?: () => void;
}

export function LoginCTA({
  variant = 'inline',
  className,
  onClick,
}: LoginCTAProps) {
  const router = useRouter();
  const { signInWithGoogle } = useSupabaseAuth();

  const handleClick = async () => {
    try {
      // Use Supabase auth instead of NextAuth.js
      await signInWithGoogle();
    } catch (e) {
      // Fallback to the login page if signIn throws
      router.push('/login');
    }
  };

  if (variant === 'sidebar') {
    return (
      <div className={className}>
        <div className="text-xs text-muted-foreground mb-2 px-2">
          Login to save and revisit previous chats!
        </div>
        <Button className="w-full" size="sm" onClick={onClick ?? handleClick}>
          Continue with Google
        </Button>
      </div>
    );
  }

  if (variant === 'toast') {
    return (
      <div className={className}>
        <div className="text-sm font-medium mb-1">
          Sign in to unlock unlimited comparisons
        </div>
        <div className="text-xs text-muted-foreground mb-2">
          Create an account to compare multiple AI models and get higher usage
          limits.
        </div>
        <Button className="w-full" size="sm" onClick={onClick ?? handleClick}>
          Continue with Google
        </Button>
      </div>
    );
  }

  // Default inline button
  return (
    <Button className={className} size="sm" onClick={onClick ?? handleClick}>
      Continue with Google
    </Button>
  );
}
