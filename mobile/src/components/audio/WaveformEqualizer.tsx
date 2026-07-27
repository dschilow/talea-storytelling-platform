import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming, cancelAnimation } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';

interface WaveformEqualizerProps {
  playing: boolean;
  size?: 'sm' | 'md';
  color?: string;
}

const BAR_CONFIG = [
  { delay: 0, min: 0.28, max: 1 },
  { delay: 140, min: 0.45, max: 0.72 },
  { delay: 70, min: 0.22, max: 0.95 },
  { delay: 210, min: 0.5, max: 0.62 },
];

/**
 * Four-bar playback indicator.
 *
 * Runs entirely on the UI thread and cancels its animation when paused, so an
 * idle player costs nothing — this sits inside the tab bar and would otherwise
 * animate for the whole session.
 */
export function WaveformEqualizer({ playing, size = 'md', color }: WaveformEqualizerProps) {
  const { colors } = useTheme();
  const height = size === 'sm' ? 14 : 20;
  const barWidth = size === 'sm' ? 2 : 2.5;
  const gap = size === 'sm' ? 2 : 3;
  const tint = color ?? colors.media.foreground;

  return (
    <View style={[styles.container, { height, gap }]}>
      {BAR_CONFIG.map((config, index) => (
        <Bar key={index} playing={playing} height={height} width={barWidth} color={tint} {...config} />
      ))}
    </View>
  );
}

function Bar({
  playing,
  height,
  width,
  color,
  delay,
  min,
  max,
}: {
  playing: boolean;
  height: number;
  width: number;
  color: string;
  delay: number;
  min: number;
  max: number;
}) {
  const scale = useSharedValue(min);

  useEffect(() => {
    if (!playing) {
      cancelAnimation(scale);
      scale.value = withTiming(min, { duration: 180 });
      return;
    }

    const timer = setTimeout(() => {
      scale.value = withRepeat(withTiming(max, { duration: 460, easing: Easing.inOut(Easing.sin) }), -1, true);
    }, delay);

    return () => clearTimeout(timer);
  }, [playing, delay, max, min, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ height: height * scale.value }));

  return <Animated.View style={[{ width, borderRadius: width, backgroundColor: color }, animatedStyle]} />;
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },
});
