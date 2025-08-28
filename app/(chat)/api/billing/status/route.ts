import { ChatSDKError } from '@/lib/errors';
import { getRecentPurchaseCreditsCount } from '@/lib/db/queries';
import { protectedRoute } from '@/lib/auth-decorators';

export const dynamic = 'force-dynamic';

export const GET = protectedRoute(async (request, context, user) => {
  const url = new URL(request.url);
  const lookbackSeconds = Number(
    url.searchParams.get('lookbackSeconds') ?? '120',
  );
  const since = new Date(Date.now() - Math.max(10, lookbackSeconds) * 1000);

  try {
    const count = await getRecentPurchaseCreditsCount({
      userId: user.id,
      since,
    });

    return Response.json({ hasRecentPurchaseCredit: count > 0, count, since });
  } catch (error) {
    return new ChatSDKError('bad_request:api').toResponse();
  }
});
