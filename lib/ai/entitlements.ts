import type { UserType } from '@/app/(auth)/auth';
import type { ChatModel } from './models';
import { SUPPORTED_MODEL_IDS } from '@/lib/constants';

interface Entitlements {
  maxMessagesPerDay: number;
  getAllowedModelIds: () => Array<string>;
}

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   */
  guest: {
    maxMessagesPerDay: 20,
    getAllowedModelIds: () => {
      // Guest users get access to basic models only
      return SUPPORTED_MODEL_IDS.filter(
        (modelId) =>
          modelId.includes('grok-3-mini') ||
          modelId.includes('gpt-3.5') ||
          modelId.includes('gemma2-9b') ||
          modelId.includes('ministral-3b'),
      );
    },
  },

  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: 100,
    getAllowedModelIds: () => {
      // Regular users get access to all supported models
      return SUPPORTED_MODEL_IDS;
    },
  },

  /*
   * TODO: For users with an account and a paid membership
   */
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
