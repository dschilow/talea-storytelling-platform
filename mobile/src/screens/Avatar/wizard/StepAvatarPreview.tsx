import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { BASE_TRAITS } from '@/lib/personality';
import {
  BODY_BUILDS,
  CHARACTER_TYPES,
  EYE_COLORS,
  FUR_COLORS_ANIMAL,
  HAIR_COLORS,
  HAIR_STYLES,
  NARRATIVE_TRAIT_OPTIONS,
  SKIN_TONES_HUMAN,
  SPECIAL_FEATURES,
  isAnimalCharacter,
  type AvatarFormData,
} from '@/types/avatarForm';

interface StepProps {
  form: AvatarFormData;
  isChildMode: boolean;
}

function labelFor(catalogue: readonly { id: string; labelDe: string }[], id: string): string {
  return catalogue.find((entry) => entry.id === id)?.labelDe ?? id;
}

/**
 * Step 5 — review.
 *
 * Also sets the expectation that matters most: the avatar arrives with all nine
 * traits at 0. Showing them empty here is deliberate — it makes the first
 * story's growth legible instead of mysterious.
 */
export function StepAvatarPreview({ form, isChildMode }: StepProps) {
  const { spacing } = useTheme();

  const isAnimal = isAnimalCharacter(form.characterType);
  const characterType =
    form.characterType === 'other' && form.customCharacterType
      ? form.customCharacterType
      : CHARACTER_TYPES.find((type) => type.id === form.characterType)?.labelDe ?? form.characterType;

  const appearance = [
    `${form.age} Jahre`,
    `${form.height} cm`,
    labelFor(BODY_BUILDS, form.bodyBuild),
    isAnimal
      ? labelFor(FUR_COLORS_ANIMAL, form.skinTone)
      : labelFor(SKIN_TONES_HUMAN, form.skinTone),
    !isAnimal ? `${labelFor(HAIR_COLORS, form.hairColor)}es Haar, ${labelFor(HAIR_STYLES, form.hairStyle)}` : null,
    `${labelFor(EYE_COLORS, form.eyeColor)}e Augen`,
  ].filter(Boolean) as string[];

  const features = form.specialFeatures.map((id) => labelFor(SPECIAL_FEATURES, id));
  const traits = form.characterTraits.map((id) => NARRATIVE_TRAIT_OPTIONS.find((entry) => entry.id === id)?.label ?? id);

  return (
    <View style={{ gap: spacing.base, paddingTop: spacing.sm }}>
      <View style={{ gap: 4 }}>
        <Text variant="headingSm">Bereit für {form.name || 'deinen Avatar'}?</Text>
        <Text variant="bodySm" tone="secondary">
          Talea malt gleich das erste Bild. Das dauert einen Moment.
        </Text>
      </View>

      <Card variant="elevated">
        <View style={{ gap: spacing.sm }}>
          <View style={styles.header}>
            <Text variant="headingMd" style={{ flex: 1 }} numberOfLines={1}>
              {form.name || '—'}
            </Text>
            <Chip label={isChildMode ? 'Kind-Avatar' : 'Begleiter'} size="sm" tone="accent" />
          </View>

          <Text variant="bodySm" tone="secondary">
            {characterType}
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 4 }}>
            {appearance.map((entry) => (
              <Chip key={entry} label={entry} size="sm" />
            ))}
          </View>

          {features.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {features.map((feature) => (
                <Chip key={feature} label={feature} size="sm" tone="neutral" />
              ))}
            </View>
          ) : null}

          {traits.length > 0 ? (
            <>
              <Text variant="overline" tone="tertiary" style={{ marginTop: spacing.xs }}>
                Charakter
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {traits.map((trait) => (
                  <Chip key={trait} label={trait} size="sm" tone="accent" />
                ))}
              </View>
            </>
          ) : null}

          {form.backstory ? (
            <>
              <Text variant="overline" tone="tertiary" style={{ marginTop: spacing.xs }}>
                Hintergrund
              </Text>
              <Text variant="bodySm" tone="secondary">
                {form.backstory}
              </Text>
            </>
          ) : null}
        </View>
      </Card>

      <Card variant="inset">
        <Text variant="overline" tone="tertiary" style={{ marginBottom: spacing.sm }}>
          Startwerte
        </Text>
        <Text variant="caption" tone="secondary" style={{ marginBottom: spacing.md }}>
          Alle neun Eigenschaften starten bei 0. Sie wachsen ausschließlich durch erlebte Geschichten — und jede Änderung
          wird begründet.
        </Text>

        <View style={{ gap: spacing.sm }}>
          {BASE_TRAITS.map((trait) => (
            <View key={trait.id} style={{ gap: 3 }}>
              <View style={styles.traitRow}>
                <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                  {trait.emoji} {trait.labels.de}
                </Text>
                <Text variant="caption" tone="muted">
                  0
                </Text>
              </View>
              <ProgressBar progress={0} height={3} />
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  traitRow: { flexDirection: 'row', alignItems: 'center' },
});
