import React, { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/theme/ThemeProvider';
import type { HapticIntent } from '@/lib/haptics';
import { Shine } from '@/components/fx/Motion';
import { useAmbientMotion } from '@/components/fx/useAmbientMotion';
import { Touchable } from './Pressable';
import { Text, type TextVariant } from './Text';
import { Gradient } from './Gradient';

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'outline' | 'danger' | 'gold';
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
  /** Periodic glint across filled buttons. Defaults to on for large primary buttons. */
  shine?: boolean;
}

const SIZES: Record<ButtonSize, { height: number; paddingHorizontal: number; gap: number; textVariant: TextVariant }> = {
  sm: { height: 38, paddingHorizontal: 15, gap: 6, textVariant: 'labelSm' },
  md: { height: 50, paddingHorizontal: 22, gap: 8, textVariant: 'label' },
  lg: { height: 58, paddingHorizontal: 26, gap: 10, textVariant: 'headingSm' },
};

/**
 * Buttons.
 *
 * `primary` is the brand's magic gradient with a top light edge and a violet
 * glow; `gold` is reserved for rewards. Disabled filled buttons switch to a
 * quiet solid surface instead of a washed-out gradient, so the label stays
 * readable and the state is unmistakable.
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
  shine,
}: ButtonProps) {
  const { colors, radius, shadows } = useTheme();
  const ambient = useAmbientMotion();
  const metrics = SIZES[size];
  const isDisabled = Boolean(disabled || loading);
  const filled = variant === 'primary' || variant === 'gold';
  const showFilled = filled && !disabled;

  const surface: Record<Exclude<ButtonVariant, 'primary' | 'gold'>, ViewStyle> = {
    secondary: {
      backgroundColor: colors.surface.primary,
      borderColor: colors.border.soft,
      borderWidth: 1,
      ...shadows.soft,
    },
    soft: { backgroundColor: colors.primarySoft },
    ghost: { backgroundColor: 'transparent' },
    outline: { backgroundColor: 'transparent', borderColor: colors.border.strong, borderWidth: 1.5 },
    danger: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerBorder, borderWidth: 1 },
  };

  const labelColor = disabled && filled
    ? colors.text.tertiary
    : variant === 'primary'
      ? colors.primaryForeground
      : variant === 'gold'
        ? '#3A2600'
        : variant === 'danger'
          ? colors.danger
          : variant === 'soft' || variant === 'ghost'
            ? colors.primary
            : colors.text.primary;

  const content = (
    <View style={[styles.content, { gap: metrics.gap }]}>
      {loading ? (
        <ActivityIndicator size="small" color={labelColor} />
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
  );

  const shell: StyleProp<ViewStyle> = [
    styles.base,
    {
      height: metrics.height,
      paddingHorizontal: metrics.paddingHorizontal,
      borderRadius: radius.pill,
    },
    fullWidth && styles.fullWidth,
    !filled && surface[variant as Exclude<ButtonVariant, 'primary' | 'gold'>],
    filled && disabled && { backgroundColor: colors.surface.inset, borderWidth: 1, borderColor: colors.border.light },
    showFilled && (variant === 'gold' ? goldGlow : shadows.glow),
    style,
  ];

  const glint = showFilled && ambient && (shine ?? (size === 'lg' && variant === 'primary'));

  return (
    <Touchable
      onPress={onPress}
      disabled={isDisabled}
      hapticIntent={hapticIntent}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      style={shell}
      // Filled buttons communicate "disabled" through their surface already.
      disabledOpacity={filled ? 1 : undefined}
    >
      {showFilled ? (
        <View style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: radius.pill }]}>
          <Gradient token={variant === 'gold' ? colors.gradient.gold : colors.gradient.action} style={StyleSheet.absoluteFill} />
          {/* Top light edge — what makes the fill read as a lit, rounded object. */}
          <LinearGradient
            colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']}
            locations={[0, 0.55]}
            style={StyleSheet.absoluteFill}
          />
          {glint ? <Shine /> : null}
        </View>
      ) : null}
      {content}
    </Touchable>
  );
}

const goldGlow = { boxShadow: '0px 10px 26px rgba(233, 161, 38, 0.38)' };

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  clip: { overflow: 'hidden' },
  fullWidth: { alignSelf: 'stretch' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
