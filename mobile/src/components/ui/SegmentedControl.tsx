import React, { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { Touchable } from './Pressable';
import { Text } from './Text';

export interface Segment<T extends string> {
  id: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Pill-shaped tab switcher with a thumb that springs between segments — used
 * wherever a screen has two or three views of the same content.
 */
export function SegmentedControl<T extends string>({ segments, value, onChange, style }: SegmentedControlProps<T>) {
  const { colors, radius, motion, isDark } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, segments.findIndex((segment) => segment.id === value));
  const segmentWidth = width > 0 ? (width - 6) / segments.length : 0;
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = withSpring(index * segmentWidth, motion.springSoft);
  }, [index, motion.springSoft, segmentWidth, x]);

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      style={[styles.track, { borderRadius: radius.pill, backgroundColor: colors.surface.inset }, style]}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      {segmentWidth > 0 ? (
        <Animated.View
          style={[
            styles.thumb,
            {
              width: segmentWidth,
              borderRadius: radius.pill,
              backgroundColor: isDark ? '#636366' : colors.surface.primary,
            },
            styles.thumbShadow,
            thumbStyle,
          ]}
        />
      ) : null}
      {segments.map((segment) => {
        const active = segment.id === value;
        return (
          <Touchable
            key={segment.id}
            onPress={() => onChange(segment.id)}
            pressScale={0.97}
            style={styles.segment}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={segment.label}
          >
            <Text variant="labelSm" tone={active ? 'primary' : 'secondary'} numberOfLines={1}>
              {segment.label}
            </Text>
          </Touchable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 3, height: 38 },
  thumb: { position: 'absolute', top: 3, bottom: 3, left: 3 },
  thumbShadow: { boxShadow: '0px 3px 8px rgba(0, 0, 0, 0.12), 0px 1px 1px rgba(0, 0, 0, 0.04)' },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
