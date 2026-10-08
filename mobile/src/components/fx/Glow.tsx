import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * Returns the colour with alpha 0. A radial gradient that fades to the plain
 * `transparent` keyword interpolates through black and leaves a grey fringe;
 * fading to the same hue at zero alpha does not.
 */
export function transparentOf(color: string): string {
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color);
  if (rgba) return `rgba(${rgba[1]}, ${rgba[2]}, ${rgba[3]}, 0)`;
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) {
    const value = parseInt(hex[1], 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, 0)`;
  }
  return 'rgba(0, 0, 0, 0)';
}

export function radialGlow(color: string, falloff = 68): string {
  return `radial-gradient(circle at center, ${color} 0%, ${transparentOf(color)} ${falloff}%)`;
}

interface GlowProps {
  color: string;
  size: number;
  style?: StyleProp<ViewStyle>;
  /** Percentage of the radius at which the glow has fully faded. */
  falloff?: number;
}

/** A soft, feathered radial light. Purely decorative. */
export function Glow({ color, size, style, falloff }: GlowProps) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.glow,
        { width: size, height: size, experimental_backgroundImage: radialGlow(color, falloff) },
        style,
      ]}
    />
  );
}

interface DriftingGlowProps extends GlowProps {
  /** Drift amplitude in dp. */
  amplitude?: number;
  /** One full drift cycle in ms. */
  period?: number;
  delay?: number;
  active: boolean;
}

/** A glow that slowly wanders and breathes — the aurora layer. */
export function DriftingGlow({ color, size, style, falloff, amplitude = 36, period = 16000, delay = 0, active }: DriftingGlowProps) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(t);
      return;
    }
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }), -1, true)
    );
    return () => cancelAnimation(t);
  }, [active, delay, period, t]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (t.value - 0.5) * amplitude * 2 },
      { translateY: Math.sin(t.value * Math.PI) * amplitude * 0.7 },
      { scale: 0.92 + t.value * 0.16 },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.glow,
        { width: size, height: size, experimental_backgroundImage: radialGlow(color, falloff) },
        style,
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute' },
});
