"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface UseAnonymousAuthReturn {
  user: any;
  isLoading: boolean;
  messageCount: number;
  signInWithGoogle: () => Promise<void>;
  incrementMessageCount: () => void;
  shouldShowLoginPrompt: boolean;
}

const MAX_ANONYMOUS_MESSAGES = 5;
const MESSAGE_COUNT_KEY = "anonymous_message_count";

export function useAnonymousAuth(): UseAnonymousAuthReturn {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [messageCount, setMessageCount] = useState(0);
  const router = useRouter();
  const supabase = createClient();

  // Load message count from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(MESSAGE_COUNT_KEY);
      setMessageCount(stored ? Number.parseInt(stored, 10) : 0);
    }
  }, []);

  // Initialize user session
  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);

      try {
        // Check for existing session
        const {
          data: { user: existingUser },
        } = await supabase.auth.getUser();

        if (existingUser) {
          setUser(existingUser);
        } else {
          // Create anonymous user if none exists
          const { data, error } = await supabase.auth.signInAnonymously();

          if (error) {
            console.error("Failed to create anonymous user:", error);
            // Create a fallback anonymous user object for client-side functionality
            setUser({
              id: `guest-${Date.now()}`,
              email: undefined,
              is_anonymous: true,
              user_metadata: {
                user_type: "anonymous",
                created_via: "anonymous",
              },
            } as any);
          } else {
            setUser(data.user);
          }
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user);
        // Reset message count when user signs in with Google
        if (!session.user.is_anonymous) {
          setMessageCount(0);
          localStorage.removeItem(MESSAGE_COUNT_KEY);
        }
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setMessageCount(0);
        localStorage.removeItem(MESSAGE_COUNT_KEY);
        // Create new anonymous user after sign out
        setTimeout(async () => {
          try {
            const { data, error } = await supabase.auth.signInAnonymously();
            if (error) {
              console.error(
                "Failed to create anonymous user after sign out:",
                error
              );
              // Create fallback anonymous user
              setUser({
                id: `guest-${Date.now()}`,
                email: undefined,
                is_anonymous: true,
                user_metadata: {
                  user_type: "anonymous",
                  created_via: "anonymous",
                },
              } as any);
            } else {
              setUser(data.user);
            }
          } catch (error) {
            console.error(
              "Error creating anonymous user after sign out:",
              error
            );
            // Create fallback anonymous user
            setUser({
              id: `guest-${Date.now()}`,
              email: undefined,
              is_anonymous: true,
              user_metadata: {
                user_type: "anonymous",
                created_via: "anonymous",
              },
            } as any);
          }
        }, 100);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const signInWithGoogle = useCallback(async () => {
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

      if (error) {
        console.error("Google sign-in error:", error);
        throw error;
      }
    } catch (error) {
      console.error("Failed to sign in with Google:", error);
      throw error;
    }
  }, [supabase.auth]);

  const incrementMessageCount = useCallback(() => {
    if (user?.is_anonymous !== false) {
      // Only increment for anonymous users
      const newCount = messageCount + 1;
      setMessageCount(newCount);
      localStorage.setItem(MESSAGE_COUNT_KEY, newCount.toString());
    }
  }, [messageCount, user?.is_anonymous]);

  const shouldShowLoginPrompt = messageCount >= MAX_ANONYMOUS_MESSAGES - 2; // Show prompt at 8 messages

  return {
    user,
    isLoading,
    messageCount,
    signInWithGoogle,
    incrementMessageCount,
    shouldShowLoginPrompt,
  };
}
