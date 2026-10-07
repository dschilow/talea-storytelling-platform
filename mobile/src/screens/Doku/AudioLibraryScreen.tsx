import React, { useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useBackend } from '@/api/backend';
import { useAudioPlayer } from '@/providers/AudioPlayerProvider';
import { useOptionalUserAccess } from '@/providers/UserAccessProvider';
import { useToast } from '@/providers/ToastProvider';
import { collectPages } from '@/lib/pagination';
import { useTheme } from '@/theme/ThemeProvider';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CoverImage } from '@/components/ui/CoverImage';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import type { RootStackParamList } from '@/navigation/types';

export interface AudioDoku { id: string; title: string; description: string; category?: string; ageGroup?: string; coverImageUrl?: string; audioUrl: string; isPublic: boolean; locked?: boolean; lockReason?: string }
export function AudioLibraryScreen() {
  const { spacing, radius } = useTheme();
  const backend = useBackend();
  const { addAndPlay, addToPlaylist } = useAudioPlayer();
  const { isAdmin } = useOptionalUserAccess();
  const toast = useToast();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<AudioDoku | null>(null);
  const episodes = useQuery<AudioDoku[]>({ queryKey: ['audio-dokus'], queryFn: () => collectPages(async (page) => {
    const response = await backend.doku.listAudioDokus(page);
    return { ...response, items: response.audioDokus ?? [] };
  }) });
  async function play(episode: AudioDoku, queueOnly = false) {
    try {
      // Re-check entitlement and resolve a fresh, signed URL at the moment of play.
      const fresh = await backend.doku.getAudioDoku({ id: episode.id }) as AudioDoku;
      if (fresh.locked || !fresh.audioUrl) { toast.info('Hörfolge gesperrt', fresh.lockReason ?? 'Diese Folge ist in deinem Tarif nicht enthalten.'); return; }
      const item = { id: `audio-doku:${fresh.id}`, trackId: fresh.id, title: fresh.title, description: fresh.description,
        coverImageUrl: fresh.coverImageUrl, audioUrl: fresh.audioUrl, type: 'audio-doku' as const, conversionStatus: 'ready' as const };
      if (queueOnly) { addToPlaylist([item]); toast.success('Zur Wiedergabeliste hinzugefügt'); }
      else addAndPlay([item]);
    } catch (error) { toast.error('Hörfolge konnte nicht geladen werden', error instanceof Error ? error.message : undefined); }
  }
  return <Screen playerClearance onRefresh={() => void episodes.refetch()} refreshing={episodes.isRefetching}>
    <ScreenHeader title="Hörbibliothek" subtitle="Audio-Dokus zum Entdecken" />
    <View style={{ gap: spacing.base }}>
      <Input placeholder="Titel, Thema oder Altersgruppe" value={search} onChangeText={setSearch} />
      {isAdmin ? <Button label="Audio-Doku erstellen" onPress={() => navigation.navigate('AudioDokuCreate')} /> : null}
      {episodes.isLoading ? <Text>Lädt …</Text> : episodes.isError ? <EmptyState title="Hörbibliothek konnte nicht geladen werden" actionLabel="Erneut versuchen" onAction={() => void episodes.refetch()} /> : null}
      {episodes.data?.filter((episode) => `${episode.title} ${episode.description} ${episode.category} ${episode.ageGroup}`.toLowerCase().includes(search.toLowerCase())).map((episode) =>
        <Card key={episode.id}><View style={{ gap: spacing.sm }}>
          <CoverImage uri={episode.coverImageUrl} style={{ height: 160 }} radius={radius.md} fallbackGradient="nature" />
          <Text variant="headingSm">{episode.title}</Text><Text>{episode.description}</Text>
          <Text variant="caption">{episode.category} · {episode.ageGroup}{episode.locked ? ' · Gesperrt' : ''}</Text>
          <Button label={episode.locked ? 'Tarifzugang prüfen' : 'Anhören'} onPress={() => void play(episode)} />
          {!episode.locked ? <Button label="Zur Wiedergabeliste" variant="secondary" onPress={() => void play(episode, true)} /> : null}
          {isAdmin ? <>
            <Button label="Bearbeiten" variant="secondary" onPress={() => navigation.navigate('AudioDokuCreate', { audioDokuId: episode.id })} />
            <Button label="Löschen" variant="secondary" onPress={() => setPendingDelete(episode)} />
          </> : null}
        </View></Card>)}
      {!episodes.isLoading && !episodes.isError && episodes.data?.length === 0 ? <EmptyState title="Noch keine Hörfolgen" /> : null}
    </View>
    <ConfirmSheet open={Boolean(pendingDelete)} title="Audio-Doku löschen?" message={`„${pendingDelete?.title ?? ''}“ wird dauerhaft gelöscht.`} destructive confirmLabel="Löschen"
      onCancel={() => setPendingDelete(null)} onConfirm={async () => {
        if (!pendingDelete) return;
        try { await backend.doku.deleteAudioDoku({ id: pendingDelete.id }); setPendingDelete(null); await episodes.refetch(); }
        catch (error) { toast.error('Löschen fehlgeschlagen', error instanceof Error ? error.message : undefined); }
      }} />
  </Screen>;
}
