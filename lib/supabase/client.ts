import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables:client');
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // Enable automatic session refresh
      autoRefreshToken: true,
      // Persist session in localStorage
      persistSession: true,
      // Detect session in URL (for OAuth redirects)
      detectSessionInUrl: true,
      // Flow type for better UX
      flowType: 'pkce',
      // Enable debug logging to troubleshoot PKCE issues
      debug: process.env.NODE_ENV === 'development',
    },
  });
}
