import React from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Globe2 } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useBackend } from '@/api/backend';
import { queryKeys, usePublicDokus } from '@/hooks/queries';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { CoverImage } from '@/components/ui/CoverImage';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface PublishedLifeStory {
  id: string;
  title: string;
  summary?: string;
  coverImageUrl?: string;
  characterName?: string;
}

/** Public content: character life stories and shared dokus. */
export function CommunityScreen() {
  const { colors, spacing, radius } = useTheme();
  const navigation = useNavigation<Nav>();
  const backend = useBackend();

  const publicDokus = usePublicDokus();

  const lifeStoriesQuery = useQuery<PublishedLifeStory[]>({
    queryKey: queryKeys.communityStories(),
    queryFn: async () => {
      const response = (await (backend.story as any).listPublishedCharacterLifeStories({})) as {
        stories?: PublishedLifeStory[];
      };
      return response?.stories ?? [];
    },
  });

  const lifeStories = lifeStoriesQuery.data ?? [];
  const dokus = publicDokus.data ?? [];
  const isLoading = lifeStoriesQuery.isLoading || publicDokus.isLoading;

  return (
    <Screen playerClearance>
      <ScreenHeader title="Entdecken" subtitle="Öffentliche Geschichten und Dokus" />

      {isLoading ? (
        <View style={{ gap: spacing.lg }}>
          <SkeletonCard height={120} />
          <SkeletonCard height={120} />
        </View>
      ) : lifeStories.length === 0 && dokus.length === 0 ? (
        <EmptyState
          icon={<Globe2 size={24} color={colors.accent.sky} />}
          title="Noch nichts veröffentlicht"
          description="Hier erscheinen Geschichten und Dokus, die andere Familien geteilt haben."
        />
      ) : (
        <View style={{ gap: spacing.xl }}>
          {lifeStories.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="overline" tone="tertiary">
                Lebensgeschichten
              </Text>
              {lifeStories.map((story) => (
                <Touchable
                  key={story.id}
                  onPress={() => navigation.navigate('CharacterLifeStory', { storyId: story.id })}
                  accessibilityLabel={story.title}
                >
                  <Card padded={false}>
                    <View style={{ flexDirection: 'row', padding: spacing.sm, gap: spacing.md, alignItems: 'center' }}>
                      <CoverImage
                        uri={story.coverImageUrl}
                        style={{ width: 74, height: 74 }}
                        radius={radius.md}
                        fallbackGradient="sunset"
                      />
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text variant="title" numberOfLines={2}>
                          {story.title}
                        </Text>
                        {story.summary ? (
                          <Text variant="caption" tone="secondary" numberOfLines={2}>
                            {story.summary}
                          </Text>
                        ) : null}
                        {story.characterName ? <Chip label={story.characterName} size="sm" style={{ marginTop: 2 }} /> : null}
                      </View>
                    </View>
                  </Card>
                </Touchable>
              ))}
            </View>
          ) : null}

          {dokus.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="overline" tone="tertiary">
                Öffentliche Dokus
              </Text>
              {dokus.map((doku) => (
                <Touchable
                  key={doku.id}
                  onPress={() => navigation.navigate('DokuReader', { dokuId: doku.id })}
                  accessibilityLabel={doku.title}
                >
                  <Card padded={false}>
                    <View style={{ flexDirection: 'row', padding: spacing.sm, gap: spacing.md, alignItems: 'center' }}>
                      <CoverImage
                        uri={doku.coverImageUrl}
                        style={{ width: 74, height: 74 }}
                        radius={radius.md}
                        fallbackGradient="nature"
                      />
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text variant="title" numberOfLines={2}>
                          {doku.title}
                        </Text>
                        <Text variant="caption" tone="secondary" numberOfLines={2}>
                          {doku.summary}
                        </Text>
                        <Chip label={doku.topic} size="sm" style={{ marginTop: 2 }} />
                      </View>
                    </View>
                  </Card>
                </Touchable>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}
