import { createClient } from '@/lib/supabase/server';
import { getBaseUrl } from '@/lib/utils';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Use getBaseUrl utility for consistent URL handling
      const baseUrl = getBaseUrl(request.headers);
      return NextResponse.redirect(`${baseUrl}${next}`);
    }
  }

  // return the user to an error page with instructions
  const baseUrl = getBaseUrl(request.headers);
  return NextResponse.redirect(`${baseUrl}/auth/auth-code-error`);
}
