import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useBackend } from '@/api/backend';
import { useChildProfiles } from '@/providers/ChildProfilesProvider';
import { useToast } from '@/providers/ToastProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';

/** Profile-specific favorites and family assignment use the same APIs as the web. */
export function ContentManagement({ kind, content, editable = true, refresh }: {
  kind: 'story' | 'doku'; content: { id: string; title: string; isPublic?: boolean; profileState?: { isFavorite?: boolean } };
  editable?: boolean; refresh: () => Promise<unknown>;
}) {
  const backend = useBackend();
  const { profiles, activeProfileId } = useChildProfiles();
  const { spacing } = useTheme();
  const toast = useToast();
  const [title, setTitle] = useState(content.title);
  const [busy, setBusy] = useState(false);
  useEffect(() => setTitle(content.title), [content.id, content.title]);
  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try { await action(); await refresh(); toast.success('Gespeichert'); }
    catch (error) { toast.error('Speichern fehlgeschlagen', error instanceof Error ? error.message : undefined); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: spacing.sm, paddingVertical: spacing.md }}>
    {editable ? <>
      <Button label={content.profileState?.isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'} variant="secondary" disabled={busy} onPress={() => void run(() => kind === 'story' ? backend.story.updateStoryProfileState({ id: content.id, isFavorite: !content.profileState?.isFavorite }) : backend.doku.updateDokuProfileState({ id: content.id, isFavorite: !content.profileState?.isFavorite }))} />
      <Input label="Titel" value={title} onChangeText={setTitle} maxLength={200} />
      <Button label="Titel speichern" disabled={busy || !title.trim() || title.trim() === content.title} variant="secondary" onPress={() => void run(() => kind === 'story' ? backend.story.update({ id: content.id, title: title.trim() }) : backend.doku.updateDoku({ id: content.id, title: title.trim() }))} />
      <Button label={content.isPublic ? 'Veröffentlichung zurücknehmen' : 'Öffentlich teilen'} variant="secondary" disabled={busy} onPress={() => void run(() => kind === 'story' ? backend.story.update({ id: content.id, isPublic: !content.isPublic }) : backend.doku.updateDoku({ id: content.id, isPublic: !content.isPublic }))} />
    </> : null}
    {profiles.some((p) => p.id !== activeProfileId) ? <>
      <Text variant="labelSm">Zu einem Kinderprofil hinzufügen</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{profiles.filter((p) => p.id !== activeProfileId).map((profile) => <Chip key={profile.id} label={profile.name} onPress={() => { if (!busy) void run(() => kind === 'story' ? backend.story.addStoryToProfile({ id: content.id, targetProfileId: profile.id }) : backend.doku.addDokuToProfile({ id: content.id, targetProfileId: profile.id })); }} />)}</View>
    </> : null}
  </View>;
}
