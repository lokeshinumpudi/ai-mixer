'use client';

import { initialArtifactData, useArtifact } from '@/hooks/use-artifact';
import { uiLogger } from '@/lib/logger';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { artifactDefinitions } from './artifact';
import { useDataStream } from './data-stream-provider';
import { upgradeToast } from './toast';

import { useUsage } from '@/hooks/use-usage';

export function DataStreamHandler() {
  const { dataStream } = useDataStream();
  const pathname = usePathname();
  const router = useRouter();
  // Do not fetch usage summary on every mount; only consume stream updates
  const { updateUsage } = useUsage({ fetch: false });

  uiLogger.debug(
    {
      chatId: pathname.startsWith('/chat/') ? pathname.slice(6) : 'none',
      pathname,
    },
    'DataStreamHandler initialized',
  );

  // Extract chatId from pathname (e.g., /chat/123 -> 123)
  const chatId = pathname.startsWith('/chat/') ? pathname.slice(6) : undefined;

  const { artifact, setArtifact, setMetadata } = useArtifact(chatId);
  const lastProcessedIndex = useRef(-1);
  const hasShownRateLimitToast = useRef(false);

  useEffect(() => {
    if (!dataStream?.length) return;

    uiLogger.debug(
      {
        newDeltasCount: dataStream.length - lastProcessedIndex.current - 1,
        totalDeltas: dataStream.length,
        chatId,
      },
      'Processing new data stream deltas',
    );

    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
    lastProcessedIndex.current = dataStream.length - 1;

    uiLogger.debug(
      {
        deltaTypes: newDeltas.map((d) => d.type),
        deltaCount: newDeltas.length,
        chatId,
      },
      'Processing data deltas',
    );

    newDeltas.forEach((delta) => {
      // Handle usage updates
      if (delta.type === 'data-usageUpdate' && delta.data) {
        const usageInfo = delta.data;

        // Update the usage hook with new data
        updateUsage(usageInfo);

        // Show upgrade toast when user is approaching or over limit
        if (usageInfo.remaining <= 10 && usageInfo.remaining > 5) {
          // Early warning
          if (!hasShownRateLimitToast.current) {
            hasShownRateLimitToast.current = true;
            upgradeToast({
              title: 'Running low on messages',
              description: `You have ${
                usageInfo.remaining
              } messages remaining this ${
                usageInfo.type === 'daily' ? 'day' : 'month'
              }. Upgrade to Pro for unlimited access to all models.`,
              actionText: 'Upgrade to Pro',
            });
          }
        } else if (usageInfo.remaining <= 5 && usageInfo.remaining > 0) {
          // Final warning
          upgradeToast({
            title: 'Almost out of messages!',
            description: `Only ${usageInfo.remaining} messages left! Upgrade to Pro for unlimited access.`,
            actionText: 'Upgrade to Pro',
          });
        } else if (usageInfo.isOverLimit) {
          // Over limit - show error toast
          upgradeToast({
            title: 'Message limit reached',
            description: `You've used all your ${usageInfo.type} messages. Upgrade to Pro for unlimited access.`,
            actionText: 'Upgrade to Pro',
          });
        }

        return; // Exit early for usage updates
      }

      const artifactDefinition = artifactDefinitions.find(
        (artifactDefinition) => artifactDefinition.kind === artifact.kind,
      );

      if (artifactDefinition?.onStreamPart) {
        artifactDefinition.onStreamPart({
          streamPart: delta,
          setArtifact,
          setMetadata,
        });
      }

      setArtifact((draftArtifact) => {
        if (!draftArtifact) {
          return { ...initialArtifactData, status: 'streaming' };
        }

        switch (delta.type) {
          case 'data-id':
            return {
              ...draftArtifact,
              documentId: delta.data,
              status: 'streaming',
            };

          case 'data-title':
            return {
              ...draftArtifact,
              title: delta.data,
              status: 'streaming',
            };

          case 'data-kind':
            return {
              ...draftArtifact,
              kind: delta.data,
              status: 'streaming',
            };

          case 'data-clear':
            return {
              ...draftArtifact,
              content: '',
              status: 'streaming',
            };

          case 'data-finish':
            return {
              ...draftArtifact,
              status: 'idle',
            };

          default:
            return draftArtifact;
        }
      });
    });
  }, [dataStream, setArtifact, setMetadata, artifact, router, updateUsage]);

  return null;
}
