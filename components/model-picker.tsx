"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAnimeOnMount } from "@/hooks/use-anime";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { LoginCTA } from "@/components/login-cta";
import {
  MobileFriendlyTooltip,
  MobileFriendlyTooltipProvider,
} from "@/components/ui/mobile-friendly-tooltip";
import { isModelEnabled, useModels } from "@/hooks/use-models";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import type { ChatModel } from "@/lib/ai/models";
import { getDefaultModelForUser } from "@/lib/ai/models";
import { COMPARE_MAX_MODELS } from "@/lib/constants";
import type { AppUser } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import {
  BrainIcon,
  CheckIcon,
  CodeIcon,
  DiamondIcon,
  ImageIcon,
  SearchIcon,
  SparklesIcon,
  StarIcon,
} from "./icons";

// Provider icons mapping
const getProviderIcon = (provider: string) => {
  switch (provider.toLowerCase()) {
    case "xai":
      return "✨";
    case "openai":
      return "🤖";
    case "anthropic":
      return "🧠";
    case "google":
      return "🔍";
    case "meta":
      return "📘";
    case "mistral":
      return "🌪️";
    case "amazon":
      return "📦";
    default:
      return "🤖";
  }
};

// Mock favorites - in real app this would come from user preferences
const mockFavorites = ["openai/gpt-4o-mini", "anthropic/claude-3.5-haiku"];

// localStorage utilities for model selection persistence
const MODEL_SELECTION_KEY = "user-model-selection";

const safeLocalStorage = {
  get: (key: string): any => {
    try {
      if (typeof window === "undefined") return null;
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.warn(`Failed to read from localStorage: ${key}`, error);
      return null;
    }
  },
  set: (key: string, value: any): void => {
    try {
      if (typeof window === "undefined") return;
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Failed to write to localStorage: ${key}`, error);
    }
  },
  remove: (key: string): void => {
    try {
      if (typeof window === "undefined") return;
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove from localStorage: ${key}`, error);
    }
  },
};

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
  const router = useRouter();
  const enabled = isModelEnabled(model);
  const providerIcon = getProviderIcon(model.provider);

  // Determine if model supports image analysis (vision capabilities)
  const supportsImageAnalysis =
    model.description.toLowerCase().includes("vision") ||
    model.description.toLowerCase().includes("image");

  return (
    <MobileFriendlyTooltip
      content={`${model.name} - ${model.description}${
        model.supportsVision ? " • Vision" : ""
      }${model.supportsReasoning ? " • Reasoning" : ""}${
        model.supportsArtifacts ? " • Code Generation" : ""
      }`}
      side="top"
      showIcon={false}
    >
      <Card
        data-testid={`model-selector-item-${model.id}`}
        className={cn(
          "relative transition-all duration-200 h-full",
          "cursor-pointer hover:shadow-md",
          "border-2",
          isSelected && enabled && "border-primary bg-primary/5 shadow-md",
          !enabled &&
            "border-dashed border-muted-foreground/30 bg-muted/30 opacity-75 hover:opacity-90",
          enabled &&
            !isSelected &&
            "border-border hover:border-primary/30 hover:shadow-sm"
        )}
        onClick={
          enabled
            ? onSelect
            : () => {
                const paymentUrl =
                  process.env.NEXT_PUBLIC_RAZORPAY_PAYMENT_PAGE_URL || "";
                if (paymentUrl) {
                  window.open(paymentUrl, "_blank");
                } else {
                  console.error(
                    "Payment URL not configured. Set NEXT_PUBLIC_RAZORPAY_PAYMENT_PAGE_URL."
                  );
                  router.push("/settings");
                }
              }
        }
      >
        <CardContent className="p-4 flex flex-col h-32">
          {/* Header with provider icon and favorite */}
          <div className="flex items-center justify-between mb-2">
            <span
              className={cn(
                "text-lg transition-opacity",
                !enabled && "opacity-60"
              )}
            >
              {providerIcon}
            </span>
            <div className="flex items-center gap-1">
              {!enabled && (
                <div className="text-amber-600 dark:text-amber-500">
                  <DiamondIcon size={12} />
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (enabled) onToggleFavorite();
                }}
                disabled={!enabled}
                className={cn(
                  "p-1 rounded transition-colors",
                  enabled && "hover:bg-accent",
                  isFavorite && enabled
                    ? "text-amber-500"
                    : enabled
                    ? "text-muted-foreground hover:text-amber-500"
                    : "text-muted-foreground/40 cursor-not-allowed"
                )}
              >
                <StarIcon size={12} />
              </button>
            </div>
          </div>

          {/* Model name - takes remaining space */}
          <div className="flex-1 flex items-start min-h-0">
            <h3
              className={cn(
                "font-medium text-sm leading-tight flex-1 line-clamp-2",
                enabled ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {model.name}
            </h3>
            {isSelected && enabled && (
              <div className="text-primary ml-2 shrink-0">
                <CheckIcon size={16} />
              </div>
            )}
          </div>

          {/* Bottom capabilities and badges row */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
            <div className="flex items-center gap-1.5">
              {supportsImageAnalysis && enabled && (
                <div className="text-purple-600 bg-purple-100 dark:bg-purple-500/20 dark:text-purple-400 rounded p-1">
                  <ImageIcon size={10} />
                </div>
              )}
              {model.supportsReasoning && enabled && (
                <div className="text-blue-600 bg-blue-100 dark:bg-blue-500/20 dark:text-blue-400 rounded p-1">
                  <BrainIcon size={10} />
                </div>
              )}
              {model.supportsArtifacts && enabled && (
                <div className="text-green-600 bg-green-100 dark:bg-green-500/20 dark:text-green-400 rounded p-1">
                  <CodeIcon size={10} />
                </div>
              )}
            </div>

            <div className="flex gap-1">
              {!enabled && (
                <div className="text-xs bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <DiamondIcon size={8} />
                  <span className="font-medium">Pro</span>
                </div>
              )}
              {model.id.includes("mini") && enabled && (
                <div className="text-xs text-muted-foreground bg-muted/80 px-2 py-0.5 rounded font-medium">
                  Fast
                </div>
              )}
              {model.id.includes("pro") && enabled && (
                <div className="text-xs text-muted-foreground bg-muted/80 px-2 py-0.5 rounded flex items-center gap-1">
                  <SparklesIcon size={8} />
                  <span className="font-medium">Pro</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </MobileFriendlyTooltip>
  );
}

interface ModelPickerProps {
  user?: AppUser | null;
  selectedModelId: string;
  className?: string;
  compact?: boolean;
  disabled?: boolean;
  selectedModelIds?: string[];
  onSelectedModelIdsChange?: (modelIds: string[]) => void;
}

export function ModelPicker({
  user,
  selectedModelId,
  className,
  compact = false,
  disabled = false,
  selectedModelIds = [],
  onSelectedModelIdsChange,
}: ModelPickerProps) {
  const router = useRouter();
  const { user: authUser } = useSupabaseAuth();
  const [open, setOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    fast: false,
    vision: false,
    reasoning: false,
    image: false,
    tools: false,
    pdf: false,
  });
  const [favorites, setFavorites] = useState<string[]>(mockFavorites);

  // Use models API which now includes user settings
  const {
    models: allModels,
    userSettings,
    userType,
    defaultModel,
    compareModels,
    mode,
    mutate: mutateModels,
  } = useModels();

  // Extract the selected model from user settings
  const serverModel = defaultModel;

  // Get localStorage model as immediate fallback
  const [localModel, setLocalModel] = useState<string | null>(() =>
    safeLocalStorage.get(MODEL_SELECTION_KEY)
  );

  // Get plan-based default model as ultimate fallback
  const planBasedDefaultModel = useMemo(() => {
    // Prefer userType from /api/models (falls back to "free" in hook)
    return getDefaultModelForUser(userType);
  }, [userType]);

  // Sync localStorage with server when server data arrives
  useEffect(() => {
    if (serverModel && serverModel !== localModel) {
      setLocalModel(serverModel);
      safeLocalStorage.set(MODEL_SELECTION_KEY, serverModel);
    }
  }, [serverModel, localModel]);

  // Determine the effective model to use for single mode:
  // 1. Props selectedModelId (if provided) - for backward compatibility
  // 2. Server settings model (authoritative once loaded)
  // 3. localStorage model (immediate persistence when server not available)
  // 4. Plan-based default
  const effectiveModelId = useMemo(() => {
    // If selectedModelId prop is provided, use it (for backward compatibility)
    if (selectedModelId) {
      const modelExists = allModels.some(
        (model) => model.id === selectedModelId
      );
      if (modelExists) return selectedModelId;
    }

    // Use server model first (authoritative)
    if (serverModel) {
      const modelExists = allModels.some((model) => model.id === serverModel);
      if (modelExists) return serverModel;
    }

    // Use localStorage model for immediate response (when server not loaded yet)
    if (localModel) {
      const modelExists = allModels.some((model) => model.id === localModel);
      if (modelExists) return localModel;
    }

    // Ultimate fallback to plan-based default
    return planBasedDefaultModel;
  }, [
    selectedModelId,
    serverModel, // Server model takes priority now
    localModel,
    allModels,
    planBasedDefaultModel,
  ]);

  // Determine the effective compare models to use:
  // 1. Props selectedModelIds (if provided) - for backward compatibility
  // 2. Server settings compare models (authoritative once loaded)
  // 3. Empty array as fallback
  const effectiveCompareModelIds = useMemo(() => {
    // If selectedModelIds prop is provided, use it (for backward compatibility)
    if (selectedModelIds && selectedModelIds.length > 0) {
      return selectedModelIds.filter((modelId) =>
        allModels.some((model) => model.id === modelId)
      );
    }

    // Use server compare models (authoritative)
    if (compareModels && compareModels.length > 0) {
      return compareModels.filter((modelId) =>
        allModels.some((model) => model.id === modelId)
      );
    }

    // Fallback to empty array
    return [];
  }, [selectedModelIds, compareModels, allModels]);

  const selectedModel = useMemo(
    () => allModels.find((model) => model.id === effectiveModelId),
    [effectiveModelId, allModels]
  );

  // Filter models based on search
  const filteredModels = useMemo(() => {
    let list = allModels;
    if (searchQuery) {
      list = list.filter(
        (model) =>
          model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          model.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          model.provider.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Capability filters
    if (filters.fast)
      list = list.filter(
        (m) =>
          m.id.includes("mini") ||
          m.id.includes("flash") ||
          m.id.includes("fast")
      );
    if (filters.vision) list = list.filter((m) => m.supportsVision);
    if (filters.reasoning) list = list.filter((m) => m.supportsReasoning);
    if (filters.image) list = list.filter((m) => m.supportsImageGeneration);
    if (filters.tools) list = list.filter((m) => m.supportsToolCalling);
    if (filters.pdf) list = list.filter((m) => m.supportsPdf);

    return list;
  }, [allModels, searchQuery, filters]);

  // Get top models (enabled models sorted by some priority)
  const topModels = useMemo(() => {
    return allModels.filter((model) => isModelEnabled(model)).slice(0, 6); // Top 6 enabled models
  }, [allModels]);

  // Separate favorites and others
  const favoriteModels = useMemo(
    () => filteredModels.filter((model) => favorites.includes(model.id)),
    [filteredModels, favorites]
  );

  const otherModels = useMemo(
    () => filteredModels.filter((model) => !favorites.includes(model.id)),
    [filteredModels, favorites]
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

  const handleModelSelect = async (modelId: string) => {
    if (onSelectedModelIdsChange) {
      // Handle multi-selection for compare mode
      const currentlySelected = selectedModelIds.includes(modelId);
      let newSelection: string[];

      if (currentlySelected) {
        // Prevent deselection if it would result in empty selection
        if (selectedModelIds.length === 1) {
          return; // Ignore the operation - no computation needed
        }
        // Remove model from selection
        newSelection = selectedModelIds.filter((id) => id !== modelId);
      } else {
        // Add model to selection (up to max limit)
        if (selectedModelIds.length < COMPARE_MAX_MODELS) {
          newSelection = [...selectedModelIds, modelId];
        } else {
          // Replace the last model if at limit
          newSelection = [...selectedModelIds.slice(0, -1), modelId];
        }
      }

      onSelectedModelIdsChange(newSelection);

      // Save compare models to settings if user is authenticated
      if (user && !user.is_anonymous && newSelection.length > 0) {
        try {
          const response = await fetch("/api/user/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              compareModels: newSelection,
              mode: "compare",
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to update settings");
          }

          // Refresh models data to get updated user settings from server
          await mutateModels();
        } catch (error) {
          console.error("Failed to save compare models to server:", error);
        }
      }

      return; // Don't close dialog in compare mode
    }

    // Regular single-model selection
    setOpen(false);

    // Immediate localStorage update for instant UI feedback
    setLocalModel(modelId);
    safeLocalStorage.set(MODEL_SELECTION_KEY, modelId);

    try {
      // Guests: don't call settings API
      if (!user || user.is_anonymous) {
        await mutateModels();
        return;
      }
      // Update user settings via PATCH API
      const response = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultModel: modelId,
          mode: "single",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update settings");
      }

      // Refresh models data to get updated user settings from server
      await mutateModels();
    } catch (error) {
      console.error("Failed to save model selection to server:", error);
      // Note: localStorage was already updated for immediate feedback
      // Server sync will happen on next page load or when API recovers
    }
  };

  const toggleFavorite = (modelId: string) => {
    setFavorites((prev) =>
      prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId]
    );
  };

  // Determine anonymous status using live auth state first, falling back to props/models
  const isAnonymousUser = Boolean(
    authUser?.is_anonymous ?? user?.is_anonymous ?? false
  );

  return (
    <MobileFriendlyTooltipProvider>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            data-testid="model-selector"
            variant={compact ? "ghost" : "outline"}
            className={cn(
              compact
                ? "rounded-md rounded-bl-lg p-[7px] h-fit dark:border-zinc-700 hover:dark:bg-zinc-900 hover:bg-zinc-200 text-xs max-w-[100px] flex items-center gap-1"
                : "flex items-center gap-2 min-w-[180px] justify-between",
              className
            )}
            disabled={disabled}
          >
            {compact ? (
              <>
                <span className="truncate text-xs">
                  {effectiveCompareModelIds.length > 0
                    ? `${effectiveCompareModelIds.length} models`
                    : selectedModel?.name || "Select Model"}
                </span>
                <SearchIcon size={12} />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span>
                    {getProviderIcon(selectedModel?.provider || "openai")}
                  </span>
                  <span className="truncate">
                    {selectedModel?.name || "Select Model"}
                  </span>
                </div>
                <SearchIcon size={16} />
              </>
            )}
          </Button>
        </DialogTrigger>

        <DialogContent
          className={cn(
            "flex flex-col transition-all duration-300",
            isExpanded ? "max-w-6xl max-h-[90vh]" : "max-w-md max-h-[70vh]"
          )}
          ref={useAnimeOnMount({
            opacity: [0, 1],
            translateY: [12, 0],
            scale: [0.98, 1],
            duration: 220,
            ease: "outQuad",
          })}
        >
          <DialogHeader className="space-y-3">
            <DialogTitle>
              <span>Select Models to Compare</span>
            </DialogTitle>

            <div className="text-sm text-muted-foreground">
              Select up to {COMPARE_MAX_MODELS} models to compare responses
              side-by-side.
              {effectiveCompareModelIds.length > 0 && (
                <span className="ml-1 font-medium text-primary">
                  ({effectiveCompareModelIds.length} selected)
                </span>
              )}
            </div>
            {userType === "free" && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 p-3 rounded-lg border border-amber-200/50 dark:border-amber-800/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Unlock all models + higher limits
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-lg font-bold text-primary">
                        ₹249
                      </span>
                      <span className="text-xs text-muted-foreground">
                        /month
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 text-xs h-7"
                    onClick={() => {
                      setOpen(false);
                      const paymentUrl =
                        process.env.NEXT_PUBLIC_RAZORPAY_PAYMENT_PAGE_URL || "";
                      if (paymentUrl) {
                        window.open(paymentUrl, "_blank");
                      } else {
                        console.error(
                          "Payment URL not configured. Set NEXT_PUBLIC_RAZORPAY_PAYMENT_PAGE_URL."
                        );
                        router.push("/settings");
                      }
                    }}
                  >
                    Upgrade now
                  </Button>
                </div>
              </div>
            )}
          </DialogHeader>

          {/* Guest CTA - only show for anonymous users */}
          {isAnonymousUser && (
            <div className="mb-3">
              <div className="text-xs text-muted-foreground mb-1">
                Sign in to save chats and unlock more models.
              </div>
              <LoginCTA />
            </div>
          )}

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
              {/* Capability filters */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <MobileFriendlyTooltip
                  content="Show models optimized for speed and quick responses"
                  side="bottom"
                  showIcon={false}
                >
                  <Button
                    type="button"
                    variant={filters.fast ? "default" : "outline"}
                    className="h-8 text-xs"
                    onClick={() => setFilters((f) => ({ ...f, fast: !f.fast }))}
                  >
                    Fast
                  </Button>
                </MobileFriendlyTooltip>
                <MobileFriendlyTooltip
                  content="Show models that can analyze and understand images"
                  side="bottom"
                  showIcon={false}
                >
                  <Button
                    type="button"
                    variant={filters.vision ? "default" : "outline"}
                    className="h-8 text-xs"
                    onClick={() =>
                      setFilters((f) => ({ ...f, vision: !f.vision }))
                    }
                  >
                    Vision
                  </Button>
                </MobileFriendlyTooltip>
                <MobileFriendlyTooltip
                  content="Show models with advanced reasoning and thinking capabilities"
                  side="bottom"
                  showIcon={false}
                >
                  <Button
                    type="button"
                    variant={filters.reasoning ? "default" : "outline"}
                    className="h-8 text-xs"
                    onClick={() =>
                      setFilters((f) => ({ ...f, reasoning: !f.reasoning }))
                    }
                  >
                    Reasoning
                  </Button>
                </MobileFriendlyTooltip>
                <MobileFriendlyTooltip
                  content="Show models that can generate and create images"
                  side="bottom"
                  showIcon={false}
                >
                  <Button
                    type="button"
                    variant={filters.image ? "default" : "outline"}
                    className="h-8 text-xs"
                    onClick={() =>
                      setFilters((f) => ({ ...f, image: !f.image }))
                    }
                  >
                    Image Gen
                  </Button>
                </MobileFriendlyTooltip>
                <MobileFriendlyTooltip
                  content="Show models that can use external tools and functions"
                  side="bottom"
                  showIcon={false}
                >
                  <Button
                    type="button"
                    variant={filters.tools ? "default" : "outline"}
                    className="h-8 text-xs"
                    onClick={() =>
                      setFilters((f) => ({ ...f, tools: !f.tools }))
                    }
                  >
                    Tool Calling
                  </Button>
                </MobileFriendlyTooltip>
                <MobileFriendlyTooltip
                  content="Show models that can read and analyze PDF documents"
                  side="bottom"
                  showIcon={false}
                >
                  <Button
                    type="button"
                    variant={filters.pdf ? "default" : "outline"}
                    className="h-8 text-xs"
                    onClick={() => setFilters((f) => ({ ...f, pdf: !f.pdf }))}
                  >
                    PDF
                  </Button>
                </MobileFriendlyTooltip>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-1 -mx-1">
            {!isExpanded ? (
              /* Minimal Vertical List View */
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">Choose Model</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsExpanded(true)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <span>Show all</span>
                    <svg
                      className="size-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {filteredModels.slice(0, 8).map((model) => {
                    const enabled =
                      isModelEnabled(model) &&
                      allModels.some((m) => m.id === model.id);
                    const isSelected = effectiveCompareModelIds.includes(
                      model.id
                    );
                    const providerIcon = getProviderIcon(model.provider);

                    // Determine capabilities
                    const supportsImageAnalysis =
                      model.id.includes("vision") ||
                      model.description.toLowerCase().includes("vision") ||
                      model.description.toLowerCase().includes("image");

                    return (
                      <button
                        type="button"
                        key={model.id}
                        onClick={
                          enabled
                            ? () => handleModelSelect(model.id)
                            : () => {
                                const paymentUrl =
                                  process.env
                                    .NEXT_PUBLIC_RAZORPAY_PAYMENT_PAGE_URL ||
                                  "";
                                if (paymentUrl) {
                                  window.open(paymentUrl, "_blank");
                                } else {
                                  console.error(
                                    "Payment URL not configured. Set NEXT_PUBLIC_RAZORPAY_PAYMENT_PAGE_URL."
                                  );
                                  router.push("/settings");
                                }
                              }
                        }
                        className={cn(
                          "flex items-center gap-2.5 p-2.5 rounded-lg border-2 transition-all duration-200 cursor-pointer w-full text-left",
                          isSelected &&
                            enabled &&
                            "border-primary bg-primary/5 shadow-sm",
                          !enabled &&
                            "border-dashed border-muted-foreground/30 opacity-75 hover:opacity-90",
                          enabled &&
                            !isSelected &&
                            "border-border hover:border-primary/30 hover:bg-muted/50"
                        )}
                      >
                        {/* Provider Icon */}
                        <span
                          className={cn("text-base", !enabled && "opacity-60")}
                        >
                          {providerIcon}
                        </span>

                        {/* Model Name */}
                        <div className="flex-1 min-w-0">
                          <h4
                            className={cn(
                              "font-medium text-sm truncate",
                              enabled
                                ? "text-foreground"
                                : "text-muted-foreground"
                            )}
                          >
                            {model.name}
                          </h4>
                          {/* {model.description && (
                            <p
                              className={cn(
                                "text-xs truncate mt-0.5",
                                enabled
                                  ? "text-muted-foreground"
                                  : "text-muted-foreground/70"
                              )}
                            >
                              {model.description}
                            </p>
                          )} */}
                        </div>

                        {/* Capability Icons */}
                        <div className="flex items-center gap-1">
                          {supportsImageAnalysis && enabled && (
                            <MobileFriendlyTooltip
                              content="This model can analyze and understand images"
                              side="top"
                              showIcon={false}
                            >
                              <div className="text-purple-600 bg-purple-100 dark:bg-purple-500/20 dark:text-purple-400 rounded p-0.5">
                                <ImageIcon size={10} />
                              </div>
                            </MobileFriendlyTooltip>
                          )}
                          {model.supportsReasoning && enabled && (
                            <MobileFriendlyTooltip
                              content="This model has advanced reasoning and thinking capabilities"
                              side="top"
                              showIcon={false}
                            >
                              <div className="text-blue-600 bg-blue-100 dark:bg-blue-500/20 dark:text-blue-400 rounded p-0.5">
                                <BrainIcon size={10} />
                              </div>
                            </MobileFriendlyTooltip>
                          )}
                          {model.supportsArtifacts && enabled && (
                            <MobileFriendlyTooltip
                              content="This model can generate code and create artifacts"
                              side="top"
                              showIcon={false}
                            >
                              <div className="text-green-600 bg-green-100 dark:bg-green-500/20 dark:text-green-400 rounded p-0.5">
                                <CodeIcon size={10} />
                              </div>
                            </MobileFriendlyTooltip>
                          )}
                          {model.id.includes("mini") && enabled && (
                            <div className="text-xs text-muted-foreground bg-muted/80 px-2 py-0.5 rounded font-medium">
                              Fast
                            </div>
                          )}
                          {!enabled && (
                            <div className="text-xs bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <DiamondIcon size={7} />
                              <span className="font-medium">Pro</span>
                            </div>
                          )}
                        </div>

                        {/* Selected Indicator */}
                        {isSelected && enabled && (
                          <div className="text-primary">
                            <CheckIcon size={14} />
                          </div>
                        )}
                      </button>
                    );
                  })}

                  {filteredModels.length > 8 && (
                    <Button
                      variant="ghost"
                      onClick={() => setIsExpanded(true)}
                      className="w-full text-sm text-muted-foreground hover:text-foreground mt-3"
                    >
                      View {filteredModels.length - 8} more models...
                    </Button>
                  )}
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
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <span>Show less</span>
                    <svg
                      className="size-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {favoriteModels.map((model) => (
                        <ModelCard
                          key={model.id}
                          model={model}
                          isSelected={effectiveCompareModelIds.includes(
                            model.id
                          )}
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
                      {favoriteModels.length > 0 ? "Others" : "All Models"}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {otherModels.map((model) => (
                        <ModelCard
                          key={model.id}
                          model={model}
                          isSelected={effectiveCompareModelIds.includes(
                            model.id
                          )}
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
    </MobileFriendlyTooltipProvider>
  );
}
