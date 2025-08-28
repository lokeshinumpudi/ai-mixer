import { protectedRoute } from '@/lib/auth-decorators';
import { SESSION_CONFIG } from '@/lib/auth/session-config';
import { getRecentPurchaseCreditsCount } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export const GET = protectedRoute(async (request, context, user) => {
  const url = new URL(request.url);
  const defaultLookbackMs = SESSION_CONFIG.PAYMENTS.VERIFICATION_WINDOW;
  const lookbackSeconds = Number(
    url.searchParams.get('lookbackSeconds') ?? String(defaultLookbackMs / 1000),
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
