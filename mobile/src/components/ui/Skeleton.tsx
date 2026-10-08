import React, { useEffect, useState } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Shimmer placeholder.
 *
 * Loading states use skeletons shaped like the content they replace, with a
 * light band sweeping across — the layout never jumps when data lands, and the
 * sweep reads as "loading" rather than "broken".
 */
export function Skeleton({ width, height, radius, style }: SkeletonProps) {
  const { colors, radius: radii } = useTheme();
  const [boxWidth, setBoxWidth] = useState(0);
  const x = useSharedValue(0);

  useEffect(() => {
    if (boxWidth === 0) return;
    x.value = 0;
    x.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, false);
    return () => cancelAnimation(x);
  }, [boxWidth, x]);

  const band = Math.max(80, boxWidth * 0.6);
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -band + x.value * (boxWidth + band) }],
  }));

  return (
    <View
      onLayout={(event) => setBoxWidth(event.nativeEvent.layout.width)}
      style={[
        styles.base,
        {
          width,
          height,
          borderRadius: radius ?? radii.sm,
          backgroundColor: colors.media.skeleton,
        },
        style,
      ]}
    >
      {boxWidth > 0 ? (
        <Animated.View style={[styles.band, { width: band }, sweepStyle]}>
          <LinearGradient
            colors={['rgba(255,255,255,0)', colors.media.shimmer, 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Convenience: a stack of text-line skeletons. */
export function SkeletonText({ lines = 3, lastLineWidth = '62%' }: { lines?: number; lastLineWidth?: DimensionValue }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} height={12} width={index === lines - 1 ? lastLineWidth : '100%'} radius={6} />
      ))}
    </View>
  );
}

/** Convenience: a card-shaped skeleton matching the content list cards. */
export function SkeletonCard({ height = 168 }: { height?: number }) {
  const { spacing, radius } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <Skeleton height={height} radius={radius.lg} />
      <Skeleton height={14} width="72%" radius={7} />
      <Skeleton height={11} width="45%" radius={6} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  band: { position: 'absolute', top: 0, bottom: 0, left: 0 },
});

export const skeletonStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
