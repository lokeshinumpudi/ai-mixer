'use client';

import { useEffect, useRef } from 'react';
import { artifactDefinitions } from './artifact';
import { initialArtifactData, useArtifact } from '@/hooks/use-artifact';
import { useDataStream } from './data-stream-provider';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from './toast';

import { useUsage } from '@/hooks/use-usage';

export function DataStreamHandler() {
  const { dataStream } = useDataStream();
  const pathname = usePathname();
  const router = useRouter();
  const { updateUsage } = useUsage();

  // Extract chatId from pathname (e.g., /chat/123 -> 123)
  const chatId = pathname.startsWith('/chat/') ? pathname.slice(6) : undefined;

  const { artifact, setArtifact, setMetadata } = useArtifact(chatId);
  const lastProcessedIndex = useRef(-1);
  const hasShownRateLimitToast = useRef(false);

  useEffect(() => {
    if (!dataStream?.length) return;

    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
    lastProcessedIndex.current = dataStream.length - 1;

    newDeltas.forEach((delta) => {
      // Handle usage updates
      if (delta.type === 'data-usageUpdate' && delta.data) {
        const usageInfo = delta.data;

        // Update the usage hook with new data
        updateUsage(usageInfo);

        // Show rate limit toast when user is approaching or over limit
        if (usageInfo.remaining <= 5 && usageInfo.remaining > 0) {
          // Warning: approaching limit
          if (!hasShownRateLimitToast.current) {
            hasShownRateLimitToast.current = true;
            toast({
              type: 'error',
              description: `${usageInfo.remaining} messages remaining. You're approaching your ${usageInfo.type} limit. Upgrade for unlimited access.`,
            });
          }
        } else if (usageInfo.isOverLimit) {
          // Over limit
          toast({
            type: 'error',
            description: `You've reached your ${usageInfo.type} message limit. Upgrade to continue chatting.`,
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
