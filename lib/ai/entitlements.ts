import { FREE_MODELS, PRICING, PRO_MODELS } from '@/lib/constants';
import type { UserType } from '@/lib/supabase/types';
import type { ChatModel } from './models';

interface Entitlements {
  maxMessagesPerDay?: number; // For free tier
  maxMessagesPerMonth?: number; // For paid tier
  getAllowedModelIds: () => Array<string>;
  planName: string;
  planDescription: string;
}

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For anonymous/guest users - Limited access to basic models
   */
  anonymous: {
    maxMessagesPerDay: 5, // 5 messages for anonymous users
    getAllowedModelIds: () => [...FREE_MODELS],
    planName: 'Guest',
    planDescription: 'Limited access for anonymous users',
  },

  /*
   * For logged-in users without a paid subscription - Free tier with daily limits
   */
  free: {
    maxMessagesPerDay: PRICING.FREE_TIER.dailyMessages,
    getAllowedModelIds: () => [...FREE_MODELS],
    planName: PRICING.FREE_TIER.name,
    planDescription: PRICING.FREE_TIER.description,
  },

  /*
   * For users with an active paid subscription - Pro tier with monthly limits
   */
  pro: {
    maxMessagesPerMonth: PRICING.PAID_TIER.monthlyMessages,
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

// Filter models from /api/models based on user entitlements
export const filterModelsForUser = (
  models: ChatModel[],
  userType: UserType,
): ChatModel[] => {
  const allowedIds = getAllowedModelIdsForUser(userType);
  return models.filter((model) => allowedIds.includes(model.id));
};
