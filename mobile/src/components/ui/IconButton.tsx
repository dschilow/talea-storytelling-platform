import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

import { useTheme } from '@/theme/ThemeProvider';
import type { HapticIntent } from '@/lib/haptics';
import { Touchable } from './Pressable';
import { Text } from './Text';
import { Gradient } from './Gradient';

export type IconButtonVariant = 'surface' | 'media' | 'brand' | 'plain';

interface IconButtonProps {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  /** `surface` on pages, `media` over imagery, `brand` for a filled accent. */
  variant?: IconButtonVariant;
  size?: number;
  badge?: number;
  disabled?: boolean;
  hapticIntent?: HapticIntent | null;
  style?: StyleProp<ViewStyle>;
}

/** Round icon-only control used in headers, readers and media chrome. */
export function IconButton({
  children,
  onPress,
  accessibilityLabel,
  variant = 'surface',
  size = 44,
  badge,
  disabled,
  hapticIntent = 'selection',
  style,
}: IconButtonProps) {
  const { colors, shadows, isDark } = useTheme();

  const shell: ViewStyle =
    variant === 'surface'
      ? { backgroundColor: colors.surface.primary, borderColor: colors.border.light, borderWidth: 1, ...shadows.soft }
      : variant === 'media'
        ? { borderColor: colors.media.chromeBorder, borderWidth: StyleSheet.hairlineWidth }
        : variant === 'brand'
          ? shadows.glow
          : {};

  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      hapticIntent={hapticIntent}
      pressScale={0.9}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.base, { width: size, height: size, borderRadius: size / 2 }, shell, style]}
    >
      {variant === 'media' ? (
        <View style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: size / 2 }]}>
          <BlurView intensity={isDark ? 30 : 24} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.media.controlBg }]} />
        </View>
      ) : variant === 'brand' ? (
        <Gradient token={colors.gradient.action} style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]} />
      ) : null}
      {children}
      {badge && badge > 0 ? (
        <View style={[styles.badge, { borderColor: colors.pageSolid }]}>
          <Gradient token={colors.gradient.action} style={[StyleSheet.absoluteFill, { borderRadius: 9 }]} />
          <Text variant="caption" tone="inverse" style={styles.badgeText}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      ) : null}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  clip: { overflow: 'hidden' },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    overflow: 'hidden',
  },
  badgeText: { fontSize: 9.5, lineHeight: 12 },
});
