import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';

interface RailProps<T> {
  data: readonly T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  /** Width of one item; enables snapping and the depth effect. */
  itemWidth: number;
  gap?: number;
  /** Scale + fade items as they leave the focus position. */
  depth?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Rendered after the last item (e.g. an "add" tile). */
  footer?: ReactNode;
}

/**
 * Horizontal content rail with snapping. With `depth`, items ease down in
 * scale as they slide away from the leading edge, which gives a carousel a
 * physical, layered feel without any per-frame JS.
 */
export function Rail<T>({ data, keyExtractor, renderItem, itemWidth, gap, depth = false, contentStyle, footer }: RailProps<T>) {
  const { spacing } = useTheme();
  const scrollX = useSharedValue(0);
  const itemGap = gap ?? spacing.md;
  const interval = itemWidth + itemGap;

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.value = event.contentOffset.x;
  });

  return (
    <Animated.ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      snapToInterval={interval}
      decelerationRate="fast"
      contentContainerStyle={[{ paddingHorizontal: spacing.lg, gap: itemGap }, contentStyle]}
    >
      {data.map((item, index) =>
        depth ? (
          <DepthItem key={keyExtractor(item, index)} index={index} interval={interval} scrollX={scrollX} width={itemWidth}>
            {renderItem(item, index)}
          </DepthItem>
        ) : (
          <View key={keyExtractor(item, index)} style={{ width: itemWidth }}>
            {renderItem(item, index)}
          </View>
        )
      )}
      {footer}
    </Animated.ScrollView>
  );
}

function DepthItem({
  children,
  index,
  interval,
  scrollX,
  width,
}: {
  children: ReactNode;
  index: number;
  interval: number;
  scrollX: SharedValue<number>;
  width: number;
}) {
  const style = useAnimatedStyle(() => {
    const distance = (scrollX.value - index * interval) / interval;
    return {
      transform: [
        { scale: interpolate(Math.abs(distance), [0, 1, 2], [1, 0.93, 0.88], Extrapolation.CLAMP) },
        { translateY: interpolate(Math.abs(distance), [0, 1], [0, 8], Extrapolation.CLAMP) },
      ],
      opacity: interpolate(distance, [-2, -1, 0, 1], [0.75, 0.92, 1, 0.6], Extrapolation.CLAMP),
    };
  });

  return <Animated.View style={[styles.item, { width }, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  item: { transformOrigin: 'center bottom' },
});
