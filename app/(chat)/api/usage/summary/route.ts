import { authenticatedRoute } from '@/lib/auth-decorators';
import { getUserUsageSummary } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export const GET = authenticatedRoute(async (request, context, user) => {
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
