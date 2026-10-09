import React, { type ReactNode } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { Button } from './Button';
import { Text } from './Text';

const TAVI = require('../../../assets/tavi.png');

interface EmptyStateProps {
  icon?: ReactNode;
  /** An illustration instead of the icon. `'tavi'` shows the mascot. */
  illustration?: 'tavi' | ImageSourcePropType | string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  compact?: boolean;
}

/**
 * Empty and zero-data states, in the manner of iOS "content unavailable"
 * views: a quiet symbol, a bold title, one line of help and the next action —
 * an empty list is an invitation, not an error.
 */
export function EmptyState({
  icon,
  illustration,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  compact,
}: EmptyStateProps) {
  const { colors, spacing } = useTheme();
  const art = illustration === 'tavi' ? TAVI : typeof illustration === 'string' ? { uri: illustration } : illustration;
  const artSize = compact ? 96 : 128;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[styles.container, { paddingVertical: compact ? spacing.xl : spacing.huge, gap: spacing.sm }]}
    >
      {art ? (
        <Image source={art} style={{ width: artSize, height: artSize, marginBottom: spacing.xs }} contentFit="contain" />
      ) : icon ? (
        <View style={[styles.icon, { backgroundColor: colors.surface.inset, marginBottom: spacing.sm }]}>{icon}</View>
      ) : null}

      <Text variant="displaySm" center>
        {title}
      </Text>

      {description ? (
        <Text variant="bodySm" tone="secondary" center style={{ maxWidth: 300 }}>
          {description}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.md, gap: spacing.xs, alignItems: 'center' }}>
          <Button label={actionLabel} onPress={onAction} size="md" />
          {secondaryActionLabel && onSecondaryAction ? (
            <Button label={secondaryActionLabel} onPress={onSecondaryAction} variant="ghost" size="sm" />
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
});
