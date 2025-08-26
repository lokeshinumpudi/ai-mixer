import { auth } from '@/app/(auth)/auth';
import { getUserById } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import type { UserType } from '@/app/(auth)/auth';

export interface SecurityContext {
  user: {
    id: string;
    type: UserType;
    email?: string | null;
  };
  isAuthenticated: true;
}

/**
 * Enhanced authentication check with database verification
 * Ensures the user exists in the database and session is valid
 */
export async function requireAuth(): Promise<SecurityContext> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError('unauthorized:chat');
  }

  // Verify user still exists in database (for real-time deactivation)
  const dbUser = await getUserById(session.user.id);
  if (!dbUser) {
    throw new ChatSDKError('unauthorized:chat');
  }

  return {
    user: {
      id: session.user.id,
      type: session.user.type,
      email: session.user.email,
    },
    isAuthenticated: true,
  };
}

/**
 * Rate limiting by user ID
 */
const userRequestCounts = new Map<
  string,
  { count: number; resetTime: number }
>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // per minute per user

export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = userRequestCounts.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    // Reset or create new limit
    userRequestCounts.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  userLimit.count++;
  return true;
}

/**
 * Input validation utilities
 */
export function validateRequestSize(
  request: Request,
  maxSizeBytes = 1024 * 1024,
): void {
  const contentLength = request.headers.get('content-length');
  if (contentLength && Number.parseInt(contentLength) > maxSizeBytes) {
    throw new ChatSDKError('bad_request:api', 'Request too large');
  }
}

/**
 * Security logging utility
 */
export function logSecurityEvent(
  event:
    | 'unauthorized_access'
    | 'forbidden_model'
    | 'rate_limit_exceeded'
    | 'invalid_input',
  details: {
    userId?: string;
    userType?: UserType;
    resource?: string;
    attemptedValue?: string;
    allowedValues?: string[];
    ip?: string;
    userAgent?: string;
  },
): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    event,
    ...details,
  };

  // In production, send to security monitoring service
  if (process.env.NODE_ENV === 'production') {
    console.warn(`[SECURITY] ${JSON.stringify(logEntry)}`);
    // TODO: Send to security monitoring service (e.g., Sentry, DataDog)
  } else {
    console.warn(`[SECURITY] ${event}:`, details);
  }
}

/**
 * Enhanced API route wrapper with security checks
 */
export function withSecurity<T extends any[]>(
  handler: (securityContext: SecurityContext, ...args: T) => Promise<Response>,
  options?: {
    requireAuth?: boolean;
    rateLimit?: boolean;
    maxRequestSize?: number;
  },
) {
  const {
    requireAuth: needsAuth = true,
    rateLimit = true,
    maxRequestSize = 1024 * 1024,
  } = options || {};

  return async (request: Request, ...args: T): Promise<Response> => {
    try {
      // Validate request size
      validateRequestSize(request, maxRequestSize);

      let securityContext: SecurityContext | null = null;

      // Authentication check
      if (needsAuth) {
        securityContext = await requireAuth();

        // Rate limiting
        if (rateLimit && !checkRateLimit(securityContext.user.id)) {
          logSecurityEvent('rate_limit_exceeded', {
            userId: securityContext.user.id,
            userType: securityContext.user.type,
          });
          return new ChatSDKError('rate_limit:api').toResponse();
        }
      }

      // Call the actual handler
      return await handler(securityContext as SecurityContext, ...args);
    } catch (error) {
      if (error instanceof ChatSDKError) {
        return error.toResponse();
      }

      console.error('API Error:', error);
      return new ChatSDKError('bad_request:api').toResponse();
    }
  };
}

/**
 * Model access validation with security logging
 */
export function validateModelAccess(
  modelId: string,
  userType: UserType,
  userId: string,
  allowedModelIds: string[],
): void {
  if (!allowedModelIds.includes(modelId)) {
    logSecurityEvent('forbidden_model', {
      userId,
      userType,
      resource: 'model_access',
      attemptedValue: modelId,
      allowedValues: allowedModelIds,
    });
    throw new ChatSDKError('forbidden:chat');
  }
}
