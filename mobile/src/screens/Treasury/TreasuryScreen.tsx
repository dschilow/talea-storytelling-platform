import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type BottomSheet from '@gorhom/bottom-sheet';
import { Crown, Gem, Sparkles, Wand2 } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useBackend } from '@/api/backend';
import { useAvatars, queryKeys } from '@/hooks/queries';
import { formatDate } from '@/lib/content';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { CoverImage } from '@/components/ui/CoverImage';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { Sheet } from '@/components/ui/Sheet';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type TreasuryRoute = RouteProp<RootStackParamList, 'Treasury'>;

interface Artifact {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  type?: string;
  rarity?: string;
  storyEffect?: string;
  acquiredAt?: string;
  sourceStoryId?: string;
  setId?: string;
  setName?: string;
}

interface TreasuryOverview {
  artifacts?: Artifact[];
  sets?: { id: string; name: string; ownedCount: number; totalCount: number; crownUnlocked?: boolean }[];
  crowns?: { id: string; name: string; imageUrl?: string; description?: string }[];
}

/**
 * Treasury.
 *
 * Artifacts are earned from stories, and the loop closes when one is taken back
 * into a new story ("Mitnehmen") — so the detail sheet's primary action is
 * exactly that, deep-linking into the story wizard with the artifact preselected.
 */
export function TreasuryScreen() {
  const { colors, spacing, radius } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<TreasuryRoute>();
  const backend = useBackend();

  const avatarsQuery = useAvatars();
  const avatars = avatarsQuery.data ?? [];

  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(route.params?.avatarId ?? null);
  const activeAvatar = useMemo(
    () => avatars.find((avatar) => avatar.id === selectedAvatarId) ?? avatars[0] ?? null,
    [avatars, selectedAvatarId]
  );

  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const detailRef = useRef<BottomSheet>(null);

  const treasuryQuery = useQuery<TreasuryOverview>({
    queryKey: queryKeys.treasury(activeAvatar?.id),
    queryFn: async () =>
      ((await (backend.story as any).treasuryOverview({ avatarId: activeAvatar!.id })) as TreasuryOverview) ?? {},
    enabled: Boolean(activeAvatar?.id),
  });

  const artifacts = treasuryQuery.data?.artifacts ?? [];
  const sets = treasuryQuery.data?.sets ?? [];
  const crowns = treasuryQuery.data?.crowns ?? [];

  if (avatarsQuery.isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Schatzkammer" />
        <SkeletonCard height={160} />
      </Screen>
    );
  }

  if (!activeAvatar) {
    return (
      <Screen>
        <ScreenHeader title="Schatzkammer" />
        <EmptyState
          icon={<Gem size={24} color={colors.accent.gold} />}
          title="Noch kein Avatar"
          description="Fundstücke gehören einem Avatar. Erstelle zuerst einen."
          actionLabel="Avatar erstellen"
          onAction={() => navigation.navigate('AvatarWizard')}
        />
      </Screen>
    );
  }

  return (
    <Screen playerClearance>
      <ScreenHeader title="Schatzkammer" subtitle={`${activeAvatar.name} · ${artifacts.length} Fundstücke`} />

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

        {crowns.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="overline" tone="tertiary">
              Kronen
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {crowns.map((crown) => (
                <Card key={crown.id} variant="elevated" style={{ flex: 1, minWidth: '46%', alignItems: 'center', gap: 6 }}>
                  <View style={[styles.crownBadge, { borderRadius: radius.pill, backgroundColor: colors.warningSoft }]}>
                    <Crown size={20} color={colors.accent.gold} />
                  </View>
                  <Text variant="labelSm" center numberOfLines={2}>
                    {crown.name}
                  </Text>
                </Card>
              ))}
            </View>
          </View>
        ) : null}

        {sets.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="overline" tone="tertiary">
              Sammlungen
            </Text>
            {sets.map((set) => (
              <Card key={set.id} variant="inset">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Sparkles size={16} color={set.crownUnlocked ? colors.accent.gold : colors.text.tertiary} />
                  <Text variant="label" style={{ flex: 1 }}>
                    {set.name}
                  </Text>
                  <Chip
                    label={`${set.ownedCount}/${set.totalCount}`}
                    size="sm"
                    tone={set.ownedCount === set.totalCount ? 'success' : 'neutral'}
                  />
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        <Text variant="overline" tone="tertiary">
          Fundstücke
        </Text>

        {treasuryQuery.isLoading ? (
          <SkeletonCard height={120} />
        ) : artifacts.length === 0 ? (
          <EmptyState
            icon={<Gem size={22} color={colors.accent.gold} />}
            title="Noch nichts gefunden"
            description="Fundstücke entstehen in Geschichten. Je mehr ihr erlebt, desto voller wird die Schatzkammer."
            actionLabel="Geschichte erstellen"
            onAction={() => navigation.navigate('StoryWizard', { mapAvatarId: activeAvatar.id })}
            compact
          />
        ) : (
          <View style={[styles.grid, { gap: spacing.sm }]}>
            {artifacts.map((artifact) => (
              <Touchable
                key={artifact.id}
                onPress={() => {
                  setSelectedArtifact(artifact);
                  detailRef.current?.expand();
                }}
                style={styles.gridItem}
                accessibilityLabel={artifact.name}
              >
                <Card padded={false} style={{ overflow: 'hidden' }}>
                  <CoverImage uri={artifact.imageUrl} style={{ height: 108 }} radius={0} fallbackGradient="warm" />
                  <View style={{ padding: spacing.sm, gap: 3 }}>
                    <Text variant="labelSm" numberOfLines={2}>
                      {artifact.name}
                    </Text>
                    {artifact.rarity ? <Chip label={artifact.rarity} size="sm" /> : null}
                  </View>
                </Card>
              </Touchable>
            ))}
          </View>
        )}
      </View>

      <Sheet ref={detailRef} snapPoints={['58%']} title={selectedArtifact?.name}>
        {selectedArtifact ? (
          <View style={{ gap: spacing.base }}>
            <CoverImage uri={selectedArtifact.imageUrl} style={{ height: 190 }} radius={radius.lg} fallbackGradient="warm" />

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {selectedArtifact.type ? <Chip label={selectedArtifact.type} size="sm" /> : null}
              {selectedArtifact.rarity ? <Chip label={selectedArtifact.rarity} size="sm" tone="accent" /> : null}
              {selectedArtifact.setName ? <Chip label={selectedArtifact.setName} size="sm" /> : null}
            </View>

            {selectedArtifact.description ? (
              <Text variant="body" tone="secondary">
                {selectedArtifact.description}
              </Text>
            ) : null}

            {selectedArtifact.storyEffect ? (
              <Card variant="inset">
                <Text variant="overline" tone="tertiary" style={{ marginBottom: 4 }}>
                  Wirkung in Geschichten
                </Text>
                <Text variant="bodySm" tone="secondary">
                  {selectedArtifact.storyEffect}
                </Text>
              </Card>
            ) : null}

            {selectedArtifact.acquiredAt ? (
              <Text variant="caption" tone="muted">
                Gefunden am {formatDate(selectedArtifact.acquiredAt)}
              </Text>
            ) : null}

            <Button
              label="In neue Geschichte mitnehmen"
              onPress={() => {
                detailRef.current?.close();
                navigation.navigate('StoryWizard', {
                  bringArtifact: selectedArtifact.id,
                  bringAvatar: activeAvatar.id,
                  mapAvatarId: activeAvatar.id,
                });
              }}
              icon={<Wand2 size={16} color={colors.primaryForeground} />}
              fullWidth
              size="lg"
            />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: '48%' },
  crownBadge: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
