"use client";

import { getChatHistoryPaginationKey } from "@/components/sidebar-history";
import { createClient } from "@/lib/supabase/client";
import type { AppUser, UserType } from "@/lib/supabase/types";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { mutate } from "swr";
import { unstable_serialize } from "swr/infinite";

export function useSupabaseAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  const clearUserData = () => {
    // Clear all SWR caches that might contain user-specific data
    mutate(() => true, undefined, { revalidate: false });

    // Specifically clear chat history and user-related caches
    // Clear SWR Infinite cache for chat history pages
    try {
      mutate(unstable_serialize(getChatHistoryPaginationKey), undefined, {
        revalidate: false,
      });
    } catch (_) {
      // no-op: fallback to pattern-based clear below
    }
    // Also clear any direct history keys as a safety net
    mutate(
      (key) => typeof key === "string" && key.startsWith("/api/history"),
      undefined,
      {
        revalidate: false,
      }
    );
    mutate("/api/usage/summary", undefined, { revalidate: false });
    mutate("/api/models", undefined, { revalidate: false });
    mutate("/api/user/settings", undefined, { revalidate: false });

    // Clear user-specific localStorage data
    const keysToRemove = [
      "anonymous_message_count",
      "user-model-selection",
      "sidebar-state",
      "chat-input-draft",
      // Also clear artifact UI caches which may reveal content
      "artifact",
    ];

    keysToRemove.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn(`Failed to remove localStorage key: ${key}`, error);
      }
    });

    // Clear any cached data that might contain user information
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
      console.warn("Failed to clear user-specific localStorage data:", error);
    }

    console.log("[AUTH] User data cleared on sign out");
  };

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ? transformUser(session.user) : null);
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ? transformUser(session.user) : null);
      setLoading(false);

      // Handle auth events
      if (event === "SIGNED_IN") {
        router.refresh();
      } else if (event === "SIGNED_OUT") {
        // Clear user data when signed out (in case signOut wasn't called directly)
        clearUserData();
        router.push("/");
        router.refresh();
        // Force a full window refresh to ensure complete state reset
        window.location.reload();
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

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

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      // Use current location to construct proper redirect URL
      const protocol = window.location.protocol;
      const host = window.location.host;
      const redirectUrl = `${protocol}//${host}/auth/callback`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
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
    setLoading(true);
    try {
      // Clear user data before signing out
      clearUserData();

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Navigate to home and refresh
      router.push("/");
      router.refresh();
      // Force a full window refresh to ensure complete state reset
      window.location.reload();

      return { error: null };
    } catch (error) {
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const linkGoogleAccount = async () => {
    if (!user?.is_anonymous) {
      throw new Error("Can only link accounts for anonymous users");
    }

    setLoading(true);
    try {
      // Use current location to construct proper redirect URL
      const protocol = window.location.protocol;
      const host = window.location.host;
      const redirectUrl = `${protocol}//${host}/auth/callback`;

      const { data, error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
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

  return {
    user,
    loading,
    signInAnonymously,
    signInWithGoogle,
    signOut,
    linkGoogleAccount,
    isAuthenticated: !!user,
    isAnonymous: user?.is_anonymous || false,
    userType: user?.user_metadata?.user_type || "anonymous",
  };
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
