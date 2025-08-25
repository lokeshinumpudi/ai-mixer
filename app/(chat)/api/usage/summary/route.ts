import { auth } from '@/app/(auth)/auth';
import { ChatSDKError } from '@/lib/errors';
import { and, desc, eq, gte } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { subscription, usageDaily } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
const db = drizzle(client);

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const usage = await db
    .select()
    .from(usageDaily)
    .where(
      and(
        eq(usageDaily.userId, session.user.id),
        gte(usageDaily.day as unknown as any, start as unknown as any),
      ),
    )
    .orderBy(desc(usageDaily.day));

  const [sub] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.userId, session.user.id))
    .limit(1);

  const plan = sub?.plan ?? 'free';
  const quota = plan === 'pro' ? 200000 : 3000; // tokens/month example

  // Sum last 30 days tokensOut for rough usage
  const used = usage.reduce(
    (acc, u) => acc + (u.tokensOut ?? 0) + (u.tokensIn ?? 0),
    0,
  );

  return Response.json({
    plan: { name: plan === 'pro' ? 'Pro' : 'Free', quota, used },
    usage,
  });
}
