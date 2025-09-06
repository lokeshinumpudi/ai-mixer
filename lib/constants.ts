import { generateDummyPassword } from "./db/utils";

export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";

export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT
);

export const DUMMY_PASSWORD = generateDummyPassword();

// Pricing configuration
export const PRICING = {
  ANONYMOUS_TIER: {
    dailyMessages: 20,
    name: "Anonymous Plan",
    description: "20 messages per day with basic models",
  },
  FREE_TIER: {
    dailyMessages: 50,
    name: "Free Plan",
    description: "50 messages per day with basic+ models",
  },
  PAID_TIER: {
    monthlyMessages: 1000,
    priceInRupees: 249,
    name: "Pro Plan",
    description: "1000 messages per month with all models",
  },
} as const;

// Free models (available to all users)
export const FREE_MODELS = [
  "openai/gpt-oss-20b",
  "google/gemini-2.5-flash-lite",
  "openai/gpt-5-nano",
] as const;

// Pro models (require paid subscription)
export const PRO_MODELS = [
  ...FREE_MODELS,
  "moonshotai/kimi-k2",
  "alibaba/qwen-3-32b",
  "openai/gpt-5-mini",
  "openai/gpt-oss-120b",
  "xai/grok-code-fast-1",
  "google/gemini-2.5-flash-image-preview",
  "openai/gpt-4o-mini",
] as const;

export const DEFAULT_MODEL = FREE_MODELS[0];
// Image model configuration
export const DEFAULT_IMAGE_MODEL = "xai/grok-2-image-1212";

// Minimal model configuration - only business controls we need
export const MODEL_CONFIG = {
  "google/gemini-2.5-flash-lite": {
    enabled: true,
    allowFileUploads: true,
    supportsVision: true,
    supportsReasoning: false,
    supportsArtifacts: true,
    supportsToolCalling: true,
    supportsPdf: true,
  },
  "openai/gpt-5-nano": {
    enabled: true,
    allowFileUploads: false,
    supportsVision: false,
    supportsReasoning: false,
    supportsArtifacts: true,
    supportsToolCalling: true,
    supportsPdf: false,
  },
  "xai/grok-code-fast-1": {
    enabled: true,
    allowFileUploads: false,
    supportsVision: false,
    supportsReasoning: false,
    supportsArtifacts: true,
    supportsToolCalling: true,
    supportsPdf: false,
  },
  "moonshotai/kimi-k2": {
    enabled: true,
    allowFileUploads: false,
    supportsVision: false,
    supportsReasoning: false,
    supportsArtifacts: true,
    supportsToolCalling: true,
    supportsPdf: false,
  },
  "openai/gpt-oss-20b": {
    enabled: true,
    allowFileUploads: false,
    supportsVision: false,
    supportsReasoning: false,
    supportsArtifacts: true,
    supportsToolCalling: true,
    supportsPdf: false,
  },
  "openai/gpt-5-mini": {
    enabled: true,
    allowFileUploads: true,
    supportsVision: true,
    supportsReasoning: false,
    supportsArtifacts: true,
    supportsToolCalling: true,
    supportsPdf: true,
  },
  "openai/gpt-oss-120b": {
    enabled: true,
    allowFileUploads: true,
    supportsVision: true,
    supportsReasoning: false,
    supportsArtifacts: true,
    supportsToolCalling: true,
    supportsPdf: true,
  },
  "openai/gpt-4o-mini": {
    enabled: true,
    allowFileUploads: true,
    supportsVision: true,
    supportsReasoning: false,
    supportsArtifacts: true,
    supportsToolCalling: true,
    supportsPdf: true,
  },
  "google/gemini-2.5-flash-image-preview": {
    enabled: true,
    allowFileUploads: true,
    supportsVision: true,
    supportsReasoning: false,
    supportsArtifacts: true,
    supportsToolCalling: true,
    supportsPdf: true,
  },
  "alibaba/qwen-3-32b": {
    enabled: true,
    allowFileUploads: false,
    supportsVision: false,
    supportsReasoning: false,
    supportsArtifacts: true,
    supportsToolCalling: true,
    supportsPdf: false,
  },
} as const;

// Backward compatibility alias
export const SUPPORTED_MODELS = MODEL_CONFIG;

// Derived constants for convenience
export const SUPPORTED_MODEL_IDS = Object.keys(MODEL_CONFIG) as Array<
  keyof typeof MODEL_CONFIG
>;

// Helper function to check if model is configured
export function isModelSupported(modelId: string): boolean {
  return modelId in MODEL_CONFIG;
}

// Helper function to get model capabilities
export function getModelCapabilities(modelId: string) {
  return MODEL_CONFIG[modelId as keyof typeof MODEL_CONFIG] || null;
}

// AI Compare feature configuration
export const COMPARE_MAX_MODELS = 3;

// Curated compare presets for quick selection
export const COMPARE_PRESETS = {
  "Fast Reasoning Trio": [
    "google/gemini-2.0-flash",
    "openai/gpt-5-nano",
    "xai/grok-code-fast-1",
  ],
  "Vision Models": [
    "google/gemini-2.0-flash",
    "openai/gpt-5-mini",
    "openai/gpt-oss-120b",
  ],
  "Code Specialists": [
    "xai/grok-code-fast-1",
    "openai/gpt-5-mini",
    "alibaba/qwen-3-32b",
  ],
  "Balanced Duo": ["google/gemini-2.0-flash", "openai/gpt-4o-mini"],
} as const;
