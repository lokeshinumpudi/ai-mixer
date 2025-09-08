'use client';

import { useEffect, useState } from 'react';
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

export function useUsage(options?: { fetch?: boolean }) {
  const shouldFetch = options?.fetch !== false;
  const [currentUsage, setCurrentUsage] = useState<UsageInfo | null>(null);

  const { data, error, mutate } = useSWR<UsageResponse>(
    shouldFetch ? '/api/usage/summary' : null,
    fetcher,
    {
      // Usage should not refetch on each chat mount; controlled updates only
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 10 * 60 * 1000, // 10 minutes
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
    usageHistory: data?.usage ?? [],
    plan: data?.plan,
    isLoading: !error && !data,
    isError: error,
    mutate,
    updateUsage,
  };
}
