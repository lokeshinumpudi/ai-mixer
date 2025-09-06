-- Performance Optimization Migration
-- This migration adds critical indexes for chat loading performance
-- Expected improvement: 50-70% faster API response times

-- 1. Chat queries by userId (for /api/history) - MOST CRITICAL
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_user_created 
ON "Chat" ("userId", "createdAt" DESC);

-- 2. Message queries by chatId with pagination (for /api/chat/[id]/messages)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_chat_created 
ON "Message_v2" ("chatId", "createdAt" DESC);

-- 3. Compare run queries by chatId (for /api/compare)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_compare_run_chat_created 
ON "CompareRun" ("chatId", "createdAt" ASC);

-- 4. Compare result queries by runId (for loading results)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_compare_result_run_created 
ON "CompareResult" ("runId", "createdAt" ASC);

-- 5. Usage queries by userId (for /api/usage)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_usage_user_created 
ON "ChatUsage" ("userId", "createdAt" DESC);

-- 6. User settings lookup (for consolidated /api/models)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_settings_user 
ON "UserSettings" ("userId");

-- 7. JSON metadata filtering for messages (for compare message filtering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_metadata_compare 
ON "Message_v2" USING GIN (("parts"::jsonb));

-- 8. Subscription lookup for user type determination
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscription_user_status 
ON "Subscription" ("userId", "status", "currentPeriodEnd");

-- 9. Composite index for chat access control
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_visibility_user 
ON "Chat" ("visibility", "userId", "createdAt" DESC);

-- 10. Vote queries optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vote_chat_message 
ON "Vote_v2" ("chatId", "messageId");

-- Update table statistics for optimal query planning
ANALYZE "Chat";
ANALYZE "Message_v2";
ANALYZE "CompareRun";
ANALYZE "CompareResult";
ANALYZE "ChatUsage";
ANALYZE "UserSettings";
ANALYZE "Subscription";
ANALYZE "Vote_v2";
