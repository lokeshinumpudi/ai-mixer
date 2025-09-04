import { authenticatedRoute } from '@/lib/auth-decorators';
import { listCompareRunsByChat } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export const GET = authenticatedRoute(async (request, _context, user) => {
  try {
    const url = new URL(request.url);
    const chatId = url.searchParams.get('chatId');
    const limit = Number.parseInt(url.searchParams.get('limit') || '50', 10);
    const cursor = url.searchParams.get('cursor') || undefined;

    if (!chatId) {
      return new ChatSDKError(
        'bad_request:api',
        'chatId is required',
      ).toResponse();
    }

    // TODO: Verify user has access to this chat
    // For now, the query will only return runs for this user anyway

    const result = await listCompareRunsByChat({
      chatId,
      limit,
      cursor,
    });

    // Filter to only runs owned by this user (additional security layer)
    const filteredItems = result.items.filter((run) => run.userId === user.id);

    return Response.json({
      items: filteredItems,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    });
  } catch (error) {
    console.error('List compare runs error:', error);

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return new ChatSDKError(
      'bad_request:api',
      'Failed to list compare runs',
    ).toResponse();
  }
});
