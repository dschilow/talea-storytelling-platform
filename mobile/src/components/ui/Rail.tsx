import React, { type ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

interface RailProps<T> {
  data: readonly T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  /** Width of one item; enables snapping to item boundaries. */
  itemWidth: number;
  gap?: number;
  contentStyle?: StyleProp<ViewStyle>;
  /** Rendered after the last item (e.g. an "add" tile). */
  footer?: ReactNode;
}

/** Horizontal shelf with snapping, like the shelves in Books, Music and TV. */
export function Rail<T>({ data, keyExtractor, renderItem, itemWidth, gap, contentStyle, footer }: RailProps<T>) {
  const { spacing } = useTheme();
  const itemGap = gap ?? spacing.md;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={itemWidth + itemGap}
      decelerationRate="fast"
      contentContainerStyle={[{ paddingHorizontal: spacing.lg, gap: itemGap }, contentStyle]}
    >
      {data.map((item, index) => (
        <View key={keyExtractor(item, index)} style={{ width: itemWidth }}>
          {renderItem(item, index)}
        </View>
      ))}
      {footer}
    </ScrollView>
  );
}
