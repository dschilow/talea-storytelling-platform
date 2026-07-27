import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Button } from './Button';
import { Text } from './Text';
import { Gradient } from './Gradient';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  compact?: boolean;
}

/**
 * Empty and zero-data states.
 *
 * Always offers the next action rather than just reporting absence — an empty
 * story list is an invitation to create one, not an error.
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  compact,
}: EmptyStateProps) {
  const { colors, spacing, radius } = useTheme();

  return (
    <View style={[styles.container, { paddingVertical: compact ? spacing.xl : spacing.huge, gap: spacing.md }]}>
      {icon ? (
        <View style={[styles.iconShell, { borderRadius: radius.xxl, borderColor: colors.border.light }]}>
          <Gradient token={colors.gradient.secondary} style={StyleSheet.absoluteFill} />
          {icon}
        </View>
      ) : null}

      <Text variant="headingSm" center>
        {title}
      </Text>

      {description ? (
        <Text variant="bodySm" tone="secondary" center style={{ maxWidth: 300 }}>
          {description}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.xs, gap: spacing.sm, alignItems: 'center' }}>
          <Button label={actionLabel} onPress={onAction} size="md" />
          {secondaryActionLabel && onSecondaryAction ? (
            <Button label={secondaryActionLabel} onPress={onSecondaryAction} variant="ghost" size="sm" />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  iconShell: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
