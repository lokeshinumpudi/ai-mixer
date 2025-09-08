/**
 * Database Reset Script
 *
 * This script completely resets the database to a clean state.
 * WARNING: This will DELETE ALL DATA permanently!
 *
 * Run with: pnpm tsx lib/db/reset-database.ts
 */

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from './schema';

config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Create connection
const client = postgres(connectionString, { prepare: false });
const db = drizzle(client, { schema });

// Tables in dependency order (children first, then parents)
const tables = [
  'Refund',
  'PaymentEvent',
  'Payment',
  'CreditLedger',
  'UsageMonthly',
  'UsageDaily',
  'ServiceDowntime',
  'UserNotification',
  'CompareResult',
  'CompareRun',
  'Vote_v2',
  'Vote',
  'Message_v2',
  'Message',
  'Stream',
  'Suggestion',
  'Document',
  'Chat',
  'UserSettings',
  'Subscription',
  'User',
];

async function resetDatabase() {
  console.log('🚨 WARNING: This will DELETE ALL DATA!');
  console.log('⏳ Starting database reset...');

  try {
    // Drop all tables in reverse dependency order
    console.log('📝 Dropping existing tables...');
    for (const tableName of tables) {
      try {
        await client`DROP TABLE IF EXISTS ${client(tableName)} CASCADE`;
        console.log(`✅ Dropped table: ${tableName}`);
      } catch (error) {
        console.log(`⚠️  Could not drop ${tableName}:`, error);
      }
    }

    // Drop the migrations table too
    try {
      await client`DROP TABLE IF EXISTS "__drizzle_migrations" CASCADE`;
      console.log('✅ Dropped migrations table');
    } catch (error) {
      console.log('⚠️  Could not drop migrations table:', error);
    }

    // Drop the drizzle schema
    try {
      await client`DROP SCHEMA IF EXISTS drizzle CASCADE`;
      console.log('✅ Dropped drizzle schema');
    } catch (error) {
      console.log('⚠️  Could not drop drizzle schema:', error);
    }

    // Recreate the drizzle schema
    try {
      await client`CREATE SCHEMA drizzle`;
      console.log('✅ Created drizzle schema');
    } catch (error) {
      console.log('⚠️  Could not create drizzle schema:', error);
    }

    // Run migrations to recreate all tables
    console.log('🔄 Running migrations to recreate tables...');
    await migrate(db, { migrationsFolder: 'lib/db/migrations' });

    console.log('🎉 Database reset complete!');
    console.log('📊 All tables have been recreated with fresh schema');
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  resetDatabase()
    .then(() => {
      console.log('✅ Database reset completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database reset failed:', error);
      process.exit(1);
    });
}

export { resetDatabase };
