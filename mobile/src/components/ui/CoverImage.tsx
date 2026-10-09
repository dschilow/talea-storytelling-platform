import React, { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image, type ImageContentFit } from 'expo-image';

import { useTheme } from '@/theme/ThemeProvider';
import type { ThemePalette } from '@/theme/tokens';
import { ImageIcon } from 'lucide-react-native';
import { Skeleton } from './Skeleton';
import { Gradient, OverlayGradient } from './Gradient';

interface CoverImageProps {
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
  contentFit?: ImageContentFit;
  /** Darkening wash for text placed over the image. */
  overlay?: 'none' | 'soft' | 'strong';
  radius?: number;
  /** Rendered on top of the image (title, badges). */
  children?: React.ReactNode;
  accessibilityLabel?: string;
  /** Placeholder gradient shown when there is no image at all. */
  fallbackGradient?: keyof ThemePalette['gradient'];
  transitionMs?: number;
  /**
   * Stable disk-cache key. Signed URLs change on every request; keying the
   * cache by the object path keeps a re-signed image a cache hit.
   */
  cacheKey?: string;
}

/**
 * Cover/hero imagery with the three states the content lists actually hit:
 * loading (shimmer), loaded (cross-fade), and missing (branded wash + sparkle).
 */
export function CoverImage({
  uri,
  style,
  contentFit = 'cover',
  overlay = 'none',
  radius,
  children,
  accessibilityLabel,
  fallbackGradient = 'primary',
  transitionMs = 320,
  cacheKey,
}: CoverImageProps) {
  const { colors, radius: radii } = useTheme();
  const [loading, setLoading] = useState(Boolean(uri));
  const [failed, setFailed] = useState(false);

  const borderRadius = radius ?? radii.md;
  const showFallback = !uri || failed;

  return (
    <View style={[styles.container, { borderRadius, backgroundColor: colors.media.skeleton }, style]}>
      {showFallback ? (
        <>
          <Gradient token={colors.gradient[fallbackGradient]} style={StyleSheet.absoluteFill} />
          <View style={styles.center}>
            <ImageIcon size={26} color={colors.text.muted} strokeWidth={1.8} />
          </View>
        </>
      ) : (
        <>
          <Image
            source={cacheKey ? { uri, cacheKey } : { uri }}
            style={StyleSheet.absoluteFill}
            contentFit={contentFit}
            transition={transitionMs}
            cachePolicy="disk"
            accessibilityLabel={accessibilityLabel}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setFailed(true);
            }}
          />
          {loading ? <Skeleton style={StyleSheet.absoluteFill} radius={borderRadius} /> : null}
        </>
      )}

      {overlay !== 'none' ? (
        <OverlayGradient
          colors={overlay === 'strong' ? colors.media.overlayStrong : colors.media.overlay}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
