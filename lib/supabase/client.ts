import { createBrowserClient } from "@supabase/ssr";

// Utility to detect network/CORS errors
export function isNetworkError(error: any): boolean {
  if (!error) return false;

  // Check for common network/CORS error patterns
  const errorMessage = error.message || error.toString() || "";
  const isCorsError =
    errorMessage.includes("CORS") ||
    errorMessage.includes("NetworkError") ||
    errorMessage.includes("Failed to fetch") ||
    errorMessage.includes("ERR_NETWORK") ||
    errorMessage.includes("ERR_INTERNET_DISCONNECTED");

  // Check for specific Supabase network errors
  const isSupabaseNetworkError =
    errorMessage.includes("fetch") &&
    (errorMessage.includes("NetworkError") ||
      errorMessage.includes("Failed to fetch"));

  return isCorsError || isSupabaseNetworkError;
}

// Enhanced client with network error handling
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables:client");
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
      flowType: "pkce",
      // Enable debug logging to troubleshoot PKCE issues
      debug: process.env.NODE_ENV === "development",
    },
  });
}
