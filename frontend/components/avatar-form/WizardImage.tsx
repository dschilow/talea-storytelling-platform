import React, { useState } from 'react';
import type { WizardAssetGroup } from '../../hooks/useWizardAssets';

interface WizardImageProps {
  url?: string;
  /** Emoji or icon rendered while the generated image is missing or loading. */
  fallback: React.ReactNode;
  alt: string;
  className?: string;
  /** Tailwind size for the fallback emoji (defaults to text-3xl). */
  fallbackClassName?: string;
}

/**
 * Renders a pre-generated Talea wizard illustration, gracefully falling back to
 * an emoji/icon when the asset has not been generated yet or fails to load.
 * This lets the wizard ship before the images exist and upgrade seamlessly.
 */
export const WizardImage: React.FC<WizardImageProps> = ({
  url,
  fallback,
  alt,
  className = 'h-full w-full object-cover',
  fallbackClassName = 'text-3xl',
}) => {
  const [errored, setErrored] = useState(false);

  if (!url || errored) {
    return <span className={fallbackClassName}>{fallback}</span>;
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => setErrored(true)}
    />
  );
};

export type { WizardAssetGroup };
export default WizardImage;
