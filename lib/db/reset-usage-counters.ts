import { dbLogger } from "@/lib/logger";
import { eq, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { userAggregates } from "./schema";

// Database connection for reset script
const client = postgres(process.env.POSTGRES_URL || "");
const db = drizzle(client);

/**
 * Reset usage counters for users based on time boundaries
 *
 * This function:
 * 1. Identifies users whose monthly/daily counters need reset
 * 2. Resets counters while preserving total usage
 * 3. Updates time boundaries to current period
 */

export interface ResetResult {
  monthlyResets: number;
  dailyResets: number;
  errors: number;
}

export async function resetUsageCounters(
  options: {
    dryRun?: boolean;
    batchSize?: number;
  } = {}
): Promise<ResetResult> {
  const { dryRun = false, batchSize = 100 } = options;

  dbLogger.info({ dryRun, batchSize }, "Starting usage counter reset process");

  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const currentMonthStr = currentMonth.toISOString().split("T")[0];
  const currentDayStr = currentDay.toISOString().split("T")[0];

  dbLogger.info(
    {
      currentMonth: currentMonthStr,
      currentDay: currentDayStr,
    },
    "Current time boundaries calculated"
  );

  let monthlyResets = 0;
  let dailyResets = 0;
  let errors = 0;

  try {
    // Find users needing monthly reset
    const usersNeedingMonthlyReset = await db
      .select({ userId: userAggregates.userId })
      .from(userAggregates)
      .where(lt(userAggregates.monthStart, currentMonthStr));

    dbLogger.info(
      { count: usersNeedingMonthlyReset.length },
      "Users needing monthly reset found"
    );

    // Process monthly resets in batches
    for (let i = 0; i < usersNeedingMonthlyReset.length; i += batchSize) {
      const batch = usersNeedingMonthlyReset.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(({ userId }) =>
          resetMonthlyCounters(userId, currentMonthStr, dryRun)
        )
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          monthlyResets++;
        } else {
          errors++;
          dbLogger.error(
            { error: result.reason },
            "Failed to reset monthly counters for user"
          );
        }
      }

      // Small delay between batches
      if (i + batchSize < usersNeedingMonthlyReset.length) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    // Find users needing daily reset
    const usersNeedingDailyReset = await db
      .select({ userId: userAggregates.userId })
      .from(userAggregates)
      .where(lt(userAggregates.dayStart, currentDayStr));

    dbLogger.info(
      { count: usersNeedingDailyReset.length },
      "Users needing daily reset found"
    );

    // Process daily resets in batches
    for (let i = 0; i < usersNeedingDailyReset.length; i += batchSize) {
      const batch = usersNeedingDailyReset.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(({ userId }) =>
          resetDailyCounters(userId, currentDayStr, dryRun)
        )
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          dailyResets++;
        } else {
          errors++;
          dbLogger.error(
            { error: result.reason },
            "Failed to reset daily counters for user"
          );
        }
      }

      // Small delay between batches
      if (i + batchSize < usersNeedingDailyReset.length) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    const result = { monthlyResets, dailyResets, errors };

    dbLogger.info(result, "Usage counter reset process completed");

    return result;
  } catch (error) {
    dbLogger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Usage counter reset process failed"
    );
    throw error;
  }
}

async function resetMonthlyCounters(
  userId: string,
  currentMonthStr: string,
  dryRun: boolean
): Promise<void> {
  if (dryRun) {
    dbLogger.debug(
      { userId, currentMonthStr },
      "DRY RUN: Would reset monthly counters"
    );
    return;
  }

  await db
    .update(userAggregates)
    .set({
      monthlyTokens: 0,
      monthlyMessages: 0,
      monthStart: currentMonthStr,
      updatedAt: new Date(),
    })
    .where(eq(userAggregates.userId, userId));

  dbLogger.debug(
    { userId, currentMonthStr },
    "Reset monthly counters for user"
  );
}

async function resetDailyCounters(
  userId: string,
  currentDayStr: string,
  dryRun: boolean
): Promise<void> {
  if (dryRun) {
    dbLogger.debug(
      { userId, currentDayStr },
      "DRY RUN: Would reset daily counters"
    );
    return;
  }

  await db
    .update(userAggregates)
    .set({
      dailyTokens: 0,
      dailyMessages: 0,
      dayStart: currentDayStr,
      updatedAt: new Date(),
    })
    .where(eq(userAggregates.userId, userId));

  dbLogger.debug({ userId, currentDayStr }, "Reset daily counters for user");
}

/**
 * Check which users need resets without actually performing them
 */
export async function checkResetStatus() {
  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const currentMonthStr = currentMonth.toISOString().split("T")[0];
  const currentDayStr = currentDay.toISOString().split("T")[0];

  const [monthlyCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(userAggregates)
    .where(lt(userAggregates.monthStart, currentMonthStr));

  const [dailyCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(userAggregates)
    .where(lt(userAggregates.dayStart, currentDayStr));

  return {
    usersNeedingMonthlyReset: Number(monthlyCount.count),
    usersNeedingDailyReset: Number(dailyCount.count),
    currentMonth: currentMonthStr,
    currentDay: currentDayStr,
  };
}

/**
 * CLI-friendly function to run resets
 */
export async function runResets() {
  try {
    console.log("🔄 Starting usage counter reset...");

    // First check what needs to be reset
    console.log("📊 Checking reset status...");
    const status = await checkResetStatus();
    console.log(
      `📈 Status: ${status.usersNeedingMonthlyReset} monthly, ${status.usersNeedingDailyReset} daily resets needed`
    );

    if (
      status.usersNeedingMonthlyReset === 0 &&
      status.usersNeedingDailyReset === 0
    ) {
      console.log("✅ No resets needed - all counters are up to date");
      return;
    }

    // Run dry-run first
    console.log("🧪 Running dry-run...");
    const dryRunResult = await resetUsageCounters({
      dryRun: true,
      batchSize: 50,
    });
    console.log(
      `📋 Dry run complete: ${dryRunResult.monthlyResets} monthly, ${dryRunResult.dailyResets} daily resets would be performed`
    );

    // Run actual resets
    console.log("🔄 Running actual resets...");
    const result = await resetUsageCounters({ batchSize: 50 });

    console.log(
      `✅ Reset complete: ${result.monthlyResets} monthly, ${result.dailyResets} daily resets performed, ${result.errors} errors`
    );
  } catch (error) {
    console.error("❌ Reset failed:", error);
    throw error;
  }
}
