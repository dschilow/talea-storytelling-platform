import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import type { Feeling } from '../storyWizardModel';

interface StepFeelingProps {
  feelings: Feeling[];
  onToggle: (feeling: Feeling) => void;
}

const FEELINGS: { id: Feeling; emoji: string; label: string; description: string }[] = [
  { id: 'funny', emoji: '😄', label: 'Lustig', description: 'Wortwitz und Situationskomik' },
  { id: 'warm', emoji: '🤗', label: 'Warmherzig', description: 'Freundschaft und Geborgenheit' },
  { id: 'exciting', emoji: '⚡', label: 'Spannend', description: 'Tempo und echte Herausforderungen' },
  { id: 'crazy', emoji: '🌀', label: 'Verrückt', description: 'Absurde Wendungen und Chaos' },
  { id: 'meaningful', emoji: '🌱', label: 'Bedeutsam', description: 'Ruhig, mit einer Botschaft' },
];

/**
 * Step 4 — the emotional register.
 *
 * Multi-select, and the first matching feeling wins when the backend derives
 * `tone` (see mapWizardStateToAPI) — the order in FEELINGS mirrors that
 * precedence so the preview and the result agree.
 */
export function StepFeeling({ feelings, onToggle }: StepFeelingProps) {
  const { colors, spacing, radius } = useTheme();

  return (
    <View style={{ gap: spacing.base, paddingTop: spacing.sm }}>
      <View style={{ gap: 4 }}>
        <Text variant="headingSm">Wie soll sich die Geschichte anfühlen?</Text>
        <Text variant="bodySm" tone="secondary">
          Mehrfachauswahl möglich — die erste Wahl prägt den Ton am stärksten.
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        {FEELINGS.map((entry) => {
          const selected = feelings.includes(entry.id);
          return (
            <Touchable
              key={entry.id}
              onPress={() => onToggle(entry.id)}
              style={[
                styles.row,
                {
                  borderRadius: radius.md,
                  padding: spacing.md,
                  gap: spacing.md,
                  backgroundColor: selected ? colors.surface.item : colors.surface.inset,
                  borderColor: selected ? colors.border.accent : colors.border.light,
                  borderWidth: selected ? 1.6 : StyleSheet.hairlineWidth,
                },
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={entry.label}
            >
              <Text variant="headingSm">{entry.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text variant="label" tone={selected ? 'accent' : 'primary'}>
                  {entry.label}
                </Text>
                <Text variant="caption" tone="tertiary">
                  {entry.description}
                </Text>
              </View>
              <View
                style={[
                  styles.checkbox,
                  {
                    borderRadius: 6,
                    borderColor: selected ? colors.primary : colors.border.strong,
                    backgroundColor: selected ? colors.primary : 'transparent',
                  },
                ]}
              >
                {selected ? (
                  <Text variant="caption" style={{ color: colors.primaryForeground, fontSize: 11, lineHeight: 13 }}>
                    ✓
                  </Text>
                ) : null}
              </View>
            </Touchable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 22, height: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
