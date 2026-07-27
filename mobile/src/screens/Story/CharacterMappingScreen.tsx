import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, Sparkles } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useBackend } from '@/api/backend';
import { useAvatars, useInvalidateContent } from '@/hooks/queries';
import { useOptionalChildProfiles } from '@/providers/ChildProfilesProvider';
import { useToast } from '@/providers/ToastProvider';
import { haptic } from '@/lib/haptics';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { CoverImage } from '@/components/ui/CoverImage';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { GenerationOverlay, type GenerationPhase } from './wizard/GenerationOverlay';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type MappingRoute = RouteProp<RootStackParamList, 'CharacterMapping'>;

interface FairyTaleRole {
  roleType: string;
  name: string;
  description?: string;
  isRequired: boolean;
}

interface FairyTaleDetails {
  id: string;
  title: string;
  summary?: string;
  roles: FairyTaleRole[];
}

/**
 * Casting screen.
 *
 * Every required role must be filled before generation; optional roles fall back
 * to AI-invented characters. A single avatar may hold several roles — the
 * backend handles that, and forbidding it would be an artificial restriction on
 * families with one avatar.
 */
export function CharacterMappingScreen() {
  const { colors, spacing, radius } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<MappingRoute>();
  const backend = useBackend();
  const toast = useToast();
  const invalidateContent = useInvalidateContent();
  const profileId = useOptionalChildProfiles()?.activeProfileId ?? null;

  const { taleId } = route.params;
  const avatarsQuery = useAvatars();
  const avatars = avatarsQuery.data ?? [];

  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [phase, setPhase] = useState<GenerationPhase>('profiles');

  const taleQuery = useQuery<FairyTaleDetails | null>({
    queryKey: ['fairy-tale', taleId],
    queryFn: async () => ((await (backend.story as any).getFairyTaleDetails({ taleId })) as FairyTaleDetails) ?? null,
  });

  const tale = taleQuery.data;
  const roles = useMemo(() => tale?.roles ?? [], [tale]);

  const missingRequired = useMemo(
    () => roles.filter((role) => role.isRequired && !mappings[role.roleType]),
    [mappings, roles]
  );

  const handleGenerate = useCallback(async () => {
    if (missingRequired.length > 0) {
      toast.warning(
        'Rollen fehlen',
        `Bitte besetze: ${missingRequired.map((role) => role.name).join(', ')}`
      );
      return;
    }

    setGenerating(true);
    try {
      setPhase('profiles');
      await new Promise((resolve) => setTimeout(resolve, 900));
      setPhase('text');

      const story = (await (backend.story as any).generateFromFairyTale({
        taleId,
        characterMappings: mappings,
        length: 'medium',
        style: 'classic',
        profileId: profileId ?? undefined,
      })) as { id: string };

      setPhase('images');
      await new Promise((resolve) => setTimeout(resolve, 900));
      setPhase('complete');
      haptic('celebrate');

      invalidateContent();
      navigation.replace('StoryReader', { storyId: story.id });
    } catch (error) {
      console.error('[CharacterMapping] Generation failed', error);
      toast.error('Geschichte konnte nicht erstellt werden', error instanceof Error ? error.message : undefined);
      setGenerating(false);
    }
  }, [backend.story, invalidateContent, mappings, missingRequired, navigation, profileId, taleId, toast]);

  if (generating) {
    return <GenerationOverlay phase={phase} recoveryAttempt={null} />;
  }

  if (taleQuery.isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Rollen besetzen" />
        <View style={{ gap: spacing.lg }}>
          <SkeletonCard height={120} />
          <SkeletonCard height={120} />
        </View>
      </Screen>
    );
  }

  if (!tale) {
    return (
      <Screen>
        <ScreenHeader title="Rollen besetzen" />
        <EmptyState
          title="Märchen nicht gefunden"
          description="Wähle ein anderes Märchen aus der Liste."
          actionLabel="Zurück zur Auswahl"
          onAction={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  if (avatars.length === 0) {
    return (
      <Screen>
        <ScreenHeader title={tale.title} />
        <EmptyState
          icon={<Sparkles size={22} color={colors.accent.lavender} />}
          title="Du brauchst zuerst einen Avatar"
          description="Für ein Märchen müssen die Rollen mit deinen Avataren besetzt werden."
          actionLabel="Avatar erstellen"
          onAction={() => navigation.navigate('AvatarWizard')}
        />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.md }}>
          <Button
            label="Märchen erschaffen"
            onPress={handleGenerate}
            disabled={missingRequired.length > 0}
            icon={<Sparkles size={17} color={colors.primaryForeground} />}
            size="lg"
            fullWidth
            hapticIntent="celebrate"
          />
          {missingRequired.length > 0 ? (
            <Text variant="caption" tone="tertiary" center style={{ marginTop: spacing.sm }}>
              Noch {missingRequired.length} {missingRequired.length === 1 ? 'Rolle' : 'Rollen'} zu besetzen
            </Text>
          ) : null}
        </View>
      }
    >
      <ScreenHeader title={tale.title} subtitle="Wer spielt welche Rolle?" />

      <View style={{ gap: spacing.base }}>
        {tale.summary ? (
          <Card variant="inset">
            <Text variant="bodySm" tone="secondary">
              {tale.summary}
            </Text>
          </Card>
        ) : null}

        {roles.map((role) => (
          <Card key={role.roleType}>
            <View style={{ gap: spacing.md }}>
              <View style={{ gap: 3 }}>
                <View style={styles.roleHeader}>
                  <Text variant="label" style={{ flex: 1 }}>
                    {role.name}
                  </Text>
                  <Chip
                    label={role.isRequired ? 'Pflicht' : 'Optional'}
                    size="sm"
                    tone={role.isRequired ? 'warning' : 'neutral'}
                  />
                </View>
                {role.description ? (
                  <Text variant="caption" tone="secondary">
                    {role.description}
                  </Text>
                ) : null}
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {avatars.map((avatar) => {
                  const selected = mappings[role.roleType] === avatar.id;
                  return (
                    <Touchable
                      key={avatar.id}
                      onPress={() =>
                        setMappings((prev) => {
                          const next = { ...prev };
                          if (selected) delete next[role.roleType];
                          else next[role.roleType] = avatar.id;
                          return next;
                        })
                      }
                      style={[
                        styles.avatarOption,
                        {
                          borderRadius: radius.md,
                          padding: spacing.xs,
                          borderColor: selected ? colors.border.accent : colors.border.light,
                          borderWidth: selected ? 1.6 : StyleSheet.hairlineWidth,
                          backgroundColor: selected ? colors.surface.item : 'transparent',
                        },
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${avatar.name} als ${role.name}`}
                    >
                      <View>
                        <CoverImage
                          uri={avatar.imageUrl}
                          style={{ width: 54, height: 54 }}
                          radius={radius.sm}
                          fallbackGradient="lavender"
                        />
                        {selected ? (
                          <View style={[styles.checkBadge, { backgroundColor: colors.primary, borderColor: colors.pageSolid }]}>
                            <Check size={11} color={colors.primaryForeground} />
                          </View>
                        ) : null}
                      </View>
                      <Text variant="caption" tone={selected ? 'accent' : 'tertiary'} numberOfLines={1} center>
                        {avatar.name}
                      </Text>
                    </Touchable>
                  );
                })}
              </View>
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  roleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarOption: { width: 70, alignItems: 'center', gap: 4 },
  checkBadge: {
    position: 'absolute',
    right: -3,
    top: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
