import React, { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import type { HapticIntent } from '@/lib/haptics';
import { Touchable } from './Pressable';
import { Text, type TextVariant } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'outline' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Rendered before the label. */
  icon?: ReactNode;
  /** Rendered after the label. */
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  hapticIntent?: HapticIntent | null;
  accessibilityHint?: string;
}

const SIZES: Record<ButtonSize, { height: number; paddingHorizontal: number; gap: number; textVariant: TextVariant }> = {
  sm: { height: 36, paddingHorizontal: 16, gap: 6, textVariant: 'labelSm' },
  md: { height: 46, paddingHorizontal: 22, gap: 8, textVariant: 'label' },
  lg: { height: 54, paddingHorizontal: 26, gap: 8, textVariant: 'title' },
};

/**
 * Capsule buttons in the iOS manner.
 *
 * - `primary`   filled with the accent (prominent)
 * - `soft`      accent-tinted fill, accent label (bordered)
 * - `secondary` neutral grey fill, label colour
 * - `ghost`     plain accent text
 * - `outline`   hairline capsule
 * - `danger`    destructive, red-tinted
 *
 * Disabled buttons switch to the neutral fill with a muted label rather than
 * fading, so the state is unmistakable and the text stays legible.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  icon,
  trailingIcon,
  fullWidth,
  style,
  hapticIntent = 'light',
  accessibilityHint,
}: ButtonProps) {
  const { colors, radius } = useTheme();
  const metrics = SIZES[size];
  const isDisabled = Boolean(disabled || loading);

  const surfaces: Record<ButtonVariant, ViewStyle> = {
    primary: { backgroundColor: colors.primary },
    soft: { backgroundColor: colors.primarySoft },
    secondary: { backgroundColor: colors.surface.inset },
    ghost: { backgroundColor: 'transparent' },
    outline: { backgroundColor: 'transparent', borderColor: colors.border.strong, borderWidth: 1 },
    danger: { backgroundColor: colors.dangerSoft },
  };

  const labels: Record<ButtonVariant, string> = {
    primary: colors.primaryForeground,
    soft: colors.primary,
    secondary: colors.text.primary,
    ghost: colors.primary,
    outline: colors.text.primary,
    danger: colors.danger,
  };

  const filled = variant === 'primary' || variant === 'soft' || variant === 'danger';
  const surface = disabled && filled ? { backgroundColor: colors.surface.inset } : surfaces[variant];
  const labelColor = disabled ? colors.text.muted : labels[variant];

  return (
    <Touchable
      onPress={onPress}
      disabled={isDisabled}
      hapticIntent={hapticIntent}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      disabledOpacity={1}
      style={[
        styles.base,
        { height: metrics.height, paddingHorizontal: metrics.paddingHorizontal, borderRadius: radius.pill },
        surface,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      <View style={[styles.content, { gap: metrics.gap }]}>
        {loading ? (
          <ActivityIndicator size="small" color={labels[variant]} />
        ) : (
          <>
            {icon}
            <Text variant={metrics.textVariant} numberOfLines={1} style={{ color: labelColor }}>
              {label}
            </Text>
            {trailingIcon}
          </>
        )}
      </View>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
