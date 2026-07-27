import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, BookOpen, Brain, Clock3 } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useBackend } from '@/api/backend';
import { useAvatars, useDokus, useStories } from '@/hooks/queries';
import { useOptionalChildProfiles } from '@/providers/ChildProfilesProvider';
import { overallAvatarLevel, readTraits, totalTraitPoints } from '@/lib/personality';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

interface ParentSummary {
  strengths?: { trait: string; label: string; value: number }[];
  recentActivity?: { date: string; label: string; type?: string }[];
  recommendations?: { title: string; reason?: string }[];
  weeklyMinutes?: number;
}

/**
 * Parent overview.
 *
 * Answers the question a parent actually has: what is my child engaging with,
 * and where are they growing? Server-side summary where available, always backed
 * by locally-derivable numbers so the screen is never empty.
 */
export function CosmosParentScreen() {
  const { colors, spacing } = useTheme();
  const backend = useBackend();

  const avatarsQuery = useAvatars();
  const storiesQuery = useStories();
  const dokusQuery = useDokus();
  const activeProfile = useOptionalChildProfiles()?.activeProfile ?? null;

  const summaryQuery = useQuery<ParentSummary>({
    queryKey: ['cosmos-parent', activeProfile?.id ?? 'all'],
    queryFn: async () =>
      ((await (backend.avatar as any).cosmosParentSummary({ profileId: activeProfile?.id })) as ParentSummary) ?? {},
    staleTime: 5 * 60_000,
  });

  const avatars = avatarsQuery.data ?? [];
  const stories = storiesQuery.data ?? [];
  const dokus = dokusQuery.data ?? [];

  const completedStories = stories.filter((story) => story.status === 'complete').length;
  const totalPoints = avatars.reduce((sum, avatar) => sum + totalTraitPoints(avatar), 0);

  // Aggregate strengths across all of the child's avatars.
  const strengths = React.useMemo(() => {
    const totals = new Map<string, { label: string; emoji: string; value: number }>();
    for (const avatar of avatars) {
      for (const trait of readTraits(avatar)) {
        if (trait.value <= 0) continue;
        const existing = totals.get(trait.id);
        totals.set(trait.id, {
          label: trait.label,
          emoji: trait.emoji,
          value: (existing?.value ?? 0) + trait.value,
        });
      }
    }
    return Array.from(totals.values()).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [avatars]);

  const isLoading = avatarsQuery.isLoading || storiesQuery.isLoading;

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Elternüberblick" />
        <SkeletonCard height={140} />
      </Screen>
    );
  }

  if (avatars.length === 0 && stories.length === 0) {
    return (
      <Screen>
        <ScreenHeader title="Elternüberblick" />
        <EmptyState
          icon={<BarChart3 size={24} color={colors.accent.sky} />}
          title="Noch keine Daten"
          description="Sobald dein Kind Geschichten liest, siehst du hier Fortschritt und Interessen."
        />
      </Screen>
    );
  }

  return (
    <Screen playerClearance>
      <ScreenHeader
        title="Elternüberblick"
        subtitle={activeProfile ? `Profil: ${activeProfile.name}` : 'Alle Profile'}
      />

      <View style={{ gap: spacing.base }}>
        <View style={[styles.statRow, { gap: spacing.sm }]}>
          <StatTile icon={<BookOpen size={17} color={colors.accent.mint} />} value={completedStories} label="Geschichten" />
          <StatTile icon={<Brain size={17} color={colors.accent.lavender} />} value={dokus.length} label="Dokus" />
          <StatTile icon={<BarChart3 size={17} color={colors.accent.sky} />} value={totalPoints} label="Punkte" />
        </View>

        {summaryQuery.data?.weeklyMinutes ? (
          <Card variant="inset">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Clock3 size={17} color={colors.text.secondary} />
              <Text variant="bodySm" tone="secondary" style={{ flex: 1 }}>
                Diese Woche etwa {summaryQuery.data.weeklyMinutes} Minuten gelesen.
              </Text>
            </View>
          </Card>
        ) : null}

        {strengths.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="overline" tone="tertiary">
              Stärken
            </Text>
            <Card>
              <View style={{ gap: spacing.md }}>
                {strengths.map((strength) => (
                  <View key={strength.label} style={{ gap: 4 }}>
                    <View style={styles.row}>
                      <Text variant="labelSm" style={{ flex: 1 }}>
                        {strength.emoji} {strength.label}
                      </Text>
                      <Text variant="labelSm" tone="accent">
                        {strength.value}
                      </Text>
                    </View>
                    <ProgressBar progress={Math.min(1, strength.value / (strengths[0]?.value || 1))} height={5} />
                  </View>
                ))}
              </View>
            </Card>
          </View>
        ) : null}

        {avatars.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="overline" tone="tertiary">
              Avatare
            </Text>
            {avatars.map((avatar) => (
              <Card key={avatar.id}>
                <View style={styles.row}>
                  <Text variant="label" style={{ flex: 1 }}>
                    {avatar.name}
                  </Text>
                  <Chip label={`Level ${overallAvatarLevel(avatar)}`} size="sm" tone="accent" />
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        {summaryQuery.data?.recommendations?.length ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="overline" tone="tertiary">
              Empfehlungen
            </Text>
            {summaryQuery.data.recommendations.map((recommendation, index) => (
              <Card key={index} variant="inset">
                <Text variant="label">{recommendation.title}</Text>
                {recommendation.reason ? (
                  <Text variant="caption" tone="tertiary" style={{ marginTop: 3 }}>
                    {recommendation.reason}
                  </Text>
                ) : null}
              </Card>
            ))}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function StatTile({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      style={[
        styles.statTile,
        {
          borderRadius: radius.lg,
          padding: spacing.md,
          gap: 4,
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.light,
        },
      ]}
    >
      {icon}
      <Text variant="headingSm">{value}</Text>
      <Text variant="caption" tone="tertiary">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  statRow: { flexDirection: 'row' },
  statTile: { flex: 1, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
});
