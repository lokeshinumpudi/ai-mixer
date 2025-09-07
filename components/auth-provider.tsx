"use client";

import { createClient } from "@/lib/supabase/client";
import type { AppUser, UserType } from "@/lib/supabase/types";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signInAnonymously: () => Promise<{ data: any; error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  getLinkedIdentities: () => Promise<{ identities: any[]; error: any }>;
  linkIdentity: (
    provider: "google" | "github" | "discord" | "twitter"
  ) => Promise<{ data: any; error: any }>;
  unlinkIdentity: (identityId: string) => Promise<{ data: any; error: any }>;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  userType: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Main auth logic moved here to avoid circular dependencies
function useAuthLogic() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    // Get initial session - Supabase handles caching automatically
    const getInitialSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.warn("Failed to get session:", error);
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        if (mounted) {
          setUser(session?.user ? transformUser(session.user) : null);
          setLoading(false);
        }
      } catch (error) {
        console.warn("Failed to get initial session:", error);
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // Listen for auth state changes - Supabase handles everything automatically
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log("[AUTH] Auth state change:", event);

      setUser(session?.user ? transformUser(session.user) : null);
      setLoading(false);

      // Handle specific auth events
      if (event === "SIGNED_IN") {
        router.refresh();
      } else if (event === "SIGNED_OUT") {
        // Clear user-specific caches
        clearUserCaches();
        router.push("/");
        router.refresh();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  const clearUserCaches = () => {
    // Simple cache clearing - let SWR handle the complexity
    try {
      // Clear all localStorage keys that start with user-specific prefixes
      const allKeys = Object.keys(localStorage);
      const userSpecificKeys = allKeys.filter(
        (key) =>
          key.startsWith("chat-") ||
          key.startsWith("user-") ||
          key.startsWith("swr-") ||
          key.startsWith("artifact-")
      );

      userSpecificKeys.forEach((key) => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.warn("Failed to clear user caches:", error);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { getBaseUrl } = await import("@/lib/utils");
      const baseUrl = getBaseUrl();

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${baseUrl}/auth/callback`,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const signInAnonymously = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInAnonymously({
        options: {
          data: {
            user_type: "anonymous" as UserType,
            created_via: "anonymous",
          },
        },
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      clearUserCaches();
      router.push("/");
      router.refresh();

      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  // Enhanced identity management with full Supabase capabilities
  const getLinkedIdentities = async () => {
    try {
      const { data, error } = await supabase.auth.getUserIdentities();
      if (error) throw error;
      return { identities: data?.identities || [], error: null };
    } catch (error) {
      return { identities: [], error };
    }
  };

  const linkIdentity = async (
    provider: "google" | "github" | "discord" | "twitter"
  ) => {
    if (!user) {
      throw new Error("Must be authenticated to link identities");
    }

    setLoading(true);
    try {
      const { getBaseUrl } = await import("@/lib/utils");
      const baseUrl = getBaseUrl();
      const redirectUrl = `${baseUrl}/auth/callback`;

      const { data, error } = await supabase.auth.linkIdentity({
        provider,
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        throw error;
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const unlinkIdentity = async (identityId: string) => {
    if (!user) {
      throw new Error("Must be authenticated to unlink identities");
    }

    setLoading(true);
    try {
      // First get the identity details to know the provider
      const { data: identities, error: getError } =
        await supabase.auth.getUserIdentities();
      if (getError) throw getError;

      const identity = identities?.identities?.find(
        (id) => id.id === identityId
      );
      if (!identity) {
        throw new Error("Identity not found");
      }

      const { data, error } = await supabase.auth.unlinkIdentity({
        id: identity.id,
        user_id: identity.user_id,
        identity_id: identity.identity_id,
        provider: identity.provider,
      });

      if (error) throw error;

      // Refresh user data to reflect changes
      await supabase.auth.getUser();

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    loading,
    signInAnonymously,
    signInWithGoogle,
    signOut,
    getLinkedIdentities,
    linkIdentity,
    unlinkIdentity,
    isAuthenticated: !!user,
    isAnonymous: user?.is_anonymous || false,
    userType: user?.user_metadata?.user_type || "anonymous",
    // Debug helper for troubleshooting PKCE issues
    debugAuthState: () => {
      if (typeof window === "undefined") return "Server-side";

      const debug = {
        localStorageAvailable: !!window.localStorage,
        localStorageLength: localStorage.length,
        supabaseKeys: Object.keys(localStorage).filter(
          (key) => key.includes("supabase") || key.includes("pkce")
        ),
        cookies: document.cookie.split(";").map((c) => c.trim()),
        userAgent: navigator.userAgent,
        incognito: !window.indexedDB,
        currentUser: user
          ? {
              id: user.id,
              email: user.email,
              isAnonymous: user.is_anonymous,
              userType: user.user_metadata?.user_type,
              createdVia: user.user_metadata?.created_via,
            }
          : null,
      };

      return debug;
    },

    // Check if identity linking was successful
    checkIdentityLinking: async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          const result = {
            userId: session.user.id,
            isAnonymous: session.user.is_anonymous,
            identitiesCount: session.user.identities?.length || 0,
            hasGoogleIdentity:
              session.user.identities?.some((id) => id.provider === "google") ||
              false,
            email: session.user.email,
            userType: session.user.user_metadata?.user_type,
          };
          return result;
        }
        return null;
      } catch (error) {
        return null;
      }
    },
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthLogic();

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// AuthGuard component to prevent rendering until auth is complete
export function AuthGuard({ children }: { children: ReactNode }) {
  const { loading, user, signInAnonymously } = useAuth();
  const [isSigningInAnonymously, setIsSigningInAnonymously] = useState(false);

  // Auto-sign in anonymously if no user and not already signing in
  useEffect(() => {
    if (!loading && !user && !isSigningInAnonymously) {
      setIsSigningInAnonymously(true);

      signInAnonymously()
        .then((result) => {
          if (result.error) {
            // If anonymous sign-in fails, redirect to login page as fallback
            if (typeof window !== "undefined") {
              window.location.href = "/login";
            }
          } else {
          }
        })
        .catch((error) => {
          // Fallback to login page on error
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
        })
        .finally(() => {
          setIsSigningInAnonymously(false);
        });
    }
  }, [loading, user, signInAnonymously, isSigningInAnonymously]);

  // Show loading spinner until auth is complete or anonymous sign-in is in progress
  if (loading || isSigningInAnonymously) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full size-8 border-b-2 border-gray-100 dark:border-gray-900" />
        {isSigningInAnonymously && (
          <p className="mt-4 text-sm text-muted-foreground">
            Setting up your account...
          </p>
        )}
      </div>
    );
  }

  return <>{children}</>;
}

// Transform Supabase User to our AppUser type
function transformUser(user: User): AppUser {
  return {
    id: user.id,
    email: user.email,
    user_metadata: {
      user_type: user.user_metadata?.user_type || "free",
      created_via: user.user_metadata?.created_via || "google",
    },
    is_anonymous: user.is_anonymous,
  };
}
