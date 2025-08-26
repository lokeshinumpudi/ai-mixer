'use client';

import { startTransition, useMemo, useOptimistic, useState } from 'react';
import { saveChatModelAsCookie } from '@/app/(chat)/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useModels, isModelEnabled } from '@/hooks/use-models';
import type { Session } from 'next-auth';
import type { ChatModel } from '@/lib/ai/models';
import {
  SearchIcon,
  StarIcon,
  BrainIcon,
  CodeIcon,
  ImageIcon,
  SparklesIcon,
  CheckIcon,
  DiamondIcon,
} from './icons';

// Provider icons mapping
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

// Mock favorites - in real app this would come from user preferences
const mockFavorites = [
  'xai/grok-3-mini',
  'openai/gpt-4o-mini',
  'anthropic/claude-3.5-haiku',
];

interface ModelCardProps {
  model: ChatModel;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

function ModelCard({
  model,
  isSelected,
  isFavorite,
  onSelect,
  onToggleFavorite,
}: ModelCardProps) {
  const enabled = isModelEnabled(model);
  const providerIcon = getProviderIcon(model.provider);

  // Determine if model supports image analysis (vision capabilities)
  const supportsImageAnalysis =
    model.id.includes('vision') ||
    model.id.includes('gpt-4') ||
    model.id.includes('claude-3') ||
    model.id.includes('gemini') ||
    model.description.toLowerCase().includes('vision') ||
    model.description.toLowerCase().includes('image');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card
          data-testid={`model-selector-item-${model.id}`}
          className={cn(
            'relative cursor-pointer transition-all duration-200 hover:shadow-md',
            'border-2 hover:border-primary/20',
            isSelected && 'border-primary bg-primary/5',
            !enabled && 'opacity-60 cursor-not-allowed',
          )}
          onClick={enabled ? onSelect : undefined}
        >
          <CardContent className="p-4 h-28 flex flex-col">
            {/* Header with provider icon and favorite */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xl">{providerIcon}</span>
              <div className="flex items-center gap-2">
                {!enabled && (
                  <div className="text-amber-500">
                    <DiamondIcon size={14} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite();
                  }}
                  className={cn(
                    'p-1 hover:bg-accent rounded transition-colors',
                    isFavorite
                      ? 'text-amber-500'
                      : 'text-muted-foreground hover:text-amber-500',
                  )}
                >
                  <StarIcon size={12} />
                </button>
              </div>
            </div>

            {/* Model name - takes remaining space */}
            <div className="flex-1 flex items-start">
              <h3 className="font-medium text-sm line-clamp-2 leading-tight flex-1">
                {model.name}
              </h3>
              {isSelected && enabled && (
                <div className="text-primary ml-2 mt-0.5">
                  <CheckIcon size={16} />
                </div>
              )}
            </div>

            {/* Bottom capabilities and badges row */}
            <div className="flex items-center justify-between mt-auto pt-2">
              <div className="flex items-center gap-2">
                {supportsImageAnalysis && (
                  <div className="text-purple-500 bg-purple-500/10 rounded-md p-1.5">
                    <ImageIcon size={12} />
                  </div>
                )}
                {model.supportsReasoning && (
                  <div className="text-blue-500 bg-blue-500/10 rounded-md p-1.5">
                    <BrainIcon size={12} />
                  </div>
                )}
                {model.supportsArtifacts && (
                  <div className="text-green-500 bg-green-500/10 rounded-md p-1.5">
                    <CodeIcon size={12} />
                  </div>
                )}
              </div>

              <div className="flex gap-1.5">
                {model.id.includes('mini') && (
                  <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    Fast
                  </div>
                )}
                {model.id.includes('pro') && (
                  <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded flex items-center gap-1">
                    <SparklesIcon size={8} />
                    Pro
                  </div>
                )}
              </div>
            </div>

            {/* Premium overlay */}
            {!enabled && (
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-background/20 rounded-lg flex items-end justify-center pb-3">
                <Button size="sm" variant="default" className="text-xs h-7">
                  Upgrade
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-2">
          <div className="font-medium">{model.name}</div>
          <div className="text-xs text-muted-foreground">
            {model.description}
          </div>
          <div className="flex gap-2 text-xs">
            {model.supportsReasoning && (
              <div className="flex items-center gap-1 text-blue-500">
                <BrainIcon size={10} />
                <span>Reasoning</span>
              </div>
            )}
            {supportsImageAnalysis && (
              <div className="flex items-center gap-1 text-purple-500">
                <ImageIcon size={10} />
                <span>Image Analysis</span>
              </div>
            )}
            {model.supportsArtifacts && (
              <div className="flex items-center gap-1 text-green-500">
                <CodeIcon size={10} />
                <span>Artifacts</span>
              </div>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface ModelPickerProps {
  session: Session;
  selectedModelId: string;
  className?: string;
  compact?: boolean;
  disabled?: boolean;
}

export function ModelPicker({
  session,
  selectedModelId,
  className,
  compact = false,
  disabled = false,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>(mockFavorites);
  const [optimisticModelId, setOptimisticModelId] =
    useOptimistic(selectedModelId);

  const { models: allModels, isLoading, userType } = useModels();

  const selectedModel = useMemo(
    () => allModels.find((model) => model.id === optimisticModelId),
    [optimisticModelId, allModels],
  );

  // Filter models based on search
  const filteredModels = useMemo(() => {
    if (!searchQuery) return allModels;
    return allModels.filter(
      (model) =>
        model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.provider.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [allModels, searchQuery]);

  // Get top models (enabled models sorted by some priority)
  const topModels = useMemo(() => {
    return allModels.filter((model) => isModelEnabled(model)).slice(0, 6); // Top 6 enabled models
  }, [allModels]);

  // Separate favorites and others
  const favoriteModels = useMemo(
    () => filteredModels.filter((model) => favorites.includes(model.id)),
    [filteredModels, favorites],
  );

  const otherModels = useMemo(
    () => filteredModels.filter((model) => !favorites.includes(model.id)),
    [filteredModels, favorites],
  );

  // Compact view models: favorites + top models (unique)
  const compactModels = useMemo(() => {
    const uniqueIds = new Set([...favorites]);
    const compactList = [...favoriteModels];

    // Add top models that aren't already in favorites
    for (const model of topModels) {
      if (!uniqueIds.has(model.id)) {
        compactList.push(model);
        uniqueIds.add(model.id);
      }
    }

    return compactList.slice(0, 8); // Limit to 8 for compact view
  }, [favoriteModels, topModels, favorites]);

  const handleModelSelect = (modelId: string) => {
    setOpen(false);
    startTransition(() => {
      setOptimisticModelId(modelId);
      saveChatModelAsCookie(modelId);
    });
  };

  const toggleFavorite = (modelId: string) => {
    setFavorites((prev) =>
      prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId],
    );
  };

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            data-testid="model-selector"
            variant={compact ? 'ghost' : 'outline'}
            className={cn(
              compact
                ? 'rounded-md rounded-bl-lg p-[7px] h-fit dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200 text-xs max-w-[100px] flex items-center gap-1'
                : 'flex items-center gap-2 min-w-[180px] justify-between',
              className,
            )}
            disabled={disabled}
          >
            {compact ? (
              <>
                <span className="truncate text-xs">
                  {selectedModel?.name || 'Select Model'}
                </span>
                <SearchIcon size={12} />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span>
                    {getProviderIcon(selectedModel?.provider || 'openai')}
                  </span>
                  <span className="truncate">
                    {selectedModel?.name || 'Select Model'}
                  </span>
                </div>
                <SearchIcon size={16} />
              </>
            )}
          </Button>
        </DialogTrigger>

        <DialogContent
          className={cn(
            'overflow-hidden flex flex-col transition-all duration-300',
            isExpanded ? 'max-w-6xl max-h-[85vh]' : 'max-w-2xl max-h-[70vh]',
          )}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Choose a Model</span>
              {userType === 'guest' && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    Unlock all models + higher limits
                  </span>
                  <span className="text-2xl font-bold text-primary">$8</span>
                  <span className="text-muted-foreground">/month</span>
                  <Button size="sm" className="ml-2">
                    Upgrade now
                  </Button>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Search - only in expanded mode */}
          {isExpanded && (
            <div className="relative mb-4">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <SearchIcon size={16} />
              </div>
              <Input
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {!isExpanded ? (
              /* Compact View */
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">Quick Access</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsExpanded(true)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Show all
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {compactModels.map((model) => (
                    <ModelCard
                      key={model.id}
                      model={model}
                      isSelected={model.id === optimisticModelId}
                      isFavorite={favorites.includes(model.id)}
                      onSelect={() => handleModelSelect(model.id)}
                      onToggleFavorite={() => toggleFavorite(model.id)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              /* Expanded View */
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">All Models</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsExpanded(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Show less
                  </Button>
                </div>

                {/* Favorites Section */}
                {favoriteModels.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="text-amber-500">
                        <StarIcon size={16} />
                      </div>
                      <h3 className="font-medium">Favorites</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {favoriteModels.map((model) => (
                        <ModelCard
                          key={model.id}
                          model={model}
                          isSelected={model.id === optimisticModelId}
                          isFavorite={true}
                          onSelect={() => handleModelSelect(model.id)}
                          onToggleFavorite={() => toggleFavorite(model.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Others Section */}
                {otherModels.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-3">
                      {favoriteModels.length > 0 ? 'Others' : 'All Models'}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {otherModels.map((model) => (
                        <ModelCard
                          key={model.id}
                          model={model}
                          isSelected={model.id === optimisticModelId}
                          isFavorite={false}
                          onSelect={() => handleModelSelect(model.id)}
                          onToggleFavorite={() => toggleFavorite(model.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* No results */}
                {filteredModels.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="flex justify-center mb-2 opacity-50">
                      <SearchIcon size={32} />
                    </div>
                    <p>No models found matching "{searchQuery}"</p>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
