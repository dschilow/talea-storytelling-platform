import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';
import { IconButton } from './IconButton';

interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
  /** Small uppercase line above a large title (e.g. today's date). */
  eyebrow?: string;
  /** Shows the back button. Defaults to true when the stack can go back. */
  showBack?: boolean;
  onBack?: () => void;
  /** Rendered on the right side. */
  actions?: ReactNode;
  /** Large left-aligned title, used on top-level tab screens. */
  large?: boolean;
}

/**
 * Navigation bar, after iOS: top-level screens get a large, left-aligned bold
 * title under a row of glass toolbar buttons; pushed screens get a glass back
 * button and a centred inline title.
 */
export function ScreenHeader({ title, subtitle, eyebrow, showBack, onBack, actions, large }: ScreenHeaderProps) {
  const { colors, spacing } = useTheme();
  const navigation = useNavigation();

  const canGoBack = navigation.canGoBack();
  const displayBack = showBack ?? canGoBack;
  const back = displayBack ? (
    <IconButton onPress={() => (onBack ? onBack() : navigation.goBack())} accessibilityLabel="Zurück" hapticIntent="light">
      <ChevronLeft size={24} color={colors.text.primary} strokeWidth={2.2} style={{ marginLeft: -2 }} />
    </IconButton>
  ) : null;

  if (large) {
    return (
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.xs }}>
        {back || actions ? (
          <View style={[styles.row, { minHeight: 44, marginBottom: spacing.xs }]}>
            {back}
            <View style={styles.flex} />
            {actions ? <View style={[styles.actions, { gap: spacing.sm }]}>{actions}</View> : null}
          </View>
        ) : null}
        {eyebrow ? (
          <Text variant="overline" tone="secondary">
            {eyebrow}
          </Text>
        ) : null}
        {title ? (
          <Text variant="displayXl" numberOfLines={2}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text variant="bodySm" tone="secondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.row, { paddingHorizontal: spacing.base, paddingVertical: spacing.sm, minHeight: 60 }]}>
      {/* Centred across the full width, independent of how many buttons sit on either side. */}
      <View style={[StyleSheet.absoluteFill, styles.titles]} pointerEvents="none">
        {title ? (
          <Text variant="title" numberOfLines={1} center>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text variant="caption" tone="secondary" numberOfLines={1} center>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {back}
      <View style={styles.flex} />
      {actions ? <View style={[styles.actions, { gap: spacing.sm }]}>{actions}</View> : null}
    </View>
  );
}

/** Circular glass button sized to sit in a header's action slot. */
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
  return (
    <IconButton onPress={onPress} accessibilityLabel={accessibilityLabel} badge={badge}>
      {children}
    </IconButton>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  titles: { justifyContent: 'center', gap: 1, paddingHorizontal: 72 },
  actions: { flexDirection: 'row', alignItems: 'center' },
});
