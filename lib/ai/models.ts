export const DEFAULT_CHAT_MODEL: string = 'xai:grok-3-mini';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
  provider: string;
  supportsReasoning: boolean;
  supportsArtifacts: boolean;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'xai:grok-3-mini',
    name: 'Grok 3 Mini',
    description: 'Fast and efficient model for general chat',
    provider: 'xai',
    supportsReasoning: true,
    supportsArtifacts: true,
  },
];
