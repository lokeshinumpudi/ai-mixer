# Example: Migrating Models Route to New Authentication System

This example shows how to migrate from the old `withSecurity` pattern to the new authentication decorators.

## BEFORE (Current Implementation)

```typescript

import { gateway } from '@/lib/gateway';
import { NextResponse } from 'next/server';
import { SUPPORTED_MODEL_IDS } from '@/lib/constants';
import { enrichModelWithCapabilities } from '@/lib/ai/models';
import { getAllowedModelIdsForUser } from '@/lib/ai/entitlements';
import { withSecurity } from '@/lib/security';

export const dynamic = 'force-dynamic';

export const GET = withSecurity(async (securityContext) => {
  const allModels = await gateway.getAvailableModels();
  const allowedModelIds = getAllowedModelIdsForUser(securityContext.user.type);

  const supportedModels = allModels.models
    .filter((model) => SUPPORTED_MODEL_IDS.includes(model.id as any))
    .map((model) => {
      const enrichedModel = enrichModelWithCapabilities(model);
      return {
        ...enrichedModel,
        enabled: allowedModelIds.includes(model.id),
      };
    });

  return NextResponse.json({
    models: supportedModels,
    userType: securityContext.user.type,
  });
});
```

## AFTER (New Decorator Pattern)

```typescript

import { gateway } from '@/lib/gateway';
import { NextResponse } from 'next/server';
import { SUPPORTED_MODEL_IDS } from '@/lib/constants';
import { enrichModelWithCapabilities } from '@/lib/ai/models';
import { getAllowedModelIdsForUser } from '@/lib/ai/entitlements';
import { protectedRoute } from '@/lib/auth-decorators';

export const dynamic = 'force-dynamic';

export const GET = protectedRoute(async (request, context, user) => {
  try {
    const allModels = await gateway.getAvailableModels();
    const allowedModelIds = getAllowedModelIdsForUser(user.type);

    const supportedModels = allModels.models
      .filter((model) => SUPPORTED_MODEL_IDS.includes(model.id as any))
      .map((model) => {
        const enrichedModel = enrichModelWithCapabilities(model);
        return {
          ...enrichedModel,
          enabled: allowedModelIds.includes(model.id),
        };
      });

    return NextResponse.json({
      models: supportedModels,
      userType: user.type,
    });
  } catch (error) {
    console.error('Failed to get available models:', error);

    // Fallback response
    const allowedModelIds = getAllowedModelIdsForUser(user.type);
    const fallbackModels = SUPPORTED_MODEL_IDS.map((modelId) => {
      const enrichedModel = enrichModelWithCapabilities({
        id: modelId,
        name: modelId,
      });
      return {
        ...enrichedModel,
        enabled: allowedModelIds.includes(modelId),
      };
    });

    return NextResponse.json({
      models: fallbackModels,
      userType: user.type,
      warning: 'Using fallback model configuration due to provider error',
    });
    }
});
```

## BENEFITS OF NEW PATTERN

### 1. CLEANER TYPE SAFETY
- `user` object is guaranteed to exist
- No need for `securityContext` wrapper
- Direct access to user properties

### 2. CENTRALIZED AUTH LOGIC
- Authentication handled by decorator
- Route classification in `route-config.ts`
- Consistent error handling

### 3. EASIER TESTING
- Mock user object directly
- No complex security context setup
- Clear input/output contract

### 4. BETTER ERROR HANDLING
- Automatic error boundaries
- Consistent error responses
- Graceful fallbacks

### 5. SELF-DOCUMENTING
- Route access level is explicit
- Authentication requirements clear
- Less boilerplate code
