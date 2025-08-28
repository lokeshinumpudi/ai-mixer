import { ChatSDKError } from '@/lib/errors';
import { getUserUsageSummary } from '@/lib/db/queries';
import { protectedRoute } from '@/lib/auth-decorators';

export const dynamic = 'force-dynamic';

export const GET = protectedRoute(async (request, context, user) => {
  try {
    const usageSummary = await getUserUsageSummary(user.id);
    return Response.json(usageSummary);
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return new ChatSDKError(
      'bad_request:database',
      'Failed to get usage summary',
    ).toResponse();
  }
});
