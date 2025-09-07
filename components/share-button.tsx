'use client';

import { updateChatVisibility } from '@/app/(chat)/actions';
import { useState } from 'react';
import { GlobeIcon, LockIcon, ShareIcon } from './icons';
import { toast } from './toast';

interface ShareButtonProps {
  chatId: string;
  currentVisibility: 'public' | 'private';
  onVisibilityChange: (visibility: 'public' | 'private') => void;
  isOwner: boolean;
}

export function ShareButton({
  chatId,
  currentVisibility,
  onVisibilityChange,
  isOwner,
}: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  console.log('🔄 Share: ShareButton rendered', {
    chatId,
    currentVisibility,
    isOwner,
    hasOnVisibilityChange: !!onVisibilityChange,
  });

  if (!isOwner) {
    console.log('❌ Share: Not owner, hiding share button');
    return null; // Only show share button to chat owners
  }

  const handlePublicClick = async () => {
    console.log('🔄 Share: Public button clicked', { isLoading, chatId });

    if (isLoading) return;

    try {
      setIsLoading(true);
      console.log('🔄 Share: Updating chat visibility to public...');

      await updateChatVisibility({ chatId, visibility: 'public' });
      console.log('✅ Share: Chat visibility updated successfully');

      onVisibilityChange('public'); // Update parent state
      console.log('✅ Share: Parent state updated');

      const url = `${window.location.origin}/chat/${chatId}`;
      console.log('🔄 Share: Copying URL to clipboard:', url);

      // Try clipboard API first, fallback to execCommand
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(url);
          console.log('✅ Share: URL copied to clipboard via Clipboard API');
        } else {
          // Fallback for older browsers or non-secure contexts
          const textArea = document.createElement('textarea');
          textArea.value = url;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand('copy');
          textArea.remove();
          console.log('✅ Share: URL copied to clipboard via fallback method');
        }
      } catch (clipboardError) {
        console.error('❌ Share: Clipboard error:', clipboardError);
        throw new Error('Failed to copy to clipboard');
      }

      toast({
        type: 'success',
        description:
          'Link copied! Anyone with this link can view your chat in read-only mode',
      });
      console.log('✅ Share: Success toast shown');

      setIsOpen(false);
    } catch (error) {
      console.error('❌ Share: Error occurred:', error);
      toast({
        type: 'error',
        description: 'Failed to share chat. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrivateClick = async () => {
    console.log('🔄 Share: Private button clicked', { isLoading, chatId });

    if (isLoading) return;

    try {
      setIsLoading(true);
      console.log('🔄 Share: Updating chat visibility to private...');

      await updateChatVisibility({ chatId, visibility: 'private' });
      console.log('✅ Share: Chat visibility updated successfully');

      onVisibilityChange('private'); // Update parent state
      console.log('✅ Share: Parent state updated');

      toast({
        type: 'success',
        description: 'Chat is now private. Only you can access this chat.',
      });
      console.log('✅ Share: Success toast shown');

      setIsOpen(false);
    } catch (error) {
      console.error('❌ Share: Error occurred:', error);
      toast({
        type: 'error',
        description: 'Failed to update chat. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          console.log('🔄 Share: Main button clicked, toggling dropdown', {
            isOpen,
            isOwner,
          });
          setIsOpen(!isOpen);
        }}
        className={`flex items-center justify-center size-8 rounded-md transition-colors ${
          currentVisibility === 'public'
            ? 'bg-green-100 hover:bg-green-200 text-green-700'
            : 'hover:bg-accent'
        }`}
        aria-label="Share chat"
        disabled={isLoading}
      >
        {currentVisibility === 'public' ? (
          <GlobeIcon size={16} />
        ) : (
          <ShareIcon size={16} />
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          {/* biome-ignore lint/nursery/noStaticElementInteractions: <explanation> */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
            <div className="p-1">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('🔄 Share: Public button DOM click event', {
                    disabled: isLoading,
                  });
                  handlePublicClick();
                }}
                disabled={isLoading}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-3 ${
                  currentVisibility === 'public'
                    ? 'bg-green-50 text-green-700'
                    : 'hover:bg-gray-50'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <GlobeIcon size={16} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">Public</div>
                  <div className="text-xs text-gray-500 truncate">
                    Copy link to share
                  </div>
                </div>
                {currentVisibility === 'public' && (
                  <div className="size-2 bg-green-500 rounded-full" />
                )}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('🔄 Share: Private button DOM click event', {
                    disabled: isLoading,
                  });
                  handlePrivateClick();
                }}
                disabled={isLoading}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-3 ${
                  currentVisibility === 'private'
                    ? 'bg-gray-50 text-gray-700'
                    : 'hover:bg-gray-50'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <LockIcon size={16} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">Private</div>
                  <div className="text-xs text-gray-500 truncate">
                    Only you can access
                  </div>
                </div>
                {currentVisibility === 'private' && (
                  <div className="size-2 bg-gray-500 rounded-full" />
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
