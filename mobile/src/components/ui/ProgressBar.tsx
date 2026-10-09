import React, { useEffect } from 'react';
import { type StyleProp, type ViewStyle, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';

interface ProgressBarProps {
  /** 0..1 */
  progress: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  /** Fill colour; defaults to the accent. */
  color?: string;
  animated?: boolean;
  /** Delay before the fill grows in, for staggered lists. */
  delay?: number;
}

/** Thin capsule progress bar in a single solid colour, as on iOS. */
export function ProgressBar({ progress, height = 6, style, color, animated = true, delay = 0 }: ProgressBarProps) {
  const { colors, radius } = useTheme();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const value = useSharedValue(animated ? 0 : clamped);

  useEffect(() => {
    value.value = animated
      ? withDelay(delay, withTiming(clamped, { duration: 600, easing: Easing.out(Easing.cubic) }))
      : clamped;
  }, [clamped, animated, delay, value]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));

  return (
    <View
      style={[{ height, borderRadius: radius.pill, backgroundColor: colors.progressTrack, overflow: 'hidden' }, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <Animated.View
        style={[
          { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: radius.pill, backgroundColor: color ?? colors.primary },
          fillStyle,
        ]}
      />
    </View>
  );
}
