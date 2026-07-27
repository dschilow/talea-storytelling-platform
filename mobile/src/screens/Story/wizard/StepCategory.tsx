import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Dog, Home, Mountain, Rocket, Sparkles, Wand2 } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { Button } from '@/components/ui/Button';
import { Gradient } from '@/components/ui/Gradient';
import type { MainCategory } from '../storyWizardModel';

interface StepCategoryProps {
  value: MainCategory | null;
  onChange: (category: MainCategory) => void;
  onPickFairyTale: () => void;
}

const CATEGORIES: {
  id: MainCategory;
  label: string;
  description: string;
  Icon: typeof Sparkles;
  gradient: 'sunset' | 'nature' | 'lavender' | 'ocean' | 'cool' | 'warm';
}[] = [
  { id: 'fairy-tales', label: 'Märchen', description: 'Klassische Motive, Magie und Moral', Icon: Sparkles, gradient: 'sunset' },
  { id: 'adventure', label: 'Abenteuer', description: 'Reisen, Mut und große Entdeckungen', Icon: Mountain, gradient: 'warm' },
  { id: 'magic', label: 'Magie', description: 'Zauber, Wunder und geheime Kräfte', Icon: Wand2, gradient: 'lavender' },
  { id: 'animals', label: 'Tiere', description: 'Tierfreunde und ihre Welt', Icon: Dog, gradient: 'nature' },
  { id: 'scifi', label: 'Sci-Fi', description: 'Weltraum, Roboter und Zukunft', Icon: Rocket, gradient: 'cool' },
  { id: 'modern', label: 'Alltag', description: 'Freundschaft, Schule und Zuhause', Icon: Home, gradient: 'ocean' },
];

/** Step 2 — the genre, which drives the backend's narrative template. */
export function StepCategory({ value, onChange, onPickFairyTale }: StepCategoryProps) {
  const { colors, spacing, radius } = useTheme();

  return (
    <View style={{ gap: spacing.base, paddingTop: spacing.sm }}>
      <View style={{ gap: 4 }}>
        <Text variant="headingSm">Worum soll es gehen?</Text>
        <Text variant="bodySm" tone="secondary">
          Das Thema bestimmt Ton, Figuren und Welt der Geschichte.
        </Text>
      </View>

      <View style={[styles.grid, { gap: spacing.sm }]}>
        {CATEGORIES.map(({ id, label, description, Icon, gradient }) => {
          const selected = value === id;
          return (
            <Touchable
              key={id}
              onPress={() => onChange(id)}
              style={[
                styles.tile,
                {
                  borderRadius: radius.lg,
                  borderColor: selected ? colors.border.accent : colors.border.light,
                  borderWidth: selected ? 1.6 : StyleSheet.hairlineWidth,
                  padding: spacing.md,
                  gap: 6,
                },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={label}
            >
              <Gradient token={colors.gradient[gradient]} style={StyleSheet.absoluteFill} />
              <View style={[styles.iconShell, { borderRadius: radius.sm, backgroundColor: colors.surface.primary }]}>
                <Icon size={18} color={colors.text.primary} />
              </View>
              <Text variant="label">{label}</Text>
              <Text variant="caption" tone="secondary" numberOfLines={2}>
                {description}
              </Text>
            </Touchable>
          );
        })}
      </View>

      {value === 'fairy-tales' ? (
        <Button
          label="Bekanntes Märchen als Vorlage wählen"
          onPress={onPickFairyTale}
          variant="secondary"
          icon={<Sparkles size={16} color={colors.text.primary} />}
          fullWidth
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { width: '48%', overflow: 'hidden', minHeight: 132 },
  iconShell: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});
