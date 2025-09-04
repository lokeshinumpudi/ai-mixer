/**
 * Authentication decorators and utilities for API routes
 *
 * These utilities help API routes declare their authentication requirements
 * and provide consistent auth handling.
 */

import { createOAuthUserIfNotExists, getUserType } from "@/lib/db/queries";
import { createClient } from "@/lib/supabase/server";
import type { AppUser, UserType } from "@/lib/supabase/types";
import type { NextRequest } from "next/server";
import { ChatSDKError } from "./errors";
import { authLogger } from "./logger";

export type RouteHandler = (
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) => Promise<Response>;
export type AuthenticatedRouteHandler = (
  request: NextRequest,
  context: { params?: Promise<Record<string, string>> },
  user: AppUser & { userType: UserType }
) => Promise<Response>;

/**
 * Decorator for public API routes that require no authentication
 */
export function publicRoute(handler: RouteHandler) {
  return async (request: NextRequest, context?: any) => {
    try {
      return await handler(request, context);
    } catch (error: any) {
      authLogger.error(
        {
          error: error.message,
          stack: error.stack,
          url: request.url,
        },
        "Public route error"
      );
      if (error instanceof ChatSDKError) {
        return error.toResponse();
      }
      return new ChatSDKError(
        "bad_request:api",
        "Internal server error"
      ).toResponse();
    }
  };
}

/**
 * Decorator for authenticated routes that allow anonymous users (for usage tracking, etc.)
 */
export function authenticatedRoute(handler: AuthenticatedRouteHandler) {
  return async (request: NextRequest, context?: any) => {
    authLogger.debug(
      {
        url: request.url,
        method: request.method,
      },
      "Processing authenticated route"
    );

    try {
      const supabase = await createClient();

      // Support Authorization: Bearer <token> for mobile clients
      const authHeader = request.headers.get("authorization");
      const bearer = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : undefined;

      authLogger.debug(
        {
          authMethod: bearer ? "bearer_token" : "session",
          hasBearerToken: !!bearer,
        },
        "Getting user authentication"
      );

      const {
        data: { user: supabaseUser },
        error: authError,
      } = bearer
        ? await supabase.auth.getUser(bearer)
        : await supabase.auth.getUser();

      // Log error details for debugging
      if (authError) {
        authLogger.error(
          {
            error: authError.message,
            code: authError.status,
            authMethod: bearer ? "bearer_token" : "session",
          },
          "Supabase authentication error"
        );
      }

      if (!supabaseUser) {
        authLogger.warn(
          {
            authMethod: bearer ? "bearer_token" : "session",
            url: request.url,
          },
          "No authenticated user found"
        );
        return new ChatSDKError(
          "unauthorized:api",
          "Authentication required"
        ).toResponse();
      }

      authLogger.info(
        {
          userId: supabaseUser.id,
          isAnonymous: supabaseUser.is_anonymous,
          email: supabaseUser.email || "none",
          authMethod: bearer ? "bearer_token" : "session",
        },
        "User authenticated successfully"
      );

      // Get user type from database with robust error handling
      authLogger.debug(
        {
          userId: supabaseUser.id,
          isAnonymous: supabaseUser.is_anonymous,
        },
        "Retrieving user type from database"
      );

      const userType = await getUserType(
        supabaseUser.id,
        supabaseUser.is_anonymous
      );

      authLogger.debug(
        {
          userId: supabaseUser.id,
          userType,
          isAnonymous: supabaseUser.is_anonymous,
        },
        "User type determined"
      );

      // Create initial user object with Supabase data
      let user: AppUser & { userType: UserType } = {
        id: supabaseUser.id,
        email: supabaseUser.email,
        user_metadata: {
          user_type: userType, // Keep for backward compatibility
          created_via:
            supabaseUser.user_metadata?.created_via ||
            (supabaseUser.is_anonymous ? "anonymous" : "google"),
        },
        is_anonymous: supabaseUser.is_anonymous,
        userType, // Simplified user type
      };

      // Handle OAuth user linking for non-anonymous users
      if (!supabaseUser.is_anonymous && supabaseUser.email) {
        authLogger.debug(
          {
            userId: user.id,
            email: user.email,
          },
          "Ensuring OAuth user exists in database"
        );

        try {
          const dbUser = await createOAuthUserIfNotExists(
            supabaseUser.id,
            supabaseUser.email
          );

          // Update user object with correct database user ID
          user = {
            ...user,
            id: dbUser.id, // Use the correct user ID from database
          };

          authLogger.debug(
            {
              supabaseUserId: supabaseUser.id,
              dbUserId: dbUser.id,
              email: user.email,
            },
            "User object updated with correct database ID"
          );
        } catch (error) {
          authLogger.error(
            {
              userId: supabaseUser.id,
              email: supabaseUser.email,
              error: error instanceof Error ? error.message : String(error),
            },
            "Failed to create/link OAuth user in database"
          );
          // Continue with original user object to avoid breaking auth
        }
      }

      authLogger.debug(
        {
          userId: user.id,
          userType: user.userType,
          url: request.url,
        },
        "Calling authenticated route handler"
      );

      return await handler(request, context, user);
    } catch (error: any) {
      authLogger.error(
        {
          error: error.message,
          stack: error.stack,
          url: request.url,
        },
        "Authenticated route error"
      );

      if (error instanceof ChatSDKError) {
        authLogger.info(
          {
            errorType: error.type,
            url: request.url,
          },
          "Returning ChatSDKError response"
        );
        return error.toResponse();
      }
      authLogger.error(
        {
          error: error.message,
          url: request.url,
        },
        "Returning generic error response"
      );
      return new ChatSDKError(
        "bad_request:api",
        "Internal server error"
      ).toResponse();
    }
  };
}

/**
 * Decorator for conditional routes that handle their own auth logic
 * (e.g., guest access with limitations)
 */
export function conditionalRoute(handler: RouteHandler) {
  return async (request: NextRequest, context?: any) => {
    try {
      // Let the route handle its own auth logic
      return await handler(request, context);
    } catch (error: any) {
      authLogger.error(
        {
          error: error.message,
          stack: error.stack,
          url: request.url,
        },
        "Conditional route error"
      );
      if (error instanceof ChatSDKError) {
        return error.toResponse();
      }
      return new ChatSDKError(
        "bad_request:api",
        "Internal server error"
      ).toResponse();
    }
  };
}

/**
 * Utility to get current user session (for conditional routes)
 */
export async function getCurrentUser(): Promise<
  (AppUser & { userType: UserType }) | null
> {
  authLogger.debug({}, "getCurrentUser called");

  try {
    const supabase = await createClient();

    // Note: getCurrentUser cannot receive request; rely on cookies first,
    // then allow Authorization header via Next/Edge request if available.
    // For callers that have Request, prefer decorators.
    authLogger.debug({}, "Getting user from session");
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser();

    if (!supabaseUser) {
      authLogger.debug({}, "No user found in session");
      return null;
    }

    authLogger.info(
      {
        userId: supabaseUser.id,
        isAnonymous: supabaseUser.is_anonymous,
        email: supabaseUser.email || "none",
      },
      "Found authenticated user"
    );

    // Determine user type from database instead of user_metadata
    authLogger.debug(
      {
        userId: supabaseUser.id,
        isAnonymous: supabaseUser.is_anonymous,
      },
      "Retrieving user type from database"
    );

    const userType = await getUserType(
      supabaseUser.id,
      supabaseUser.is_anonymous
    );

    authLogger.debug(
      {
        userId: supabaseUser.id,
        userType,
        isAnonymous: supabaseUser.is_anonymous,
      },
      "User type determined"
    );

    return {
      id: supabaseUser.id,
      email: supabaseUser.email,
      user_metadata: {
        user_type: userType, // Keep for backward compatibility but derive from DB
        created_via:
          supabaseUser.user_metadata?.created_via ||
          (supabaseUser.is_anonymous ? "anonymous" : "google"),
      },
      is_anonymous: supabaseUser.is_anonymous,
      userType, // New database-derived user type
    };
  } catch (error: any) {
    authLogger.error(
      {
        error: error.message,
        stack: error.stack,
      },
      "Failed to get current user"
    );
    return null;
  }
}

/**
 * Utility for guest access with message limits
 */
export async function handleGuestAccess(request: NextRequest) {
  const user = await getCurrentUser();

  if (user && !user.is_anonymous) {
    return { user, isGuest: false };
  }

  // Return anonymous user or create one if none exists
  return {
    user: user || {
      id: "anonymous",
      email: undefined,
      user_metadata: {
        user_type: "anonymous" as const,
        created_via: "anonymous" as const,
      },
      is_anonymous: true,
    },
    isGuest: true,
  };
}

/**
 * Type-safe wrapper for withSecurity function (existing pattern)
 */
export function withAuth<T = any>(
  handler: (
    user: AppUser,
    request: NextRequest,
    context?: T
  ) => Promise<Response>
) {
  return async (request: NextRequest, context?: T) => {
    const user = await getCurrentUser();

    if (!user || user.is_anonymous) {
      return new ChatSDKError(
        "unauthorized:api",
        "Authentication required"
      ).toResponse();
    }

    return await handler(user, request, context);
  };
}
