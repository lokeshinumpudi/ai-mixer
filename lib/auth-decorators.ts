/**
 * Authentication decorators and utilities for API routes
 *
 * These utilities help API routes declare their authentication requirements
 * and provide consistent auth handling.
 */

import { auth } from '@/app/(auth)/auth';
import type { NextRequest } from 'next/server';
import { ChatSDKError } from './errors';

export type RouteHandler = (
  request: NextRequest,
  context?: any,
) => Promise<Response>;
export type AuthenticatedRouteHandler = (
  request: NextRequest,
  context: any,
  user: any,
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
 * Decorator for protected API routes that require authentication
 */
export function protectedRoute(handler: AuthenticatedRouteHandler) {
  return async (request: NextRequest, context?: any) => {
    try {
      const session = await auth();

      if (!session?.user) {
        return new ChatSDKError(
          'unauthorized:api',
          'Authentication required',
        ).toResponse();
      }

      return await handler(request, context, session.user);
    } catch (error) {
      console.error('Protected route error:', error);
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
export async function getCurrentUser() {
  try {
    const session = await auth();
    return session?.user || null;
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
}

/**
 * Utility for guest access with message limits
 */
export async function handleGuestAccess(request: NextRequest) {
  const session = await auth();

  if (session?.user) {
    return { user: session.user, isGuest: false };
  }

  // Implement guest logic here
  // For now, return guest user
  return {
    user: {
      id: 'guest',
      email: 'guest@example.com',
      type: 'guest',
    },
    isGuest: true,
  };
}

/**
 * Type-safe wrapper for withSecurity function (existing pattern)
 */
export function withAuth<T = any>(
  handler: (user: any, request: NextRequest, context?: T) => Promise<Response>,
) {
  return async (request: NextRequest, context?: T) => {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError(
        'unauthorized:api',
        'Authentication required',
      ).toResponse();
    }

    return await handler(session.user, request, context);
  };
}
