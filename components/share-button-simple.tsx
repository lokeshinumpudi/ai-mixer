'use client';

import { updateChatVisibility } from '@/app/(chat)/actions';
import { useState } from 'react';
import { GlobeIcon, ShareIcon } from './icons';
import { toast } from './toast';

interface ShareButtonProps {
  chatId: string;
  currentVisibility: 'public' | 'private';
  onVisibilityChange: (visibility: 'public' | 'private') => void;
  isOwner: boolean;
}

export function ShareButtonSimple({
  chatId,
  currentVisibility,
  onVisibilityChange,
  isOwner,
}: ShareButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!isOwner) return null;

  const handleToggle = async () => {
    if (isLoading) return;

    const newVisibility = currentVisibility === 'public' ? 'private' : 'public';

    try {
      setIsLoading(true);
      await updateChatVisibility({ chatId, visibility: newVisibility });
      onVisibilityChange(newVisibility);

      if (newVisibility === 'public') {
        const url = `${window.location.origin}/chat/${chatId}`;
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(url);
          } else {
            const ta = document.createElement('textarea');
            ta.value = url;
            ta.style.position = 'fixed';
            ta.style.left = '-999999px';
            ta.style.top = '-999999px';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            document.execCommand('copy');
            ta.remove();
          }
          toast({
            type: 'success',
            description:
              'Link copied! Anyone with this link can view your chat in read-only mode',
          });
        } catch {
          toast({
            type: 'success',
            description: `Chat is public. Share this link: ${url}`,
          });
        }
      } else {
        toast({
          type: 'success',
          description: 'Chat is now private. Only you can access this chat.',
        });
      }
    } catch {
      toast({
        type: 'error',
        description: 'Failed to update chat. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isLoading}
      className={`flex items-center justify-center size-8 rounded-md transition-colors ${
        currentVisibility === 'public'
          ? 'bg-green-100 hover:bg-green-200 text-green-700'
          : 'hover:bg-accent'
      } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      aria-label={
        currentVisibility === 'public' ? 'Make chat private' : 'Share chat'
      }
      title={currentVisibility === 'public' ? 'Click to make private' : 'Share'}
    >
      {isLoading ? (
        <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : currentVisibility === 'public' ? (
        <GlobeIcon size={16} />
      ) : (
        <ShareIcon size={16} />
      )}
    </button>
  );
}
