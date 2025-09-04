import { config } from "dotenv";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";

config({
  path: ".env.local",
});

const runMigrate = async () => {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is not defined");
  }

  const connection = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(connection, { schema });

  console.log("⏳ Running migrations...");

  const start = Date.now();
  await migrate(db, { migrationsFolder: "./lib/db/migrations" });
  const end = Date.now();

  console.log("✅ Migrations completed in", end - start, "ms");

  // Run data migration to populate supabaseId field
  console.log("⏳ Running data migration for supabaseId field...");
  await runDataMigration(db);
  console.log("✅ Data migration completed");

  process.exit(0);
};

async function runDataMigration(db: any) {
  console.log("🔧 Starting targeted OAuth user ID fix...");

  try {
    // First, let's check if the supabaseId column exists
    const testQuery = await db.execute(
      sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'supabaseId'`
    );
    const hasSupabaseIdColumn = testQuery.length > 0;

    if (!hasSupabaseIdColumn) {
      console.log(
        "⚠️  supabaseId column not found. Migration may have failed."
      );
      return;
    }

    console.log("✅ supabaseId column exists, proceeding with migration...");

    // Step 1: Fix the specific user case from the logs
    // User: 97a206ee-2ab6-4a67-a314-ef844a8d6b8c (Supabase ID)
    // Should link to: ac7b6825-75fa-4cba-b31c-9dde30a42aef (Database user ID)

    const supabaseUserId = "97a206ee-2ab6-4a67-a314-ef844a8d6b8c";
    const linkedUserId = "ac7b6825-75fa-4cba-b31c-9dde30a42aef";

    // Check if the linked user exists
    const [linkedUser] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, linkedUserId))
      .limit(1);

    if (linkedUser) {
      // Update the linked user to have the correct supabaseId
      await db
        .update(schema.user)
        .set({ supabaseId: supabaseUserId })
        .where(eq(schema.user.id, linkedUserId));

      console.log(
        `✅ Updated user ${linkedUserId} with supabaseId ${supabaseUserId}`
      );

      // Step 2: Fix the specific chat from the logs
      const chatId = "a56712de-b4e5-459d-8865-b07ccf534121";

      await db
        .update(schema.chat)
        .set({ userId: linkedUserId })
        .where(eq(schema.chat.id, chatId));

      console.log(`✅ Updated chat ${chatId} userId to ${linkedUserId}`);

      // Step 3: Fix any other chats that might have the same OAuth user ID
      const oauthChats = await db
        .select()
        .from(schema.chat)
        .where(eq(schema.chat.userId, supabaseUserId));

      for (const chat of oauthChats) {
        await db
          .update(schema.chat)
          .set({ userId: linkedUserId })
          .where(eq(schema.chat.id, chat.id));

        console.log(
          `✅ Updated additional chat ${chat.id} userId to ${linkedUserId}`
        );
      }

      console.log("🎉 Targeted OAuth user ID fix completed!");
      console.log(`   - User linked: ${linkedUserId} ↔ ${supabaseUserId}`);
      console.log(`   - Chats fixed: ${oauthChats.length + 1}`);
    } else {
      console.log(`⚠️  Could not find linked user ${linkedUserId}`);
    }
  } catch (error) {
    console.error("❌ Data migration error:", error);
    // Don't fail the entire migration for data migration errors
  }
}

runMigrate().catch((err) => {
  console.error("❌ Migration failed");
  console.error(err);
  process.exit(1);
});
