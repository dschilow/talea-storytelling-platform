import React, { useRef, useState, useCallback } from 'react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Optional wrapper className (skeleton/aspect box). Image className stays on <img>. */
  wrapperClassName?: string;
  /** Force eager loading for above-the-fold images (e.g. hero). */
  eager?: boolean;
}

/**
 * Image with a built-in shimmer skeleton and fade-in.
 * The skeleton stays visible until the image has decoded, so large landing
 * assets fade in gracefully instead of popping in line by line.
 */
const LazyImage: React.FC<LazyImageProps> = ({
  wrapperClassName = '',
  eager = false,
  className = '',
  onLoad,
  ...imgProps
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  const markLoaded = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    setLoaded(true);
    onLoad?.(e);
  }, [onLoad]);

  /* If the image is already cached, the load event may fire before React
     attaches the handler — detect that synchronously via the ref. */
  const handleRef = useCallback((node: HTMLImageElement | null) => {
    imgRef.current = node;
    if (node && node.complete && node.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <span className={`lazy-img${loaded ? ' is-loaded' : ''} ${wrapperClassName}`.trim()}>
      <span className="lazy-img-skeleton" aria-hidden="true" />
      <img
        {...imgProps}
        ref={handleRef}
        className={className}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={eager ? 'high' : undefined}
        onLoad={markLoaded}
      />
    </span>
  );
};

export default LazyImage;
