import React, { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useBackend } from '@/api/backend';
import { useTheme } from '@/theme/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { useAudioPlayer } from '@/providers/AudioPlayerProvider';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Stepper } from '@/components/form/Stepper';
import type { RootStackParamList } from '@/navigation/types';

/** Native upload, script generation, casting, dialogue and server-side mastering. */
export function AudioDokuCreateScreen() {
  const { spacing } = useTheme();
  const backend = useBackend();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AudioDokuCreate'>>();
  const id = route.params?.audioDokuId;
  const queryClient = useQueryClient();
  const toast = useToast();
  const { playTrack } = useAudioPlayer();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverDescription, setCoverDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [category, setCategory] = useState('Wissen');
  const [ageGroup, setAgeGroup] = useState('6-8');
  const [isPublic, setIsPublic] = useState(false);
  const [audio, setAudio] = useState<{ audioUrl?: string; audioDataUrl?: string; filename?: string }>({});
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [script, setScript] = useState('');
  const [minutes, setMinutes] = useState(5);
  const [speakerNames, setSpeakerNames] = useState('TAVI, LUMI');
  const [speakerVoiceMap, setSpeakerVoiceMap] = useState<Record<string, string>>({});
  const [provider, setProvider] = useState<'elevenlabs' | 'qwen'>('elevenlabs');
  const [soundDesign, setSoundDesign] = useState(true);
  const [screenplay, setScreenplay] = useState<unknown[]>([]);
  const voices = useQuery<Array<{ id: string; name: string }>>({ queryKey: ['audio-create-voices', provider], queryFn: async () => {
    if (provider === 'qwen') { const response = await backend.tts.listQwenVoices(); return response.availableSpeakers.map((name: string) => ({ id: name, name })); }
    const response = await backend.tts.listElevenLabsVoices(); return response.voices.map((voice: { voiceId: string; name: string }) => ({ id: voice.voiceId, name: voice.name }));
  } });
  const existing = useQuery({ queryKey: ['audio-doku-edit', id], queryFn: () => backend.doku.getAudioDoku({ id: id! }), enabled: Boolean(id) });
  useEffect(() => {
    const entry = existing.data; if (!entry) return;
    setTitle(entry.title); setDescription(entry.description); setCoverDescription(entry.coverDescription ?? '');
    setCoverImageUrl(entry.coverImageUrl ?? ''); setCategory(entry.category ?? 'Wissen'); setAgeGroup(entry.ageGroup ?? '6-8');
    setAudio({ audioUrl: entry.audioUrl }); setIsPublic(entry.isPublic);
  }, [existing.data]);

  async function action(label: string, task: () => Promise<void>) {
    if (busy) return; setBusy(label);
    try { await task(); } catch (error) { toast.error(`${label} fehlgeschlagen`, error instanceof Error ? error.message : undefined); }
    finally { setBusy(null); }
  }
  async function generatedAudio(data: string, url?: string) {
    if (url) { setAudio({ audioUrl: url }); setPreviewUri(url); return; }
    const payload = data.replace(/^data:[^,]+,/, '');
    const uri = `${FileSystem.cacheDirectory}audio-doku-preview-${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(uri, payload, { encoding: FileSystem.EncodingType.Base64 });
    setPreviewUri(uri); setAudio({ audioDataUrl: data.startsWith('data:') ? data : `data:audio/mpeg;base64,${data}`, filename: 'audio-doku.mp3' });
  }
  const speakers = [...new Set(script.split('\n').map((line) => /^\s*([^:\n]{1,80}):/.exec(line)?.[1].trim()).filter((name): name is string => Boolean(name)))];
  return <Screen playerClearance>
    <ScreenHeader title={id ? 'Audio-Doku bearbeiten' : 'Audio-Doku erstellen'} subtitle={busy ?? 'Aufnahme importieren oder einen Dialog erzeugen'} />
    <View style={{ gap: spacing.base }}>
      {existing.isError ? <Button label="Audio-Doku erneut laden" onPress={() => void existing.refetch()} /> : null}
      <Input label="Titel" value={title} onChangeText={setTitle} />
      <Input label="Beschreibung" value={description} onChangeText={setDescription} multilineRows={3} />
      <Input label="Altersgruppe" value={ageGroup} onChangeText={setAgeGroup} />
      <Input label="Kategorie" value={category} onChangeText={setCategory} />
      <Input label="Cover-Beschreibung" value={coverDescription} onChangeText={setCoverDescription} multilineRows={2} />
      <Input label="Cover-Bild-URL (optional)" value={coverImageUrl} onChangeText={setCoverImageUrl} autoCapitalize="none" />
      <Button label="Cover generieren" variant="secondary" disabled={!!busy || !coverDescription.trim()} onPress={() => void action('Cover', async () => {
        const response = await backend.doku.generateAudioCover({ title, coverDescription }); setCoverImageUrl(response.coverImageUrl);
      })} />
      <Button label="Audiodatei auswählen" disabled={!!busy} onPress={() => void action('Upload', async () => {
        const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
        if (result.canceled) return;
        const file = result.assets[0]; const contentType = file.mimeType ?? 'audio/mpeg';
        const upload = await backend.doku.createAudioUploadUrl({ filename: file.name, contentType });
        const response = await FileSystem.uploadAsync(upload.uploadUrl, file.uri, { httpMethod: 'PUT', uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, headers: { 'Content-Type': contentType } });
        if (response.status < 200 || response.status >= 300) throw new Error(`Upload: ${response.status}`);
        setAudio({ audioUrl: upload.audioUrl, filename: file.name }); setPreviewUri(file.uri); toast.success('Audio hochgeladen');
      })} />
      <Input label="Audio-URL (alternativ)" value={audio.audioUrl ?? ''} autoCapitalize="none" onChangeText={(audioUrl) => setAudio({ audioUrl })} />
      <Card><View style={{ gap: spacing.md }}>
        <Text variant="headingSm">Dialogstudio</Text>
        <Input label="Thema" value={topic} onChangeText={setTopic} />
        <Stepper label="Dauer" value={minutes} min={2} max={20} unit="Min" onChange={setMinutes} />
        <Input label="Sprecher (kommagetrennt)" value={speakerNames} onChangeText={setSpeakerNames} />
        <Button label="Skript erstellen" disabled={!!busy || !topic.trim()} onPress={() => void action('Skript', async () => {
          const [ageFrom, ageTo] = ageGroup.split('-').map(Number);
          const response = await backend.doku.generateAudioDokuScript({ topic, ageFrom: ageFrom || 6, ageTo: ageTo || ageFrom || 8, durationMinutes: minutes, speakerNames: speakerNames.split(',').map((name) => name.trim()).filter(Boolean) });
          setScript(response.script); setScreenplay(response.screenplay ?? []); setTitle(response.title); setDescription(response.description);
          setAgeGroup(response.ageGroup); setCategory(response.category); setCoverDescription(response.coverPrompt);
        })} />
        <Input label="Skript (SPRECHER: Text)" value={script} onChangeText={setScript} multilineRows={12} />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {(['elevenlabs', 'qwen'] as const).map((entry) => <Chip key={entry} label={entry === 'qwen' ? 'Qwen' : 'ElevenLabs'} selected={provider === entry} onPress={() => { setProvider(entry); setSpeakerVoiceMap({}); }} />)}
        </View>
        {voices.isError ? <Button label="Stimmen erneut laden" onPress={() => void voices.refetch()} /> : null}
        {speakers.map((speaker) => <View key={speaker} style={{ gap: spacing.sm }}>
          <Text variant="label">{speaker}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {voices.data?.map((voice) => <Chip key={voice.id} label={voice.name} selected={speakerVoiceMap[speaker] === voice.id} onPress={() => setSpeakerVoiceMap({ ...speakerVoiceMap, [speaker]: voice.id })} />)}
          </View>
        </View>)}
        {provider === 'elevenlabs' ? <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ flex: 1 }}>Musik und Sounddesign</Text><Switch value={soundDesign} onValueChange={setSoundDesign} accessibilityLabel="Musik und Sounddesign" /></View> : null}
        <Button label="Dialog vertonen" disabled={!!busy || !speakers.length || speakers.some((speaker) => !speakerVoiceMap[speaker])} onPress={() => void action('Vertonung', async () => {
          if (provider === 'elevenlabs') {
            const response = await backend.doku.renderAudioDokuMaster({ script, speakerVoiceMap, soundDesign, screenplay, title, includeBranding: true });
            await generatedAudio(response.audioData);
          } else {
            const response = await backend.tts.generateQwenDialogue({ script, speakerVoiceMap, outputFormat: 'mp3', languageId: 'de' });
            const variant = response.variants[0]; if (!variant?.audioData) throw new Error('Keine Hörfassung erhalten');
            await generatedAudio(variant.audioData);
          }
          toast.success('Hörfassung erstellt');
        })} />
      </View></Card>
      {previewUri || audio.audioUrl ? <Button label="Audio vorhören" variant="secondary" onPress={() => playTrack({ id: 'audio-doku-preview', title: title || 'Vorschau', audioUrl: previewUri ?? audio.audioUrl! })} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ flex: 1 }}>Öffentlich veröffentlichen</Text><Switch value={isPublic} onValueChange={setIsPublic} accessibilityLabel="Öffentlich veröffentlichen" /></View>
      <Button label={id ? 'Änderungen speichern' : 'Audio-Doku speichern'} loading={busy === 'Speichern'} disabled={!!busy || !description.trim() || (!audio.audioUrl && !audio.audioDataUrl) || (!id && !coverDescription.trim())}
        onPress={() => void action('Speichern', async () => {
          const payload = { title, description, ageGroup, category, coverDescription, coverImageUrl: coverImageUrl || undefined, isPublic, ...audio };
          if (id) await backend.doku.updateAudioDoku({ id, ...payload }); else await backend.doku.createAudioDoku(payload);
          await queryClient.invalidateQueries({ queryKey: ['audio-dokus'] }); toast.success('Audio-Doku gespeichert'); navigation.goBack();
        })} />
    </View>
  </Screen>;
}
