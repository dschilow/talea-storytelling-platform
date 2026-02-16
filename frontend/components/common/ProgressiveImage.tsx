import React, { useEffect, useState } from 'react';
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
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [src]);

  const hasSource = Boolean(src);
  const showSkeleton = hasSource && !loaded && !error;
  const showFallback = !hasSource || error;

  return (
    <div className={cn('relative overflow-hidden', containerClassName)}>
      {hasSource && !error && (
        <motion.img
          src={src ?? undefined}
          alt={alt}
          loading={loading}
          initial={{ opacity: 0, scale: 1.03 }}
          animate={loaded ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: revealDelayMs / 1000 }}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={cn('h-full w-full object-cover', imageClassName)}
        />
      )}

      <AnimatePresence>
        {showSkeleton && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, delay: revealDelayMs / 1000 }}
            className={cn('absolute inset-0 animate-pulse bg-[#ebe5d9] dark:bg-[#2b3b51]', skeletonClassName)}
            aria-hidden
          >
            <motion.div
              className="absolute inset-y-0 -left-1/3 w-1/3 bg-white/30 dark:bg-white/10"
              animate={{ x: ['0%', '420%'] }}
              transition={{ duration: 1.35, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {showFallback && (
        <div className="absolute inset-0">
          {fallback ?? <div className="h-full w-full bg-[#ebe5d9] dark:bg-[#2b3b51]" />}
        </div>
      )}
    </div>
  );
};

export default ProgressiveImage;