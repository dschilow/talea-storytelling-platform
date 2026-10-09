import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Touchable } from './Pressable';
import { Text } from './Text';

type ChipTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'gold' | 'media';

interface ChipProps {
  label: string;
  icon?: ReactNode;
  tone?: ChipTone;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  size?: 'sm' | 'md';
}

/**
 * Capsule label / filter.
 *
 * Filters rest on the neutral system fill; a selected filter inverts to the
 * label colour (black on light, white on dark), the way Apple's apps mark the
 * active scope. Status tones are soft tints of the system colours.
 */
export function Chip({ label, icon, tone = 'neutral', selected, onPress, style, size = 'md' }: ChipProps) {
  const { colors, radius, isDark } = useTheme();

  const toneStyles: Record<ChipTone, { bg: string; text: string }> = {
    neutral: { bg: colors.surface.inset, text: colors.text.primary },
    accent: { bg: colors.primarySoft, text: colors.primary },
    success: { bg: colors.successSoft, text: colors.success },
    warning: { bg: colors.warningSoft, text: colors.warning },
    danger: { bg: colors.dangerSoft, text: colors.danger },
    gold: { bg: colors.goldSoft, text: isDark ? colors.system.yellow : '#8A5A00' },
    media: { bg: colors.media.chromeBg, text: colors.media.foreground },
  };

  const resolved = selected
    ? { bg: colors.text.primary, text: isDark ? '#000000' : '#FFFFFF' }
    : toneStyles[tone];
  const small = size === 'sm';

  const body = (
    <View
      style={[
        styles.chip,
        {
          height: small ? 24 : 34,
          borderRadius: radius.pill,
          backgroundColor: resolved.bg,
          paddingHorizontal: small ? 9 : 14,
          gap: small ? 4 : 6,
        },
        style,
      ]}
    >
      {icon}
      <Text variant={small ? 'caption' : 'labelSm'} weight={small ? 'semibold' : undefined} style={{ color: resolved.text }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) return body;

  return (
    <Touchable onPress={onPress} pressScale={0.95} accessibilityRole="button" accessibilityState={{ selected }}>
      {body}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
});
