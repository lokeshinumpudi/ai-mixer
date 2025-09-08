import { getAllowedModelIdsForUser } from '@/lib/ai/entitlements';
import { enrichModelWithCapabilities } from '@/lib/ai/models';
import { authenticatedRoute } from '@/lib/auth-decorators';
import { MODEL_CONFIG } from '@/lib/constants';
import { getActiveModelCache, getUserSettings } from '@/lib/db/queries';
import { gateway } from '@/lib/gateway';
import { NextResponse } from 'next/server';

export const GET = authenticatedRoute(async (request, context, user) => {
  // Get latest valid cached models
  const cache = await getActiveModelCache();

  let models: any;
  if (cache) {
    models = cache.models;
  } else {
    // Fallback to direct gateway call
    const { models: gatewayModels } = await gateway.getAvailableModels();
    models = gatewayModels;
  }

  // Apply existing business logic (filtering, enrichment, etc.)
  const allowedModelIds = getAllowedModelIdsForUser(user.userType);
  const userSettings = await getUserSettings(user.id);

  const supportedModels = models
    .filter((model: any) => model.id in MODEL_CONFIG)
    .map((model: any) => {
      const enrichedModel = enrichModelWithCapabilities(model);
      return {
        ...enrichedModel,
        enabled: enrichedModel.enabled && allowedModelIds.includes(model.id),
      };
    });

  return NextResponse.json(
    {
      models: supportedModels,
      userType: user.userType,
      userSettings: userSettings?.settings || {},
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=300',
      },
    },
  );
});
