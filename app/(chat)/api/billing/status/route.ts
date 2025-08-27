import { auth } from '@/app/(auth)/auth';
import { getRecentPurchaseCreditsCount } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const url = new URL(request.url);
  const lookbackSeconds = Number(
    url.searchParams.get('lookbackSeconds') ?? '120',
  );
  const since = new Date(Date.now() - Math.max(10, lookbackSeconds) * 1000);

  try {
    const count = await getRecentPurchaseCreditsCount({
      userId: session.user.id,
      since,
    });

    return Response.json({ hasRecentPurchaseCredit: count > 0, count, since });
  } catch (error) {
    return new ChatSDKError('bad_request:api').toResponse();
  }
}
