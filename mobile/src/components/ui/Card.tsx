import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Touchable } from './Pressable';
import { Gradient } from './Gradient';

export type CardVariant = 'surface' | 'elevated' | 'inset' | 'outline';

interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  padded?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Elevation ramp key; defaults to `soft` for surface, `medium` for elevated. */
  elevation?: 'none' | 'soft' | 'medium' | 'strong';
  accessibilityLabel?: string;
}

/**
 * The card surface used across the app.
 *
 * `elevated` renders the two-stop vertical gradient from `--talea-surface-elevated`;
 * everything else is a flat translucent fill over the page wash — the same
 * layering model as the web's glass surfaces, without a blur pass per card
 * (blur is reserved for chrome that actually overlaps scrolling content).
 */
export function Card({ children, variant = 'surface', padded = true, onPress, style, elevation, accessibilityLabel }: CardProps) {
  const { colors, radius, spacing, shadows } = useTheme();

  const shadowKey = elevation ?? (variant === 'elevated' ? 'medium' : variant === 'outline' ? 'none' : 'soft');

  const base: StyleProp<ViewStyle> = [
    styles.base,
    {
      borderRadius: radius.lg,
      borderColor: variant === 'outline' ? colors.border.strong : colors.border.light,
      backgroundColor:
        variant === 'inset'
          ? colors.surface.inset
          : variant === 'outline'
            ? 'transparent'
            : variant === 'elevated'
              ? 'transparent'
              : colors.surface.primary,
    },
    padded && { padding: spacing.base },
    shadows[shadowKey],
    style,
  ];

  const body = (
    <>
      {variant === 'elevated' ? (
        <Gradient token={colors.surface.elevated} style={[StyleSheet.absoluteFill, { borderRadius: radius.lg }]} />
      ) : null}
      {children}
    </>
  );

  if (onPress) {
    return (
      <Touchable onPress={onPress} style={base} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
        {body}
      </Touchable>
    );
  }

  return <View style={base}>{body}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
