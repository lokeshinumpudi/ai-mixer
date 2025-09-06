import { authenticatedRoute } from '@/lib/auth-decorators';
import { getUserUsageWithValidation } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import { apiLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Ultra-minimal, cost-conscious usage API
// Returns raw data for client-side computation + server validation context
export const GET = authenticatedRoute(async (request, _context, user) => {
  try {
    const url = new URL(request.url);
    const page = Math.max(
      1,
      Number.parseInt(url.searchParams.get('page') || '1', 10),
    );
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(url.searchParams.get('limit') || '25', 10)),
    ); // Cost-conscious default: 25
    const chatId = url.searchParams.get('chatId');

    apiLogger.info(
      {
        userId: user.id,
        userType: user.userType,
        page,
        limit,
        chatId,
      },
      'Usage data request',
    );

    if (chatId) {
      // Future: Chat-specific usage endpoint can be implemented here
      // For now, return general usage data
      apiLogger.debug(
        { chatId },
        'Chat-specific usage not yet implemented, returning general usage',
      );
    }

    // Get raw usage data + server validation context
    const usageData = await getUserUsageWithValidation(
      user.id,
      user.userType,
      page,
      limit,
    );

    apiLogger.info(
      {
        userId: user.id,
        itemCount: usageData.items.length,
        totalRecords: usageData.total,
        currentUsage: usageData.currentUsage,
      },
      'Usage data retrieved successfully',
    );

    return Response.json(usageData);
  } catch (error) {
    const parsedError =
      error instanceof Error ? error : new Error(String(error));

    apiLogger.error(
      {
        error: parsedError.message,
        stack: parsedError.stack,
        userId: user.id,
      },
      'Failed to get usage data',
    );

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return new ChatSDKError(
      'bad_request:database',
      'Failed to get usage data',
    ).toResponse();
  }
});
