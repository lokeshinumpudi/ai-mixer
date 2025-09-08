'use server';

import { authLogger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { getBaseUrl } from '@/lib/utils';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export async function signInWithGoogle() {
  const supabase = await createClient();
  const headersList = await headers();
  const baseUrl = getBaseUrl(headersList);

  authLogger.debug(
    {
      baseUrl,
      redirectUrl: `${baseUrl}/auth/callback`,
    },
    'Google OAuth sign-in initiated',
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${baseUrl}/auth/callback`,
    },
  });

  if (error) {
    authLogger.error(
      {
        error: error.message,
        baseUrl,
      },
      'Google OAuth sign-in failed',
    );
    redirect('/error');
  }

  authLogger.info(
    {
      oauthUrl: data.url,
      baseUrl,
    },
    'Google OAuth sign-in successful, redirecting',
  );
  redirect(data.url);
}
