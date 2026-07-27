import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Coins, Pencil } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { CoverImage } from '@/components/ui/CoverImage';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import type { CreditUsage } from '@/providers/UserAccessProvider';
import type { Avatar } from '@/types/avatar';
import type { WizardState } from '../storyWizardModel';

interface StepSummaryProps {
  state: WizardState;
  avatars: Avatar[];
  storyCredits: CreditUsage | null;
  onEditStep: (step: number) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  'fairy-tales': 'Märchen',
  adventure: 'Abenteuer',
  magic: 'Magie',
  animals: 'Tiere',
  scifi: 'Sci-Fi',
  modern: 'Alltag',
};

const FEELING_LABELS: Record<string, string> = {
  funny: 'Lustig',
  warm: 'Warmherzig',
  exciting: 'Spannend',
  crazy: 'Verrückt',
  meaningful: 'Bedeutsam',
};

const LENGTH_LABELS: Record<string, string> = { short: 'Kurz', medium: 'Mittel', long: 'Lang' };

/** Step 6 — review everything before spending a credit. */
export function StepSummary({ state, avatars, storyCredits, onEditStep }: StepSummaryProps) {
  const { colors, spacing, radius } = useTheme();

  const selectedAvatars = avatars.filter((avatar) => state.selectedAvatars.includes(avatar.id));

  const wishes = [
    state.rhymes && 'In Reimen',
    state.moral && 'Mit Botschaft',
    state.avatarIsHero && 'Avatar ist Held:in',
    state.happyEnd && 'Happy End',
    state.surpriseEnd && 'Überraschende Wendung',
  ].filter(Boolean) as string[];

  return (
    <View style={{ gap: spacing.base, paddingTop: spacing.sm }}>
      <View style={{ gap: 4 }}>
        <Text variant="headingSm">Alles bereit?</Text>
        <Text variant="bodySm" tone="secondary">
          Prüfe deine Auswahl — danach schreibt Talea die Geschichte.
        </Text>
      </View>

      <SummaryRow title="Avatare" onEdit={() => onEditStep(0)}>
        <View style={[styles.avatarRow, { gap: spacing.sm }]}>
          {selectedAvatars.map((avatar) => (
            <View key={avatar.id} style={{ alignItems: 'center', width: 62, gap: 4 }}>
              <CoverImage uri={avatar.imageUrl} style={styles.avatarThumb} radius={26} fallbackGradient="lavender" />
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {avatar.name}
              </Text>
            </View>
          ))}
        </View>
      </SummaryRow>

      <SummaryRow title="Thema" onEdit={() => onEditStep(1)}>
        <Chip label={state.mainCategory ? (CATEGORY_LABELS[state.mainCategory] ?? state.mainCategory) : '—'} />
      </SummaryRow>

      <SummaryRow title="Umfang" onEdit={() => onEditStep(2)}>
        <View style={[styles.chips, { gap: spacing.xs }]}>
          <Chip label={state.ageGroup ? `${state.ageGroup} Jahre` : '—'} />
          <Chip label={state.length ? LENGTH_LABELS[state.length] : '—'} />
        </View>
      </SummaryRow>

      <SummaryRow title="Stimmung" onEdit={() => onEditStep(3)}>
        <View style={[styles.chips, { gap: spacing.xs }]}>
          {state.feelings.map((feeling) => (
            <Chip key={feeling} label={FEELING_LABELS[feeling] ?? feeling} />
          ))}
        </View>
      </SummaryRow>

      {(wishes.length > 0 || state.customWish || state.broughtArtifact) && (
        <SummaryRow title="Wünsche" onEdit={() => onEditStep(4)}>
          <View style={{ gap: spacing.sm }}>
            {wishes.length > 0 ? (
              <View style={[styles.chips, { gap: spacing.xs }]}>
                {wishes.map((wish) => (
                  <Chip key={wish} label={wish} size="sm" />
                ))}
              </View>
            ) : null}
            {state.broughtArtifact ? (
              <Chip label={`Mitnehmen: ${state.broughtArtifact.name ?? 'Fundstück'}`} tone="accent" size="sm" />
            ) : null}
            {state.customWish ? (
              <Text variant="bodySm" tone="secondary">
                „{state.customWish}“
              </Text>
            ) : null}
          </View>
        </SummaryRow>
      )}

      {storyCredits ? (
        <Card variant="inset" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={[styles.creditIcon, { borderRadius: radius.sm, backgroundColor: colors.surface.primary }]}>
            <Coins size={17} color={colors.accent.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="label">
              {storyCredits.remaining === null
                ? 'Unbegrenzt Geschichten'
                : `${storyCredits.remaining} ${storyCredits.remaining === 1 ? 'Geschichte' : 'Geschichten'} übrig`}
            </Text>
            <Text variant="caption" tone="tertiary">
              Diese Geschichte kostet {storyCredits.costPerGeneration} Münze
              {storyCredits.costPerGeneration === 1 ? '' : 'n'}.
            </Text>
          </View>
        </Card>
      ) : null}
    </View>
  );
}

function SummaryRow({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  const { colors, spacing } = useTheme();

  return (
    <Card>
      <View style={[styles.header, { marginBottom: spacing.sm }]}>
        <Text variant="overline" tone="tertiary" style={{ flex: 1 }}>
          {title}
        </Text>
        <Touchable onPress={onEdit} hapticIntent="light" style={{ padding: 4 }} accessibilityLabel={`${title} bearbeiten`}>
          <Pencil size={14} color={colors.text.tertiary} />
        </Touchable>
      </View>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  avatarRow: { flexDirection: 'row', flexWrap: 'wrap' },
  avatarThumb: { width: 52, height: 52 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  creditIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
