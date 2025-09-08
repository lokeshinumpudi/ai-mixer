import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables:middleware');
  }

  const supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // Check for Supabase session cookies
  // Supabase typically sets sb-[project-ref]-auth-token and sb-[project-ref]-auth-token.0
  const cookies = request.cookies.getAll();
  const hasSupabaseCookies = cookies.some(
    (cookie) =>
      cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token'),
  );

  let user = null;

  if (hasSupabaseCookies) {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      user = authUser;
    } catch (error) {
      // If getUser fails, continue without user (will be handled by client)
      console.warn('Middleware auth check failed:', error);
    }
  }

  return supabaseResponse;
}
