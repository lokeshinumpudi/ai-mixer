'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/utils';
import type { ChatModel } from '@/lib/ai/models';

interface ModelsResponse {
  models: ChatModel[];
  userType: 'free' | 'pro';
}

export function useModels() {
  const { data, error, isLoading, mutate } = useSWR<ModelsResponse>(
    '/api/models',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      refreshInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    },
  );

  return {
    models: data?.models ?? [],
    userType: data?.userType ?? 'free',
    isLoading,
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
