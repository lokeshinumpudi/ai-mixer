import { generateDummyPassword } from './db/utils';

export const isProductionEnvironment = process.env.NODE_ENV === 'production';
export const isDevelopmentEnvironment = process.env.NODE_ENV === 'development';
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT,
);

export const DUMMY_PASSWORD = generateDummyPassword();

export const DEFAULT_MODEL = 'xai/grok-3-mini';
// Image model configuration
export const DEFAULT_IMAGE_MODEL = 'xai/grok-2-image-1212'; // Or whatever image model is available via gateway

// Pricing configuration
export const PRICING = {
  FREE_TIER: {
    dailyMessages: 20,
    name: 'Free Plan',
    description: '20 messages per day with basic models',
  },
  PAID_TIER: {
    monthlyMessages: 1000,
    priceInRupees: 249,
    name: 'Pro Plan',
    description: '1000 messages per month with all models',
  },
} as const;

// Free models (available to all users)
export const FREE_MODELS = [
  'xai/grok-3-mini',
  'openai/gpt-3.5-turbo',
  'google/gemma2-9b-it',
  'meta/llama-3.1-8b',
  'mistral/ministral-3b',
  'amazon/nova-micro',
] as const;

// Pro models (require paid subscription)
export const PRO_MODELS = [
  'xai/grok-3',
  'openai/gpt-4o-mini',
  'anthropic/claude-3.5-haiku',
  'google/gemini-2.0-flash',
  'amazon/nova-lite',
] as const;

// Unified model configuration - single source of truth
export const SUPPORTED_MODELS = {
  'xai/grok-3': {
    supportsReasoning: true,
    supportsArtifacts: true,
  },
  'xai/grok-3-mini': {
    supportsReasoning: true,
    supportsArtifacts: true,
  },
  'openai/gpt-4o-mini': {
    supportsReasoning: false,
    supportsArtifacts: true,
  },
  'openai/gpt-3.5-turbo': {
    supportsReasoning: false,
    supportsArtifacts: false,
  },
  'anthropic/claude-3.5-haiku': {
    supportsReasoning: false,
    supportsArtifacts: true,
  },
  'google/gemini-2.0-flash': {
    supportsReasoning: false,
    supportsArtifacts: true,
  },
  'google/gemma2-9b-it': {
    supportsReasoning: false,
    supportsArtifacts: false,
  },
  'meta/llama-3.1-8b': {
    supportsReasoning: false,
    supportsArtifacts: false,
  },
  'mistral/ministral-3b': {
    supportsReasoning: false,
    supportsArtifacts: false,
  },
  'amazon/nova-lite': {
    supportsReasoning: false,
    supportsArtifacts: true,
  },
  'amazon/nova-micro': {
    supportsReasoning: false,
    supportsArtifacts: false,
  },
} as const;

// Derived constants for convenience
export const SUPPORTED_MODEL_IDS = Object.keys(SUPPORTED_MODELS) as Array<
  keyof typeof SUPPORTED_MODELS
>;

// Helper functions to work with the unified model config
export function getModelCapabilities(modelId: string) {
  return (
    SUPPORTED_MODELS[modelId as keyof typeof SUPPORTED_MODELS] || {
      supportsReasoning: false,
      supportsArtifacts: false,
    }
  );
}

export function isModelSupported(modelId: string): boolean {
  return modelId in SUPPORTED_MODELS;
}

// Backward compatibility alias (deprecated - use SUPPORTED_MODELS directly)
export const MODEL_CAPABILITIES = SUPPORTED_MODELS;
