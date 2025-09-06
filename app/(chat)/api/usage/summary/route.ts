import { authenticatedRoute } from "@/lib/auth-decorators";
import {
  getUserUsageAndLimits,
  getUserUsageWithValidation,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { apiLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Backward compatibility endpoint for existing useUsage hook
// Returns usage data in the format expected by existing UI components
export const GET = authenticatedRoute(async (request, _context, user) => {
  try {
    apiLogger.info(
      {
        userId: user.id,
        userType: user.userType,
      },
      "Usage summary request (backward compatibility)"
    );

    // Get usage data from NEW usage tracking system
    const newUsageData = await getUserUsageWithValidation(
      user.id,
      user.userType,
      1,
      100 // Get recent usage for counting
    );

    // Get limits from old system for quota information
    const limitsInfo = await getUserUsageAndLimits({
      userId: user.id,
      userType: user.userType,
    });

    // Count messages from new usage system (each chat usage record = 1 message)
    const messagesUsedToday = newUsageData.items.filter((item) => {
      const itemDate = new Date(item.createdAt);
      const today = new Date();
      return itemDate.toDateString() === today.toDateString();
    }).length;

    // Format response to match existing useUsage hook expectations
    const response = {
      plan: {
        used: messagesUsedToday, // Use NEW system count
        quota: limitsInfo.quota,
        remaining: Math.max(0, limitsInfo.quota - messagesUsedToday),
        isOverLimit: messagesUsedToday >= limitsInfo.quota,
        type: limitsInfo.type,
        resetInfo: limitsInfo.resetInfo,
      },
      usage: [], // Empty array for backward compatibility - detailed usage is in /api/usage
    };

    apiLogger.info(
      {
        userId: user.id,
        usageInfo: {
          used: messagesUsedToday,
          quota: limitsInfo.quota,
          remaining: Math.max(0, limitsInfo.quota - messagesUsedToday),
          isOverLimit: messagesUsedToday >= limitsInfo.quota,
          newSystemRecords: newUsageData.items.length,
        },
      },
      "Usage summary retrieved successfully"
    );

    return Response.json(response);
  } catch (error) {
    const parsedError =
      error instanceof Error ? error : new Error(String(error));

    apiLogger.error(
      {
        error: parsedError.message,
        stack: parsedError.stack,
        userId: user.id,
      },
      "Failed to get usage summary"
    );

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return new ChatSDKError(
      "bad_request:database",
      "Failed to retrieve usage summary"
    ).toResponse();
  }
});
