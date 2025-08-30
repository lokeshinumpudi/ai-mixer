import type { Attachment } from '@/lib/types';
import { useEffect, useRef, useState } from 'react';
import { useAnimeControls } from '@/hooks/use-anime';

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
}: {
  attachment: Attachment;
  isUploading?: boolean;
}) => {
  const { name, url, contentType } = attachment;
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const { createAnimation } = useAnimeControls();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (containerRef.current) {
      createAnimation(containerRef.current, {
        opacity: [0, 1],
        translateY: [6, 0],
        duration: 220,
        ease: 'outQuad',
      });
    }
  }, [createAnimation, url]);

  return (
    <div
      ref={containerRef}
      data-testid="input-attachment-preview"
      className="flex flex-col gap-2"
    >
      <div className="w-20 h-16 aspect-video bg-muted rounded-md relative flex flex-col items-center justify-center overflow-hidden">
        {contentType ? (
          contentType.startsWith('image') ? (
            // NOTE: it is recommended to use next/image for images
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imageRef}
              key={url}
              src={url}
              alt={name ?? 'An image attachment'}
              className="rounded-md size-full object-cover"
              onLoad={() => {
                setLoaded(true);
              }}
            />
          ) : (
            <div className="" />
          )
        ) : (
          <div className="" />
        )}

        {(isUploading || !loaded) && (
          <div
            data-testid="input-attachment-loader"
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_1.2s_infinite]"
          >
            {/* shimmer overlay */}
          </div>
        )}
      </div>
      <div className="text-xs text-zinc-500 max-w-16 truncate">{name}</div>
    </div>
  );
};
