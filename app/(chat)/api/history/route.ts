import { authenticatedRoute } from '@/lib/auth-decorators';
import { getChatsByUserId } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import type { NextRequest } from 'next/server';

export const GET = authenticatedRoute(
  async (request: NextRequest, context, user) => {
    // Ensure user exists in our database (for OAuth users)
    if (!user.is_anonymous && user.email) {
      try {
        const { createOAuthUserIfNotExistsSimple } = await import(
          '@/lib/db/queries'
        );
        await createOAuthUserIfNotExistsSimple(user.id, user.email);
      } catch (error) {
        console.error('Failed to ensure OAuth user exists:', error);
        // Continue anyway - user might already exist
      }
    }

    const { searchParams } = request.nextUrl;

    const limit = Number.parseInt(searchParams.get('limit') || '10');
    const startingAfter = searchParams.get('starting_after');
    const endingBefore = searchParams.get('ending_before');

    if (startingAfter && endingBefore) {
      return new ChatSDKError(
        'bad_request:api',
        'Only one of starting_after or ending_before can be provided.',
      ).toResponse();
    }

    const chats = await getChatsByUserId({
      id: user.id,
      limit,
      startingAfter,
      endingBefore,
    });

    return Response.json(chats, {
      headers: {
        // 🚀 PERFORMANCE: Aggressive caching for chat history
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
        'X-Performance-Optimized': 'true',
      },
    });
  },
);
