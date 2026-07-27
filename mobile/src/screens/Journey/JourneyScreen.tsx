import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Check, Lock, Map as MapIcon, Sparkles, Star } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useAvatars, useStories } from '@/hooks/queries';
import { overallAvatarLevel, readTraits, totalTraitPoints } from '@/lib/personality';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { CoverImage } from '@/components/ui/CoverImage';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Points needed to clear each stage of the path. */
const STAGE_THRESHOLDS = [0, 40, 120, 260, 460, 720, 1050, 1450];

const STAGE_THEMES = [
  { title: 'Erste Schritte', hint: 'Die allererste Geschichte', tags: 'animals' },
  { title: 'Neugier weckt', hint: 'Entdecke eine neue Welt', tags: 'adventure' },
  { title: 'Mut fassen', hint: 'Eine Prüfung bestehen', tags: 'magic' },
  { title: 'Freundschaft', hint: 'Gemeinsam mehr schaffen', tags: 'modern' },
  { title: 'Weite Welt', hint: 'Fremde Kulturen und Orte', tags: 'fairy-tales' },
  { title: 'Große Fragen', hint: 'Sterne, Zeit und Zukunft', tags: 'scifi' },
  { title: 'Meisterschaft', hint: 'Alles zusammenbringen', tags: 'adventure' },
  { title: 'Legende', hint: 'Deine eigene Sage', tags: 'magic' },
];

/**
 * Learning path.
 *
 * A per-avatar progression map. Stages unlock from accumulated trait points, so
 * the path is a direct visualisation of the personality system rather than a
 * separate progress track — reading stories is the only way to advance it.
 *
 * Tapping an unlocked stage opens the story wizard pre-filled with that stage's
 * theme, which is what makes the map actionable rather than decorative.
 */
export function JourneyScreen() {
  const { colors, spacing, radius } = useTheme();
  const navigation = useNavigation<Nav>();

  const avatarsQuery = useAvatars();
  const storiesQuery = useStories();

  const avatars = avatarsQuery.data ?? [];
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);

  const activeAvatar = useMemo(
    () => avatars.find((avatar) => avatar.id === selectedAvatarId) ?? avatars[0] ?? null,
    [avatars, selectedAvatarId]
  );

  const points = totalTraitPoints(activeAvatar);
  const level = overallAvatarLevel(activeAvatar);
  const storyCount = storiesQuery.data?.length ?? 0;

  const currentStage = useMemo(() => {
    const index = STAGE_THRESHOLDS.findIndex((threshold) => points < threshold);
    return index === -1 ? STAGE_THRESHOLDS.length - 1 : Math.max(0, index - 1);
  }, [points]);

  const topTraits = useMemo(
    () =>
      readTraits(activeAvatar)
        .filter((trait) => trait.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 3),
    [activeAvatar]
  );

  if (avatarsQuery.isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Lernkarte" />
        <SkeletonCard height={160} />
      </Screen>
    );
  }

  if (!activeAvatar) {
    return (
      <Screen>
        <ScreenHeader title="Lernkarte" />
        <EmptyState
          icon={<MapIcon size={24} color={colors.accent.mint} />}
          title="Noch kein Avatar"
          description="Die Lernkarte zeigt, wie sich ein Avatar durch Geschichten entwickelt."
          actionLabel="Avatar erstellen"
          onAction={() => navigation.navigate('AvatarWizard')}
        />
      </Screen>
    );
  }

  return (
    <Screen playerClearance>
      <ScreenHeader title="Lernkarte" subtitle={`${activeAvatar.name} · Level ${level}`} />

      <View style={{ gap: spacing.base }}>
        {avatars.length > 1 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {avatars.map((avatar) => (
              <Chip
                key={avatar.id}
                label={avatar.name}
                selected={avatar.id === activeAvatar.id}
                onPress={() => setSelectedAvatarId(avatar.id)}
              />
            ))}
          </View>
        ) : null}

        <Card variant="elevated">
          <View style={{ flexDirection: 'row', gap: spacing.base, alignItems: 'center' }}>
            <CoverImage uri={activeAvatar.imageUrl} style={styles.avatar} radius={radius.lg} fallbackGradient="lavender" />
            <View style={{ flex: 1, gap: 6 }}>
              <Text variant="headingSm">{activeAvatar.name}</Text>
              <Text variant="caption" tone="tertiary">
                {points} Punkte · {storyCount} Geschichten gelesen
              </Text>
              <ProgressBar
                progress={
                  currentStage + 1 < STAGE_THRESHOLDS.length
                    ? (points - STAGE_THRESHOLDS[currentStage]) /
                      (STAGE_THRESHOLDS[currentStage + 1] - STAGE_THRESHOLDS[currentStage])
                    : 1
                }
              />
              {currentStage + 1 < STAGE_THRESHOLDS.length ? (
                <Text variant="caption" tone="secondary">
                  Noch {STAGE_THRESHOLDS[currentStage + 1] - points} Punkte bis Etappe {currentStage + 2}
                </Text>
              ) : (
                <Text variant="caption" tone="accent">
                  Alle Etappen erreicht
                </Text>
              )}
            </View>
          </View>

          {topTraits.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md }}>
              {topTraits.map((trait) => (
                <Chip key={trait.id} label={`${trait.emoji} ${trait.label} ${trait.value}`} size="sm" tone="accent" />
              ))}
            </View>
          ) : null}
        </Card>

        <Text variant="overline" tone="tertiary">
          Etappen
        </Text>

        <View style={{ gap: spacing.sm }}>
          {STAGE_THEMES.map((stage, index) => {
            const threshold = STAGE_THRESHOLDS[index];
            const isComplete = index < currentStage;
            const isCurrent = index === currentStage;
            const isLocked = points < threshold;

            return (
              <Animated.View key={stage.title} entering={FadeInDown.delay(index * 45).duration(300)}>
                <Touchable
                  onPress={() =>
                    isLocked
                      ? undefined
                      : navigation.navigate('StoryWizard', { tags: stage.tags, mapAvatarId: activeAvatar.id })
                  }
                  disabled={isLocked}
                  hapticIntent={isLocked ? null : 'medium'}
                  style={[
                    styles.stage,
                    {
                      borderRadius: radius.lg,
                      padding: spacing.md,
                      gap: spacing.md,
                      backgroundColor: isCurrent ? colors.surface.item : colors.surface.primary,
                      borderColor: isCurrent ? colors.border.accent : colors.border.light,
                      borderWidth: isCurrent ? 1.6 : StyleSheet.hairlineWidth,
                      opacity: isLocked ? 0.55 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Etappe ${index + 1}: ${stage.title}${isLocked ? ' (gesperrt)' : ''}`}
                  accessibilityState={{ disabled: isLocked }}
                >
                  <View
                    style={[
                      styles.stageBadge,
                      {
                        borderRadius: radius.pill,
                        backgroundColor: isComplete
                          ? colors.successSoft
                          : isCurrent
                            ? colors.primary
                            : colors.surface.inset,
                      },
                    ]}
                  >
                    {isComplete ? (
                      <Check size={16} color={colors.success} />
                    ) : isLocked ? (
                      <Lock size={15} color={colors.text.muted} />
                    ) : (
                      <Star size={16} color={colors.primaryForeground} />
                    )}
                  </View>

                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="label" tone={isCurrent ? 'accent' : 'primary'}>
                      {stage.title}
                    </Text>
                    <Text variant="caption" tone="tertiary">
                      {isLocked ? `Ab ${threshold} Punkten` : stage.hint}
                    </Text>
                  </View>

                  {!isLocked ? <Sparkles size={16} color={colors.text.tertiary} /> : null}
                </Touchable>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 76, height: 76 },
  stage: { flexDirection: 'row', alignItems: 'center' },
  stageBadge: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
});
