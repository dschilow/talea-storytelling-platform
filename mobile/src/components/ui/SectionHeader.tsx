import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';
import { Touchable } from './Pressable';

interface SectionHeaderProps {
  title: string;
  /** Small secondary line under the title. */
  caption?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Section title (iOS Title 2) with an optional plain "see all" link. */
export function SectionHeader({ title, caption, actionLabel, onAction }: SectionHeaderProps) {
  const { colors, spacing } = useTheme();

  return (
    <View style={[styles.row, { paddingHorizontal: spacing.lg, gap: spacing.md }]}>
      <View style={styles.titles}>
        <Text variant="displayMd">{title}</Text>
        {caption ? (
          <Text variant="bodySm" tone="secondary">
            {caption}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Touchable
          onPress={onAction}
          hapticIntent="light"
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel={`${title}: ${actionLabel}`}
        >
          <Text variant="bodySm" tone="accent">
            {actionLabel}
          </Text>
          <ChevronRight size={16} color={colors.primary} strokeWidth={2.4} />
        </Touchable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  titles: { flex: 1, gap: 1 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 1, paddingVertical: 4, paddingLeft: 8 },
});
