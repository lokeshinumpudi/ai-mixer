import { FREE_MODELS, getModelCapabilities, PRO_MODELS } from '@/lib/constants';
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
  supportsReasoning: boolean;
  supportsArtifacts: boolean;
  supportsVision?: boolean;
  supportsImageGeneration?: boolean;
  supportsToolCalling?: boolean;
  supportsPdf?: boolean;
  enabled?: boolean; // Optional for backward compatibility
}

// Helper function to convert gateway model to our ChatModel interface
export const enrichModelWithCapabilities = (gatewayModel: any): ChatModel => {
  const capabilities = getModelCapabilities(gatewayModel.id);

  return {
    id: gatewayModel.id,
    name: gatewayModel.name || gatewayModel.id,
    description: gatewayModel.description || `${gatewayModel.id} model`,
    provider: gatewayModel.id.split('/')[0] || 'unknown',
    supportsReasoning: capabilities.supportsReasoning,
    supportsArtifacts: capabilities.supportsArtifacts,
    supportsVision: capabilities.supportsVision,
    supportsImageGeneration: capabilities.supportsImageGeneration,
    supportsToolCalling: capabilities.supportsToolCalling,
    supportsPdf: capabilities.supportsPdf,
  };
};
