'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { isModelEnabled, useModels } from '@/hooks/use-models';
import type { ChatModel } from '@/lib/ai/models';
import { COMPARE_MAX_MODELS, COMPARE_PRESETS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { CheckIcon, Plus, SearchIcon, X } from 'lucide-react';
import { useMemo, useState } from 'react';

interface ModelMultiSelectProps {
  selectedModelIds: string[];
  onSelectionChange: (modelIds: string[]) => void;
  className?: string;
  disabled?: boolean;
}

// Provider icons mapping (reused from model-picker)
const getProviderIcon = (provider: string) => {
  switch (provider.toLowerCase()) {
    case 'xai':
      return '✨';
    case 'openai':
      return '🤖';
    case 'anthropic':
      return '🧠';
    case 'google':
      return '🔍';
    case 'meta':
      return '📘';
    case 'mistral':
      return '🌪️';
    case 'amazon':
      return '📦';
    default:
      return '🤖';
  }
};

function getModelDisplayName(model: ChatModel): string {
  // Extract the model name from the provider/model format
  const parts = model.id.split('/');
  if (parts.length === 2) {
    const [provider, modelName] = parts;
    const capitalizedProvider =
      provider.charAt(0).toUpperCase() + provider.slice(1);
    return `${capitalizedProvider} ${modelName}`;
  }
  return model.name;
}

interface ModelChipProps {
  modelId: string;
  model?: ChatModel;
  onRemove: () => void;
}

function ModelChip({ modelId, model, onRemove }: ModelChipProps) {
  const displayName = model ? getModelDisplayName(model) : modelId;
  const providerIcon = model ? getProviderIcon(model.provider) : '🤖';

  return (
    <Badge
      variant="secondary"
      className="flex items-center gap-2 px-3 py-1 text-sm"
    >
      <span className="text-base">{providerIcon}</span>
      <span>{displayName}</span>

      <Button
        onClick={onRemove}
        className="ml-1 text-gray-500 hover:text-gray-700"
      >
        <X className="size-3" />
      </Button>
    </Badge>
  );
}

interface ModelSelectCardProps {
  model: ChatModel;
  isSelected: boolean;
  onToggle: () => void;
}

function ModelSelectCard({
  model,
  isSelected,
  onToggle,
}: ModelSelectCardProps) {
  const enabled = isModelEnabled(model);
  const providerIcon = getProviderIcon(model.provider);
  const displayName = getModelDisplayName(model);

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 border-2',
        'hover:shadow-md',
        isSelected && enabled && 'border-primary bg-primary/5 shadow-md',
        !enabled &&
          'border-dashed border-muted-foreground/30 bg-muted/30 opacity-75',
        enabled && !isSelected && 'border-border hover:border-primary/30',
        !enabled && 'cursor-not-allowed',
      )}
      onClick={enabled ? onToggle : undefined}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-lg">{providerIcon}</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{displayName}</div>
              <div className="text-xs text-gray-500 truncate">
                {model.description}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Capability badges */}
            <div className="flex items-center gap-1">
              {model.supportsReasoning && enabled && (
                <Badge variant="outline" className="text-xs px-1 py-0">
                  Reasoning
                </Badge>
              )}
              {model.supportsVision && enabled && (
                <Badge variant="outline" className="text-xs px-1 py-0">
                  Vision
                </Badge>
              )}
            </div>

            {!enabled && (
              <Badge variant="outline" className="text-xs text-amber-600">
                Pro
              </Badge>
            )}

            {isSelected && enabled && (
              <div className="text-primary">
                <CheckIcon className="size-4" />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ModelMultiSelect({
  selectedModelIds,
  onSelectionChange,
  className,
  disabled = false,
}: ModelMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { models: allModels } = useModels();

  // Get selected models
  const selectedModels = useMemo(() => {
    return selectedModelIds
      .map((id) => allModels.find((model) => model.id === id))
      .filter(Boolean) as ChatModel[];
  }, [selectedModelIds, allModels]);

  // Filter models based on search
  const filteredModels = useMemo(() => {
    let list = allModels.filter(isModelEnabled); // Only show enabled models for compare

    if (searchQuery) {
      list = list.filter(
        (model) =>
          model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          model.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          model.provider.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    return list;
  }, [allModels, searchQuery]);

  const handleModelToggle = (modelId: string) => {
    if (selectedModelIds.includes(modelId)) {
      // Remove model
      onSelectionChange(selectedModelIds.filter((id) => id !== modelId));
    } else {
      // Add model (if not at limit)
      if (selectedModelIds.length < COMPARE_MAX_MODELS) {
        onSelectionChange([...selectedModelIds, modelId]);
      }
    }
  };

  const handlePresetSelect = (presetName: string) => {
    const presetModelIds =
      COMPARE_PRESETS[presetName as keyof typeof COMPARE_PRESETS];
    if (presetModelIds) {
      // Filter to only include models that exist and are enabled
      const validModelIds = presetModelIds.filter((id) =>
        allModels.some((model) => model.id === id && isModelEnabled(model)),
      );
      onSelectionChange(validModelIds.slice(0, COMPARE_MAX_MODELS));
    }
  };

  const handleRemoveModel = (modelId: string) => {
    onSelectionChange(selectedModelIds.filter((id) => id !== modelId));
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* Selected models chips */}
      {selectedModelIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedModelIds.map((modelId) => {
            const model = allModels.find((m) => m.id === modelId);
            return (
              <ModelChip
                key={modelId}
                modelId={modelId}
                model={model}
                onRemove={() => handleRemoveModel(modelId)}
              />
            );
          })}
        </div>
      )}

      {/* Add models button */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="gap-2"
            disabled={disabled || selectedModelIds.length >= COMPARE_MAX_MODELS}
          >
            <Plus className="size-4" />
            {selectedModelIds.length === 0
              ? 'Select models to compare'
              : `Add model (${selectedModelIds.length}/${COMPARE_MAX_MODELS})`}
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Select Models to Compare</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Presets */}
            <div>
              <h3 className="text-sm font-medium mb-2">Quick Presets</h3>
              <div className="flex flex-wrap gap-2">
                {Object.keys(COMPARE_PRESETS).map((presetName) => (
                  <Button
                    key={presetName}
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetSelect(presetName)}
                    className="text-xs"
                  >
                    {presetName}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Model selection */}
            <div className="flex-1 overflow-y-auto max-h-96">
              <div className="space-y-2">
                {filteredModels.map((model) => (
                  <ModelSelectCard
                    key={model.id}
                    model={model}
                    isSelected={selectedModelIds.includes(model.id)}
                    onToggle={() => handleModelToggle(model.id)}
                  />
                ))}
              </div>

              {filteredModels.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  No models found matching your search.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-gray-500">
                {selectedModelIds.length}/{COMPARE_MAX_MODELS} models selected
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => onSelectionChange([])}
                  disabled={selectedModelIds.length === 0}
                >
                  Clear All
                </Button>
                <Button onClick={() => setOpen(false)}>Done</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
