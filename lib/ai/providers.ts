import { extractReasoningMiddleware, wrapLanguageModel } from 'ai';
import { gateway } from '@/lib/gateway';
import { chatModel, titleModel } from './models.test';
import { isTestEnvironment, getModelCapabilities } from '../constants';

// Helper function to get a model with reasoning if supported
export const getLanguageModel = (modelId: string) => {
  if (isTestEnvironment) {
    // Return test models for testing
    if (modelId === 'title-model') return titleModel;
    return chatModel;
  }

  const capabilities = getModelCapabilities(modelId);

  const baseModel = gateway.languageModel(modelId);

  // Wrap with reasoning middleware if the model supports it
  if (capabilities?.supportsReasoning) {
    return wrapLanguageModel({
      model: baseModel,
      middleware: extractReasoningMiddleware({ tagName: 'thinking' }),
    });
  }

  return baseModel;
};

// Utility function to check if a model supports specific features
export const modelSupports = (
  modelId: string,
  feature: 'reasoning' | 'artifacts',
): boolean => {
  const capabilities = getModelCapabilities(modelId);
  if (!capabilities) return false;

  return feature === 'reasoning'
    ? capabilities.supportsReasoning
    : capabilities.supportsArtifacts;
};
