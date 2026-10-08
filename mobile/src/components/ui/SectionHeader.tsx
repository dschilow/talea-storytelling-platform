import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';
import { Touchable } from './Pressable';

interface SectionHeaderProps {
  title: string;
  /** Small line under the title. */
  caption?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Section title in the storybook serif, with an optional "see all" link. */
export function SectionHeader({ title, caption, actionLabel, onAction }: SectionHeaderProps) {
  const { colors, spacing, radius } = useTheme();

  return (
    <View style={[styles.row, { paddingHorizontal: spacing.lg, gap: spacing.md }]}>
      <View style={styles.titles}>
        <Text variant="displaySm">{title}</Text>
        {caption ? (
          <Text variant="caption" tone="tertiary">
            {caption}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Touchable
          onPress={onAction}
          hapticIntent="light"
          style={[styles.action, { borderRadius: radius.pill, backgroundColor: colors.primarySoft }]}
          accessibilityRole="button"
          accessibilityLabel={`${title}: ${actionLabel}`}
        >
          <Text variant="labelSm" tone="accent">
            {actionLabel}
          </Text>
          <ChevronRight size={14} color={colors.primary} strokeWidth={2.6} />
        </Touchable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  titles: { flex: 1, gap: 2 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 12, paddingRight: 8, height: 30 },
});
