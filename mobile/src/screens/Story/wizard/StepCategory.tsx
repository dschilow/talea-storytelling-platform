import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Dog, Home, Mountain, Rocket, Sparkles, Wand2 } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { Button } from '@/components/ui/Button';
import { Gradient } from '@/components/ui/Gradient';
import { TaleaArt } from '@/components/ui/TaleaArt';
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
  hue: string;
}[] = [
  { id: 'fairy-tales', label: 'Märchen', description: 'Klassische Motive, Magie und Moral', Icon: Sparkles, gradient: 'sunset', hue: '#E04DA3' },
  { id: 'adventure', label: 'Abenteuer', description: 'Reisen, Mut und große Entdeckungen', Icon: Mountain, gradient: 'warm', hue: '#F07A2E' },
  { id: 'magic', label: 'Magie', description: 'Zauber, Wunder und geheime Kräfte', Icon: Wand2, gradient: 'lavender', hue: '#7B55F0' },
  { id: 'animals', label: 'Tiere', description: 'Tierfreunde und ihre Welt', Icon: Dog, gradient: 'nature', hue: '#22A866' },
  { id: 'scifi', label: 'Sci-Fi', description: 'Weltraum, Roboter und Zukunft', Icon: Rocket, gradient: 'cool', hue: '#2F8FEF' },
  { id: 'modern', label: 'Alltag', description: 'Freundschaft, Schule und Zuhause', Icon: Home, gradient: 'ocean', hue: '#14AFAE' },
];

/** Step 2 — the genre, which drives the backend's narrative template. */
export function StepCategory({ value, onChange, onPickFairyTale }: StepCategoryProps) {
  const { colors, spacing, radius } = useTheme();

  return (
    <View style={{ gap: spacing.base, paddingTop: spacing.sm }}>
      <View style={{ gap: 4 }}>
        <Text variant="displayLg">Worum soll es gehen?</Text>
        <Text variant="bodySm" tone="secondary">
          Das Thema bestimmt Ton, Figuren und Welt der Geschichte.
        </Text>
      </View>

      <View style={[styles.grid, { gap: spacing.md }]}>
        {CATEGORIES.map(({ id, label, description, Icon, gradient, hue }) => {
          const selected = value === id;
          return (
            <Touchable
              key={id}
              onPress={() => onChange(id)}
              pressScale={0.96}
              style={[
                styles.tile,
                {
                  borderRadius: radius.xl,
                  borderColor: selected ? colors.primary : 'transparent',
                  borderWidth: 2,
                  backgroundColor: colors.surface.primary,
                },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={label}
            >
              <View style={styles.art}>
                <Gradient token={colors.gradient[gradient]} style={StyleSheet.absoluteFill} />
                <TaleaArt
                  group="storyCategory"
                  id={id}
                  size={92}
                  fallback={<Icon size={34} color={hue} strokeWidth={2} />}
                />
              </View>
              <View style={{ padding: spacing.md, paddingTop: spacing.sm, gap: 3 }}>
                <Text variant="title">{label}</Text>
                <Text variant="caption" tone="secondary" numberOfLines={2}>
                  {description}
                </Text>
              </View>
              {selected ? (
                <View style={[styles.check, { backgroundColor: colors.primary }]}>
                  <Text variant="caption" weight="extrabold" tone="inverse" style={{ fontSize: 12, lineHeight: 14 }}>
                    ✓
                  </Text>
                </View>
              ) : null}
            </Touchable>
          );
        })}
      </View>

      {value === 'fairy-tales' ? (
        <Button
          label="Bekanntes Märchen als Vorlage wählen"
          onPress={onPickFairyTale}
          variant="soft"
          icon={<Sparkles size={16} color={colors.primary} />}
          fullWidth
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { width: '48%', overflow: 'hidden' },
  art: { height: 116, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  check: { position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
