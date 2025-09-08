import { dbLogger } from "@/lib/logger";
import { and, eq, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { chatUsage, user, userAggregates } from "./schema";

// Database connection for backfill script
const client = postgres(process.env.POSTGRES_URL || "");
const db = drizzle(client);

/**
 * Backfill script to populate user aggregates from existing usage data
 *
 * This script:
 * 1. Finds all users who have usage data but no aggregates
 * 2. Calculates their total usage from chatUsage records
 * 3. Calculates current month/day usage
 * 4. Creates aggregate records with proper time boundaries
 */

interface UserUsageSummary {
  userId: string;
  totalTokens: number;
  totalCostCents: number;
  monthlyTokens: number;
  monthlyMessages: number;
  dailyTokens: number;
  dailyMessages: number;
}

export async function backfillUserAggregates(
  options: {
    batchSize?: number;
    dryRun?: boolean;
  } = {}
) {
  const { batchSize = 100, dryRun = false } = options;

  dbLogger.info(
    { batchSize, dryRun },
    "Starting user aggregates backfill process"
  );

  try {
    // Get current time boundaries
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    dbLogger.info(
      {
        monthStart: monthStart.toISOString(),
        dayStart: dayStart.toISOString(),
      },
      "Time boundaries calculated"
    );

    // Find users who have usage data but no aggregates
    const usersNeedingBackfill = await db
      .select({ userId: user.id })
      .from(user)
      .leftJoin(userAggregates, eq(user.id, userAggregates.userId))
      .where(sql`${userAggregates.userId} IS NULL`)
      .innerJoin(chatUsage, eq(user.id, chatUsage.userId));

    const uniqueUsers = Array.from(
      new Set(usersNeedingBackfill.map((u) => u.userId))
    );

    dbLogger.info(
      { userCount: uniqueUsers.length },
      "Found users needing backfill"
    );

    if (uniqueUsers.length === 0) {
      dbLogger.info({}, "No users need backfill - all up to date");
      return { processed: 0, errors: 0 };
    }

    let processed = 0;
    let errors = 0;

    // Process users in batches
    for (let i = 0; i < uniqueUsers.length; i += batchSize) {
      const batch = uniqueUsers.slice(i, i + batchSize);

      dbLogger.info(
        {
          batchStart: i + 1,
          batchEnd: Math.min(i + batchSize, uniqueUsers.length),
          totalUsers: uniqueUsers.length,
        },
        "Processing batch"
      );

      const batchResults = await Promise.allSettled(
        batch.map((userId) =>
          processUserAggregates(userId, monthStart, dayStart, dryRun)
        )
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          processed++;
        } else {
          errors++;
          dbLogger.error(
            { error: result.reason },
            "Failed to process user in batch"
          );
        }
      }

      // Small delay between batches to avoid overwhelming the database
      if (i + batchSize < uniqueUsers.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    dbLogger.info(
      { processed, errors, total: uniqueUsers.length },
      "Backfill process completed"
    );

    return { processed, errors };
  } catch (error) {
    dbLogger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Backfill process failed"
    );
    throw error;
  }
}

async function processUserAggregates(
  userId: string,
  monthStart: Date,
  dayStart: Date,
  dryRun: boolean
): Promise<UserUsageSummary> {
  // Calculate total usage (all time)
  const [totalUsage] = await db
    .select({
      totalTokens: sql<number>`COALESCE(SUM(${chatUsage.tokensIn} + ${chatUsage.tokensOut}), 0)`,
      totalCostCents: sql<number>`COALESCE(SUM(${chatUsage.cost}), 0)`,
      totalMessages: sql<number>`COALESCE(COUNT(*), 0)`,
    })
    .from(chatUsage)
    .where(eq(chatUsage.userId, userId));

  // Calculate monthly usage (current month)
  const [monthlyUsage] = await db
    .select({
      monthlyTokens: sql<number>`COALESCE(SUM(${chatUsage.tokensIn} + ${chatUsage.tokensOut}), 0)`,
      monthlyMessages: sql<number>`COALESCE(COUNT(*), 0)`,
    })
    .from(chatUsage)
    .where(
      and(eq(chatUsage.userId, userId), gte(chatUsage.createdAt, monthStart))
    );

  // Calculate daily usage (today)
  const [dailyUsage] = await db
    .select({
      dailyTokens: sql<number>`COALESCE(SUM(${chatUsage.tokensIn} + ${chatUsage.tokensOut}), 0)`,
      dailyMessages: sql<number>`COALESCE(COUNT(*), 0)`,
    })
    .from(chatUsage)
    .where(
      and(eq(chatUsage.userId, userId), gte(chatUsage.createdAt, dayStart))
    );

  const aggregateData: UserUsageSummary = {
    userId,
    totalTokens: Number(totalUsage.totalTokens) || 0,
    totalCostCents: Number(totalUsage.totalCostCents) || 0,
    monthlyTokens: Number(monthlyUsage.monthlyTokens) || 0,
    monthlyMessages: Number(monthlyUsage.monthlyMessages) || 0,
    dailyTokens: Number(dailyUsage.dailyTokens) || 0,
    dailyMessages: Number(dailyUsage.dailyMessages) || 0,
  };

  dbLogger.debug(
    {
      ...aggregateData,
      dryRun,
    },
    "Calculated user aggregate data"
  );

  if (!dryRun) {
    // Insert the aggregate record
    await db.insert(userAggregates).values({
      userId,
      totalTokens: aggregateData.totalTokens,
      totalCostCents: aggregateData.totalCostCents,
      monthlyTokens: aggregateData.monthlyTokens,
      monthlyMessages: aggregateData.monthlyMessages,
      dailyTokens: aggregateData.dailyTokens,
      dailyMessages: aggregateData.dailyMessages,
      monthStart: monthStart.toISOString().split("T")[0],
      dayStart: dayStart.toISOString().split("T")[0],
    });

    dbLogger.info({ ...aggregateData }, "Created user aggregate record");
  }

  return aggregateData;
}

/**
 * Verify backfill integrity by comparing aggregate totals with raw usage data
 */
export async function verifyBackfillIntegrity(userId?: string) {
  dbLogger.info(
    { userId: userId || "all" },
    "Starting backfill integrity verification"
  );

  let whereClause = undefined;
  if (userId) {
    whereClause = eq(userAggregates.userId, userId);
  }

  const aggregates = await db
    .select()
    .from(userAggregates)
    .where(whereClause)
    .limit(100); // Limit for performance

  let verified = 0;
  let discrepancies = 0;

  for (const aggregate of aggregates) {
    // Get actual totals from chatUsage
    const [actualTotals] = await db
      .select({
        actualTokens: sql<number>`COALESCE(SUM(${chatUsage.tokensIn} + ${chatUsage.tokensOut}), 0)`,
        actualCost: sql<number>`COALESCE(SUM(${chatUsage.cost}), 0)`,
      })
      .from(chatUsage)
      .where(eq(chatUsage.userId, aggregate.userId));

    const tokensMatch =
      Number(actualTotals.actualTokens) === aggregate.totalTokens;
    const costMatch =
      Number(actualTotals.actualCost) === aggregate.totalCostCents;

    if (tokensMatch && costMatch) {
      verified++;
    } else {
      discrepancies++;
      dbLogger.warn(
        {
          userId: aggregate.userId,
          aggregateTokens: aggregate.totalTokens,
          actualTokens: Number(actualTotals.actualTokens),
          aggregateCost: aggregate.totalCostCents,
          actualCost: Number(actualTotals.actualCost),
        },
        "Discrepancy found in user aggregate data"
      );
    }
  }

  dbLogger.info(
    { verified, discrepancies, total: aggregates.length },
    "Integrity verification completed"
  );

  return { verified, discrepancies, total: aggregates.length };
}

/**
 * CLI-friendly function to run backfill
 */
export async function runBackfill() {
  try {
    console.log("🚀 Starting user aggregates backfill...");

    // First run in dry-run mode to see what would be processed
    console.log("📊 Running dry-run to analyze data...");
    const dryRunResult = await backfillUserAggregates({
      dryRun: true,
      batchSize: 50,
    });
    console.log(
      `📈 Dry run complete: ${dryRunResult.processed} users would be processed`
    );

    if (dryRunResult.processed === 0) {
      console.log("✅ No users need backfill - system is up to date");
      return;
    }

    // Ask for confirmation (in a real CLI, you'd use readline)
    console.log("🔄 Running actual backfill...");
    const result = await backfillUserAggregates({ batchSize: 50 });

    console.log(
      `✅ Backfill complete: ${result.processed} users processed, ${result.errors} errors`
    );

    // Verify a sample of the results
    console.log("🔍 Verifying backfill integrity...");
    const verification = await verifyBackfillIntegrity();
    console.log(
      `✅ Verification complete: ${verification.verified} verified, ${verification.discrepancies} discrepancies`
    );
  } catch (error) {
    console.error("❌ Backfill failed:", error);
    throw error;
  }
}
