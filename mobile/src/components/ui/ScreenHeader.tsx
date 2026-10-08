import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowLeft } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';
import { IconButton } from './IconButton';

interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
  /** Small uppercase line above a large title. */
  eyebrow?: string;
  /** Shows the back button. Defaults to true when the stack can go back. */
  showBack?: boolean;
  onBack?: () => void;
  /** Rendered on the right side. */
  actions?: ReactNode;
  /** Large serif title, used on top-level tab screens. */
  large?: boolean;
}

/**
 * Shared screen header.
 *
 * Native stack headers are disabled app-wide so every screen can compose its
 * own chrome over the page background. Top-level screens get a large serif
 * title (the storybook voice); pushed screens a compact bar with a back button.
 */
export function ScreenHeader({ title, subtitle, eyebrow, showBack, onBack, actions, large }: ScreenHeaderProps) {
  const { colors, spacing } = useTheme();
  const navigation = useNavigation();

  const canGoBack = navigation.canGoBack();
  const displayBack = showBack ?? canGoBack;
  const back = displayBack ? (
    <IconButton onPress={() => (onBack ? onBack() : navigation.goBack())} accessibilityLabel="Zurück" hapticIntent="light">
      <ArrowLeft size={20} color={colors.text.primary} strokeWidth={2.2} />
    </IconButton>
  ) : null;

  if (large) {
    return (
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, gap: spacing.md }}>
        {back || actions ? (
          <View style={styles.row}>
            {back}
            <View style={styles.flex} />
            {actions ? <View style={[styles.actions, { gap: spacing.sm }]}>{actions}</View> : null}
          </View>
        ) : null}
        <Animated.View entering={FadeInDown.duration(380)} style={{ gap: 4 }}>
          {eyebrow ? (
            <Text variant="overline" tone="accent">
              {eyebrow}
            </Text>
          ) : null}
          {title ? (
            <Text variant="displayLg" numberOfLines={2}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text variant="bodySm" tone="secondary" numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.row, { paddingHorizontal: spacing.base, paddingVertical: spacing.md, gap: spacing.md }]}>
      {back}
      <View style={styles.titles}>
        {title ? (
          <Text variant="displaySm" numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
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
  return (
    <IconButton onPress={onPress} accessibilityLabel={accessibilityLabel} badge={badge}>
      {children}
    </IconButton>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  titles: { flex: 1, gap: 1 },
  actions: { flexDirection: 'row', alignItems: 'center' },
});
