import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { TaleaArt } from '@/components/ui/TaleaArt';
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
  const { colors, spacing, radius, shadows } = useTheme();

  return (
    <View style={{ gap: spacing.base, paddingTop: spacing.sm }}>
      <View style={{ gap: 4 }}>
        <Text variant="displaySm">Wie soll sich die Geschichte anfühlen?</Text>
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
              pressScale={0.98}
              style={[
                styles.row,
                selected ? shadows.soft : null,
                {
                  borderRadius: radius.lg,
                  padding: spacing.sm + 2,
                  paddingRight: spacing.md,
                  gap: spacing.md,
                  backgroundColor: selected ? colors.primarySoft : colors.surface.primary,
                  borderColor: selected ? colors.primary : colors.border.light,
                  borderWidth: selected ? 2 : 1,
                },
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={entry.label}
            >
              <View style={[styles.artShell, { borderRadius: radius.md, backgroundColor: colors.surface.inset }]}>
                <TaleaArt
                  group="storyFeeling"
                  id={entry.id}
                  size={52}
                  fallback={<Text style={{ fontSize: 24, lineHeight: 30 }}>{entry.emoji}</Text>}
                />
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text variant="title" tone={selected ? 'accent' : 'primary'}>
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
                    borderRadius: 13,
                    borderColor: selected ? colors.primary : colors.border.strong,
                    backgroundColor: selected ? colors.primary : colors.surface.primary,
                  },
                ]}
              >
                {selected ? <Check size={14} color={colors.primaryForeground} strokeWidth={3} /> : null}
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
  artShell: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  checkbox: { width: 26, height: 26, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
