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
    userType: securityContext.user.type,
  });
});
