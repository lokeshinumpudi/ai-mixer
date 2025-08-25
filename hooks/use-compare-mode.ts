'use client';

import { useState, useCallback } from 'react';
import type { ChatModel } from '@/lib/ai/models';

export interface CompareMode {
  isActive: boolean;
  selectedModels: ChatModel[];
}

export function useCompareMode() {
  const [compareMode, setCompareMode] = useState<CompareMode>({
    isActive: false,
    selectedModels: [],
  });

  const activateCompareMode = useCallback((models: ChatModel[]) => {
    setCompareMode({
      isActive: true,
      selectedModels: models,
    });
  }, []);

  const deactivateCompareMode = useCallback(() => {
    setCompareMode({
      isActive: false,
      selectedModels: [],
    });
  }, []);

  const toggleModelSelection = useCallback((model: ChatModel) => {
    setCompareMode((prev) => {
      const isSelected = prev.selectedModels.some((m) => m.id === model.id);

      if (isSelected) {
        // Remove the model
        const newSelectedModels = prev.selectedModels.filter(
          (m) => m.id !== model.id,
        );
        return {
          ...prev,
          selectedModels: newSelectedModels,
        };
      } else {
        // Add the model
        return {
          ...prev,
          selectedModels: [...prev.selectedModels, model],
        };
      }
    });
  }, []);

  const isModelSelected = useCallback(
    (modelId: string) => {
      return compareMode.selectedModels.some((model) => model.id === modelId);
    },
    [compareMode.selectedModels],
  );

  return {
    compareMode,
    activateCompareMode,
    deactivateCompareMode,
    toggleModelSelection,
    isModelSelected,
  };
}
