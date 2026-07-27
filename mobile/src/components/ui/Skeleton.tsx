import React, { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

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
 * Loading states use skeletons that match the shape of the content they replace
 * rather than a centred spinner — the layout never jumps when data lands, which
 * is the single biggest perceived-performance win on a content-heavy app.
 */
export function Skeleton({ width, height, radius, style }: SkeletonProps) {
  const { colors, radius: radii } = useTheme();
  const progress = useSharedValue(0.45);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 950, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius ?? radii.sm,
          backgroundColor: colors.media.skeleton,
        },
        animatedStyle,
        style,
      ]}
    />
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

export const skeletonStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
