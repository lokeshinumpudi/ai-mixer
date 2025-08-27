import { auth } from '@/app/(auth)/auth';
import { addCredit } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

// This is a temporary endpoint for testing payment credit addition
// Remove this in production
export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new ChatSDKError(
      'forbidden:api',
      'Not available in production',
    ).toResponse();
  }

  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  try {
    const { amount } = await request.json();
    const tokens = Math.floor(amount || 1000); // Default 1000 tokens for testing

    await addCredit({
      userId: session.user.id,
      tokensDelta: tokens,
      reason: 'purchase',
    });

    return Response.json({
      success: true,
      userId: session.user.id,
      tokensAdded: tokens,
      message: 'Test credit added successfully',
    });
  } catch (error) {
    console.error('Manual credit addition error:', error);
    return new ChatSDKError(
      'bad_request:api',
      'Failed to add test credit',
    ).toResponse();
  }
}
