import { getAllowedModelIdsForUser } from '@/lib/ai/entitlements';
import { enrichModelWithCapabilities } from '@/lib/ai/models';
import { authenticatedRoute } from '@/lib/auth-decorators';
import { MODEL_CONFIG } from '@/lib/constants';
import { getUserSettings } from '@/lib/db/queries';
import { gateway } from '@/lib/gateway';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export const GET = authenticatedRoute(async (request, context, user) => {
  try {
    // Fetch user settings and models in parallel
    const [userSettings, allModels] = await Promise.all([
      getUserSettings(user.id),
      gateway.getAvailableModels(),
    ]);

    const allowedModelIds = getAllowedModelIdsForUser(user.userType);

    // Filter models that exist in our config, enrich with capabilities
    const supportedModels = allModels.models
      .filter((model) => model.id in MODEL_CONFIG)
      .map((model) => {
        const enrichedModel = enrichModelWithCapabilities(model);
        return {
          ...enrichedModel,
          enabled: enrichedModel.enabled && allowedModelIds.includes(model.id),
        };
      });

    return NextResponse.json({
      models: supportedModels,
      userType: user.userType,
      userSettings: userSettings?.settings || {},
    });
  } catch (error) {
    console.error('Failed to get available models:', error);

    // Fallback response with basic model info
    // Note: user is already available from authenticatedRoute decorator

    const allowedModelIds = getAllowedModelIdsForUser(user.userType);

    // Try to get user settings even in fallback
    let userSettings = {} as any;
    try {
      const settings = await getUserSettings(user.id);
      userSettings = settings?.settings || {};
    } catch (settingsError) {
      console.error('Failed to get user settings in fallback:', settingsError);
    }

    // Fallback models from our config
    const fallbackModels = Object.keys(MODEL_CONFIG).map((modelId) => {
      const enrichedModel = enrichModelWithCapabilities({
        id: modelId,
        name: modelId,
      });
      return {
        ...enrichedModel,
        enabled: enrichedModel.enabled && allowedModelIds.includes(modelId),
      };
    });

    return NextResponse.json({
      models: fallbackModels,
      userType: user.userType,
      userSettings,
      warning: 'Using fallback model configuration due to provider error',
    });
  }
});
