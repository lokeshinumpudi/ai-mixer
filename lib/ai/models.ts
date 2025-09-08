import { FREE_MODELS, MODEL_CONFIG, PRO_MODELS } from '@/lib/constants';
import type { UserType } from '@/lib/supabase/types';

// Get default model based on user plan
export const getDefaultModelForUser = (userType: UserType): string => {
  switch (userType) {
    case 'free':
      // Return the first available free model, fallback to DEFAULT_MODEL
      return FREE_MODELS[0];
    case 'pro': {
      // For pro users, prefer a premium model that's not in the free tier
      // Find the first pro-only model (not in FREE_MODELS)
      const proOnlyModels = PRO_MODELS.filter(
        (model) => !FREE_MODELS.includes(model as any),
      );
      return proOnlyModels[0] || PRO_MODELS[0];
    }
    case 'anonymous':
      // Anonymous users get the same as free users
      return FREE_MODELS[0];
    default:
      return FREE_MODELS[0];
  }
};

// Model interface for client-side usage
export interface ChatModel {
  id: string;
  name: string;
  description: string;
  provider: string;
  // Basic capabilities inferred from gateway + our config
  supportsVision?: boolean;
  supportsImageGeneration?: boolean;
  supportsReasoning?: boolean;
  supportsArtifacts?: boolean;
  supportsToolCalling?: boolean;
  supportsPdf?: boolean;
  // Business controls
  enabled?: boolean;
  allowFileUploads?: boolean;
  // Gateway pricing data
  pricing?: {
    input: string;
    output: string;
  } | null;
}

// Helper function to convert gateway model to our ChatModel interface
export const enrichModelWithCapabilities = (gatewayModel: any): ChatModel => {
  // Get our custom config for this model
  const customConfig =
    MODEL_CONFIG[gatewayModel.id as keyof typeof MODEL_CONFIG];

  // Infer basic capabilities from gateway data
  const hasVisionSupport =
    gatewayModel.modelType === 'image' ||
    gatewayModel.description?.toLowerCase().includes('vision');

  return {
    id: gatewayModel.id,
    name: gatewayModel.name || gatewayModel.id,
    description: gatewayModel.description || `${gatewayModel.id} model`,
    provider: gatewayModel.id.split('/')[0] || 'unknown',

    // Basic capabilities inferred from gateway
    supportsVision: customConfig?.supportsVision ?? hasVisionSupport,
    supportsImageGeneration: gatewayModel.modelType === 'image',

    // Enhanced capabilities from our config
    supportsReasoning: customConfig?.supportsReasoning ?? false,
    supportsArtifacts: customConfig?.supportsArtifacts ?? false,
    supportsToolCalling: customConfig?.supportsToolCalling ?? false,
    supportsPdf: customConfig?.supportsPdf ?? hasVisionSupport,

    // Business controls from our config
    enabled: customConfig?.enabled ?? false,
    allowFileUploads: customConfig?.allowFileUploads ?? hasVisionSupport,

    // Gateway pricing data
    pricing: gatewayModel.pricing || null,
  };
};
