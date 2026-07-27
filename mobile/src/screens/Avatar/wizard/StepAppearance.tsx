import React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { OptionGrid } from '@/components/form/OptionGrid';
import {
  EYE_COLORS,
  FUR_COLORS_ANIMAL,
  HAIR_COLORS,
  HAIR_STYLES,
  SKIN_TONES_HUMAN,
  SPECIAL_FEATURES,
  isAnimalCharacter,
  isHumanCharacter,
  type AvatarFormData,
} from '@/types/avatarForm';

interface StepProps {
  form: AvatarFormData;
  onChange: (patch: Partial<AvatarFormData>) => void;
}

/**
 * Step 3 — appearance.
 *
 * The skin/fur catalogue switches on species (the same rule the web form uses),
 * and hair is hidden for animals where it is meaningless.
 */
export function StepAppearance({ form, onChange }: StepProps) {
  const { spacing } = useTheme();

  const isHuman = isHumanCharacter(form.characterType);
  const isAnimal = isAnimalCharacter(form.characterType);
  const skinTones = isAnimal ? FUR_COLORS_ANIMAL : SKIN_TONES_HUMAN;

  const toggleFeature = (featureId: string) => {
    const current = form.specialFeatures;
    onChange({
      specialFeatures: current.includes(featureId as never)
        ? (current.filter((entry) => entry !== featureId) as AvatarFormData['specialFeatures'])
        : ([...current, featureId] as AvatarFormData['specialFeatures']),
    });
  };

  return (
    <View style={{ gap: spacing.xl, paddingTop: spacing.sm }}>
      <View style={{ gap: spacing.md }}>
        <Text variant="headingSm">{isAnimal ? 'Fellfarbe' : 'Hautton'}</Text>
        <OptionGrid
          options={skinTones.map((tone) => ({ id: tone.id, label: tone.labelDe, color: tone.color }))}
          value={form.skinTone}
          onSelect={(skinTone) => onChange({ skinTone })}
          columns={4}
          swatches
        />
      </View>

      {!isAnimal ? (
        <>
          <View style={{ gap: spacing.md }}>
            <Text variant="headingSm">Haarfarbe</Text>
            <OptionGrid
              options={HAIR_COLORS.map((color) => ({
                id: color.id,
                label: color.labelDe,
                color: color.color,
                icon: color.icon,
              }))}
              value={form.hairColor}
              onSelect={(hairColor) => onChange({ hairColor: hairColor as AvatarFormData['hairColor'] })}
              columns={4}
              swatches
            />
          </View>

          <View style={{ gap: spacing.md }}>
            <Text variant="headingSm">Frisur</Text>
            <OptionGrid
              options={HAIR_STYLES.map((style) => ({ id: style.id, label: style.labelDe, icon: style.icon }))}
              value={form.hairStyle}
              onSelect={(hairStyle) => onChange({ hairStyle: hairStyle as AvatarFormData['hairStyle'] })}
              columns={3}
            />
          </View>
        </>
      ) : null}

      <View style={{ gap: spacing.md }}>
        <Text variant="headingSm">Augenfarbe</Text>
        <OptionGrid
          options={EYE_COLORS.map((color) => ({ id: color.id, label: color.labelDe, color: color.color, icon: color.icon }))}
          value={form.eyeColor}
          onSelect={(eyeColor) => onChange({ eyeColor: eyeColor as AvatarFormData['eyeColor'] })}
          columns={3}
          swatches
        />
      </View>

      <View style={{ gap: spacing.md }}>
        <View style={{ gap: 4 }}>
          <Text variant="headingSm">Besonderheiten</Text>
          <Text variant="bodySm" tone="secondary">
            Mehrfachauswahl — diese Merkmale erscheinen auf jedem Bild.
          </Text>
        </View>
        <OptionGrid
          options={SPECIAL_FEATURES.filter((feature) => isHuman || feature.category !== 'face' || feature.id === 'freckles').map(
            (feature) => ({ id: feature.id, label: feature.labelDe, icon: feature.icon })
          )}
          value={form.specialFeatures as unknown as string[]}
          onSelect={toggleFeature}
          columns={4}
          multi
        />
      </View>
    </View>
  );
}
