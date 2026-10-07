import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useBackend } from '@/api/backend';
import { useAvatars, useAvatarMemories, useDokus, useStories } from '@/hooks/queries';
import { useJourneyProgress } from '@/hooks/useJourneyProgress';
import { buildDynamicSegments } from '@/lib/journeySegments';
import { computeNodeStates, SEED_SEGMENTS } from '@/lib/TaleaLearningPathSeedData';
import { finishJourneyNode, startJourneyNode } from '@/lib/journeyModel';
import { readTraits } from '@/lib/personality';
import type { MapNode, MapSegment } from '@/lib/TaleaLearningPathTypes';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/providers/ToastProvider';
import type { RootStackParamList } from '@/navigation/types';

const LABELS = { DokuStop: 'Wissen', QuizStop: 'Quiz', StoryGate: 'Geschichte', StudioStage: 'Hören', MemoryFire: 'Erinnerung', Fork: 'Abzweigung' };
export function JourneyScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const backend = useBackend(); const toast = useToast();
  const avatars = useAvatars(); const stories = useStories(); const dokus = useDokus();
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const avatar = avatars.data?.find((a) => a.id === selectedAvatarId) ?? avatars.data?.[0];
  const memories = useAvatarMemories(avatar?.id);
  const ledger = useJourneyProgress(avatar?.id);
  const audio = useQuery({ queryKey: ['journey-audio'], queryFn: () => backend.doku.listAudioDokus({ limit: 50, offset: 0 }) });
  const [segmentLimit, setSegmentLimit] = useState(6); const [todayOnly, setTodayOnly] = useState(false);
  const generated = useMemo(() => {
    if (!(dokus.data?.length || stories.data?.length)) return { segments: SEED_SEGMENTS, backendDoneIds: new Set<string>() };
    return buildDynamicSegments((dokus.data ?? []).filter((d) => d.status === 'complete') as any, stories.data ?? [], (memories.data ?? []) as any, audio.data?.audioDokus ?? [], segmentLimit, avatar?.id ?? null);
  }, [dokus.data, stories.data, memories.data, audio.data, segmentLimit, avatar?.id]);
  const progress = { ...ledger.progress, doneNodeIds: [...new Set([...ledger.progress.doneNodeIds, ...generated.backendDoneIds])] };
  const traits = Object.fromEntries(readTraits(avatar).map((trait) => [trait.id, trait.value]));
  async function start(node: MapNode) {
    try {
      if (node.action.type === 'sheet') { await ledger.update((state) => finishJourneyNode(state, node.nodeId)); return; }
      if (node.action.type !== 'navigate') return;
      await ledger.update((state) => startJourneyNode(state, node));
      const { to, params } = node.action;
      if (to.startsWith('/doku-reader/')) navigation.navigate('DokuReader', { dokuId: to.split('/').pop()! });
      else if (to.startsWith('/story-reader/')) navigation.navigate('StoryReader', { storyId: to.split('/').pop()! });
      else if (to === '/doku/create') navigation.navigate('DokuWizard', { topic: (params?.topicTags ?? '').replace(/,/g, ', ') });
      else if (to === '/story') navigation.navigate('StoryWizard', { tags: params?.tags, mapAvatarId: avatar?.id });
      else if (to === '/quiz') navigation.navigate('Tabs', { screen: 'Spiel', params: { tab: 'quiz' } });
      else if (to === '/doku') navigation.navigate(params?.mode === 'audio' ? 'AudioLibrary' : 'Tabs', params?.mode === 'audio' ? undefined : { screen: 'Dokus' } as any);
    } catch (error) { toast.error('Lernschritt konnte nicht gestartet werden', error instanceof Error ? error.message : undefined); }
  }
  if (avatars.isLoading || dokus.isLoading || stories.isLoading) return <Screen><ScreenHeader title="Lernkarte" /><Text>Lernkarte wird geladen …</Text></Screen>;
  if (avatars.isError || dokus.isError || stories.isError) return <Screen><ScreenHeader title="Lernkarte" /><EmptyState title="Lernkarte konnte nicht geladen werden" actionLabel="Erneut versuchen" onAction={() => { void avatars.refetch(); void dokus.refetch(); void stories.refetch(); }} /></Screen>;
  if (!avatar) return <Screen><ScreenHeader title="Lernkarte" /><EmptyState title="Noch kein Avatar" actionLabel="Avatar erstellen" onAction={() => navigation.navigate('AvatarWizard')} /></Screen>;
  return <Screen playerClearance><ScreenHeader title="Lernkarte" subtitle="Wissen, Geschichten und Quiz verbinden sich zu deinem Lernweg." /><View style={{ gap: 16 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{avatars.data?.map((item) => <Chip key={item.id} label={item.name} selected={item.id === avatar.id} onPress={() => setSelectedAvatarId(item.id)} />)}</View>
    <View style={{ flexDirection: 'row', gap: 8 }}><Chip label="Alle Kapitel" selected={!todayOnly} onPress={() => setTodayOnly(false)} /><Chip label="Heute empfohlen" selected={todayOnly} onPress={() => setTodayOnly(true)} /></View>
    {generated.segments.map((segment: MapSegment) => <View key={segment.segmentId} style={{ gap: 12 }}><Text variant="headingMd">{segment.title}</Text>{computeNodeStates(segment, progress, traits).nodesWithState.filter(({ node }) => !todayOnly || segment.recommendedDailyStops?.includes(node.nodeId)).map(({ node, state }) => <Card key={node.nodeId}><View style={{ gap: 8 }}><Chip label={`${LABELS[node.type]} · ${state === 'done' ? 'Geschafft ✓' : state === 'locked' ? 'Noch gesperrt' : 'Bereit'}`} /><Text variant="headingSm">{node.title}</Text><Text>{node.subtitle}</Text>{node.action.type === 'fork' ? node.action.options.map((option) => <Button key={option.id} label={`${option.icon} ${option.label}`} disabled={state === 'locked'} variant="secondary" onPress={async () => { try { await ledger.update((current) => ({ ...finishJourneyNode(current, node.nodeId), forkSelectionsByNodeId: { ...current.forkSelectionsByNodeId, [node.nodeId]: { optionId: option.id, nextSegmentId: option.nextSegmentId, selectedAt: Date.now() } } })); } catch (error) { toast.error('Auswahl nicht gespeichert'); } }} />) : <Button label={state === 'done' ? 'Noch einmal öffnen' : 'Lernschritt starten'} disabled={state === 'locked'} onPress={() => void start(node)} />}</View></Card>)}</View>)}
    {generated.segments.length >= segmentLimit ? <Button label="Weitere Kapitel" variant="secondary" onPress={() => setSegmentLimit((value) => value + 6)} /> : null}
  </View></Screen>;
}
