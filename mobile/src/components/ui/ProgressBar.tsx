import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { Gradient } from './Gradient';

interface ProgressBarProps {
  /** 0..1 */
  progress: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  /** Flat colour instead of the Talea progress gradient. */
  color?: string;
  animated?: boolean;
}

export function ProgressBar({ progress, height = 6, style, color, animated = true }: ProgressBarProps) {
  const { colors, radius } = useTheme();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const value = useSharedValue(clamped);

  useEffect(() => {
    value.value = animated ? withTiming(clamped, { duration: 260 }) : clamped;
  }, [clamped, animated, value]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));

  return (
    <View
      style={[{ height, borderRadius: radius.pill, backgroundColor: colors.progressTrack, overflow: 'hidden' }, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <Animated.View style={[StyleSheet.absoluteFillObject, { width: '0%' }, fillStyle]}>
        {color ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: color, borderRadius: radius.pill }]} />
        ) : (
          <Gradient token={colors.gradient.progress} style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]} />
        )}
      </Animated.View>
    </View>
  );
}
