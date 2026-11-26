import React, { useCallback, useState } from 'react';

import { cn } from '@/lib/utils';

type RevealImageProps = React.ImgHTMLAttributes<HTMLImageElement>;

/**
 * A plain `<img>` that fades in once it has decoded instead of painting line by
 * line over the placeholder. Cached pictures (already `complete` when React
 * attaches) show at once. The fade itself lives in index.css (`.talea-reveal-img`).
 */
export const RevealImage: React.FC<RevealImageProps> = ({ className, onLoad, src, decoding = 'async', ...props }) => {
  const [loadedSrc, setLoadedSrc] = useState<string | undefined>(undefined);
  const watch = useCallback(
    (node: HTMLImageElement | null) => {
      if (node?.complete && node.naturalWidth > 0) setLoadedSrc(node.getAttribute('src') ?? undefined);
    },
    [],
  );

  return (
    <img
      {...props}
      ref={watch}
      src={src}
      decoding={decoding}
      data-loaded={src && loadedSrc === src ? '' : undefined}
      onLoad={(event) => {
        setLoadedSrc(event.currentTarget.getAttribute('src') ?? undefined);
        onLoad?.(event);
      }}
      className={cn('talea-reveal-img', className)}
    />
  );
};

export default RevealImage;
