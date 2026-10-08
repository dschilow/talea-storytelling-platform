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
 * Compact status/filter pill.
 *
 * Filter chips sit on white with a hairline; selected chips flip to solid brand
 * violet. Status tones are soft tints with a matching ink, and `media` is a
 * frosted dark pill for use on top of cover art.
 */
export function Chip({ label, icon, tone = 'neutral', selected, onPress, style, size = 'md' }: ChipProps) {
  const { colors, radius, shadows } = useTheme();

  const toneStyles: Record<ChipTone, { bg: string; border: string; text: string }> = {
    neutral: { bg: colors.surface.primary, border: colors.border.soft, text: colors.text.secondary },
    accent: { bg: colors.primarySoft, border: 'transparent', text: colors.primary },
    success: { bg: colors.successSoft, border: 'transparent', text: colors.success },
    warning: { bg: colors.warningSoft, border: 'transparent', text: colors.warning },
    danger: { bg: colors.dangerSoft, border: 'transparent', text: colors.danger },
    gold: { bg: colors.goldSoft, border: 'transparent', text: colors.gold },
    media: { bg: colors.media.chromeBg, border: colors.media.chromeBorder, text: colors.media.foreground },
  };

  const resolved = selected
    ? { bg: colors.primary, border: colors.primary, text: colors.primaryForeground }
    : toneStyles[tone];
  const small = size === 'sm';

  const body = (
    <View
      style={[
        styles.chip,
        {
          height: small ? 24 : 36,
          borderRadius: radius.pill,
          backgroundColor: resolved.bg,
          borderColor: resolved.border,
          borderWidth: resolved.border === 'transparent' ? 0 : small ? StyleSheet.hairlineWidth : 1,
          paddingHorizontal: small ? 9 : 14,
          gap: small ? 4 : 6,
        },
        selected && !small ? shadows.glow : null,
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
    <Touchable onPress={onPress} pressScale={0.94} accessibilityRole="button" accessibilityState={{ selected }}>
      {body}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
});
