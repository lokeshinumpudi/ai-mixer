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

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'chat-model': chatModel,
        'chat-model-reasoning': reasoningModel,
        'chat-model-2': chatModel,
        'title-model': titleModel,
        'artifact-model': artifactModel,
      },
    })
  : customProvider({
      languageModels: {
        'chat-model': xai('grok-3-mini'),
        'chat-model-reasoning': wrapLanguageModel({
          model: xai('grok-3-mini'),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'chat-model-2': xai('grok-3-mini'),
        'title-model': xai('grok-3-mini'),
        'artifact-model': xai('grok-3-mini'),
      },
      imageModels: {
        'small-model': xai.imageModel('grok-2-image'),
      },
    });
