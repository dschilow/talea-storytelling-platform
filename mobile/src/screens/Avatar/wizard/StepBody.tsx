import React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { OptionGrid } from '@/components/form/OptionGrid';
import { Stepper } from '@/components/form/Stepper';
import { BODY_BUILDS, GENDERS, isHumanCharacter, type AvatarFormData } from '@/types/avatarForm';

interface StepProps {
  form: AvatarFormData;
  onChange: (patch: Partial<AvatarFormData>) => void;
}

/** Step 2 — age, gender, height and build. */
export function StepBody({ form, onChange }: StepProps) {
  const { spacing } = useTheme();

  const ageHint =
    form.age <= 5
      ? 'Kleinkind'
      : form.age <= 9
        ? 'Kind'
        : form.age <= 13
          ? 'Vorpubertär'
          : form.age <= 19
            ? 'Jugendlich'
            : form.age <= 60
              ? 'Erwachsen'
              : 'Alt und weise';

  return (
    <View style={{ gap: spacing.xl, paddingTop: spacing.sm }}>
      <View style={{ gap: spacing.md }}>
        <Text variant="headingSm">Alter und Größe</Text>
        <Stepper label="Alter" value={form.age} min={1} max={150} onChange={(age) => onChange({ age })} unit="Jahre" hint={ageHint} />
        <Stepper
          label="Größe"
          value={form.height}
          min={40}
          max={230}
          step={5}
          onChange={(height) => onChange({ height })}
          unit="cm"
        />
      </View>

      {isHumanCharacter(form.characterType) ? (
        <View style={{ gap: spacing.md }}>
          <Text variant="headingSm">Geschlecht</Text>
          <OptionGrid
            options={GENDERS.map((gender) => ({ id: gender.id, label: gender.labelDe, icon: gender.icon }))}
            value={form.gender}
            onSelect={(gender) => onChange({ gender: gender as AvatarFormData['gender'] })}
            columns={2}
          />
        </View>
      ) : null}

      <View style={{ gap: spacing.md }}>
        <Text variant="headingSm">Statur</Text>
        <OptionGrid
          options={BODY_BUILDS.map((build) => ({ id: build.id, label: build.labelDe, icon: build.icon }))}
          value={form.bodyBuild}
          onSelect={(bodyBuild) => onChange({ bodyBuild: bodyBuild as AvatarFormData['bodyBuild'] })}
          columns={3}
        />
      </View>
    </View>
  );
}
