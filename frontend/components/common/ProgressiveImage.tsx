import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { cn } from '@/lib/utils';

type ProgressiveImageProps = {
  src?: string | null;
  alt: string;
  containerClassName?: string;
  imageClassName?: string;
  skeletonClassName?: string;
  fallback?: React.ReactNode;
  revealDelayMs?: number;
  loading?: 'lazy' | 'eager';
  fetchPriority?: 'high' | 'low' | 'auto';
};

export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  alt,
  containerClassName,
  imageClassName,
  skeletonClassName,
  fallback,
  revealDelayMs = 0,
  loading = 'lazy',
  fetchPriority = 'auto',
}) => {
  // State is keyed by the source it belongs to. A reset effect on [src] also ran
  // on mount — after a cached image had already fired `load` — and left that
  // image invisible at opacity 0 forever.
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const loaded = Boolean(src) && loadedSrc === src;
  const error = Boolean(src) && failedSrc === src;

  // Cached images can be complete before React attaches onLoad.
  useEffect(() => {
    const img = imgRef.current;
    if (src && img?.complete && img.naturalWidth > 0) setLoadedSrc(src);
  }, [src]);

  const hasSource = Boolean(src);
  const showSkeleton = hasSource && !loaded && !error;
  const showFallback = !hasSource || error;

  return (
    <div className={cn('relative overflow-hidden', containerClassName)}>
      {hasSource && !error && (
        <motion.img
          ref={imgRef}
          src={src ?? undefined}
          alt={alt}
          loading={loading}
          decoding="async"
          fetchPriority={fetchPriority}
          initial={{ opacity: 0, scale: 1.03 }}
          animate={loaded ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: loaded ? 0 : revealDelayMs / 1000 }}
          onLoad={() => setLoadedSrc(src ?? null)}
          onError={() => setFailedSrc(src ?? null)}
          className={cn('h-full w-full object-cover', imageClassName)}
        />
      )}

      <AnimatePresence>
        {showSkeleton && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, delay: revealDelayMs / 1000 }}
            className={cn('talea-shimmer absolute inset-0 bg-[var(--talea-media-skeleton)]', skeletonClassName)}
            aria-hidden
          >
          </motion.div>
        )}
      </AnimatePresence>

      {showFallback && (
        <div className="absolute inset-0">
          {fallback ?? <div className="h-full w-full bg-[var(--talea-media-skeleton)]" />}
        </div>
      )}
    </div>
  );
};

export default ProgressiveImage;