import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useBackend } from '@/api/backend';
import { useToast } from '@/providers/ToastProvider';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import type { SheetRef } from '@/components/ui/Sheet';
import { RecordEditor } from './RecordEditor';
import type { RootStackParamList } from '@/navigation/types';

export function CharacterLifeEditorScreen() {
  const { params: { characterId } } = useRoute<RouteProp<RootStackParamList, 'CharacterLifeEditor'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const backend = useBackend(); const toast = useToast(); const editor = useRef<SheetRef>(null);
  const [ageGroup, setAgeGroup] = useState('6-8'); const [busy, setBusy] = useState(false);
  const life = useQuery({ queryKey: ['admin-character-life', characterId], queryFn: () => backend.story.getCharacterLifeStory({ characterId }), refetchInterval: (query) => query.state.data?.story?.status === 'generating' ? 5000 : false });
  async function run(action: () => Promise<unknown>) { if (busy) return; setBusy(true); try { await action(); await life.refetch(); } catch (error) { toast.error('Aktion fehlgeschlagen', error instanceof Error ? error.message : undefined); } finally { setBusy(false); } }
  return <Screen><ScreenHeader title="Charakter-Lebensgeschichte" /><View style={{ gap: 16 }}>
    {life.isError ? <Button label="Erneut laden" onPress={() => void life.refetch()} /> : null}
    <View style={{ flexDirection: 'row', gap: 8 }}>{['3-5', '6-8', '9-12', '13+'].map((age) => <Chip key={age} label={age} selected={ageGroup === age} onPress={() => setAgeGroup(age)} />)}</View>
    <Button label={life.data?.story ? 'Lebensgeschichte neu erstellen' : 'Lebensgeschichte erstellen'} loading={busy} disabled={life.data?.story?.status === 'generating'} onPress={() => void run(() => backend.story.generateCharacterLifeStory({ characterId, ageGroup }))} />
    {life.data?.story ? <><Text variant="headingMd">{life.data.story.title}</Text><Text>{life.data.story.description}</Text><Text>Status: {life.data.story.status} · {life.data.story.wordCount} Wörter</Text><Button label="Text und Kapitel bearbeiten" variant="secondary" onPress={() => editor.current?.expand()} /><Button label="Lesen" variant="secondary" onPress={() => navigation.navigate('CharacterLifeStory', { storyId: life.data.story.id })} /><Button label={life.data.story.status === 'published' ? 'Veröffentlichung zurücknehmen' : 'Veröffentlichen'} disabled={busy || life.data.story.status === 'generating'} onPress={() => void run(() => backend.story.setCharacterLifeStoryStatus({ characterId, status: life.data.story.status === 'published' ? 'draft' : 'published' }))} />{life.data.story.lastError ? <Text tone="danger">{life.data.story.lastError}</Text> : null}</> : null}
  </View><RecordEditor sheetRef={editor} title="Lebensgeschichte bearbeiten" data={life.data?.story ?? null} onSave={async (data) => { await backend.story.updateCharacterLifeStory({ characterId, title: data.title, description: data.description, chapters: data.chapters }); await life.refetch(); }} /></Screen>;
}
