import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Orbit, Sparkles, TrendingUp } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useBackend } from '@/api/backend';
import { queryKeys, useAvatars } from '@/hooks/queries';
import { readTraits, traitEmoji, traitLabel } from '@/lib/personality';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface CosmosDomain {
  id: string;
  name: string;
  mastery?: number;
  topicCount?: number;
  masteredCount?: number;
}

interface CosmosState {
  domains?: CosmosDomain[];
  suggestions?: { id: string; title: string; domainId?: string; reason?: string }[];
  totalMastery?: number;
}

/**
 * Knowledge cosmos.
 *
 * The web renders this as a 3D scene (three.js). That does not port meaningfully
 * to a phone — the interaction budget and the thermal cost are both wrong — so
 * the mobile version presents the same underlying data as an explorable list:
 * domains with mastery, plus the backend's topic suggestions as concrete next
 * steps. Same model, native interaction.
 */
export function CosmosScreen() {
  const { colors, spacing, radius } = useTheme();
  const navigation = useNavigation<Nav>();
  const backend = useBackend();

  const avatarsQuery = useAvatars();
  const avatars = avatarsQuery.data ?? [];
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);

  const activeAvatar = useMemo(
    () => avatars.find((avatar) => avatar.id === selectedAvatarId) ?? avatars[0] ?? null,
    [avatars, selectedAvatarId]
  );

  const cosmosQuery = useQuery<CosmosState>({
    queryKey: queryKeys.cosmos(activeAvatar?.id ?? ''),
    queryFn: async () =>
      ((await (backend.avatar as any).getCosmosStateV2({ avatarId: activeAvatar!.id })) as CosmosState) ?? {},
    enabled: Boolean(activeAvatar?.id),
    // The cosmos is derived server-side from stories and quizzes; a stale view
    // is harmless and this call is relatively expensive.
    staleTime: 5 * 60_000,
  });

  // Knowledge subcategories are the local mirror of the cosmos, and they render
  // even when the server-side state is unavailable.
  const knowledgeTrait = useMemo(() => readTraits(activeAvatar).find((trait) => trait.id === 'knowledge'), [activeAvatar]);

  const domains = cosmosQuery.data?.domains ?? [];
  const suggestions = cosmosQuery.data?.suggestions ?? [];

  if (avatarsQuery.isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Wissenskosmos" />
        <SkeletonCard height={160} />
      </Screen>
    );
  }

  if (!activeAvatar) {
    return (
      <Screen>
        <ScreenHeader title="Wissenskosmos" />
        <EmptyState
          icon={<Orbit size={24} color={colors.accent.sky} />}
          title="Noch kein Avatar"
          description="Der Wissenskosmos zeigt, was ein Avatar in Geschichten und Dokus gelernt hat."
          actionLabel="Avatar erstellen"
          onAction={() => navigation.navigate('AvatarWizard')}
        />
      </Screen>
    );
  }

  const hasAnything = domains.length > 0 || (knowledgeTrait?.subcategories.length ?? 0) > 0;

  return (
    <Screen playerClearance>
      <ScreenHeader title="Wissenskosmos" subtitle={`${activeAvatar.name}`} />

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={[styles.orb, { borderRadius: radius.pill, backgroundColor: colors.successSoft }]}>
              <Text variant="headingSm">{traitEmoji('knowledge')}</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="headingSm">
                {traitLabel('knowledge')} {knowledgeTrait?.value ?? 0}
              </Text>
              <Text variant="caption" tone="secondary">
                {knowledgeTrait?.subcategories.length ?? 0} Wissensgebiete entdeckt
              </Text>
              <ProgressBar progress={Math.min(1, (knowledgeTrait?.value ?? 0) / 1000)} />
            </View>
          </View>
        </Card>

        {!hasAnything && !cosmosQuery.isLoading ? (
          <EmptyState
            icon={<Sparkles size={22} color={colors.accent.sky} />}
            title="Der Kosmos ist noch leer"
            description="Lies eine Geschichte oder ein Doku — jedes neue Wissensgebiet erscheint hier als eigener Bereich."
            actionLabel="Doku erstellen"
            onAction={() => navigation.navigate('DokuWizard')}
            compact
          />
        ) : null}

        {/* Server-side domains, when available. */}
        {domains.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="overline" tone="tertiary">
              Bereiche
            </Text>
            {domains.map((domain, index) => (
              <Animated.View key={domain.id} entering={FadeInDown.delay(index * 45).duration(300)}>
                <Card>
                  <View style={{ gap: 6 }}>
                    <View style={styles.row}>
                      <Text variant="label" style={{ flex: 1 }}>
                        {domain.name}
                      </Text>
                      {domain.masteredCount !== undefined && domain.topicCount !== undefined ? (
                        <Chip label={`${domain.masteredCount}/${domain.topicCount}`} size="sm" />
                      ) : null}
                    </View>
                    <ProgressBar progress={Math.min(1, (domain.mastery ?? 0) / 100)} height={5} />
                  </View>
                </Card>
              </Animated.View>
            ))}
          </View>
        ) : null}

        {/* Local knowledge subcategories — always available, no network needed. */}
        {knowledgeTrait && knowledgeTrait.subcategories.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="overline" tone="tertiary">
              Wissensgebiete
            </Text>
            {knowledgeTrait.subcategories.map((subcategory, index) => (
              <Animated.View key={subcategory.key} entering={FadeInDown.delay(index * 40).duration(300)}>
                <Card>
                  <View style={{ gap: 6 }}>
                    <View style={styles.row}>
                      <Text variant="label" style={{ flex: 1 }}>
                        {subcategory.label}
                      </Text>
                      <Text variant="labelSm" tone="accent">
                        {subcategory.value}
                      </Text>
                    </View>
                    <ProgressBar progress={Math.min(1, subcategory.value / 1000)} height={5} />
                    {subcategory.description ? (
                      <Text variant="caption" tone="tertiary">
                        {subcategory.description}
                      </Text>
                    ) : null}
                  </View>
                </Card>
              </Animated.View>
            ))}
          </View>
        ) : null}

        {suggestions.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="overline" tone="tertiary">
              Vorschläge
            </Text>
            {suggestions.map((suggestion) => (
              <Touchable
                key={suggestion.id}
                onPress={() => navigation.navigate('DokuWizard')}
                accessibilityLabel={suggestion.title}
              >
                <Card variant="inset">
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <TrendingUp size={16} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text variant="label">{suggestion.title}</Text>
                      {suggestion.reason ? (
                        <Text variant="caption" tone="tertiary">
                          {suggestion.reason}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </Card>
              </Touchable>
            ))}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  orb: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center' },
});
