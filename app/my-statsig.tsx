'use client';

import { useAuth } from '@/components/auth-provider';
import { StatsigProvider, useClientAsyncInit } from '@statsig/react-bindings';
import { StatsigSessionReplayPlugin } from '@statsig/session-replay';
import { StatsigAutoCapturePlugin } from '@statsig/web-analytics';
import React, { useMemo } from 'react';

export default function MyStatsig({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const statsigUser = useMemo(
    () => ({
      userID: user?.id || 'anonymous',
      email: user?.email || undefined,
      custom: {
        is_anonymous: user?.is_anonymous ?? true,
        user_type: user?.user_metadata?.user_type ?? 'anonymous',
      },
    }),
    [user?.id, user?.email, user?.is_anonymous, user?.user_metadata?.user_type],
  );

  const { client } = useClientAsyncInit(
    process.env.NEXT_PUBLIC_STATSIG_CLIENT_KEY || '',
    statsigUser,
    {
      plugins: [
        new StatsigAutoCapturePlugin(),
        new StatsigSessionReplayPlugin(),
      ],
    },
  );

  return (
    <StatsigProvider client={client} loadingComponent={<div>Loading...</div>}>
      {children}
    </StatsigProvider>
  );
}
