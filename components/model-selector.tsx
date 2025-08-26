'use client';

import { startTransition, useMemo, useOptimistic, useState } from 'react';

import { saveChatModelAsCookie } from '@/app/(chat)/actions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { cn } from '@/lib/utils';

import { CheckCircleFillIcon, ChevronDownIcon } from './icons';
import { useModels, isModelEnabled } from '@/hooks/use-models';
import type { Session } from 'next-auth';

export function ModelSelector({
  session,
  selectedModelId,
  className,
}: {
  session: Session;
  selectedModelId: string;
} & React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);
  const [optimisticModelId, setOptimisticModelId] =
    useOptimistic(selectedModelId);

  const { models: allModels, isLoading } = useModels();

  const selectedChatModel = useMemo(
    () => allModels.find((chatModel) => chatModel.id === optimisticModelId),
    [optimisticModelId, allModels],
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        asChild
        className={cn(
          'w-fit data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
          className,
        )}
      >
        <Button
          data-testid="model-selector"
          variant="outline"
          className="md:px-2 md:h-[34px]"
        >
          {selectedChatModel?.name}
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[300px]">
        {allModels.map((chatModel) => {
          const { id } = chatModel;
          const enabled = isModelEnabled(chatModel);

          return (
            <DropdownMenuItem
              data-testid={`model-selector-item-${id}`}
              key={id}
              onSelect={() => {
                if (!enabled) return; // Prevent selection of disabled models

                setOpen(false);

                startTransition(() => {
                  setOptimisticModelId(id);
                  saveChatModelAsCookie(id);
                });
              }}
              data-active={id === optimisticModelId}
              disabled={!enabled}
              asChild
            >
              <button
                type="button"
                className={cn(
                  'gap-4 group/item flex flex-row justify-between items-center w-full',
                  !enabled && 'opacity-50 cursor-not-allowed',
                )}
                disabled={!enabled}
              >
                <div className="flex flex-col gap-1 items-start">
                  <div className="flex items-center gap-2">
                    {chatModel.name}
                    {!enabled && (
                      <span className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                        Pro
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {chatModel.description}
                  </div>
                </div>

                <div className="text-foreground dark:text-foreground opacity-0 group-data-[active=true]/item:opacity-100">
                  <CheckCircleFillIcon />
                </div>
              </button>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
