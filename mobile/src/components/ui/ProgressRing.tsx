import React, { useEffect, useId, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  /** 0..1 */
  progress: number;
  size: number;
  strokeWidth?: number;
  /** `magic` is the brand sweep, `gold` the reward colour; or pass any hue list. */
  palette?: 'magic' | 'gold' | readonly string[];
  /** Track colour; defaults to the theme's progress track. */
  trackColor?: string;
  delay?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Circular progress with a gradient stroke and rounded caps. Used for avatar
 * levels: the ring fills towards the next level, the content sits inside.
 */
export function ProgressRing({
  progress,
  size,
  strokeWidth = 4,
  palette = 'magic',
  trackColor,
  delay = 0,
  children,
  style,
}: ProgressRingProps) {
  const { colors } = useTheme();
  const gradientId = `ring-${useId().replace(/:/g, '')}`;
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = useSharedValue(0);

  useEffect(() => {
    value.value = withDelay(delay, withTiming(clamped, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [clamped, delay, value]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - value.value),
  }));

  const stops =
    palette === 'magic'
      ? colors.gradient.magic.colors
      : palette === 'gold'
        ? colors.gradient.gold.colors
        : palette;

  return (
    <View style={[{ width: size, height: size }, styles.center, style]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            {stops.map((stop, index) => (
              <Stop key={index} offset={stops.length === 1 ? 0 : index / (stops.length - 1)} stopColor={stop} />
            ))}
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor ?? colors.progressTrack}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          fill="none"
          // Start at 12 o'clock.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
