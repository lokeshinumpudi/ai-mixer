# Route Authentication System

A centralized, scalable system for managing API route authentication requirements.

## 🏗️ Architecture Overview

The authentication system consists of three main components:

1. **Route Configuration** (`lib/route-config.ts`) - Centralized route access control
2. **Middleware** (`middleware.ts`) - Enforces access control at the edge
3. **Auth Decorators** (`lib/auth-decorators.ts`) - Type-safe route handlers

## 🚦 Route Access Levels

### 1. Public Routes

- **No authentication required**
- Accessible by anyone, including external services
- Examples: webhooks, health checks, public APIs

### 2. Protected Routes

- **Authentication required**
- Must have valid session token
- Examples: user data, chat functionality, file uploads

### 3. Conditional Routes

- **Custom authentication logic**
- Route handles its own auth requirements
- Examples: guest access with limitations, public data with user context

## 📝 Adding New Routes

### Step 1: Configure Route Access

Add your route pattern to `lib/route-config.ts`:

```typescript
export const ROUTE_CONFIG: RouteConfig = {
  public: [
    "/api/webhooks/**", // All webhook routes
    "/api/health", // Health check
    "/api/public/**", // Public API namespace
  ],

  protected: [
    "/api/user/**", // User-specific data
    "/api/billing/orders", // Protected billing operations
    "/api/files/upload", // File uploads
  ],

  conditional: [
    "/api/chat/guest", // Guest chat with limits
    "/api/search/public", // Public search with user context
  ],
};
```

### Step 2: Implement Route Handler

Choose the appropriate decorator based on your route type:

#### Public Route Example

```typescript
// app/api/webhooks/stripe/route.ts
import { publicRoute } from "@/lib/auth-decorators";

export const POST = publicRoute(async (request) => {
  // No authentication required
  const signature = request.headers.get("stripe-signature");
  // Process webhook...
  return Response.json({ received: true });
});
```

#### Protected Route Example

```typescript
// app/api/user/profile/route.ts
import { protectedRoute } from "@/lib/auth-decorators";

export const GET = protectedRoute(async (request, context, user) => {
  // user is guaranteed to exist and be authenticated
  const profile = await getUserProfile(user.id);
  return Response.json(profile);
});

export const PUT = protectedRoute(async (request, context, user) => {
  const updates = await request.json();
  await updateUserProfile(user.id, updates);
  return Response.json({ success: true });
});
```

#### Conditional Route Example

```typescript
// app/api/chat/guest/route.ts
import { authenticatedRoute, handleGuestAccess } from "@/lib/auth-decorators";

export const POST = authenticatedRoute(async (request) => {
  const { user, isGuest } = await handleGuestAccess(request);

  if (isGuest) {
    // Check guest message limits
    const messageCount = await getGuestMessageCount(request.ip);
    if (messageCount >= 5) {
      return new ChatSDKError(
        "rate_limited",
        "Guest limit exceeded"
      ).toResponse();
    }
  }

  // Process chat message...
  return streamChatResponse(user, message);
});
```

## 🔧 Advanced Patterns

### Custom Authentication Logic

For complex auth requirements, use the base `withAuth` wrapper:

```typescript
import { withAuth } from "@/lib/auth-decorators";

export const POST = withAuth(async (user, request) => {
  // Check user permissions
  if (!hasPermission(user, "admin")) {
    return new ChatSDKError("forbidden", "Admin access required").toResponse();
  }

  // Admin-only logic...
  return Response.json({ success: true });
});
```

### Route-Specific Middleware

For routes that need additional validation:

```typescript
import { protectedRoute } from "@/lib/auth-decorators";
import { validateSubscription } from "@/lib/billing";

export const POST = protectedRoute(async (request, context, user) => {
  // Additional validation
  const subscription = await validateSubscription(user.id);
  if (!subscription.isActive) {
    return new ChatSDKError(
      "subscription_required",
      "Active subscription required"
    ).toResponse();
  }

  // Protected logic with subscription check...
  return Response.json({ data });
});
```

## 🧪 Testing Routes

### Test Public Routes

```bash
curl -X GET "http://localhost:3000/api/health"
# Expected: 200 OK (no auth required)
```

### Test Protected Routes

```bash
# Without auth
curl -X GET "http://localhost:3000/api/user/profile"
# Expected: 401 Unauthorized

# With auth
curl -X GET "http://localhost:3000/api/user/profile" \
  -H "Authorization: Bearer SUPABASE_JWT_TOKEN"
# Expected: 200 OK with user data
```

### Test Conditional Routes

```bash
# Guest access
curl -X POST "http://localhost:3000/api/chat/guest" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'
# Expected: 200 OK with guest limitations
```

## 🔄 Migration Guide

### From Old Middleware Pattern

**Before:**

```typescript
// middleware.ts - Hard-coded paths
if (pathname.startsWith("/api/webhooks")) {
  return NextResponse.next();
}
if (pathname.startsWith("/api/billing/webhook")) {
  return NextResponse.next();
}
// ... more hardcoded checks
```

**After:**

```typescript
// lib/route-config.ts - Centralized configuration
public: ["/api/webhooks/**", "/api/billing/**/webhook"];
```

### From Manual Auth Checks

**Before:**

```typescript
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  // Route logic...
}
```

**After:**

```typescript
export const GET = protectedRoute(async (request, context, user) => {
  // user is guaranteed to exist
  // Route logic...
});
```

## 🚀 Benefits

1. **Centralized Configuration** - All route access control in one place
2. **Type Safety** - Guaranteed user object in protected routes
3. **Consistent Error Handling** - Standardized error responses
4. **Easy Testing** - Clear patterns for different auth levels
5. **Scalable** - Add new routes without touching middleware
6. **Self-Documenting** - Route access level is explicit in code

## 📋 Best Practices

1. **Use Descriptive Patterns** - `/api/admin/**` instead of `/api/admin/users`
2. **Group Related Routes** - Put all webhooks under `/api/webhooks/`
3. **Default to Protected** - Make routes protected by default, explicitly mark as public
4. **Document Conditional Logic** - Explain complex auth requirements in comments
5. **Test All Access Levels** - Ensure routes work for intended users only

## 🔍 Debugging

Check route access level:

```typescript
import { getRouteAccessLevel } from "@/lib/route-config";

console.log(getRouteAccessLevel("/api/user/profile")); // 'protected'
console.log(getRouteAccessLevel("/api/webhooks/stripe")); // 'public'
```

Enable debug logging in middleware:

```typescript
console.log(`Route: ${pathname}, Access: ${accessLevel}, User: ${!!token}`);
```
