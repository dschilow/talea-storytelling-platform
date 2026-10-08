import React, { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

/** Four-point star, the Talea sparkle. Drawn in a 24×24 box. */
const SPARKLE_PATH =
  'M12 0C12.9 6.2 17.8 11.1 24 12C17.8 12.9 12.9 17.8 12 24C11.1 17.8 6.2 12.9 0 12C6.2 11.1 11.1 6.2 12 0Z';

export function SparkleGlyph({ size = 16, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={SPARKLE_PATH} fill={color} />
    </Svg>
  );
}

/** Deterministic pseudo-random sequence so layouts are stable across renders. */
export function seeded(seed: number) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

interface Particle {
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
}

function makeParticles(count: number, seed: number, minSize: number, maxSize: number): Particle[] {
  const random = seeded(seed);
  return Array.from({ length: count }, () => ({
    x: random(),
    y: random(),
    size: minSize + random() * (maxSize - minSize),
    delay: Math.round(random() * 2600),
    duration: 1600 + Math.round(random() * 2200),
  }));
}

const Twinkle = memo(function Twinkle({
  particle,
  color,
  active,
  shape,
  width,
  height,
}: {
  particle: Particle;
  color: string;
  active: boolean;
  shape: 'sparkle' | 'dot';
  width: number;
  height: number;
}) {
  const t = useSharedValue(active ? 0 : 0.6);

  useEffect(() => {
    if (!active) {
      cancelAnimation(t);
      t.value = 0.6;
      return;
    }
    t.value = withDelay(
      particle.delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: particle.duration * 0.45, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: particle.duration * 0.55, easing: Easing.in(Easing.quad) })
        ),
        -1,
        false
      )
    );
    return () => cancelAnimation(t);
  }, [active, particle.delay, particle.duration, t]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.15 + t.value * 0.85,
    transform: [{ scale: shape === 'sparkle' ? 0.45 + t.value * 0.55 : 0.7 + t.value * 0.3 }, { rotate: `${t.value * 45}deg` }],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        { left: particle.x * width - particle.size / 2, top: particle.y * height - particle.size / 2 },
        style,
      ]}
    >
      {shape === 'sparkle' ? (
        <SparkleGlyph size={particle.size} color={color} />
      ) : (
        <View style={{ width: particle.size, height: particle.size, borderRadius: particle.size / 2, backgroundColor: color }} />
      )}
    </Animated.View>
  );
});

interface SparkleFieldProps {
  /** Size of the area the particles are scattered over. */
  width: number;
  height: number;
  count?: number;
  color?: string;
  shape?: 'sparkle' | 'dot';
  minSize?: number;
  maxSize?: number;
  seed?: number;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * A field of twinkling sparkles (or star dots). Positions are seeded, so the
 * same seed always produces the same constellation.
 */
export function SparkleField({
  width,
  height,
  count = 10,
  color = '#FFFFFF',
  shape = 'sparkle',
  minSize = 6,
  maxSize = 14,
  seed = 7,
  active = true,
  style,
}: SparkleFieldProps) {
  const particles = useMemo(() => makeParticles(count, seed, minSize, maxSize), [count, seed, minSize, maxSize]);

  if (width <= 0 || height <= 0) return null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {particles.map((particle, index) => (
        <Twinkle
          key={index}
          particle={particle}
          color={color}
          active={active}
          shape={shape}
          width={width}
          height={height}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: { position: 'absolute' },
});
