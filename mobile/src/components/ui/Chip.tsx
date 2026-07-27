import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Touchable } from './Pressable';
import { Text } from './Text';

type ChipTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

interface ChipProps {
  label: string;
  icon?: ReactNode;
  tone?: ChipTone;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  size?: 'sm' | 'md';
}

/** Compact status/filter pill — the native equivalent of `taleaChipClass`. */
export function Chip({ label, icon, tone = 'neutral', selected, onPress, style, size = 'md' }: ChipProps) {
  const { colors, radius } = useTheme();

  const toneStyles: Record<ChipTone, { bg: string; border: string; text: typeof colors.text.primary }> = {
    neutral: { bg: colors.surface.inset, border: colors.border.light, text: colors.text.secondary },
    accent: { bg: colors.successSoft, border: colors.border.accent, text: colors.primary },
    success: { bg: colors.successSoft, border: colors.border.accent, text: colors.success },
    warning: { bg: colors.warningSoft, border: colors.border.soft, text: colors.warning },
    danger: { bg: colors.dangerSoft, border: colors.dangerBorder, text: colors.danger },
  };

  const resolved = selected ? toneStyles.accent : toneStyles[tone];
  const height = size === 'sm' ? 24 : 30;

  const body = (
    <View
      style={[
        styles.chip,
        {
          height,
          borderRadius: radius.pill,
          backgroundColor: resolved.bg,
          borderColor: selected ? colors.border.accent : resolved.border,
          borderWidth: selected ? 1 : StyleSheet.hairlineWidth,
          paddingHorizontal: size === 'sm' ? 8 : 11,
        },
        style,
      ]}
    >
      {icon}
      <Text variant={size === 'sm' ? 'caption' : 'labelSm'} style={{ color: resolved.text }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) return body;

  return (
    <Touchable onPress={onPress} pressScale={0.94} accessibilityRole="button" accessibilityState={{ selected }}>
      {body}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
  },
});
