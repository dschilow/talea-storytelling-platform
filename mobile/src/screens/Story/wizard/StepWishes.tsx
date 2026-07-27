import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { Gem, Sparkles } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useBackend } from '@/api/backend';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Touchable } from '@/components/ui/Pressable';
import { CoverImage } from '@/components/ui/CoverImage';
import type { BroughtArtifactSelection, WizardState } from '../storyWizardModel';

interface StepWishesProps {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  selectedAvatarIds: string[];
}

interface BringableArtifact {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  avatarId: string;
  avatarName?: string;
  storyEffect?: string;
}

/**
 * Step 5 — optional wishes.
 *
 * Also hosts the "Mitnehmen" loop from the treasury system: an artifact a
 * selected avatar already owns can be carried into the new story, where the
 * backend weaves it into the plot.
 */
export function StepWishes({ state, onChange, selectedAvatarIds }: StepWishesProps) {
  const { colors, spacing, radius } = useTheme();
  const backend = useBackend();

  const [artifacts, setArtifacts] = useState<BringableArtifact[]>([]);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);

  useEffect(() => {
    if (selectedAvatarIds.length === 0) {
      setArtifacts([]);
      return;
    }

    let cancelled = false;
    setLoadingArtifacts(true);

    void (async () => {
      try {
        const response = (await (backend.story as any).bringableArtifacts({ avatarIds: selectedAvatarIds })) as {
          artifacts?: BringableArtifact[];
        };
        if (!cancelled) setArtifacts(response?.artifacts ?? []);
      } catch {
        // The treasury is optional content — a failure here should not block
        // story creation, so it simply renders no artifact section.
        if (!cancelled) setArtifacts([]);
      } finally {
        if (!cancelled) setLoadingArtifacts(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [backend.story, selectedAvatarIds]);

  const toggles: { key: keyof WizardState; label: string; description: string }[] = [
    { key: 'rhymes', label: 'In Reimen', description: 'Die Geschichte wird als Reimtext erzählt' },
    { key: 'moral', label: 'Mit Botschaft', description: 'Eine klare Moral am Ende' },
    { key: 'avatarIsHero', label: 'Avatar ist Held:in', description: 'Dein Avatar steht im Mittelpunkt' },
    { key: 'happyEnd', label: 'Happy End', description: 'Die Geschichte endet versöhnlich' },
    { key: 'surpriseEnd', label: 'Überraschende Wendung', description: 'Ein unerwartetes Ende' },
  ];

  return (
    <View style={{ gap: spacing.xl, paddingTop: spacing.sm }}>
      <View style={{ gap: spacing.md }}>
        <View style={{ gap: 4 }}>
          <Text variant="headingSm">Besondere Wünsche</Text>
          <Text variant="bodySm" tone="secondary">
            Alles optional — Talea erfindet den Rest.
          </Text>
        </View>

        <Card padded={false}>
          {toggles.map((entry, index) => (
            <View
              key={entry.key}
              style={[
                styles.toggleRow,
                {
                  padding: spacing.md,
                  gap: spacing.md,
                  borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: colors.border.light,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text variant="label">{entry.label}</Text>
                <Text variant="caption" tone="tertiary">
                  {entry.description}
                </Text>
              </View>
              <Switch
                value={Boolean(state[entry.key])}
                onValueChange={(value) => onChange({ [entry.key]: value } as Partial<WizardState>)}
                trackColor={{ false: colors.progressTrack, true: colors.primary }}
                thumbColor={colors.media.foreground}
                accessibilityLabel={entry.label}
              />
            </View>
          ))}
        </Card>
      </View>

      <View style={{ gap: spacing.md }}>
        <Text variant="headingSm">Eigener Wunsch</Text>
        <Input
          value={state.customWish}
          onChangeText={(customWish) => onChange({ customWish })}
          placeholder="z. B. „Die Geschichte soll im Regenwald spielen und ein Faultier soll vorkommen.“"
          multilineRows={4}
          maxLength={500}
          showCounter
        />
      </View>

      {artifacts.length > 0 || loadingArtifacts ? (
        <View style={{ gap: spacing.md }}>
          <View style={{ gap: 4 }}>
            <Text variant="headingSm">Fundstück mitnehmen</Text>
            <Text variant="bodySm" tone="secondary">
              Ein Gegenstand aus der Schatzkammer wird Teil der neuen Geschichte.
            </Text>
          </View>

          {loadingArtifacts ? (
            <Text variant="caption" tone="tertiary">
              Schatzkammer wird geladen …
            </Text>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {artifacts.map((artifact) => {
                const selected = state.broughtArtifact?.artifactId === artifact.id;
                return (
                  <Touchable
                    key={artifact.id}
                    onPress={() =>
                      onChange({
                        broughtArtifact: selected
                          ? null
                          : ({
                              artifactId: artifact.id,
                              avatarId: artifact.avatarId,
                              name: artifact.name,
                            } satisfies BroughtArtifactSelection),
                      })
                    }
                    style={[
                      styles.artifactRow,
                      {
                        borderRadius: radius.md,
                        padding: spacing.sm,
                        gap: spacing.md,
                        backgroundColor: selected ? colors.surface.item : colors.surface.inset,
                        borderColor: selected ? colors.border.accent : colors.border.light,
                        borderWidth: selected ? 1.6 : StyleSheet.hairlineWidth,
                      },
                    ]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                  >
                    <CoverImage
                      uri={artifact.imageUrl}
                      style={{ width: 48, height: 48 }}
                      radius={radius.sm}
                      fallbackGradient="warm"
                    />
                    <View style={{ flex: 1 }}>
                      <Text variant="label" numberOfLines={1}>
                        {artifact.name}
                      </Text>
                      <Text variant="caption" tone="tertiary" numberOfLines={2}>
                        {artifact.storyEffect ?? artifact.description ?? artifact.avatarName ?? ''}
                      </Text>
                    </View>
                    {selected ? <Gem size={17} color={colors.primary} /> : <Sparkles size={15} color={colors.text.tertiary} />}
                  </Touchable>
                );
              })}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', alignItems: 'center' },
  artifactRow: { flexDirection: 'row', alignItems: 'center' },
});
