import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { xai } from '@ai-sdk/xai';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';
import { isTestEnvironment } from '../constants';
import { chatModels } from './models';

// Create dynamic language model mapping
const createLanguageModels = () => {
  const models: Record<string, any> = {};

  // Add all chat models
  for (const model of chatModels) {
    const baseModelId = model.id.split(':')[1]; // Extract model ID after provider prefix

    if (model.provider === 'xai') {
      if (model.supportsReasoning) {
        models[model.id] = wrapLanguageModel({
          model: xai(baseModelId),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        });
      } else {
        models[model.id] = xai(baseModelId);
      }
    }
    // Future: Add other providers like OpenAI, Anthropic, etc.
  }

  // Add special models for system functions
  models['title-model'] = xai('grok-3-mini');
  models['artifact-model'] = xai('grok-3-mini');

  return models;
};

const createTestLanguageModels = () => ({
  // Map new model IDs to test models for backward compatibility
  'xai:grok-3-mini': chatModel,
  'xai:grok-3-mini-reasoning': reasoningModel,
  'xai:grok-2-1212': chatModel,
  'xai:grok-2-reasoning': reasoningModel,
  'title-model': titleModel,
  'artifact-model': artifactModel,
});

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: createTestLanguageModels(),
    })
  : customProvider({
      languageModels: createLanguageModels(),
      imageModels: {
        'small-model': xai.imageModel('grok-2-image'),
      },
    });
