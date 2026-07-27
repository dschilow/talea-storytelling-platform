import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import type { AgeGroup, StoryLength } from '../storyWizardModel';

interface StepScopeProps {
  ageGroup: AgeGroup | null;
  length: StoryLength | null;
  onChangeAge: (ageGroup: AgeGroup) => void;
  onChangeLength: (length: StoryLength) => void;
}

const AGE_GROUPS: { id: AgeGroup; label: string; description: string }[] = [
  { id: '3-5', label: '3–5 Jahre', description: 'Kurze Sätze, klare Bilder' },
  { id: '6-8', label: '6–8 Jahre', description: 'Erste eigene Leseabenteuer' },
  { id: '9-12', label: '9–12 Jahre', description: 'Mehr Handlung und Tiefe' },
  { id: '13+', label: '13+ Jahre', description: 'Komplexe Themen und Figuren' },
];

const LENGTHS: { id: StoryLength; label: string; description: string }[] = [
  { id: 'short', label: 'Kurz', description: '≈ 5 Minuten' },
  { id: 'medium', label: 'Mittel', description: '≈ 10 Minuten' },
  { id: 'long', label: 'Lang', description: '≈ 20 Minuten' },
];

/** Step 3 — age group and length, which set vocabulary and chapter count. */
export function StepScope({ ageGroup, length, onChangeAge, onChangeLength }: StepScopeProps) {
  const { spacing } = useTheme();

  return (
    <View style={{ gap: spacing.xl, paddingTop: spacing.sm }}>
      <View style={{ gap: spacing.md }}>
        <View style={{ gap: 4 }}>
          <Text variant="headingSm">Für welches Alter?</Text>
          <Text variant="bodySm" tone="secondary">
            Bestimmt Wortschatz, Satzlänge und wie viel Spannung erlaubt ist.
          </Text>
        </View>

        <View style={{ gap: spacing.sm }}>
          {AGE_GROUPS.map((entry) => (
            <OptionRow
              key={entry.id}
              label={entry.label}
              description={entry.description}
              selected={ageGroup === entry.id}
              onPress={() => onChangeAge(entry.id)}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.md }}>
        <View style={{ gap: 4 }}>
          <Text variant="headingSm">Wie lang?</Text>
          <Text variant="bodySm" tone="secondary">
            Längere Geschichten brauchen mehr Zeit zum Erstellen.
          </Text>
        </View>

        <View style={[styles.lengthRow, { gap: spacing.sm }]}>
          {LENGTHS.map((entry) => (
            <OptionTile
              key={entry.id}
              label={entry.label}
              description={entry.description}
              selected={length === entry.id}
              onPress={() => onChangeLength(entry.id)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

export function OptionRow({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, radius } = useTheme();

  return (
    <Touchable
      onPress={onPress}
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
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.radio,
          { borderColor: selected ? colors.primary : colors.border.strong, backgroundColor: 'transparent' },
        ]}
      >
        {selected ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="label">{label}</Text>
        {description ? (
          <Text variant="caption" tone="tertiary">
            {description}
          </Text>
        ) : null}
      </View>
    </Touchable>
  );
}

function OptionTile({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, radius } = useTheme();

  return (
    <Touchable
      onPress={onPress}
      style={[
        styles.tile,
        {
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          gap: 2,
          backgroundColor: selected ? colors.surface.item : colors.surface.inset,
          borderColor: selected ? colors.border.accent : colors.border.light,
          borderWidth: selected ? 1.6 : StyleSheet.hairlineWidth,
        },
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}, ${description}`}
    >
      <Text variant="label" center tone={selected ? 'accent' : 'primary'}>
        {label}
      </Text>
      <Text variant="caption" tone="tertiary" center>
        {description}
      </Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 9, height: 9, borderRadius: 5 },
  lengthRow: { flexDirection: 'row' },
  tile: { flex: 1, alignItems: 'center' },
});
