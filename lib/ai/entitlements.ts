import type { UserType } from '@/app/(auth)/auth';
import { chatModels, type ChatModel } from './models';

interface Entitlements {
  maxMessagesPerDay: number;
  getAvailableModels: () => Array<ChatModel>;
}

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   */
  guest: {
    maxMessagesPerDay: 20,
    getAvailableModels: () => {
      // Guest users get access to basic models only
      return chatModels.filter(
        (model) => model.id.includes('grok-3-mini'), // Only mini models for guests
      );
    },
  },

  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: 100,
    getAvailableModels: () => {
      // Regular users get access to all models
      return chatModels;
    },
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};

// Helper functions for backward compatibility and convenience
export const getAvailableModelsForUser = (
  userType: UserType,
): Array<ChatModel> => {
  return entitlementsByUserType[userType].getAvailableModels();
};

export const getAvailableModelIdsForUser = (
  userType: UserType,
): Array<ChatModel['id']> => {
  return getAvailableModelsForUser(userType).map((model) => model.id);
};
