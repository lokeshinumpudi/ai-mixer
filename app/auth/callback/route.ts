import { createClient } from '@/lib/supabase/server';
import { getBaseUrl } from '@/lib/utils';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/';

  // Handle OAuth errors from Google
  if (error) {
    console.error('OAuth error:', error, errorDescription);
    const baseUrl = getBaseUrl(request.headers);
    return NextResponse.redirect(
      `${baseUrl}/auth/auth-code-error?error=${encodeURIComponent(
        error,
      )}&description=${encodeURIComponent(errorDescription || '')}`,
    );
  }

  if (code) {
    try {
      const supabase = await createClient();

      // Check if user is already authenticated (identity linking scenario)
      const {
        data: { session: existingSession },
      } = await supabase.auth.getSession();

      let data: any;
      let exchangeError: any;

      if (existingSession && !existingSession.user?.is_anonymous) {
        // User is already authenticated with a non-anonymous account
        // This might be a re-authentication or account linking scenario
        const result = await supabase.auth.exchangeCodeForSession(code);
        data = result.data;
        exchangeError = result.error;
      } else if (existingSession?.user?.is_anonymous) {
        // User is anonymous - this is likely an identity linking scenario
        const result = await supabase.auth.exchangeCodeForSession(code);
        data = result.data;
        exchangeError = result.error;

        if (!exchangeError && data?.session) {
          console.log('[AUTH] Identity linking successful');
        }
      } else {
        // No existing session - this is initial authentication
        const result = await supabase.auth.exchangeCodeForSession(code);
        data = result.data;
        exchangeError = result.error;
      }

      if (!exchangeError && data?.session) {
        // Success - redirect to the intended page
        const baseUrl = getBaseUrl(request.headers);

        console.log('[AUTH] OAuth successful');
        return NextResponse.redirect(`${baseUrl}${next}`);
      } else {
        console.error('[AUTH] OAuth failed:', exchangeError?.message);

        // Check if identity linking succeeded despite code exchange failure
        if (existingSession?.user?.is_anonymous) {
          try {
            const {
              data: { session: updatedSession },
            } = await supabase.auth.getSession();

            if (
              updatedSession?.user &&
              (!updatedSession.user.is_anonymous ||
                (updatedSession.user.identities?.length || 0) > 0)
            ) {
              console.log('[AUTH] Identity linking succeeded');
              const baseUrl = getBaseUrl(request.headers);
              return NextResponse.redirect(`${baseUrl}${next}`);
            }
          } catch {
            // Ignore session check errors
          }
        }

        const baseUrl = getBaseUrl(request.headers);
        return NextResponse.redirect(
          `${baseUrl}/auth/auth-code-error?error=exchange_failed&description=${encodeURIComponent(
            exchangeError?.message || 'Failed to exchange code for session',
          )}`,
        );
      }
    } catch (err) {
      console.error(
        '[AUTH] Callback error:',
        err instanceof Error ? err.message : String(err),
      );

      const baseUrl = getBaseUrl(request.headers);
      return NextResponse.redirect(
        `${baseUrl}/auth/auth-code-error?error=callback_error&description=${encodeURIComponent(
          String(err),
        )}`,
      );
    }
  }

  // No code provided
  console.error('No authorization code provided');

  // If this is a debug request (no code but has debug param), return debug info
  const debug = searchParams.get('debug');
  if (debug === 'true') {
    console.log('[AUTH] Debug request received');

    const baseUrl = getBaseUrl(request.headers);
    return NextResponse.redirect(
      `${baseUrl}/auth/auth-code-error?error=debug&description=Debug info logged.`,
    );
  }

  const baseUrl = getBaseUrl(request.headers);
  return NextResponse.redirect(
    `${baseUrl}/auth/auth-code-error?error=no_code&description=No authorization code provided`,
  );
}
