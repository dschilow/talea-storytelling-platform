import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import type { ThemePalette } from '@/theme/tokens';
import { Touchable } from './Pressable';
import { Gradient } from './Gradient';

export type CardVariant = 'surface' | 'elevated' | 'inset' | 'outline' | 'tinted';

interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  padded?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Shadow ramp key; defaults to `soft` for surface, `medium` for elevated. */
  elevation?: 'none' | 'soft' | 'medium' | 'strong';
  /** Gradient wash for the `tinted` variant. */
  tint?: keyof ThemePalette['gradient'];
  accessibilityLabel?: string;
}

/**
 * The card surface used across the app.
 *
 * Opaque fills with soft ink-tinted shadows. `boxShadow` is painted as the
 * view's own background, so clipping children to the rounded corners does not
 * cut the shadow off.
 */
export function Card({
  children,
  variant = 'surface',
  padded = true,
  onPress,
  onLongPress,
  style,
  elevation,
  tint = 'primary',
  accessibilityLabel,
}: CardProps) {
  const { colors, radius, spacing, shadows } = useTheme();

  const shadowKey = elevation ?? (variant === 'elevated' ? 'medium' : variant === 'surface' || variant === 'tinted' ? 'soft' : 'none');
  const flat = StyleSheet.flatten(style) ?? {};
  const cornerRadius = typeof flat.borderRadius === 'number' ? flat.borderRadius : radius.lg;

  const base: StyleProp<ViewStyle> = [
    {
      overflow: 'hidden',
      borderRadius: cornerRadius,
      borderWidth: variant === 'outline' ? 1.5 : variant === 'inset' ? 0 : 1,
      borderColor: variant === 'outline' ? colors.border.strong : colors.border.light,
      backgroundColor:
        variant === 'inset'
          ? colors.surface.inset
          : variant === 'outline' || variant === 'tinted'
            ? 'transparent'
            : colors.surface.primary,
    },
    padded && { padding: spacing.base },
    shadows[shadowKey],
    style,
  ];

  const body = (
    <>
      {variant === 'tinted' || variant === 'elevated' ? (
        <Gradient
          token={variant === 'tinted' ? colors.gradient[tint] : colors.surface.elevated}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      {children}
    </>
  );

  if (onPress || onLongPress) {
    return (
      <Touchable onPress={onPress} onLongPress={onLongPress} style={base} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
        {body}
      </Touchable>
    );
  }

  return <View style={base}>{body}</View>;
}
