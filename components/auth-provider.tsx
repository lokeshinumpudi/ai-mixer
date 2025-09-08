"use client";

import { createClient } from "@/lib/supabase/client";
import type { AppUser, UserType } from "@/lib/supabase/types";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  const [authError, setAuthError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const maxRetries = 3;

  // Import the network error detector
  const { isNetworkError: detectNetworkError } = useMemo(
    () => ({
      isNetworkError: (error: any) => {
        if (!error) return false;
        const errorMessage = error.message || error.toString() || "";
        return (
          errorMessage.includes("CORS") ||
          errorMessage.includes("NetworkError") ||
          errorMessage.includes("Failed to fetch") ||
          errorMessage.includes("ERR_NETWORK") ||
          errorMessage.includes("ERR_INTERNET_DISCONNECTED") ||
          (errorMessage.includes("fetch") &&
            errorMessage.includes("NetworkError"))
        );
      },
    }),
    []
  );

  // Auto-sign in anonymously with retry logic
  useEffect(() => {
    if (
      !loading &&
      !user &&
      !isSigningInAnonymously &&
      retryCount < maxRetries
    ) {
      setIsSigningInAnonymously(true);
      setAuthError(null);

      signInAnonymously()
        .then((result) => {
          if (result.error) {
            const isNetworkErr = detectNetworkError(result.error);

            if (isNetworkErr) {
              setIsNetworkError(true);
              setAuthError(
                "Network connection issue. Please check your internet connection and try again."
              );

              // Exponential backoff retry for network errors
              if (retryCount < maxRetries - 1) {
                const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10s delay
                retryTimeoutRef.current = setTimeout(() => {
                  setRetryCount((prev) => prev + 1);
                  setIsSigningInAnonymously(false);
                }, delay);
              } else {
                setAuthError(
                  "Unable to connect to authentication service. Please refresh the page or try again later."
                );
              }
            } else {
              // Non-network error - show login option
              setAuthError(
                "Authentication failed. Please sign in to continue."
              );
            }
          } else {
            setIsNetworkError(false);
            setRetryCount(0);
          }
        })
        .catch((error) => {
          const isNetworkErr = detectNetworkError(error);

          if (isNetworkErr) {
            setIsNetworkError(true);
            setAuthError(
              "Network connection issue. Please check your internet connection and try again."
            );

            // Exponential backoff retry for network errors
            if (retryCount < maxRetries - 1) {
              const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
              retryTimeoutRef.current = setTimeout(() => {
                setRetryCount((prev) => prev + 1);
                setIsSigningInAnonymously(false);
              }, delay);
            } else {
              setAuthError(
                "Unable to connect to authentication service. Please refresh the page or try again later."
              );
            }
          } else {
            setAuthError("Authentication failed. Please sign in to continue.");
          }
        })
        .finally(() => {
          if (!retryTimeoutRef.current) {
            setIsSigningInAnonymously(false);
          }
        });
    }
  }, [
    loading,
    user,
    signInAnonymously,
    isSigningInAnonymously,
    retryCount,
    maxRetries,
    detectNetworkError,
  ]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Show loading spinner until auth is complete or anonymous sign-in is in progress
  if (loading || isSigningInAnonymously) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full size-8 border-b-2 border-gray-100 dark:border-gray-900" />
        {isSigningInAnonymously && (
          <p className="mt-4 text-sm text-muted-foreground">
            Setting up your account...{" "}
            {retryCount > 0 && `(Retry ${retryCount}/${maxRetries})`}
          </p>
        )}
      </div>
    );
  }

  // Show error state for network issues or auth failures
  if (authError) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md overflow-hidden rounded-2xl flex flex-col gap-6 bg-background/80 backdrop-blur-md shadow-xl ring-1 ring-border/50 p-6 sm:p-8">
          <div className="flex flex-col items-center justify-center gap-3 px-4 text-center sm:px-16">
            <div className="size-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <svg
                className="size-6 text-red-600 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {isNetworkError ? "Connection Issue" : "Authentication Error"}
            </h3>
            <p className="text-sm text-muted-foreground">{authError}</p>
            {isNetworkError && retryCount < maxRetries && (
              <p className="text-xs text-muted-foreground">
                Retrying in a moment... ({retryCount}/{maxRetries})
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setRetryCount(0);
                setAuthError(null);
                setIsNetworkError(false);
                setIsSigningInAnonymously(false);
              }}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>

            {isNetworkError && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
              >
                Refresh Page
              </button>
            )}

            {!isNetworkError && (
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/login";
                }}
                className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
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
