/**
 * Data Integrity Checker for OAuth User Management
 *
 * This module provides comprehensive analysis and fixing of OAuth user identity issues,
 * ensuring data integrity and preventing the problems identified with the "simple" approach.
 */

import { eq, sql } from "drizzle-orm";
import * as schema from "./schema";

export interface IntegrityIssue {
  type:
    | "orphaned_record"
    | "inconsistent_user_id"
    | "missing_supabase_id"
    | "data_loss_risk";
  severity: "low" | "medium" | "high" | "critical";
  table: string;
  recordId: string;
  description: string;
  recommendedAction: string;
  affectedData?: any;
}

export interface IntegrityReport {
  issues: IntegrityIssue[];
  summary: {
    totalIssues: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    dataLossRisk: "none" | "low" | "medium" | "high" | "critical";
  };
  recommendations: string[];
}

export class DataIntegrityChecker {
  constructor(private db: any) {}

  /**
   * Comprehensive data integrity analysis
   */
  async analyzeIntegrity(): Promise<IntegrityReport> {
    const issues: IntegrityIssue[] = [];

    // Check 1: Orphaned records (records referencing non-existent users)
    const orphanedIssues = await this.checkOrphanedRecords();
    issues.push(...orphanedIssues);

    // Check 2: Users with OAuth IDs but missing supabaseId
    const oauthUserIssues = await this.checkOAuthUserConsistency();
    issues.push(...oauthUserIssues);

    // Check 3: Inconsistent user ID references across tables
    const consistencyIssues = await this.checkUserIdConsistency();
    issues.push(...consistencyIssues);

    // Check 4: Data loss risk assessment
    const dataLossRisk = this.assessDataLossRisk(issues);

    const summary = this.generateSummary(issues, dataLossRisk);
    const recommendations = this.generateRecommendations(issues);

    return {
      issues,
      summary,
      recommendations,
    };
  }

  /**
   * Check for orphaned records (foreign keys pointing to non-existent users)
   */
  private async checkOrphanedRecords(): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];

    // Check orphaned chats
    const orphanedChats = await this.db.execute(sql`
      SELECT c.id, c."userId", c.title
      FROM "Chat" c
      LEFT JOIN "User" u ON c."userId" = u.id
      WHERE u.id IS NULL
    `);

    for (const chat of orphanedChats) {
      issues.push({
        type: "orphaned_record",
        severity: "critical",
        table: "Chat",
        recordId: chat.id,
        description: `Chat "${chat.title}" references non-existent user ${chat.userId}`,
        recommendedAction: "Delete orphaned chat or restore missing user",
        affectedData: {
          chatId: chat.id,
          userId: chat.userId,
          title: chat.title,
        },
      });
    }

    // Check other tables for orphaned records
    const tablesToCheck = [
      { table: "Message_v2", fkColumn: "chatId", refTable: "Chat" },
      { table: "Vote_v2", fkColumn: "chatId", refTable: "Chat" },
      { table: "UserSettings", fkColumn: "userId", refTable: "User" },
      { table: "Document", fkColumn: "userId", refTable: "User" },
      { table: "Suggestion", fkColumn: "userId", refTable: "User" },
      { table: "Subscription", fkColumn: "userId", refTable: "User" },
      { table: "Payment", fkColumn: "userId", refTable: "User" },
      { table: "CreditLedger", fkColumn: "userId", refTable: "User" },
      { table: "UsageDaily", fkColumn: "userId", refTable: "User" },
      { table: "UsageMonthly", fkColumn: "userId", refTable: "User" },
      { table: "PaymentEvent", fkColumn: "userId", refTable: "User" },
      { table: "Refund", fkColumn: "userId", refTable: "User" },
      { table: "UserNotification", fkColumn: "userId", refTable: "User" },
      { table: "CompareRun", fkColumn: "userId", refTable: "User" },
    ];

    for (const { table, fkColumn, refTable } of tablesToCheck) {
      const orphanedRecords = await this.db.execute(sql`
        SELECT t.id, t."${sql.identifier(fkColumn)}"
        FROM "${sql.identifier(table)}" t
        LEFT JOIN "${sql.identifier(refTable)}" r ON t."${sql.identifier(
        fkColumn
      )}" = r.id
        WHERE r.id IS NULL
        LIMIT 10
      `);

      for (const record of orphanedRecords) {
        issues.push({
          type: "orphaned_record",
          severity: "high",
          table,
          recordId: record.id,
          description: `${table} record references non-existent ${refTable} ${record[fkColumn]}`,
          recommendedAction:
            "Fix foreign key reference or delete orphaned record",
          affectedData: record,
        });
      }
    }

    return issues;
  }

  /**
   * Check OAuth user consistency (supabaseId field)
   */
  private async checkOAuthUserConsistency(): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];

    // Find users with OAuth-style IDs but missing supabaseId
    const inconsistentUsers = await this.db
      .select()
      .from(schema.user)
      .where(
        sql`length(id) = 36 AND id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND supabaseId IS NULL`
      );

    for (const user of inconsistentUsers) {
      issues.push({
        type: "missing_supabase_id",
        severity: "medium",
        table: "User",
        recordId: user.id,
        description: `OAuth user ${user.email} has OAuth-style ID but missing supabaseId field`,
        recommendedAction: "Set supabaseId = id for OAuth users",
        affectedData: { userId: user.id, email: user.email },
      });
    }

    // Find users with supabaseId but inconsistent primary key
    const usersWithSupabaseId = await this.db
      .select()
      .from(schema.user)
      .where(sql`supabaseId IS NOT NULL`);

    for (const user of usersWithSupabaseId) {
      if (
        user.id !== user.supabaseId &&
        user.id.length === 36 &&
        user.id.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        )
      ) {
        issues.push({
          type: "inconsistent_user_id",
          severity: "high",
          table: "User",
          recordId: user.id,
          description: `User has OAuth-style primary key but different supabaseId`,
          recommendedAction:
            "Ensure primary key matches supabaseId for OAuth users",
          affectedData: {
            userId: user.id,
            supabaseId: user.supabaseId,
            email: user.email,
          },
        });
      }
    }

    return issues;
  }

  /**
   * Check for user ID consistency across related tables
   */
  private async checkUserIdConsistency(): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];

    // Check for chats created with OAuth user IDs that don't match their owner's supabaseId
    const inconsistentChats = await this.db.execute(sql`
      SELECT c.id, c."userId", u.supabaseId, u.email
      FROM "Chat" c
      JOIN "User" u ON c."userId" = u.id
      WHERE u.supabaseId IS NOT NULL
        AND c."userId" != u.supabaseId
        AND c."userId" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    `);

    for (const chat of inconsistentChats) {
      issues.push({
        type: "data_loss_risk",
        severity: "critical",
        table: "Chat",
        recordId: chat.id,
        description: `Chat owned by OAuth user but userId doesn't match supabaseId`,
        recommendedAction: "Update chat.userId to match user.supabaseId",
        affectedData: {
          chatId: chat.id,
          currentUserId: chat.userId,
          correctUserId: chat.supabaseId,
          userEmail: chat.email,
        },
      });
    }

    return issues;
  }

  /**
   * Assess overall data loss risk
   */
  private assessDataLossRisk(
    issues: IntegrityIssue[]
  ): IntegrityReport["summary"]["dataLossRisk"] {
    const criticalIssues = issues.filter(
      (i) => i.severity === "critical"
    ).length;
    const highIssues = issues.filter((i) => i.severity === "high").length;

    if (criticalIssues > 0) return "critical";
    if (highIssues > 5) return "high";
    if (highIssues > 0) return "medium";
    if (issues.length > 10) return "low";
    return "none";
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(issues: IntegrityIssue[], dataLossRisk: string) {
    const bySeverity = issues.reduce((acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byType = issues.reduce((acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalIssues: issues.length,
      bySeverity,
      byType,
      dataLossRisk: dataLossRisk as any,
    };
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(issues: IntegrityIssue[]): string[] {
    const recommendations: string[] = [];

    const criticalCount = issues.filter(
      (i) => i.severity === "critical"
    ).length;
    const orphanedCount = issues.filter(
      (i) => i.type === "orphaned_record"
    ).length;
    const consistencyCount = issues.filter(
      (i) => i.type === "inconsistent_user_id"
    ).length;

    if (criticalCount > 0) {
      recommendations.push(
        `🚨 CRITICAL: ${criticalCount} critical issues require immediate attention`
      );
      recommendations.push(
        "   - Address orphaned records that could cause application crashes"
      );
      recommendations.push(
        "   - Fix inconsistent user IDs that prevent proper authentication"
      );
    }

    if (orphanedCount > 0) {
      recommendations.push(
        `🗑️ CLEANUP: ${orphanedCount} orphaned records need removal or fixing`
      );
      recommendations.push(
        "   - Delete or reassign orphaned chats and related data"
      );
    }

    if (consistencyCount > 0) {
      recommendations.push(
        `🔗 CONSISTENCY: ${consistencyCount} user ID inconsistencies detected`
      );
      recommendations.push(
        "   - Ensure all OAuth user references use consistent IDs"
      );
      recommendations.push(
        "   - Implement proper user identity linking strategy"
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "✅ No critical issues detected - data integrity looks good!"
      );
    } else {
      recommendations.push("");
      recommendations.push("🛡️ PREVENTION MEASURES:");
      recommendations.push(
        "   - Always use the linking approach (never overwrite user IDs)"
      );
      recommendations.push(
        "   - Add comprehensive integrity checks to CI/CD pipeline"
      );
      recommendations.push("   - Implement monitoring for orphaned records");
      recommendations.push(
        "   - Use database transactions for all user identity operations"
      );
    }

    return recommendations;
  }

  /**
   * Safe OAuth user linking (the correct approach)
   */
  async safeOAuthUserLink(supabaseUserId: string, email: string) {
    console.log(`🔗 Performing SAFE OAuth user linking for ${supabaseUserId}`);

    // Step 1: Check if OAuth user already exists
    const [existingOAuthUser] = await this.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.supabaseId, supabaseUserId))
      .limit(1);

    if (existingOAuthUser) {
      console.log(`✅ OAuth user ${supabaseUserId} already exists`);
      return existingOAuthUser;
    }

    // Step 2: Check if user exists by email (anonymous/legacy user)
    const [existingByEmail] = await this.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, email))
      .limit(1);

    if (!existingByEmail) {
      // Step 3a: No existing user - create new OAuth user
      const [newUser] = await this.db
        .insert(schema.user)
        .values({
          id: supabaseUserId,
          email,
          supabaseId: supabaseUserId,
        })
        .returning();

      console.log(`✅ Created new OAuth user: ${supabaseUserId}`);
      return newUser;
    }

    // Step 3b: Existing user found - link it safely
    if (existingByEmail.supabaseId) {
      // Email already linked to different OAuth user
      console.log(`⚠️ Email ${email} already linked to different OAuth user`);
      // Create new OAuth user instead
      const [newUser] = await this.db
        .insert(schema.user)
        .values({
          id: supabaseUserId,
          email,
          supabaseId: supabaseUserId,
        })
        .returning();

      console.log(
        `✅ Created separate OAuth user due to email conflict: ${supabaseUserId}`
      );
      return newUser;
    }

    // Safe to link - update existing user
    const [updatedUser] = await this.db
      .update(schema.user)
      .set({
        supabaseId: supabaseUserId,
        // CRITICAL: Keep existing database ID to preserve ALL relationships
      })
      .where(eq(schema.user.id, existingByEmail.id))
      .returning();

    console.log(
      `✅ Safely linked anonymous user ${existingByEmail.id} to OAuth user ${supabaseUserId}`
    );
    return updatedUser;
  }

  /**
   * Fix specific OAuth user access issue (like the one reported)
   */
  async fixOAuthUserAccess(supabaseUserId: string, databaseUserId: string) {
    console.log(
      `🔧 Fixing OAuth user access: ${supabaseUserId} ↔ ${databaseUserId}`
    );

    // Step 1: Verify database user exists
    const [dbUser] = await this.db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, databaseUserId))
      .limit(1);

    if (!dbUser) {
      throw new Error(`Database user ${databaseUserId} not found`);
    }

    // Step 2: Link the OAuth user safely
    const [updatedUser] = await this.db
      .update(schema.user)
      .set({
        supabaseId: supabaseUserId,
        // Keep existing ID to preserve relationships
      })
      .where(eq(schema.user.id, databaseUserId))
      .returning();

    // Step 3: Fix any chats that might have OAuth user ID
    const problemChats = await this.db
      .select()
      .from(schema.chat)
      .where(eq(schema.chat.userId, supabaseUserId));

    console.log(`📊 Found ${problemChats.length} chats to fix`);

    for (const chat of problemChats) {
      await this.db
        .update(schema.chat)
        .set({ userId: databaseUserId })
        .where(eq(schema.chat.id, chat.id));

      console.log(`✅ Fixed chat ${chat.id} ownership`);
    }

    console.log(
      `🎉 Successfully fixed OAuth user access - ${problemChats.length} chats corrected`
    );
    return { updatedUser, fixedChats: problemChats.length };
  }
}

// Export utility functions
export async function analyzeDataIntegrity(db: any): Promise<IntegrityReport> {
  const checker = new DataIntegrityChecker(db);
  return await checker.analyzeIntegrity();
}

export async function safeOAuthUserLink(
  db: any,
  supabaseUserId: string,
  email: string
) {
  const checker = new DataIntegrityChecker(db);
  return await checker.safeOAuthUserLink(supabaseUserId, email);
}

export async function fixOAuthUserAccess(
  db: any,
  supabaseUserId: string,
  databaseUserId: string
) {
  const checker = new DataIntegrityChecker(db);
  return await checker.fixOAuthUserAccess(supabaseUserId, databaseUserId);
}
