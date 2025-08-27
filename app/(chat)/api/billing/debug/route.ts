import { auth } from '@/app/(auth)/auth';
import { creditLedger, type CreditLedger } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { ChatSDKError } from '@/lib/errors';

// Import db from queries.ts where it's defined
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  try {
    // Get all recent credit entries for this user (last 24 hours)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const credits = await db
      .select()
      .from(creditLedger)
      .where(eq(creditLedger.userId, session.user.id))
      .orderBy(desc(creditLedger.createdAt))
      .limit(10);

    // Get specific purchase credits from last 24 hours
    const recentPurchaseCredits = credits.filter(
      (credit: CreditLedger) =>
        credit.reason === 'purchase' && credit.createdAt >= since,
    );

    return Response.json({
      userId: session.user.id,
      totalCredits: credits.length,
      recentPurchaseCredits: recentPurchaseCredits.length,
      since: since.toISOString(),
      allCredits: credits.map((credit: CreditLedger) => ({
        id: credit.id,
        tokensDelta: credit.tokensDelta,
        reason: credit.reason,
        createdAt: credit.createdAt,
      })),
      recentPurchaseDetails: recentPurchaseCredits.map(
        (credit: CreditLedger) => ({
          id: credit.id,
          tokensDelta: credit.tokensDelta,
          reason: credit.reason,
          createdAt: credit.createdAt,
        }),
      ),
    });
  } catch (error) {
    console.error('Debug route error:', error);
    return new ChatSDKError(
      'bad_request:api',
      'Debug query failed',
    ).toResponse();
  }
}
