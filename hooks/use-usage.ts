'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface UsageInfo {
  used: number;
  quota: number;
  remaining: number;
  isOverLimit: boolean;
  type: 'daily' | 'monthly';
  resetInfo: string;
}

interface UsageResponse {
  plan: UsageInfo;
  usage: any[];
}

export function useUsage() {
  const [currentUsage, setCurrentUsage] = useState<UsageInfo | null>(null);

  const { data, error, mutate } = useSWR<UsageResponse>(
    '/api/usage/summary',
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: false,
    },
  );

  useEffect(() => {
    if (data?.plan) {
      setCurrentUsage(data.plan);
    }
  }, [data]);

  const updateUsage = (newUsageInfo: UsageInfo) => {
    setCurrentUsage(newUsageInfo);
  };

  return {
    usage: currentUsage,
    isLoading: !error && !data,
    isError: error,
    mutate,
    updateUsage,
  };
}
