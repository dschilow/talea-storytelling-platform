import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';

export interface GridOption {
  id: string;
  label: string;
  /** Emoji or short glyph shown above the label. */
  icon?: string;
  /** Solid colour swatch (CSS gradients from the shared catalogues are ignored). */
  color?: string;
}

interface OptionGridProps {
  options: readonly GridOption[];
  value: string | string[];
  onSelect: (id: string) => void;
  columns?: 2 | 3 | 4;
  /** Renders a colour swatch instead of an icon. */
  swatches?: boolean;
  multi?: boolean;
}

/**
 * Grid of selectable options.
 *
 * Drives every catalogue-backed choice in the avatar wizard (character type,
 * hair, eyes, skin, features). Selection state uses a ring + tint rather than a
 * checkmark badge so a 12-item grid stays readable at a glance.
 *
 * The shared catalogues express some swatches as CSS gradient strings, which RN
 * cannot render as a colour — those fall back to a neutral swatch with the icon,
 * so a "rainbow" option is still identifiable by its emoji.
 */
export function OptionGrid({ options, value, onSelect, columns = 3, swatches, multi }: OptionGridProps) {
  const { colors, spacing, radius } = useTheme();

  const selectedIds = Array.isArray(value) ? value : [value];
  const gapTotal = spacing.sm * (columns - 1);
  const widthPercent = `${(100 - (gapTotal / 3.4)) / columns}%` as const;

  return (
    <View style={[styles.grid, { gap: spacing.sm }]}>
      {options.map((option) => {
        const selected = selectedIds.includes(option.id);
        const isGradient = option.color?.includes('gradient');
        const swatchColor = swatches && option.color && !isGradient ? option.color : null;

        return (
          <Touchable
            key={option.id}
            onPress={() => onSelect(option.id)}
            style={[
              styles.tile,
              {
                width: widthPercent,
                borderRadius: radius.md,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.xs,
                gap: 6,
                backgroundColor: selected ? colors.surface.item : colors.surface.inset,
                borderColor: selected ? colors.border.accent : colors.border.light,
                borderWidth: selected ? 1.6 : StyleSheet.hairlineWidth,
              },
            ]}
            accessibilityRole={multi ? 'checkbox' : 'radio'}
            accessibilityState={multi ? { checked: selected } : { selected }}
            accessibilityLabel={option.label}
          >
            {swatchColor ? (
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: swatchColor, borderColor: colors.border.strong },
                ]}
              />
            ) : option.icon ? (
              <Text variant="headingSm">{option.icon}</Text>
            ) : null}

            <Text variant="caption" center numberOfLines={2} tone={selected ? 'accent' : 'secondary'}>
              {option.label}
            </Text>
          </Touchable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { alignItems: 'center', justifyContent: 'center', minHeight: 76 },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth },
});
