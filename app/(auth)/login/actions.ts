'use server';

import { createClient } from '@/lib/supabase/server';
import { getBaseUrl } from '@/lib/utils';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export async function signInWithGoogle() {
  const supabase = await createClient();
  const headersList = await headers();
  const baseUrl = getBaseUrl(headersList);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${baseUrl}/auth/callback`,
    },
  });

  if (error) {
    redirect('/error');
  }

  redirect(data.url);
}
