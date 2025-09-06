'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { fetcher } from '@/lib/utils';
import { useMemo } from 'react';
import useSWR from 'swr';

interface ChatUsage {
  id: string;
  chatId: string | null;
  userId: string;
  modelId: string;
  tokensIn: number;
  tokensOut: number;
  cost: number; // in cents
  createdAt: string;
}

interface UsageData {
  items: ChatUsage[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  limits: {
    quota: number;
    used: number;
    remaining: number;
    type: 'daily' | 'monthly';
    resetInfo: string;
  };
  currentUsage: {
    totalTokens: number;
    totalCost: number;
    totalChats: number;
    activeChats: number;
  };
  warnings: Array<{
    type: string;
    message: string;
    severity: string;
  }>;
}

export function UsageDashboard() {
  const {
    data: usageData,
    error,
    isLoading,
  } = useSWR<UsageData>(
    '/api/usage?limit=100', // Load more for better client-side computation
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // 30 seconds
      refreshInterval: 60000, // 1 minute for usage data
    },
  );

  // CLIENT-SIDE COMPUTATION - This is the key cost optimization!
  const computedSummary = useMemo(() => {
    if (!usageData?.items || usageData.items.length === 0) {
      return {
        totalTokens: 0,
        totalCost: 0,
        totalChats: 0,
        activeChats: 0,
        deletedChats: 0,
        modelBreakdown: [],
        recentActivity: [],
      };
    }

    const items = usageData.items;

    // Compute totals from raw data
    const totalTokens = items.reduce(
      (sum, usage) => sum + usage.tokensIn + usage.tokensOut,
      0,
    );
    const totalCost = items.reduce((sum, usage) => sum + usage.cost, 0);

    // Compute unique chats
    const uniqueChats = new Set(items.map((u) => u.chatId).filter(Boolean));
    const activeChats = new Set(
      items.filter((u) => u.chatId).map((u) => u.chatId),
    );

    // Model breakdown computation
    const modelBreakdown = items.reduce(
      (acc, usage) => {
        const modelId = usage.modelId;
        if (!acc[modelId]) {
          acc[modelId] = {
            modelId,
            tokens: 0,
            cost: 0,
            messages: 0,
            displayName: modelId.replace(/^[^/]+\//, ''), // Remove provider prefix
          };
        }
        acc[modelId].tokens += usage.tokensIn + usage.tokensOut;
        acc[modelId].cost += usage.cost;
        acc[modelId].messages += 1;
        return acc;
      },
      {} as Record<string, any>,
    );

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentActivity = items.filter(
      (usage) => new Date(usage.createdAt) > sevenDaysAgo,
    );

    return {
      totalTokens,
      totalCost: totalCost / 100, // Convert cents to dollars
      totalChats: uniqueChats.size,
      activeChats: activeChats.size,
      deletedChats: uniqueChats.size - activeChats.size,
      modelBreakdown: Object.values(modelBreakdown).sort(
        (a: any, b: any) => b.cost - a.cost,
      ),
      recentActivity,
    };
  }, [usageData?.items]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {['tokens', 'cost', 'chats', 'active'].map((type) => (
            <Card key={type}>
              <CardContent className="p-6">
                <div className="h-8 bg-muted animate-pulse rounded mb-2" />
                <div className="h-4 bg-muted animate-pulse rounded w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive">Failed to load usage data</p>
        </CardContent>
      </Card>
    );
  }

  const { limits, warnings } = usageData || { limits: null, warnings: [] };
  const usagePercentage = limits ? (limits.used / limits.quota) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((warning) => (
            <div
              key={`${warning.type}-${warning.message}`}
              className="p-3 rounded-lg border border-orange-200 bg-orange-50 text-orange-800"
            >
              {warning.message}
            </div>
          ))}
        </div>
      )}

      {/* Usage Quota */}
      {limits && (
        <Card>
          <CardHeader>
            <CardTitle>Usage Quota</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Messages used</span>
                <span>
                  {limits.used} / {limits.quota}
                </span>
              </div>
              <Progress value={usagePercentage} className="w-full" />
            </div>
            <p className="text-sm text-muted-foreground">{limits.resetInfo}</p>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards - Client-side computed */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">
              {computedSummary.totalTokens.toLocaleString()}
            </div>
            <p className="text-muted-foreground">Total Tokens</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">
              ${computedSummary.totalCost.toFixed(4)}
            </div>
            <p className="text-muted-foreground">Total Cost</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">
              {computedSummary.totalChats}
            </div>
            <p className="text-muted-foreground">Total Chats</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">
              {computedSummary.activeChats}
            </div>
            <p className="text-muted-foreground">Active Chats</p>
          </CardContent>
        </Card>
      </div>

      {/* Model Breakdown - Client-side computed */}
      {computedSummary.modelBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Usage by Model</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {computedSummary.modelBreakdown.slice(0, 10).map((model: any) => (
                <div
                  key={model.modelId}
                  className="flex items-center justify-between"
                >
                  <div className="flex-1">
                    <p className="font-medium">{model.displayName}</p>
                    <p className="text-sm text-muted-foreground">
                      {model.tokens.toLocaleString()} tokens • {model.messages}{' '}
                      messages
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary">
                      ${(model.cost / 100).toFixed(4)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity Summary */}
      {computedSummary.recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Last 7 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-lg font-semibold">
                  {computedSummary.recentActivity.length}
                </div>
                <p className="text-sm text-muted-foreground">Messages</p>
              </div>
              <div>
                <div className="text-lg font-semibold">
                  {computedSummary.recentActivity
                    .reduce(
                      (sum, usage) => sum + usage.tokensIn + usage.tokensOut,
                      0,
                    )
                    .toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground">Tokens</p>
              </div>
              <div>
                <div className="text-lg font-semibold">
                  $
                  {(
                    computedSummary.recentActivity.reduce(
                      (sum, usage) => sum + usage.cost,
                      0,
                    ) / 100
                  ).toFixed(4)}
                </div>
                <p className="text-sm text-muted-foreground">Cost</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {(!usageData?.items || usageData.items.length === 0) && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">No Usage Data Yet</h3>
              <p className="text-muted-foreground">
                Start chatting to see your usage statistics here.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
