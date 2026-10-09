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
  /** Shadow ramp key; cards sit flat on the grouped page by default. */
  elevation?: 'none' | 'soft' | 'medium' | 'strong';
  /** Colour wash for the `tinted` variant. */
  tint?: keyof ThemePalette['gradient'];
  accessibilityLabel?: string;
}

/**
 * Content card. Like iOS grouped content: an opaque rounded surface sitting
 * flat on the grey page — no border, no shadow unless it floats.
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

  const shadowKey = elevation ?? (variant === 'elevated' ? 'medium' : 'none');
  const flat = StyleSheet.flatten(style) ?? {};
  const cornerRadius = typeof flat.borderRadius === 'number' ? flat.borderRadius : radius.lg;

  const base: StyleProp<ViewStyle> = [
    {
      overflow: 'hidden',
      borderRadius: cornerRadius,
      backgroundColor:
        variant === 'inset'
          ? colors.surface.inset
          : variant === 'outline' || variant === 'tinted'
            ? 'transparent'
            : colors.surface.primary,
    },
    variant === 'outline' && { borderWidth: 1, borderColor: colors.border.soft },
    padded && { padding: spacing.base },
    shadows[shadowKey],
    style,
  ];

  const body = (
    <>
      {variant === 'tinted' ? <Gradient token={colors.gradient[tint]} style={StyleSheet.absoluteFill} pointerEvents="none" /> : null}
      {children}
    </>
  );

  if (onPress || onLongPress) {
    return (
      <Touchable
        onPress={onPress}
        onLongPress={onLongPress}
        pressScale={0.98}
        style={base}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {body}
      </Touchable>
    );
  }

  return <View style={base}>{body}</View>;
}
