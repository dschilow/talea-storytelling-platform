import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { withAlpha } from '@/theme/tokens';
import { Gradient } from './Gradient';

interface ProgressBarProps {
  /** 0..1 */
  progress: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  /** Flat hue instead of the Talea progress gradient (rendered as a two-tone sweep). */
  color?: string;
  animated?: boolean;
  /** Delay before the fill grows in, for staggered lists. */
  delay?: number;
}

/**
 * Rounded progress bar. The fill grows in on mount, carries a soft glow in its
 * own hue, and uses the brand sweep unless a trait colour is given.
 */
export function ProgressBar({ progress, height = 8, style, color, animated = true, delay = 0 }: ProgressBarProps) {
  const { colors, radius } = useTheme();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const value = useSharedValue(animated ? 0 : clamped);

  useEffect(() => {
    value.value = animated
      ? withDelay(delay, withTiming(clamped, { duration: 720, easing: Easing.out(Easing.cubic) }))
      : clamped;
  }, [clamped, animated, delay, value]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));

  return (
    <View
      style={[{ height, borderRadius: radius.pill, backgroundColor: colors.progressTrack }, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <Animated.View
        style={[
          styles.fill,
          { borderRadius: radius.pill, minWidth: clamped > 0 ? height : 0 },
          color ? { boxShadow: `0px 2px 8px ${withAlpha(color, 0.35)}` } : null,
          fillStyle,
        ]}
      >
        <View style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: radius.pill }]}>
          {color ? (
            <LinearGradient
              colors={[withAlpha(color, 0.78), color]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <Gradient token={colors.gradient.progress} style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient
            colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
            style={[StyleSheet.absoluteFill, { bottom: '45%' }]}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  clip: { overflow: 'hidden' },
});
