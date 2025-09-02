import { getAllowedModelIdsForUser } from '@/lib/ai/entitlements';
import { enrichModelWithCapabilities } from '@/lib/ai/models';
import { protectedRoute } from '@/lib/auth-decorators';
import { SUPPORTED_MODEL_IDS } from '@/lib/constants';
import { getUserSettings } from '@/lib/db/queries';
import { gateway } from '@/lib/gateway';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export const GET = protectedRoute(async (request, context, user) => {
  try {
    // Fetch user settings alongside models
    const [userSettings, allModels] = await Promise.all([
      getUserSettings(user.id),
      gateway.getAvailableModels(),
    ]);

    const allowedModelIds = getAllowedModelIdsForUser(user.type);

    // Filter supported models, enrich with capabilities, and add enabled flag
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
      userSettings: userSettings?.settings || {},
    });
  } catch (error) {
    console.error('Failed to get available models:', error);

    // Fallback response with basic model info
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

    // Try to get user settings even in fallback
    let userSettings = {};
    try {
      const settings = await getUserSettings(user.id);
      userSettings = settings?.settings || {};
    } catch (settingsError) {
      console.error('Failed to get user settings in fallback:', settingsError);
    }

    return NextResponse.json({
      models: fallbackModels,
      userType: user.type,
      userSettings,
      warning: 'Using fallback model configuration due to provider error',
    });
  }
});
