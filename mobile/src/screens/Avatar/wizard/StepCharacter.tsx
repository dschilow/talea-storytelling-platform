import React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { NARRATIVE_TRAIT_OPTIONS, type AvatarFormData } from '@/types/avatarForm';

interface StepProps {
  form: AvatarFormData;
  onChange: (patch: Partial<AvatarFormData>) => void;
}

const MAX_TRAITS = 4;

/**
 * Step 4 — narrative character.
 *
 * These fields feed `narrativeProfile`, which shapes how the avatar *behaves* in
 * prose. It is explicitly not the personality-trait system: those nine traits
 * always start at 0 and are earned, never authored.
 */
export function StepCharacter({ form, onChange }: StepProps) {
  const { spacing } = useTheme();

  const toggleTrait = (traitId: string) => {
    const current = form.characterTraits;
    if (current.includes(traitId)) {
      onChange({ characterTraits: current.filter((entry) => entry !== traitId) });
      return;
    }
    if (current.length >= MAX_TRAITS) return;
    onChange({ characterTraits: [...current, traitId] });
  };

  return (
    <View style={{ gap: spacing.xl, paddingTop: spacing.sm }}>
      <View style={{ gap: spacing.md }}>
        <View style={{ gap: 4 }}>
          <Text variant="headingSm">Wie ist dein Avatar?</Text>
          <Text variant="bodySm" tone="secondary">
            Bis zu {MAX_TRAITS} Charakterzüge. Sie beeinflussen, wie sich der Avatar in Geschichten verhält — nicht seine
            Eigenschaftswerte, die starten bei 0.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {NARRATIVE_TRAIT_OPTIONS.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              selected={form.characterTraits.includes(option.id)}
              onPress={() => toggleTrait(option.id)}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.md }}>
        <Input
          label="Dominante Persönlichkeit (optional)"
          value={form.dominantPersonality}
          onChangeText={(dominantPersonality) => onChange({ dominantPersonality })}
          placeholder="z. B. „unerschütterlich optimistisch“"
          maxLength={80}
        />

        <Input
          label="Eigenheit (optional)"
          value={form.quirk}
          onChangeText={(quirk) => onChange({ quirk })}
          placeholder="z. B. „sammelt bunte Steine“"
          maxLength={120}
        />

        <Input
          label="Lieblingsspruch (optional)"
          value={form.catchphrase}
          onChangeText={(catchphrase) => onChange({ catchphrase })}
          placeholder="z. B. „Das kriegen wir hin!“"
          maxLength={120}
        />

        <Input
          label="Hintergrund (optional)"
          value={form.backstory}
          onChangeText={(backstory) => onChange({ backstory })}
          placeholder="Woher kommt dein Avatar? Was ist bisher passiert?"
          multilineRows={4}
          maxLength={600}
          showCounter
        />

        <Input
          label="Weitere Beschreibung (optional)"
          value={form.additionalDescription ?? ''}
          onChangeText={(additionalDescription) => onChange({ additionalDescription })}
          placeholder="Details fürs Bild, z. B. Kleidung oder Lieblingsfarbe"
          multilineRows={3}
          maxLength={400}
        />
      </View>
    </View>
  );
}
