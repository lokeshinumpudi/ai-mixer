"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetcher } from "@/lib/utils";
import { ChevronLeft, ChevronRight, DollarSign, Zap } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";

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
    type: "daily" | "monthly";
    resetInfo: string;
  };
  currentUsage: {
    totalTokens: string;
    totalCost: number;
    totalChats: string;
    activeChats: string;
  };
  warnings: Array<{
    type: string;
    message: string;
    severity: string;
  }>;
}

export function UsageDashboard() {
  const [page, setPage] = useState(1);
  const limit = 10; // Simple pagination

  const {
    data: usageData,
    error,
    isLoading,
  } = useSWR<UsageData>(`/api/usage?page=${page}&limit=${limit}`, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 30000, // Refresh every 30 seconds
  });

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive">Failed to load usage data</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {["messages", "tokens", "cost", "chats"].map((type) => (
            <Card key={type}>
              <CardContent className="p-6">
                <div className="h-8 bg-muted animate-pulse rounded mb-2" />
                <div className="h-4 bg-muted animate-pulse rounded w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="h-64 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const { items, limits, currentUsage, warnings } = usageData || {
    items: [],
    limits: {
      quota: 50,
      used: 0,
      remaining: 50,
      type: "daily" as const,
      resetInfo: "",
    },
    currentUsage: {
      totalTokens: "0",
      totalCost: 0,
      totalChats: "0",
      activeChats: "0",
    },
    warnings: [],
  };

  const usagePercentage = Math.min(
    100,
    Math.round((limits.used / limits.quota) * 100)
  );

  return (
    <div className="space-y-6">
      {/* Usage Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-orange-500" />
              <div className="text-2xl font-bold">
                {Number(currentUsage.totalTokens).toLocaleString()}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Total Tokens</p>
            <p className="text-xs text-muted-foreground">Input + Output</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <DollarSign className="size-4 text-green-500" />
              <div className="text-2xl font-bold">
                ${(currentUsage.totalCost / 100).toFixed(4)}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Total Cost</p>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-orange-600">
              Usage Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      {/* Usage History Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Recent Usage</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm text-muted-foreground">Page {page}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={!usageData?.hasMore}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No usage data available
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 text-sm font-medium">Date</th>
                    <th className="text-left p-2 text-sm font-medium">Model</th>
                    <th className="text-right p-2 text-sm font-medium">
                      Tokens In
                    </th>
                    <th className="text-right p-2 text-sm font-medium">
                      Tokens Out
                    </th>
                    <th className="text-right p-2 text-sm font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 text-sm">
                        {new Date(item.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-2">
                        <Badge variant="secondary" className="text-xs">
                          {item.modelId.split("/")[1] || item.modelId}
                        </Badge>
                      </td>
                      <td className="p-2 text-sm text-right">
                        {item.tokensIn.toLocaleString()}
                      </td>
                      <td className="p-2 text-sm text-right">
                        {item.tokensOut.toLocaleString()}
                      </td>
                      <td className="p-2 text-sm text-right">
                        ${(item.cost / 100).toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
