import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { motion } from '@/theme/tokens';
import { Gradient } from '@/components/ui/Gradient';

interface ScrubberProps {
  /** 0..1 */
  progress: number;
  onScrub: (ratio: number) => void;
  onScrubEnd: (ratio: number) => void;
}

/**
 * Draggable audio position bar.
 *
 * The drag runs on the UI thread so the thumb never lags behind the finger, and
 * the track grows on touch to widen the hit area without inflating the resting
 * layout — the standard mobile media-scrubber affordance.
 */
export function Scrubber({ progress, onScrub, onScrubEnd }: ScrubberProps) {
  const { colors, radius } = useTheme();
  const [width, setWidth] = useState(0);

  const dragging = useSharedValue(0);
  const localProgress = useSharedValue(progress);
  const isDragging = useSharedValue(false);

  // Follow external playback progress unless the user is actively scrubbing.
  // This runs in an effect rather than during render: reading or writing a
  // shared value while rendering is undefined behaviour in Reanimated.
  useEffect(() => {
    if (isDragging.value) return;
    localProgress.value = Math.max(0, Math.min(1, progress));
  }, [progress, isDragging, localProgress]);

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((event) => {
      isDragging.value = true;
      dragging.value = withSpring(1, motion.spring);
      if (width > 0) {
        const ratio = Math.max(0, Math.min(1, event.x / width));
        localProgress.value = ratio;
        runOnJS(onScrub)(ratio);
      }
    })
    .onUpdate((event) => {
      if (width <= 0) return;
      const ratio = Math.max(0, Math.min(1, event.x / width));
      localProgress.value = ratio;
      runOnJS(onScrub)(ratio);
    })
    .onFinalize(() => {
      isDragging.value = false;
      dragging.value = withSpring(0, motion.spring);
      runOnJS(onScrubEnd)(localProgress.value);
    });

  const trackStyle = useAnimatedStyle(() => ({
    height: 5 + dragging.value * 3,
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: `${localProgress.value * 100}%`,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    left: `${localProgress.value * 100}%`,
    transform: [{ translateX: -7 }, { scale: 1 + dragging.value * 0.25 }],
    opacity: 0.65 + dragging.value * 0.35,
  }));

  return (
    <GestureDetector gesture={pan}>
      <View
        style={styles.hitArea}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessibilityRole="adjustable"
        accessibilityLabel="Wiedergabeposition"
      >
        <Animated.View
          style={[
            styles.track,
            trackStyle,
            { backgroundColor: colors.progressTrack, borderRadius: radius.pill },
          ]}
        >
          <Animated.View style={[StyleSheet.absoluteFillObject, fillStyle]}>
            <Gradient token={colors.gradient.progress} style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]} />
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[
            styles.thumb,
            thumbStyle,
            { backgroundColor: colors.media.foreground, borderColor: colors.primary },
          ]}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  hitArea: { height: 28, justifyContent: 'center' },
  track: { width: '100%', overflow: 'hidden' },
  thumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
  },
});
