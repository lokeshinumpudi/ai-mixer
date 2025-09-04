/**
 * Authentication decorators and utilities for API routes
 *
 * These utilities help API routes declare their authentication requirements
 * and provide consistent auth handling.
 */

import { getUserType } from '@/lib/db/queries';
import { createClient } from '@/lib/supabase/server';
import type { AppUser, UserType } from '@/lib/supabase/types';
import type { NextRequest } from 'next/server';
import { ChatSDKError } from './errors';

export type RouteHandler = (
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> },
) => Promise<Response>;
export type AuthenticatedRouteHandler = (
  request: NextRequest,
  context: { params?: Promise<Record<string, string>> },
  user: AppUser & { userType: UserType },
) => Promise<Response>;

/**
 * Decorator for public API routes that require no authentication
 */
export function publicRoute(handler: RouteHandler) {
  return async (request: NextRequest, context?: any) => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error('Public route error:', error);
      if (error instanceof ChatSDKError) {
        return error.toResponse();
      }
      return new ChatSDKError(
        'bad_request:api',
        'Internal server error',
      ).toResponse();
    }
  };
}

/**
 * Decorator for authenticated routes that allow anonymous users (for usage tracking, etc.)
 */
export function authenticatedRoute(handler: AuthenticatedRouteHandler) {
  return async (request: NextRequest, context?: any) => {
    try {
      const supabase = await createClient();

      // Support Authorization: Bearer <token> for mobile clients
      const authHeader = request.headers.get('authorization');
      const bearer = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : undefined;

      const {
        data: { user: supabaseUser },
        error: authError,
      } = bearer
        ? await supabase.auth.getUser(bearer)
        : await supabase.auth.getUser();

      // Log error details for debugging
      if (authError) {
        console.error('Supabase auth error:', authError);
      }

      if (!supabaseUser) {
        return new ChatSDKError(
          'unauthorized:api',
          'Authentication required',
        ).toResponse();
      }

      // Get user type from database with robust error handling
      const userType = await getUserType(
        supabaseUser.id,
        supabaseUser.is_anonymous,
      );

      const user: AppUser & { userType: UserType } = {
        id: supabaseUser.id,
        email: supabaseUser.email,
        user_metadata: {
          user_type: userType, // Keep for backward compatibility
          created_via:
            supabaseUser.user_metadata?.created_via ||
            (supabaseUser.is_anonymous ? 'anonymous' : 'google'),
        },
        is_anonymous: supabaseUser.is_anonymous,
        userType, // Simplified user type
      };

      return await handler(request, context, user);
    } catch (error) {
      console.error('Authenticated route error:', error);
      if (error instanceof ChatSDKError) {
        return error.toResponse();
      }
      return new ChatSDKError(
        'bad_request:api',
        'Internal server error',
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
    } catch (error) {
      console.error('Conditional route error:', error);
      if (error instanceof ChatSDKError) {
        return error.toResponse();
      }
      return new ChatSDKError(
        'bad_request:api',
        'Internal server error',
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
  try {
    const supabase = await createClient();

    // Note: getCurrentUser cannot receive request; rely on cookies first,
    // then allow Authorization header via Next/Edge request if available.
    // For callers that have Request, prefer decorators.
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser();

    if (!supabaseUser) return null;

    // Determine user type from database instead of user_metadata
    const userType = await getUserType(
      supabaseUser.id,
      supabaseUser.is_anonymous,
    );

    return {
      id: supabaseUser.id,
      email: supabaseUser.email,
      user_metadata: {
        user_type: userType, // Keep for backward compatibility but derive from DB
        created_via:
          supabaseUser.user_metadata?.created_via ||
          (supabaseUser.is_anonymous ? 'anonymous' : 'google'),
      },
      is_anonymous: supabaseUser.is_anonymous,
      userType, // New database-derived user type
    };
  } catch (error) {
    console.error('Failed to get current user:', error);
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
      id: 'anonymous',
      email: undefined,
      user_metadata: {
        user_type: 'anonymous' as const,
        created_via: 'anonymous' as const,
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
    context?: T,
  ) => Promise<Response>,
) {
  return async (request: NextRequest, context?: T) => {
    const user = await getCurrentUser();

    if (!user || user.is_anonymous) {
      return new ChatSDKError(
        'unauthorized:api',
        'Authentication required',
      ).toResponse();
    }

    return await handler(user, request, context);
  };
}
