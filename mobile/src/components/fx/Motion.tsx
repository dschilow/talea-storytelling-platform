import React, { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

/**
 * A diagonal light band that sweeps across its parent every few seconds — the
 * "polished" glint on primary buttons and hero cards. The parent must clip
 * (`overflow: 'hidden'`).
 */
export function Shine({
  active = true,
  interval = 4200,
  delay = 900,
  intensity = 0.32,
}: {
  active?: boolean;
  interval?: number;
  delay?: number;
  intensity?: number;
}) {
  const [width, setWidth] = useState(0);
  const x = useSharedValue(-1);

  useEffect(() => {
    if (!active || width === 0) {
      cancelAnimation(x);
      x.value = -1;
      return;
    }
    x.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.cubic) }),
          withDelay(interval, withTiming(-1, { duration: 0 }))
        ),
        -1,
        false
      )
    );
    return () => cancelAnimation(x);
  }, [active, delay, interval, width, x]);

  const bandWidth = Math.max(60, width * 0.45);
  // x: -1 (fully off the left edge) → 1 (fully off the right edge).
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -bandWidth * 1.5 + ((x.value + 1) / 2) * (width + bandWidth * 2) }, { skewX: '-20deg' }],
  }));

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 ? (
        <Animated.View style={[styles.band, { width: bandWidth }, style]}>
          <LinearGradient
            colors={['rgba(255,255,255,0)', `rgba(255,255,255,${intensity})`, 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Gently bobs its children up and down — for mascots and hero art. */
export function Floating({
  children,
  amplitude = 6,
  period = 3200,
  rotate = 0,
  active = true,
  delay = 0,
  style,
}: {
  children: ReactNode;
  amplitude?: number;
  period?: number;
  /** Max rotation in degrees. */
  rotate?: number;
  active?: boolean;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(t);
      return;
    }
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: period / 2, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(t);
  }, [active, delay, period, t]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (t.value - 0.5) * amplitude * 2 }, { rotate: `${(t.value - 0.5) * rotate * 2}deg` }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/** Slow continuous rotation — orbit rings, loading halos. */
export function Spin({
  children,
  duration = 12000,
  reverse = false,
  active = true,
  style,
}: {
  children: ReactNode;
  duration?: number;
  reverse?: boolean;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(t);
      return;
    }
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [active, duration, t]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(reverse ? -1 : 1) * t.value * 360}deg` }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/** Breathing scale + opacity — a calm "working" signal. */
export function Pulse({
  children,
  from = 0.94,
  to = 1.06,
  period = 2400,
  active = true,
  style,
}: {
  children: ReactNode;
  from?: number;
  to?: number;
  period?: number;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      cancelAnimation(t);
      return;
    }
    t.value = withRepeat(withTiming(1, { duration: period / 2, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(t);
  }, [active, period, t]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: from + (to - from) * t.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  band: { position: 'absolute', top: -20, bottom: -20, left: 0 },
});
