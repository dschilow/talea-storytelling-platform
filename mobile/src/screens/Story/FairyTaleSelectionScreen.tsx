import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Clock, Globe2, Sparkles } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useBackend } from '@/api/backend';
import { queryKeys } from '@/hooks/queries';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface FairyTale {
  id: string;
  title: string;
  source: string;
  cultureRegion: string;
  ageRecommendation: number;
  durationMinutes: number;
  genreTags: string[];
  moralLesson?: string;
  summary?: string;
}

/**
 * Fairy-tale template picker.
 *
 * Choosing a tale leads into character mapping, where the child's own avatars
 * are cast into the tale's roles — that casting step is what turns a public-
 * domain tale into a personalised story.
 */
export function FairyTaleSelectionScreen() {
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<Nav>();
  const backend = useBackend();

  const [search, setSearch] = useState('');
  const [region, setRegion] = useState<string>('all');

  const talesQuery = useQuery<FairyTale[]>({
    queryKey: queryKeys.fairyTales(),
    queryFn: async () => {
      const response = (await (backend.story as any).listAvailableFairyTales({})) as { tales?: FairyTale[] };
      return response?.tales ?? [];
    },
  });

  const tales = talesQuery.data ?? [];

  const regions = useMemo(() => {
    const unique = new Set(tales.map((tale) => tale.cultureRegion).filter(Boolean));
    return ['all', ...Array.from(unique).sort()];
  }, [tales]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tales.filter((tale) => {
      if (region !== 'all' && tale.cultureRegion !== region) return false;
      if (!term) return true;
      return (
        tale.title.toLowerCase().includes(term) ||
        (tale.summary ?? '').toLowerCase().includes(term) ||
        tale.genreTags.some((tag) => tag.toLowerCase().includes(term))
      );
    });
  }, [region, search, tales]);

  return (
    <Screen>
      <ScreenHeader title="Märchen wählen" subtitle="Deine Avatare übernehmen die Rollen" />

      <View style={{ gap: spacing.base }}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Märchen suchen"
          icon={<Sparkles size={16} color={colors.text.tertiary} />}
        />

        {regions.length > 2 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {regions.map((entry) => (
              <Chip
                key={entry}
                label={entry === 'all' ? 'Alle Regionen' : entry}
                selected={region === entry}
                onPress={() => setRegion(entry)}
              />
            ))}
          </View>
        ) : null}

        {talesQuery.isLoading ? (
          <View style={{ gap: spacing.lg }}>
            <SkeletonCard height={110} />
            <SkeletonCard height={110} />
            <SkeletonCard height={110} />
          </View>
        ) : talesQuery.isError ? (
          <EmptyState
            title="Märchen konnten nicht geladen werden"
            description="Prüfe deine Verbindung und versuche es erneut."
            actionLabel="Erneut versuchen"
            onAction={() => void talesQuery.refetch()}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Sparkles size={22} color={colors.text.tertiary} />}
            title="Nichts gefunden"
            description="Versuche einen anderen Suchbegriff."
            compact
          />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {filtered.map((tale) => (
              <Touchable
                key={tale.id}
                onPress={() => navigation.navigate('CharacterMapping', { taleId: tale.id })}
                accessibilityLabel={tale.title}
              >
                <Card>
                  <View style={{ gap: 6 }}>
                    <Text variant="title">{tale.title}</Text>
                    {tale.summary ? (
                      <Text variant="bodySm" tone="secondary" numberOfLines={3}>
                        {tale.summary}
                      </Text>
                    ) : null}

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 4 }}>
                      {tale.cultureRegion ? (
                        <Chip
                          label={tale.cultureRegion}
                          size="sm"
                          icon={<Globe2 size={10} color={colors.text.secondary} />}
                        />
                      ) : null}
                      {tale.ageRecommendation ? <Chip label={`ab ${tale.ageRecommendation} J.`} size="sm" /> : null}
                      {tale.durationMinutes ? (
                        <Chip
                          label={`${tale.durationMinutes} Min`}
                          size="sm"
                          icon={<Clock size={10} color={colors.text.secondary} />}
                        />
                      ) : null}
                    </View>

                    {tale.moralLesson ? (
                      <Text variant="caption" tone="tertiary" style={{ marginTop: 2 }}>
                        Botschaft: {tale.moralLesson}
                      </Text>
                    ) : null}
                  </View>
                </Card>
              </Touchable>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}
