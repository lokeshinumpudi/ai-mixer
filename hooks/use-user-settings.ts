'use client';

import { useAuth } from '@/components/auth-provider';
import { getDefaultModelForUser } from '@/lib/ai/models';
import type { UserType } from '@/lib/supabase/types';
import { fetcher } from '@/lib/utils';
import { useCallback, useState } from 'react';
import useSWR from 'swr';

export interface UserSettings {
  defaultModel?: string;
  theme?: 'light' | 'dark' | 'system';
  sidebarCollapsed?: boolean;
  [key: string]: any;
}

export interface UseUserSettingsReturn {
  settings: UserSettings;
  updateSetting: (key: string, value: any) => Promise<void>;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  isLoading: boolean;
  error: any;
}

/**
 * Hook for managing user settings with database persistence
 * Provides optimistic updates and automatic synchronization
 */
export function useUserSettings(): UseUserSettingsReturn {
  const { user } = useAuth();
  const userId = user?.id;

  // Fetch user settings from API - used primarily for manual settings updates
  // Note: Model selection is now handled via the models API for better performance
  const {
    data: settingsData,
    mutate: mutateSettings,
    isLoading,
    error,
  } = useSWR<UserSettings>(userId ? `/api/user/settings` : null, fetcher, {
    fallbackData: {},
    // Less aggressive caching since model selection is handled elsewhere
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    // Shorter deduping interval for when this API is actually called
    dedupingInterval: 30 * 1000, // 30 seconds
  });

  // Optimistic local state for immediate UI updates
  const [optimisticSettings, setOptimisticSettings] = useState<UserSettings>(
    {},
  );

  // Combine server data with optimistic updates
  const settings = { ...settingsData, ...optimisticSettings };

  // Update a single setting with optimistic update
  const updateSetting = useCallback(
    async (key: string, value: any) => {
      if (!userId) return;

      // Optimistic update
      setOptimisticSettings((prev) => ({ ...prev, [key]: value }));

      try {
        // Server update
        const response = await fetch('/api/user/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: value }),
        });

        if (!response.ok) {
          throw new Error('Failed to update setting');
        }

        // Update SWR cache
        await mutateSettings((current) => ({
          ...current,
          [key]: value,
        }));

        // Clear optimistic update
        setOptimisticSettings((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      } catch (error) {
        // Revert optimistic update on error
        setOptimisticSettings((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        throw error;
      }
    },
    [userId, mutateSettings],
  );

  // Update multiple settings at once
  const updateSettings = useCallback(
    async (newSettings: Partial<UserSettings>) => {
      if (!userId) return;

      // Optimistic update
      setOptimisticSettings((prev) => ({ ...prev, ...newSettings }));

      try {
        // Server update
        const response = await fetch('/api/user/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSettings),
        });

        if (!response.ok) {
          throw new Error('Failed to update settings');
        }

        // Update SWR cache
        await mutateSettings((current) => ({
          ...current,
          ...newSettings,
        }));

        // Clear optimistic updates
        setOptimisticSettings((prev) => {
          const next = { ...prev };
          Object.keys(newSettings).forEach((key) => {
            delete next[key];
          });
          return next;
        });
      } catch (error) {
        // Revert optimistic updates on error
        setOptimisticSettings((prev) => {
          const next = { ...prev };
          Object.keys(newSettings).forEach((key) => {
            delete next[key];
          });
          return next;
        });
        throw error;
      }
    },
    [userId, mutateSettings],
  );

  return {
    settings,
    updateSetting,
    updateSettings,
    isLoading,
    error,
  };
}

/**
 * Hook specifically for managing the selected model
 * Provides plan-based defaults and persistence
 */
export function useSelectedModel(): {
  selectedModel: string;
  setSelectedModel: (modelId: string) => Promise<void>;
  isLoading: boolean;
} {
  const { settings, updateSetting, isLoading } = useUserSettings();
  const { user } = useAuth();

  // Get the selected model from settings, with plan-based fallback
  const selectedModel =
    settings?.defaultModel ||
    getDefaultModelForUser(user?.user_metadata?.user_type as UserType);

  const setSelectedModel = useCallback(
    async (modelId: string) => {
      await updateSetting('defaultModel', modelId);
    },
    [updateSetting],
  );

  return {
    selectedModel,
    setSelectedModel,
    isLoading,
  };
}
