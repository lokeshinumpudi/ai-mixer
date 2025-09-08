import { FREE_MODELS, PRICING, PRO_MODELS } from '@/lib/constants';
import type { UserType } from '@/lib/supabase/types';
import type { ChatModel } from './models';

interface Entitlements {
  maxMessagesPerDay?: number; // For free tier
  maxMessagesPerMonth?: number; // For paid tier
  maxTokens?: number; // Token limit for usage tracking
  maxCost?: number; // Cost limit in USD
  warningThreshold?: number; // Warning threshold (0.8 = 80%)
  getAllowedModelIds: () => Array<string>;
  planName: string;
  planDescription: string;
}

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For anonymous/guest users - Limited access to basic models
   */
  anonymous: {
    maxMessagesPerDay: PRICING.ANONYMOUS_TIER.dailyMessages,
    maxTokens: 5000, // ~20 messages worth of tokens
    maxCost: 0.5, // $0.50 cost limit
    warningThreshold: 0.8, // Warn at 80% usage
    getAllowedModelIds: () => [...FREE_MODELS],
    planName: 'Guest',
    planDescription: 'Limited access for anonymous users',
  },

  /*
   * For logged-in users without a paid subscription - Free tier with daily limits
   */
  free: {
    maxMessagesPerDay: PRICING.FREE_TIER.dailyMessages,
    maxTokens: 5000, // ~50 messages worth of tokens
    maxCost: 1.0, // $1.00 cost limit
    warningThreshold: 0.8, // Warn at 80% usage
    getAllowedModelIds: () => [...FREE_MODELS],
    planName: PRICING.FREE_TIER.name,
    planDescription: PRICING.FREE_TIER.description,
  },

  /*
   * For users with an active paid subscription - Pro tier with monthly limits
   */
  pro: {
    maxMessagesPerMonth: PRICING.PAID_TIER.monthlyMessages,
    maxTokens: 100000, // ~1000 messages worth of tokens
    maxCost: 10.0, // $10.00 cost limit
    warningThreshold: 0.9, // Warn at 90% usage (more generous)
    getAllowedModelIds: () => [...FREE_MODELS, ...PRO_MODELS],
    planName: PRICING.PAID_TIER.name,
    planDescription: PRICING.PAID_TIER.description,
  },
};

// Helper function to get allowed model IDs for a user type
export const getAllowedModelIdsForUser = (
  userType: UserType,
): Array<string> => {
  return entitlementsByUserType[userType].getAllowedModelIds();
};

// Helper function to get usage limits for a user type
export const getUserLimits = (userType: UserType) => {
  const entitlements = entitlementsByUserType[userType];
  return {
    maxTokens: entitlements.maxTokens || 0,
    maxCost: entitlements.maxCost || 0,
    warningThreshold: entitlements.warningThreshold || 0.8,
  };
};

// Helper function to get entitlements for a user type
export const getUserEntitlements = (userType: UserType) => {
  return entitlementsByUserType[userType];
};

// Filter models from /api/models based on user entitlements
export const filterModelsForUser = (
  models: ChatModel[],
  userType: UserType,
): ChatModel[] => {
  const allowedIds = getAllowedModelIdsForUser(userType);
  return models.filter((model) => allowedIds.includes(model.id));
};
