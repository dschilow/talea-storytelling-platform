import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import type { HapticIntent } from '@/lib/haptics';
import { Touchable } from './Pressable';
import { Text } from './Text';
import { Glass } from './Glass';

export type IconButtonVariant = 'surface' | 'media' | 'brand' | 'plain';

interface IconButtonProps {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  /** `surface` glass on pages, `media` dark glass over imagery, `brand` filled accent. */
  variant?: IconButtonVariant;
  size?: number;
  badge?: number;
  disabled?: boolean;
  hapticIntent?: HapticIntent | null;
  style?: StyleProp<ViewStyle>;
}

/** Round toolbar control — the glass circle buttons of iOS 26 toolbars. */
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
  const { colors } = useTheme();
  const round = { width: size, height: size, borderRadius: size / 2 };

  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      hapticIntent={hapticIntent}
      pressScale={0.9}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[round, style]}
    >
      {variant === 'surface' || variant === 'media' ? (
        <Glass borderRadius={size / 2} tone={variant === 'media' ? 'dark' : 'auto'} style={[StyleSheet.absoluteFill, styles.center]}>
          {children}
        </Glass>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.center, { borderRadius: size / 2, backgroundColor: variant === 'brand' ? colors.primary : 'transparent' }]}>
          {children}
        </View>
      )}
      {badge && badge > 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.pageSolid }]}>
          <Text variant="caption" tone="inverse" style={styles.badgeText}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      ) : null}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 10, lineHeight: 12 },
});
