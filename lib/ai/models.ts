import { DEFAULT_MODEL, getModelCapabilities } from '@/lib/constants';

export const DEFAULT_CHAT_MODEL: string = DEFAULT_MODEL;

// Model interface for client-side usage
export interface ChatModel {
  id: string;
  name: string;
  description: string;
  provider: string;
  supportsReasoning: boolean;
  supportsArtifacts: boolean;
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
  };
};
