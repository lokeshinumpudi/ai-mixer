'use client';

import { useAuth } from '@/components/auth-provider';
import type { ChatModel } from '@/lib/ai/models';
import { fetcher } from '@/lib/utils';
import useSWR from 'swr';

interface ModelsResponse {
  models: ChatModel[];
  userType: 'free' | 'pro';
  userSettings?: {
    defaultModel?: string;
    compareModels?: string[];
    mode?: 'single' | 'compare';
    theme?: string;
    systemPrompt?: {
      name?: string;
      profession?: string;
      traits?: string[];
      preferences?: string;
      updatedAt?: string;
    };
    [key: string]: any;
  };
}

export function useModels() {
  const { user, loading: authLoading } = useAuth();

  // Only fetch models when auth is ready and user exists
  // Add a small delay to ensure session is fully synchronized
  const shouldFetch = !authLoading && user && user.id;

  const { data, error, isLoading, mutate } = useSWR<ModelsResponse>(
    shouldFetch ? '/api/models' : null,
    fetcher,
    {
      revalidateOnMount: true,
      // Fetch on first mount, reuse cache across chat navigations
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      // Periodic background refresh is still fine but make it lighter
      refreshInterval: 15 * 60 * 1000, // 15 minutes
      dedupingInterval: 60 * 60 * 1000, // 1 hour
      // Add error retry with backoff
      errorRetryCount: 3,
      errorRetryInterval: 1000,
    },
  );

  return {
    models: data?.models ?? [],
    userType: data?.userType ?? 'free',
    userSettings: data?.userSettings ?? {},
    systemPrompt: data?.userSettings?.systemPrompt ?? null,
    // Extract specific settings for convenience
    defaultModel: data?.userSettings?.defaultModel,
    compareModels: data?.userSettings?.compareModels ?? [],
    mode: data?.userSettings?.mode ?? 'single',
    isLoading: authLoading || isLoading, // Include auth loading state
    error,
    mutate,
  };
}

// Helper functions to filter models by enabled status
export function getEnabledModels(models: ChatModel[]): ChatModel[] {
  return models.filter((model) => model.enabled !== false);
}

export function getDisabledModels(models: ChatModel[]): ChatModel[] {
  return models.filter((model) => model.enabled === false);
}

// Helper function to check if a model is enabled for the current user
export function isModelEnabled(model: ChatModel): boolean {
  return model.enabled !== false;
}
