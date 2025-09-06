# 🚀 **Complete Usage Tracking System Implementation Plan**

## 📋 **Overview - Hybrid Security + Cost Optimization**

Complete token usage tracking with **zero data loss**, **server-side security validation**, and **cost-optimized client computation**. Uses actual AI SDK and Vercel Gateway pricing data (no approximations) with existing entitlements system for consistency.

---

## 🎯 **Architecture Benefits & Trade-offs**

### **✅ Benefits of Client-Side Computation**

- **Ultra-simple database**: Single table, no triggers, no pre-computation
- **Maximum flexibility**: Client can compute any metrics/summaries needed
- **Zero storage overhead**: No duplicate summary data
- **Easy maintenance**: No trigger logic to maintain
- **Cost effective**: Eliminates all trigger execution costs
- **Real-time updates**: Fresh data on every page load

### **⚖️ Trade-offs**

- **Client-side processing**: JavaScript computation for summaries
- **Larger payloads**: Raw data sent to client (pagination helps)
- **Initial load time**: First computation may take ~50-100ms
- **Memory usage**: Client holds usage data in memory
- **Scalability limit**: May not work for 100k+ usage records per user

### **💡 Why This Approach Wins for Most Use Cases**

- **99% of users**: Have < 10k usage records (fast client computation)
- **Simplicity**: No database triggers, functions, or maintenance
- **Flexibility**: Easy to add new metrics/computations
- **Cost savings**: Eliminates trigger execution costs entirely
- **Development speed**: Much simpler to implement and maintain

---

## 🗂️ **Phase 1: Database Foundation & Migration**

### **1.1 Ultra-Minimal Schema Design**

```sql
-- Single ChatUsage table - zero overhead
CREATE TABLE "ChatUsage" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatId UUID REFERENCES "Chat"(id),  -- NULL = deleted, NOT NULL = active
  userId UUID NOT NULL REFERENCES "user"(id),
  modelId VARCHAR(64) NOT NULL,
  tokensIn INTEGER NOT NULL DEFAULT 0,
  tokensOut INTEGER NOT NULL DEFAULT 0,
  cost DECIMAL(10,6) NOT NULL DEFAULT 0,
  createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Single index for cost-conscious queries
CREATE INDEX idx_chatusage_user ON "ChatUsage"(userId);
```

### **1.2 Migration Strategy**

```bash
# Generate migration
pnpm db:generate

# Apply migration
pnpm db:migrate

# No data backfill needed - client computes summaries on-demand
```

### **1.3 Cost-Optimized Queries**

```typescript
// Ultra-minimal queries with single index utilization
import { getUserLimits } from "@/lib/ai/entitlements";

export async function getUserUsageData(userId: string, limit: number = 25) {
  return await db
    .select()
    .from(chatUsage)
    .where(eq(chatUsage.userId, userId))
    .orderBy(desc(chatUsage.createdAt))
    .limit(limit); // Cost-conscious default
}
```

```typescript
// Simplified paginated query with cost-conscious defaults
export async function getUserUsageData(
  userId: string,
  page: number = 1,
  limit: number = 25
) {
  const offset = (page - 1) * limit;

  const [usageData, totalCount] = await Promise.all([
    db
      .select()
      .from(chatUsage)
      .where(eq(chatUsage.userId, userId))
      .orderBy(desc(chatUsage.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(chatUsage)
      .where(eq(chatUsage.userId, userId)),
  ]);

  return {
    items: usageData,
    total: totalCount[0].count,
    page,
    limit,
    hasMore: offset + limit < totalCount[0].count,
  };
}

// 🚨 CRITICAL: Server-side validation functions for security
export async function getCurrentUserUsage(userId: string) {
  // Server-computed for security - cannot trust client data
  const [result] = await db
    .select({
      totalTokens: sql<number>`SUM(${chatUsage.tokensIn} + ${chatUsage.tokensOut})`,
      totalCost: sql<number>`SUM(${chatUsage.cost})`,
      totalChats: sql<number>`COUNT(DISTINCT ${chatUsage.chatId})`,
      activeChats: sql<number>`COUNT(DISTINCT CASE WHEN ${chatUsage.chatId} IS NOT NULL THEN ${chatUsage.chatId} END)`,
    })
    .from(chatUsage)
    .where(eq(chatUsage.userId, userId));

  return (
    result || { totalTokens: 0, totalCost: 0, totalChats: 0, activeChats: 0 }
  );
}

export function getUserLimits(userType: string) {
  // Use existing entitlements system for consistency
  return getUserLimits(userType);
}

export function generateUsageWarnings(currentUsage: any, limits: any) {
  const warnings = [];

  if (currentUsage.totalTokens > limits.maxTokens * limits.warningThreshold) {
    warnings.push({
      type: "tokens",
      message: `You've used ${Math.round(
        (currentUsage.totalTokens / limits.maxTokens) * 100
      )}% of your token limit`,
      severity: "warning",
    });
  }

  if (currentUsage.totalCost > limits.maxCost * limits.warningThreshold) {
    warnings.push({
      type: "cost",
      message: `You've used $${currentUsage.totalCost.toFixed(2)} of your $${
        limits.maxCost
      } limit`,
      severity: "warning",
    });
  }

  return warnings;
}
```

---

## 🔧 **Phase 2: Batch Usage Tracking Implementation**

### **2.1 Rate-Limited Batch Processing with Validation**

```typescript
// app/(chat)/api/compare/stream/route.ts - Rate-limited with validation
export const POST = protectedRoute(async (req, context, user) => {
  const { prompt, modelIds } = await req.json();

  // 🚨 CRITICAL: Use actual AI SDK usage data (no approximations!)
  const currentUsage = await getCurrentUserUsage(user.id);
  const limits = getUserLimits(user.userType);

  // Don't estimate costs - AI SDK and Vercel Gateway provide accurate usage data
  // We'll validate against limits during/after processing with real data from:
  // - event.usage.promptTokens (actual input tokens)
  // - event.usage.completionTokens (actual output tokens)
  // - calculateCost() using gateway pricing data

  // Proceed with processing...
  const usageBatch: UsageRecord[] = [];

  // ... processing logic ...

  // Single batch insert after all models complete
  after(async (event) => {
    if (event.type === "run_end" && usageBatch.length > 0) {
      await batchInsertChatUsage(usageBatch);
    }
  });

  return streamResponse;
});

// 🚨 Real-time validation using ACTUAL AI SDK data
after(async (event) => {
  if (event.type === "model_end" && event.usage) {
    // Use precise data from AI SDK (no approximations!)
    const inputTokens = event.usage.promptTokens || 0; // Actual input tokens
    const outputTokens = event.usage.completionTokens || 0; // Actual output tokens
    const actualCost = calculateCost(event.modelId, event.usage); // Gateway pricing

    // Check against limits using real data
    if (
      currentUsage.totalTokens + inputTokens + outputTokens >
      limits.maxTokens
    ) {
      return Response.json(
        {
          error: "Token limit exceeded during processing",
          message: `This response would exceed your ${limits.maxTokens} token limit.`,
          actualUsage: inputTokens + outputTokens,
          limit: limits.maxTokens,
          remaining: limits.maxTokens - currentUsage.totalTokens,
        },
        { status: 429 }
      );
    }

    usageBatch.push({
      userId: user.id,
      chatId: runId,
      modelId: event.modelId,
      tokensIn: inputTokens, // Actual AI SDK data
      tokensOut: outputTokens, // Actual AI SDK data
      cost: actualCost, // Actual gateway pricing
    });
  }
});
```

### **2.2 Cost Calculation Using Gateway Pricing**

```typescript
// lib/utils.ts
export function calculateCost(modelId: string, usage: any): number {
  // Use Vercel Gateway pricing data (no approximations!)
  const gatewayModel = getGatewayModel(modelId);
  if (!gatewayModel?.pricing) return 0;

  const inputCost =
    (usage.promptTokens || 0) * parseFloat(gatewayModel.pricing.input);
  const outputCost =
    (usage.completionTokens || 0) * parseFloat(gatewayModel.pricing.output);

  // Return precise cost from gateway pricing
  return Number((inputCost + outputCost).toFixed(6));
}
```

---

## 🌐 **Phase 3: API Layer Implementation**

### **3.1 Hybrid API Layer (Client Display + Server Validation)**

```typescript
// app/(chat)/api/usage/route.ts - Raw data for client + server validation context
export const GET = protectedRoute(async (req, context, user) => {
  const { type = "data", page = 1, limit = 25, chatId } = req.query;

  // 🚨 CRITICAL: Server-side usage validation for limits/warnings
  const currentUsage = await getCurrentUserUsage(user.id); // Server-computed
  const limits = getUserLimits(user.userType);

  if (type === "chat" && chatId) {
    const usage = await getChatUsage(chatId, user.id);
    return Response.json({
      ...usage,
      limits,
      currentUsage,
      warnings: generateUsageWarnings(currentUsage, limits),
    });
  }

  // Default: Raw data for client computation + server validation context
  const usageData = await getUserUsageData(
    user.id,
    Number(page),
    Number(limit)
  );
  return Response.json({
    ...usageData,
    limits, // Server validation
    currentUsage, // Server-computed for accuracy
    warnings: generateUsageWarnings(currentUsage, limits),
  });
});

// app/(chat)/api/usage/validate/route.ts - Pre-flight validation
export const POST = protectedRoute(async (req, context, user) => {
  const { requestedTokens } = await req.json();

  const currentUsage = await getCurrentUserUsage(user.id);
  const limits = getUserLimits(user.userType);

  const canProceed =
    currentUsage.totalTokens + requestedTokens <= limits.maxTokens;

  return Response.json({
    canProceed,
    currentUsage,
    projectedUsage: currentUsage.totalTokens + requestedTokens,
    warnings: generateUsageWarnings(currentUsage, limits),
  });
});
```

**Usage:**

```bash
# Get user usage data (default)
GET /api/usage?page=1&limit=25

# Get specific chat usage
GET /api/usage?type=chat&chatId=123
```

### **3.2 Admin Features - Post-MVP**

**Admin analytics deferred to focus on core user experience first:**

- Global usage dashboard
- User management tables
- Advanced filtering/reporting

_Will be added only if business requirements demand them._

---

## 🎨 **Phase 4: Frontend Implementation**

### **4.1 Usage Dashboard Component (Client-Side Computation)**

```typescript
// components/usage/usage-dashboard.tsx
export function UsageDashboard() {
  const { data: usageData } = useSWR("/api/usage?page=1&limit=25");

  // 🚨 CRITICAL: Use server-validated data for limits/warnings
  const { limits, currentUsage, warnings } = usageData || {};

  // Client-side computation for detailed breakdowns (non-critical)
  const summary = useMemo(() => {
    if (!usageData?.items) return null;

    const items = usageData.items;

    // Client computes detailed breakdowns (can be approximate)
    const modelBreakdown = items.reduce((acc, usage) => {
      const modelId = usage.modelId;
      if (!acc[modelId]) acc[modelId] = { modelId, tokens: 0, cost: 0 };
      acc[modelId].tokens += usage.tokensIn + usage.tokensOut;
      acc[modelId].cost += Number(usage.cost);
      return acc;
    }, {});

    return {
      modelBreakdown: Object.values(modelBreakdown),
      // Use server-computed values for critical data
      totalTokens: currentUsage?.totalTokens || 0,
      totalCost: currentUsage?.totalCost || 0,
      totalChats: currentUsage?.totalChats || 0,
      activeChats: currentUsage?.activeChats || 0,
    };
  }, [usageData?.items, currentUsage]);

  // 🚨 Show server-generated warnings to users
  useEffect(() => {
    warnings?.forEach((warning) => {
      if (warning.severity === "warning") {
        toast({
          title: "Usage Warning",
          description: warning.message,
          variant: "destructive",
        });
      }
    });
  }, [warnings]);

  return (
    <div className="space-y-6">
      {/* Lifetime Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.totalTokens?.toLocaleString()}
            </div>
            <p className="text-muted-foreground">Total Tokens</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-2xl font-bold">
              ${summary?.totalCost?.toFixed(4)}
            </div>
            <p className="text-muted-foreground">Total Cost</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalChats}</div>
            <p className="text-muted-foreground">Total Chats</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.activeChats}</div>
            <p className="text-muted-foreground">Active Chats</p>
          </CardContent>
        </Card>
      </div>

      {/* Model Breakdown Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Usage by Model</CardTitle>
        </CardHeader>
        <CardContent>
          <ModelUsageChart data={summary?.modelBreakdown} />
        </CardContent>
      </Card>
    </div>
  );
}
```

### **4.2 Paginated Usage Table**

```typescript
// components/usage/usage-table.tsx
export function UsageTable() {
  const { data, size, setSize } = useSWRInfinite(
    (pageIndex) => `/api/usage/history?page=${pageIndex + 1}`
  );

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Chat</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Tokens</TableHead>
            <TableHead>Cost</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data
            ?.flatMap((page) => page.items)
            .map((usage) => (
              <TableRow key={usage.id}>
                <TableCell>
                  {usage.chatId ? (
                    <Link href={`/chat/${usage.chatId}`}>View Chat</Link>
                  ) : (
                    <span className="text-muted-foreground">Deleted Chat</span>
                  )}
                </TableCell>
                <TableCell>{usage.modelId}</TableCell>
                <TableCell>{usage.tokensIn + usage.tokensOut}</TableCell>
                <TableCell>${usage.cost.toFixed(4)}</TableCell>
                <TableCell>
                  <Badge variant={usage.chatId ? "default" : "secondary"}>
                    {usage.chatId ? "Active" : "Deleted"}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(usage.createdAt)}</TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>

      {data?.[0]?.hasMore && (
        <Button onClick={() => setSize(size + 1)} disabled={isLoading}>
          Load More
        </Button>
      )}
    </div>
  );
}
```

### **4.3 Settings Page Integration**

```typescript
// app/(chat)/settings/page.tsx
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");

  return (
    <div className="container mx-auto py-8">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="usage">Usage & Billing</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>

        <TabsContent value="usage">
          <UsageDashboard />
          <UsageTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## 📊 **Phase 5: Admin Dashboard**

### **5.1 Global Usage Analytics**

```typescript
// components/admin/global-usage.tsx
export function GlobalUsageDashboard() {
  const { data: globalStats } = useSWR("/api/admin/usage/global");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent>
            <div className="text-3xl font-bold">
              {globalStats?.totalUsers?.toLocaleString()}
            </div>
            <p className="text-muted-foreground">Active Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-3xl font-bold">
              {globalStats?.totalTokens?.toLocaleString()}
            </div>
            <p className="text-muted-foreground">Tokens Used</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-3xl font-bold">
              ${globalStats?.totalRevenue?.toFixed(2)}
            </div>
            <p className="text-muted-foreground">Revenue</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Models by Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <ModelUsageChart data={globalStats?.modelUsage} />
        </CardContent>
      </Card>
    </div>
  );
}
```

### **5.2 User Management Table**

```typescript
// components/admin/users-usage-table.tsx
export function UsersUsageTable() {
  const { data, size, setSize } = useSWRInfinite(
    (pageIndex) => `/api/admin/usage/users?page=${pageIndex + 1}`
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Total Tokens</TableHead>
          <TableHead>Total Cost</TableHead>
          <TableHead>Chats</TableHead>
          <TableHead>Last Activity</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data
          ?.flatMap((page) => page.users)
          .map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.totalTokens?.toLocaleString()}</TableCell>
              <TableCell>${user.totalCost?.toFixed(4)}</TableCell>
              <TableCell>{user.totalChats}</TableCell>
              <TableCell>{formatDate(user.lastActivity)}</TableCell>
            </TableRow>
          ))}
      </TableBody>
    </Table>
  );
}
```

---

## 🚀 **Phase 6: Performance Optimizations**

### **6.1 Database Optimizations**

```sql
-- Composite indexes for common queries
CREATE INDEX idx_chatusage_user_model ON "ChatUsage"(userId, modelId);
CREATE INDEX idx_chatusage_user_date ON "ChatUsage"(userId, createdAt DESC);
CREATE INDEX idx_chatusage_chat_model ON "ChatUsage"(chatId, modelId);

-- Partial indexes for active chats
CREATE INDEX idx_chatusage_active ON "ChatUsage"(userId, createdAt DESC)
WHERE "chatId" IS NOT NULL;
```

### **6.2 Query Optimizations (Pre-computed)**

```typescript
// Lightning-fast queries with pre-computed data
export async function getOptimizedUserSummary(userId: string) {
  // Single primary key lookup - O(1)
  const [summary] = await db
    .select()
    .from(userUsageSummary)
    .where(eq(userUsageSummary.userId, userId))
    .limit(1);

  // Simple index scan for model breakdown
  const modelBreakdown = await db
    .select()
    .from(userModelUsage)
    .where(eq(userModelUsage.userId, userId));

  return {
    ...summary,
    modelBreakdown,
  };
}

// Additional optimized queries
export async function getUserUsageByDateRange(
  userId: string,
  startDate: Date,
  endDate: Date
) {
  return await db
    .select()
    .from(chatUsage)
    .where(
      and(
        eq(chatUsage.userId, userId),
        gte(chatUsage.createdAt, startDate),
        lte(chatUsage.createdAt, endDate)
      )
    );
}
```

### **6.3 Caching Strategy**

```typescript
// SWR configuration for usage data
const { data: usage } = useSWR("/api/usage/summary", fetcher, {
  revalidateOnFocus: false,
  dedupingInterval: 30000, // 30 seconds
  refreshInterval: 60000, // 1 minute for usage data
});
```

---

## 🔒 **Phase 7: Security & Compliance**

### **7.1 API Security**

```typescript
// Rate limiting for usage endpoints
import rateLimit from "@/lib/rate-limit";

const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
});

export const GET = protectedRoute(async (req, context, user) => {
  await limiter.check(req, 10); // 10 requests per minute

  const summary = await getUserUsageSummary(user.id);
  return Response.json(summary);
});
```

### **7.2 Data Privacy**

```typescript
// PII masking for admin endpoints
export function maskUserData(user: any) {
  return {
    ...user,
    email: maskEmail(user.email),
    // Exclude sensitive fields
  };
}

// Audit logging for usage access
export async function logUsageAccess(userId: string, action: string) {
  await db.insert(auditLog).values({
    userId,
    action,
    resource: "usage",
    timestamp: new Date(),
  });
}
```

---

## 🧪 **Phase 8: Testing & Quality Assurance**

### **8.1 Unit Tests**

```typescript
// tests/db/queries.test.ts
describe("Usage Queries", () => {
  it("should calculate user usage summary correctly", async () => {
    const userId = "test-user-id";
    const summary = await getUserUsageSummary(userId);

    expect(summary).toHaveProperty("totalTokens");
    expect(summary).toHaveProperty("totalCost");
    expect(summary).toHaveProperty("modelBreakdown");
  });

  it("should handle deleted chats in summary", async () => {
    // Test with nullable chatId
  });
});
```

### **8.2 Integration Tests**

```typescript
// tests/api/usage.test.ts
describe("Usage API", () => {
  it("should return paginated usage history", async () => {
    const response = await app.request("/api/usage/history?page=1&limit=10");
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.items).toHaveLength(10);
    expect(data.hasMore).toBeDefined();
  });
});
```

### **8.3 Performance Tests**

```typescript
// tests/performance/usage.test.ts
describe("Usage Performance", () => {
  it("should handle 1000 users efficiently", async () => {
    const start = Date.now();

    // Simulate 1000 concurrent requests
    const promises = Array.from({ length: 1000 }, () =>
      getUserUsageSummary("test-user-id")
    );

    await Promise.all(promises);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(5000); // Under 5 seconds
  });
});
```

---

## 📈 **Phase 9: Monitoring & Analytics**

### **9.1 Usage Metrics**

```typescript
// lib/metrics.ts
export const usageMetrics = {
  totalTokens: new Counter({
    name: "usage_tokens_total",
    help: "Total tokens used",
    labelNames: ["model", "user_type"],
  }),

  totalCost: new Counter({
    name: "usage_cost_total",
    help: "Total cost incurred",
    labelNames: ["model", "user_type"],
  }),

  activeUsers: new Gauge({
    name: "usage_active_users",
    help: "Number of active users",
  }),
};
```

### **9.2 Error Tracking**

```typescript
// lib/error-tracking.ts
export function trackUsageError(error: Error, context: any) {
  // Send to error tracking service
  Sentry.captureException(error, {
    tags: {
      component: "usage-tracking",
      operation: context.operation,
    },
    extra: context,
  });
}
```

---

## 🚀 **Phase 10: Deployment & Rollout**

### **10.1 Migration Checklist**

- [ ] Database schema migration applied
- [ ] Indexes created for performance
- [ ] API endpoints deployed
- [ ] Frontend components deployed
- [ ] Admin dashboard deployed
- [ ] Rate limiting configured
- [ ] Monitoring alerts set up

### **10.2 Rollout Strategy**

```bash
# Gradual rollout with feature flags
export ROLLBACK_USAGE_TRACKING=true  # For emergency rollback

# A/B testing for new features
export USAGE_TRACKING_ENABLED=true
export USAGE_TRACKING_PERCENTAGE=10  # Start with 10% of users
```

### **10.3 Success Metrics**

- Database query performance < 50ms (single index)
- API response time < 100ms (25 records, single endpoint)
- Frontend load time < 400ms (optimized client computation)
- Client computation < 30ms for summaries
- 99.9% uptime for usage endpoints
- Accurate cost calculation (within 0.01%)
- Zero data loss on chat deletion
- **Ultra-minimal overhead: 1 index, 1 table, 1 endpoint**

---

## 🎯 **Success Criteria**

### **Functional Requirements**

- ✅ **Zero Data Loss**: Deleted chats preserve usage data
- ✅ **Accurate Tracking**: Uses actual AI SDK token counts (no approximations)
- ✅ **Cost Calculation**: Uses actual Vercel Gateway pricing data (no estimates)
- ✅ **Multi-Model Support**: Efficient batch processing for comparisons
- ✅ **Pagination**: Efficient pagination with 25 records default
- ✅ **User-Focused**: Clean dashboard for individual users (admin features deferred)
- ✅ **Server Validation**: Rate limits enforced server-side for security
- ✅ **Real-time Warnings**: Users notified when approaching limits
- ✅ **Hybrid Architecture**: Client display + server security validation
- ✅ **Existing Entitlements**: Leverages current entitlements system for consistency

### **Performance Requirements**

- ✅ **Query Performance**: < 50ms (single index, minimal data)
- ✅ **Batch Efficiency**: Single DB call for multi-model comparisons
- ✅ **Client Computation**: < 30ms for simplified calculations
- ✅ **Server Validation**: < 20ms for limit checks using actual AI SDK data
- ✅ **Scalability**: Handles 1000+ users with < 10k records each
- ✅ **Storage Efficiency**: 1 index, 1 table (ultra-minimal)
- ✅ **API Efficiency**: Single endpoint, 25 records default
- ✅ **Rate Limiting**: Real-time enforcement using actual gateway pricing

### **Security Requirements**

- ✅ **Data Privacy**: PII masking and audit logging
- ✅ **Rate Limiting**: Server-side enforcement (cannot be bypassed)
- ✅ **Access Control**: Proper authentication and authorization
- ✅ **Server Validation**: Critical limits checked server-side only
- ✅ **Pre-flight Checks**: Usage validated before expensive AI processing
- ✅ **Real-time Enforcement**: Limits enforced during streaming responses

---

## 📋 **Implementation Timeline**

### **Week 1: Ultra-Minimal MVP**

- Single table schema + 1 index
- Single API endpoint with pagination
- Basic dashboard with client-side computation
- Batch usage tracking for multi-model chats

### **Week 2: Polish & Launch**

- UI/UX refinements
- Performance testing
- Error handling
- Production deployment

### **Future: Admin Features (If Needed)**

- Global analytics dashboard
- User management tables
- Advanced reporting
- _Only if business requirements demand them_

---

## 🔧 **Maintenance & Support**

### **Regular Tasks**

- Monitor query performance
- Update model pricing from gateway
- Clean up old usage data (if needed)
- Review and optimize indexes

### **Support Queries**

- Usage data discrepancies
- Performance issues
- Cost calculation questions
- Feature enhancement requests

---

_This implementation provides enterprise-grade usage tracking with zero data loss, optimized performance, and comprehensive analytics capabilities._
