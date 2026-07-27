import React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { OptionGrid } from '@/components/form/OptionGrid';
import { CHARACTER_TYPES, type AvatarFormData } from '@/types/avatarForm';

interface StepProps {
  form: AvatarFormData;
  onChange: (patch: Partial<AvatarFormData>) => void;
  isChildMode: boolean;
}

/** Step 1 — name and species. */
export function StepIdentity({ form, onChange, isChildMode }: StepProps) {
  const { spacing } = useTheme();

  const options = CHARACTER_TYPES.map((type) => ({ id: type.id, label: type.labelDe, icon: type.icon }));

  return (
    <View style={{ gap: spacing.xl, paddingTop: spacing.sm }}>
      <View style={{ gap: spacing.md }}>
        <View style={{ gap: 4 }}>
          <Text variant="headingSm">{isChildMode ? 'Wie heißt du?' : 'Wie soll dein Avatar heißen?'}</Text>
          <Text variant="bodySm" tone="secondary">
            Dieser Name taucht in allen Geschichten auf.
          </Text>
        </View>

        <Input
          value={form.name}
          onChangeText={(name) => onChange({ name })}
          placeholder="z. B. Mira"
          autoCapitalize="words"
          maxLength={40}
          autoFocus
        />
      </View>

      <View style={{ gap: spacing.md }}>
        <View style={{ gap: 4 }}>
          <Text variant="headingSm">Was ist dein Avatar?</Text>
          <Text variant="bodySm" tone="secondary">
            Bestimmt Aussehen und wie Talea die Figur beschreibt.
          </Text>
        </View>

        <OptionGrid
          options={options}
          value={form.characterType}
          onSelect={(characterType) => onChange({ characterType: characterType as AvatarFormData['characterType'] })}
          columns={4}
        />

        {form.characterType === 'other' ? (
          <Input
            label="Was für ein Wesen?"
            value={form.customCharacterType ?? ''}
            onChangeText={(customCharacterType) => onChange({ customCharacterType })}
            placeholder="z. B. Wolkenwesen"
            maxLength={40}
          />
        ) : null}
      </View>
    </View>
  );
}
