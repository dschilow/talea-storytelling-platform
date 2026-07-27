import React, { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import type { HapticIntent } from '@/lib/haptics';
import { Touchable } from './Pressable';
import { Text, type TextVariant } from './Text';
import { Gradient } from './Gradient';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
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
  sm: { height: 38, paddingHorizontal: 14, gap: 6, textVariant: 'labelSm' },
  md: { height: 48, paddingHorizontal: 20, gap: 8, textVariant: 'label' },
  lg: { height: 56, paddingHorizontal: 24, gap: 10, textVariant: 'title' },
};

/**
 * Primary action button.
 *
 * The `primary` variant uses the same two-stop gradient as the web's filled
 * buttons; the rest are flat surfaces. Loading state keeps the button's width
 * stable by swapping the label for a spinner in-place rather than collapsing.
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
  const { colors, radius, shadows } = useTheme();
  const metrics = SIZES[size];
  const isDisabled = disabled || loading;

  const surface: Record<Exclude<ButtonVariant, 'primary'>, ViewStyle> = {
    secondary: { backgroundColor: colors.surface.inset, borderColor: colors.border.soft, borderWidth: StyleSheet.hairlineWidth },
    ghost: { backgroundColor: 'transparent' },
    outline: { backgroundColor: 'transparent', borderColor: colors.border.strong, borderWidth: 1 },
    danger: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerBorder, borderWidth: 1 },
  };

  const labelTone = variant === 'primary' ? 'inverse' : variant === 'danger' ? 'danger' : 'primary';
  const spinnerColor = variant === 'primary' ? colors.primaryForeground : colors.primary;

  const content = (
    <View style={[styles.content, { gap: metrics.gap }]}>
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <>
          {icon}
          <Text variant={metrics.textVariant} tone={labelTone} numberOfLines={1}>
            {label}
          </Text>
          {trailingIcon}
        </>
      )}
    </View>
  );

  const shell: StyleProp<ViewStyle> = [
    styles.base,
    {
      height: metrics.height,
      paddingHorizontal: metrics.paddingHorizontal,
      borderRadius: radius.pill,
    },
    fullWidth && styles.fullWidth,
    variant !== 'primary' && surface[variant],
    style,
  ];

  if (variant === 'primary') {
    return (
      <Touchable
        onPress={onPress}
        disabled={isDisabled}
        hapticIntent={hapticIntent}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: Boolean(isDisabled), busy: Boolean(loading) }}
        style={[shell, !isDisabled && shadows.medium]}
      >
        <Gradient token={colors.gradient.action} style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]} />
        {content}
      </Touchable>
    );
  }

  return (
    <Touchable
      onPress={onPress}
      disabled={isDisabled}
      hapticIntent={hapticIntent}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(isDisabled), busy: Boolean(loading) }}
      style={shell}
    >
      {content}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fullWidth: { alignSelf: 'stretch' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
