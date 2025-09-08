'use client';

import { useCallback, useEffect, useState } from 'react';

export interface StreamingCompareState {
  items: any[];
  isStreaming: boolean;
  add: (run: any) => void;
  update: (runId: string, updates: any) => void;
  clear: () => void;
}

export function useStreamingCompare(chatId: string): StreamingCompareState {
  const [items, setItems] = useState<any[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const add = useCallback((run: any) => {
    setIsStreaming(true);
    setItems((prev) => [...prev, run]);
  }, []);

  const update = useCallback((runId: string, updates: any) => {
    setItems((prev) =>
      prev.map((r) => (r.id === runId ? { ...r, ...updates } : r)),
    );
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setIsStreaming(false);
  }, []);

  // Auto-clear streaming flag a few seconds after last update
  useEffect(() => {
    if (!isStreaming) return;
    const t = setTimeout(() => setIsStreaming(false), 3000);
    return () => clearTimeout(t);
  }, [items.length, isStreaming]);

  return { items, isStreaming, add, update, clear };
}
