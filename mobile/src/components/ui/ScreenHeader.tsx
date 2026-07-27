import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';
import { Touchable } from './Pressable';

interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
  /** Shows the back chevron. Defaults to true when the stack can go back. */
  showBack?: boolean;
  onBack?: () => void;
  /** Rendered on the right side. */
  actions?: ReactNode;
  /** Large display title, used on top-level tab screens. */
  large?: boolean;
}

/**
 * Shared screen header.
 *
 * Native stack headers are disabled app-wide so every screen can compose its own
 * chrome over the page background; this is the standard bar those screens use.
 */
export function ScreenHeader({ title, subtitle, showBack, onBack, actions, large }: ScreenHeaderProps) {
  const { colors, spacing, radius } = useTheme();
  const navigation = useNavigation();

  const canGoBack = navigation.canGoBack();
  const displayBack = showBack ?? canGoBack;

  return (
    <View style={[styles.container, { paddingHorizontal: spacing.base, paddingVertical: spacing.md, gap: spacing.md }]}>
      {displayBack ? (
        <Touchable
          onPress={() => (onBack ? onBack() : navigation.goBack())}
          style={[
            styles.backButton,
            { borderRadius: radius.pill, backgroundColor: colors.surface.primary, borderColor: colors.border.light },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
        >
          <ChevronLeft size={20} color={colors.text.primary} />
        </Touchable>
      ) : null}

      <View style={styles.titles}>
        {title ? (
          <Text variant={large ? 'displaySm' : 'headingMd'} numberOfLines={large ? 2 : 1}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text variant="bodySm" tone="secondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {actions ? <View style={[styles.actions, { gap: spacing.sm }]}>{actions}</View> : null}
    </View>
  );
}

/** Circular icon button sized to sit in a header's action slot. */
export function HeaderAction({
  children,
  onPress,
  accessibilityLabel,
  badge,
}: {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  badge?: number;
}) {
  const { colors, radius } = useTheme();

  return (
    <Touchable
      onPress={onPress}
      style={[
        styles.backButton,
        { borderRadius: radius.pill, backgroundColor: colors.surface.primary, borderColor: colors.border.light },
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
      {badge && badge > 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.primary, borderColor: colors.pageSolid }]}>
          <Text variant="caption" tone="inverse" style={{ fontSize: 9, lineHeight: 12 }}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      ) : null}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  titles: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
});
