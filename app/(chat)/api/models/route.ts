import { getAllowedModelIdsForUser } from '@/lib/ai/entitlements';
import { enrichModelWithCapabilities } from '@/lib/ai/models';
import { protectedRoute } from '@/lib/auth-decorators';
import { SUPPORTED_MODEL_IDS } from '@/lib/constants';
import { gateway } from '@/lib/gateway';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export const GET = protectedRoute(async (request, context, user) => {
  try {
    const allModels = await gateway.getAvailableModels();
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

    return NextResponse.json({
      models: fallbackModels,
      userType: user.type,
      warning: 'Using fallback model configuration due to provider error',
    });
  }
});
