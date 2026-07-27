import React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fontFamily } from '@/theme/typography';
import type { TypeScale } from '@/theme/typography';

export type TextVariant = keyof TypeScale;
export type TextTone = 'primary' | 'secondary' | 'tertiary' | 'muted' | 'inverse' | 'accent' | 'danger' | 'success' | 'warning';
export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold';

const WEIGHT_TO_ROLE = {
  regular: 'bodyRegular',
  medium: 'body',
  semibold: 'bodySemibold',
  bold: 'bodyBold',
  extrabold: 'bodyExtraBold',
} as const;

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
  /** Overrides the variant's weight while keeping its size and rhythm. */
  weight?: TextWeight;
  center?: boolean;
}

/**
 * Typed text primitive. Every string in the app renders through this, so the
 * type scale, colour tones and font fallbacks stay consistent — screen code
 * never hard-codes a fontSize or a hex colour.
 */
export function Text({ variant = 'body', tone = 'primary', weight, center, style, ...rest }: TextProps) {
  const theme = useTheme();

  const toneColor: Record<TextTone, string> = {
    primary: theme.colors.text.primary,
    secondary: theme.colors.text.secondary,
    tertiary: theme.colors.text.tertiary,
    muted: theme.colors.text.muted,
    inverse: theme.colors.text.inverse,
    accent: theme.colors.primary,
    danger: theme.colors.danger,
    success: theme.colors.success,
    warning: theme.colors.warning,
  };

  return (
    <RNText
      {...rest}
      style={[
        theme.type[variant],
        { color: toneColor[tone] },
        weight ? { fontFamily: fontFamily(WEIGHT_TO_ROLE[weight]) } : null,
        center ? { textAlign: 'center' } : null,
        style,
      ]}
    />
  );
}
