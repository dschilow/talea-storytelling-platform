import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useBackend } from '@/api/backend';
import { useAvatars } from '@/hooks/queries';
import { useOptionalChildProfiles } from '@/providers/ChildProfilesProvider';
import { useToast } from '@/providers/ToastProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { domainLabel, type CosmosState, type TopicIsland, type TopicTimeline } from '@/lib/featureModels';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Touchable } from '@/components/ui/Pressable';
import type { RootStackParamList } from '@/navigation/types';

type Suggestion = { suggestionId: string; topicTitle: string; topicSlug: string; teaserKid: string; reasonParent: string };
export function CosmosScreen() {
  const { spacing } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const backend = useBackend();
  const profileId = useOptionalChildProfiles()?.activeProfileId ?? undefined;
  const toast = useToast();
  const avatarsQuery = useAvatars();
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [domainId, setDomainId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const avatar = useMemo(() => avatarsQuery.data?.find((a) => a.id === avatarId) ?? avatarsQuery.data?.[0], [avatarId, avatarsQuery.data]);
  const params = { avatarId: avatar?.id, profileId };
  const state = useQuery<CosmosState>({ queryKey: ['cosmos', profileId, avatar?.id],
    queryFn: () => backend.avatar.getCosmosStateV2(params), enabled: Boolean(profileId || avatar) });
  const topics = useQuery<{ activeIslands: TopicIsland[]; otherTopics: TopicIsland[] }>({
    queryKey: ['cosmos-topics', profileId, avatar?.id, domainId],
    queryFn: () => backend.avatar.getDomainTopicsV2({ ...params, domainId }), enabled: Boolean(domainId),
  });
  const suggestions = useQuery<{ items: Suggestion[] }>({ queryKey: ['cosmos-suggestions', profileId, avatar?.id, domainId],
    queryFn: () => backend.avatar.getTopicSuggestions({ ...params, domainId }), enabled: Boolean(domainId), staleTime: 300000 });
  const timeline = useQuery<TopicTimeline>({ queryKey: ['cosmos-timeline', profileId, avatar?.id, topicId],
    queryFn: () => backend.avatar.getTopicTimelineV2({ ...params, topicId }), enabled: Boolean(topicId) });

  async function select(suggestion: Suggestion) {
    if (!domainId || selecting) return;
    setSelecting(true);
    try {
      await backend.avatar.selectTopicSuggestion({ ...params, domainId, topicSlug: suggestion.topicSlug, topicTitle: suggestion.topicTitle });
      navigation.navigate('DokuWizard', { topic: suggestion.topicTitle, domainId });
    } catch (error) { toast.error('Thema konnte nicht ausgewählt werden', error instanceof Error ? error.message : undefined); }
    finally { setSelecting(false); }
  }
  return <Screen playerClearance>
    <ScreenHeader title="Wissenskosmos" subtitle={avatar?.name} />
    <View style={{ gap: spacing.base }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {avatarsQuery.data?.map((a) => <Chip key={a.id} label={a.name} selected={a.id === avatar?.id} onPress={() => { setAvatarId(a.id); setTopicId(null); }} />)}
      </View>
      {state.isLoading ? <Text>Lädt …</Text> : state.isError ? <EmptyState title="Wissenskosmos konnte nicht geladen werden" actionLabel="Erneut versuchen" onAction={() => void state.refetch()} /> : null}
      {state.data ? <Text variant="bodySm">{state.data.totalStoriesRead} Geschichten · {state.data.totalDokusRead} Dokus gelesen</Text> : null}
      {state.data?.domains.map((domain) => <Touchable key={domain.domainId} onPress={() => { setDomainId(domain.domainId); setTopicId(null); }} accessibilityLabel={domainLabel(domain.domainId)}>
        <Card variant={domainId === domain.domainId ? 'elevated' : 'inset'}><View style={{ gap: spacing.sm }}>
          <Text variant="headingSm">{domainLabel(domain.domainId)} · Level {domain.planetLevel}</Text>
          <Text variant="bodySm">{domain.masteryText} · {domain.confidenceText}</Text>
          <ProgressBar progress={Math.min(1, domain.masteryScore / 100)} />
          <Text variant="caption">{domain.activeTopicCount} Themen · {domain.evidence}</Text>
        </View></Card>
      </Touchable>)}
      {domainId ? <>
        <Text variant="headingSm">Themen in {domainLabel(domainId)}</Text>
        {topics.isLoading ? <Text>Lädt …</Text> : topics.isError ? <EmptyState title="Themen konnten nicht geladen werden" actionLabel="Erneut versuchen" onAction={() => void topics.refetch()} /> : null}
        {[...(topics.data?.activeIslands ?? []), ...(topics.data?.otherTopics ?? [])].map((topic) => <Touchable key={topic.topicId} onPress={() => setTopicId(topic.topicId)}>
          <Card><Text variant="label">{topic.topicTitle}</Text><Text variant="caption">{topic.masteryLabel} · {topic.confidenceLabel} · {topic.docsCount} Inhalte</Text>
            {topic.recallDueAt ? <Text variant="caption">Wiederholung: {new Date(topic.recallDueAt).toLocaleDateString()}</Text> : null}
          </Card>
        </Touchable>)}
        {topicId ? <Card><View style={{ gap: spacing.sm }}>
          <Text variant="label">Lernverlauf</Text>
          {timeline.isLoading ? <Text>Lädt …</Text> : timeline.isError ? <Button label="Verlauf erneut laden" onPress={() => void timeline.refetch()} /> : null}
          {timeline.data?.docs.map((doc) => <Button key={doc.contentId} label={doc.title} variant="secondary" onPress={() => doc.type === 'doku' ?
            navigation.navigate('DokuReader', { dokuId: doc.contentId }) : navigation.navigate('StoryReader', { storyId: doc.contentId })} />)}
          {timeline.data?.quizAttempts.map((attempt) => <Text key={attempt.id} variant="caption">Quiz: {attempt.correctCount}/{attempt.totalCount} · {new Date(attempt.createdAt).toLocaleDateString()}</Text>)}
          {timeline.data?.recallTasks.map((task) => <View key={task.id} style={{ gap: spacing.sm }}>
            <Text variant="caption">Wiederholung: {task.status} · {new Date(task.dueAt).toLocaleDateString()}</Text>
            {task.status === 'pending' && timeline.data?.docs.some((doc) => doc.type === 'doku') ? <Button label="Wissen wiederholen" onPress={() => navigation.navigate('DokuQuiz', { dokuId: timeline.data!.docs.find((doc) => doc.type === 'doku')!.contentId })} /> : null}
          </View>)}
        </View></Card> : null}
        <Text variant="headingSm">Als Nächstes entdecken</Text>
        {suggestions.isLoading ? <Text>Themen werden vorbereitet …</Text> : suggestions.isError ? <Button label="Vorschläge erneut laden" onPress={() => void suggestions.refetch()} /> : null}
        {suggestions.data?.items.map((suggestion) => <Card key={suggestion.suggestionId}><View style={{ gap: spacing.sm }}>
          <Text variant="label">{suggestion.topicTitle}</Text><Text variant="bodySm">{suggestion.teaserKid}</Text>
          <Button label="Doku entdecken" loading={selecting} onPress={() => void select(suggestion)} />
        </View></Card>)}
        <Button label="Anderen Vorschlag suchen" variant="secondary" onPress={async () => {
          try { await backend.avatar.refreshOneTopicSuggestion({ ...params, domainId }); await suggestions.refetch(); }
          catch { toast.error('Vorschläge konnten nicht aktualisiert werden'); }
        }} />
      </> : null}
      <Button label="Doku erstellen" onPress={() => navigation.navigate('DokuWizard', domainId ? { domainId } : undefined)} />
    </View>
  </Screen>;
}
