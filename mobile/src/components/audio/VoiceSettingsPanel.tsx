import React from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useBackend } from '@/api/backend';
import { useAudioPlayer } from '@/providers/AudioPlayerProvider';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import type { TTSProviderType } from '@/types/ttsVoice';

export function VoiceSettingsPanel() {
  const backend = useBackend();
  const { voiceSettings, setVoiceSettings } = useAudioPlayer();
  const provider = voiceSettings.provider ?? 'qwen';
  const providers = useQuery({ queryKey: ['tts-providers'], queryFn: () => backend.tts.getAvailableTtsProviders() });
  const voices = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['tts-voices', provider], queryFn: async () => {
      if (provider === 'thorsten' || provider === 'thorsten-cosyvoice') return [{ id: 'thorsten', name: 'Thorsten' }];
      if (provider === 'xai') return (await backend.tts.listXaiVoices()).voices;
      return (await backend.tts.listQwenVoices()).availableSpeakers.map((id: string) => ({ id, name: id }));
    },
  });
  return <Card><View style={{ gap: 12 }}>
    <Text variant="label">Stimmen für Hörfassungen</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {(providers.data?.providers ?? []).map((item: { id: TTSProviderType; name: string; configured: boolean }) => <Chip key={item.id} label={`${item.name}${item.configured ? '' : ' · nicht eingerichtet'}`} selected={provider === item.id} onPress={() => { if (item.configured) setVoiceSettings({ provider: item.id, mode: 'default' }); }} />)}
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {(['default', 'speaker', 'dialogue'] as const).map((mode) => <Chip key={mode} label={{ default: 'Standard', speaker: 'Eine Stimme', dialogue: 'Mehrere Stimmen' }[mode]} selected={voiceSettings.mode === mode} onPress={() => setVoiceSettings({ ...voiceSettings, mode })} />)}
    </View>
    {voiceSettings.mode !== 'default' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(voices.data ?? []).map((voice) => {
      const selected = voiceSettings.mode === 'dialogue' ? voiceSettings.dialogueSpeakerIds?.includes(voice.id) : voiceSettings.speakerId === voice.id;
      return <Chip key={voice.id} label={voice.name} selected={Boolean(selected)} onPress={() => setVoiceSettings(voiceSettings.mode === 'dialogue' ? { ...voiceSettings, dialogueSpeakerIds: selected ? (voiceSettings.dialogueSpeakerIds ?? []).filter((id) => id !== voice.id) : [...(voiceSettings.dialogueSpeakerIds ?? []), voice.id] } : { ...voiceSettings, speakerId: voice.id })} />;
    })}</View> : null}
    <Text variant="caption" tone="secondary">Gilt für neu hinzugefügte Hörfassungen. Vorhandene Aufnahmen behalten ihre Stimme.</Text>
    {providers.isError || voices.isError ? <Button label="Stimmen erneut laden" variant="secondary" onPress={() => { void providers.refetch(); void voices.refetch(); }} /> : null}
  </View></Card>;
}
