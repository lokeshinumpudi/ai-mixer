import { auth } from '@/app/(auth)/auth';
import { ChatSDKError } from '@/lib/errors';
import { getUserUsageSummary } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  try {
    const usageSummary = await getUserUsageSummary(session.user.id);
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
}
