import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { Minus, Plus } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { haptic } from '@/lib/haptics';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  /** Secondary caption, e.g. a derived description of the value. */
  hint?: string;
}

/**
 * Numeric picker with a draggable track.
 *
 * Combines +/- buttons (precise) with a drag track (fast) because the ranges
 * here are wide — age can be 1..150 for a fantasy avatar, and tapping "+" a
 * hundred times is not a design.
 */
export function Stepper({ label, value, min, max, step = 1, unit, onChange, hint }: StepperProps) {
  const { colors, spacing, radius } = useTheme();
  const trackWidth = useSharedValue(0);

  const clamp = (next: number) => Math.min(max, Math.max(min, Math.round(next / step) * step));

  const setFromRatio = (ratio: number) => {
    const next = clamp(min + ratio * (max - min));
    if (next !== value) {
      onChange(next);
      haptic('selection');
    }
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((event) => {
      if (trackWidth.value <= 0) return;
      runOnJS(setFromRatio)(Math.max(0, Math.min(1, event.x / trackWidth.value)));
    })
    .onUpdate((event) => {
      if (trackWidth.value <= 0) return;
      runOnJS(setFromRatio)(Math.max(0, Math.min(1, event.x / trackWidth.value)));
    });

  const adjust = (delta: number) => {
    const next = clamp(value + delta);
    if (next !== value) {
      onChange(next);
      haptic('light');
    }
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.header}>
        <Text variant="labelSm" tone="secondary" style={{ flex: 1 }}>
          {label}
        </Text>
        <Text variant="label" tone="accent">
          {value}
          {unit ? ` ${unit}` : ''}
        </Text>
      </View>

      <View style={[styles.row, { gap: spacing.md }]}>
        <Touchable
          onPress={() => adjust(-step)}
          disabled={value <= min}
          hapticIntent={null}
          style={[styles.button, { borderRadius: radius.pill, backgroundColor: colors.surface.inset, borderColor: colors.border.light }]}
          accessibilityLabel={`${label} verringern`}
        >
          <Minus size={16} color={value <= min ? colors.text.muted : colors.text.primary} />
        </Touchable>

        <GestureDetector gesture={pan}>
          <View
            style={styles.track}
            onLayout={(event) => {
              trackWidth.value = event.nativeEvent.layout.width;
            }}
            accessibilityRole="adjustable"
            accessibilityLabel={label}
            accessibilityValue={{ min, max, now: value }}
          >
            <ProgressBar progress={(value - min) / (max - min)} height={8} animated={false} />
          </View>
        </GestureDetector>

        <Touchable
          onPress={() => adjust(step)}
          disabled={value >= max}
          hapticIntent={null}
          style={[styles.button, { borderRadius: radius.pill, backgroundColor: colors.surface.inset, borderColor: colors.border.light }]}
          accessibilityLabel={`${label} erhöhen`}
        >
          <Plus size={16} color={value >= max ? colors.text.muted : colors.text.primary} />
        </Touchable>
      </View>

      {hint ? (
        <Text variant="caption" tone="tertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  button: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  track: { flex: 1, justifyContent: 'center', height: 34 },
});
