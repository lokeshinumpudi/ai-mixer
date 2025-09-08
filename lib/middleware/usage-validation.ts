import "server-only";

import { getUserUsageAndLimitsOptimized } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { apiLogger } from "@/lib/logger";
import type { UserType } from "@/lib/supabase/types";

export interface UsageValidationResult {
  isValid: boolean;
  usageInfo: {
    used: number;
    quota: number;
    remaining: number;
    isOverLimit: boolean;
    type: "daily" | "monthly";
    resetInfo: string;
  };
  error?: ChatSDKError;
}

/**
 * Middleware function to validate user usage limits before allowing API operations
 *
 * This provides a consistent, fast O(1) lookup for usage validation across all APIs
 * using the optimized user aggregates table instead of expensive database aggregations.
 *
 * @param userId - The user ID to check
 * @param userType - The user type (anonymous, free, pro)
 * @param operation - Description of the operation being attempted (for logging)
 * @returns Promise<UsageValidationResult> - Validation result with usage info
 */
export async function validateUserUsage(
  userId: string,
  userType: UserType,
  operation = "API operation"
): Promise<UsageValidationResult> {
  try {
    apiLogger.debug(
      {
        userId,
        userType,
        operation,
      },
      "Validating user usage limits"
    );

    // Fast O(1) lookup using aggregates table
    const usageInfo = await getUserUsageAndLimitsOptimized(userId, userType);

    apiLogger.info(
      {
        userId,
        userType,
        operation,
        currentUsage: usageInfo.used,
        quota: usageInfo.quota,
        remaining: usageInfo.remaining,
        isOverLimit: usageInfo.isOverLimit,
        resetType: usageInfo.type,
      },
      "Usage validation completed"
    );

    // Check if user has exceeded their quota
    if (usageInfo.isOverLimit) {
      apiLogger.warn(
        {
          userId,
          userType,
          operation,
          used: usageInfo.used,
          quota: usageInfo.quota,
          isAnonymous: userType === "anonymous",
        },
        "User exceeded usage quota - blocking operation"
      );

      // Different error handling for anonymous vs authenticated users
      let error: ChatSDKError;

      if (userType === "anonymous") {
        // Anonymous users get a login prompt
        apiLogger.info(
          {
            userId,
            operation,
            currentUsage: usageInfo.used,
            quota: usageInfo.quota,
          },
          "Anonymous user hit rate limit - prompting login"
        );
        error = new ChatSDKError(
          "login_required:compare",
          "Sign in to unlock higher limits and continue using the service"
        );
      } else {
        // Authenticated users get upgrade prompt
        error = new ChatSDKError(
          "rate_limit:chat",
          `You've reached your ${usageInfo.type} limit of ${
            usageInfo.quota
          } messages. ${
            userType === "free"
              ? "Upgrade to Pro for unlimited conversations."
              : `Your quota resets ${usageInfo.resetInfo}.`
          }`
        );
      }

      return {
        isValid: false,
        usageInfo,
        error,
      };
    }

    return {
      isValid: true,
      usageInfo,
    };
  } catch (error) {
    const parsedError =
      error instanceof Error ? error : new Error(String(error));

    apiLogger.error(
      {
        userId,
        userType,
        operation,
        error: parsedError.message,
        stack: parsedError.stack,
      },
      "Failed to validate user usage"
    );

    // On validation failure, allow the operation but log the error
    // This prevents service disruption due to database issues
    return {
      isValid: true,
      usageInfo: {
        used: 0,
        quota: 1000, // Fallback quota
        remaining: 1000,
        isOverLimit: false,
        type: "daily" as const,
        resetInfo: "tomorrow at 5:29 AM",
      },
    };
  }
}

/**
 * Middleware wrapper for API routes that require usage validation
 *
 * Usage:
 * ```typescript
 * export const POST = withUsageValidation(
 *   async (request, context, user, usageInfo) => {
 *     // Your API logic here
 *     // usageInfo contains validated usage data
 *     return Response.json({ success: true });
 *   },
 *   'chat_stream' // operation name for logging
 * );
 * ```
 */
export function withUsageValidation<T extends any[], R>(
  handler: (
    request: Request,
    context: any,
    user: any,
    usageInfo: UsageValidationResult["usageInfo"],
    ...args: T
  ) => Promise<R>,
  operation: string
) {
  return async (
    request: Request,
    context: any,
    user: any,
    ...args: T
  ): Promise<R> => {
    // Validate usage before proceeding
    const validation = await validateUserUsage(
      user.id,
      user.userType,
      operation
    );

    if (!validation.isValid && validation.error) {
      return validation.error.toResponse() as R;
    }

    // Proceed with the original handler, passing usage info
    return handler(request, context, user, validation.usageInfo, ...args);
  };
}

/**
 * Lightweight usage check for read-only operations
 *
 * This performs the same validation but doesn't block the operation,
 * just provides usage info for display purposes.
 */
export async function checkUserUsage(
  userId: string,
  userType: UserType
): Promise<UsageValidationResult["usageInfo"]> {
  try {
    return await getUserUsageAndLimitsOptimized(userId, userType);
  } catch (error) {
    apiLogger.error(
      {
        userId,
        userType,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to check user usage - returning fallback"
    );

    // Return fallback usage info
    return {
      used: 0,
      quota: 1000,
      remaining: 1000,
      isOverLimit: false,
      type: "daily" as const,
      resetInfo: "tomorrow at 5:29 AM",
    };
  }
}
