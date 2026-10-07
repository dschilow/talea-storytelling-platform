import React, { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { useChildProfiles, type ProfileDetails } from '@/providers/ChildProfilesProvider';
import { useToast } from '@/providers/ToastProvider';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';

export function ProfileBudgetControls({ profile }: { profile: ProfileDetails }) {
  const { saveProfileBudget, isMutating } = useChildProfiles();
  const toast = useToast();
  const [caps, setCaps] = useState<Record<string, string>>({});
  const [allowReserve, setAllowReserve] = useState(false);
  useEffect(() => { setCaps(Object.fromEntries(['storySoftCap', 'storyHardCap', 'dokuSoftCap', 'dokuHardCap'].map((field) => [field, String((profile.budget as any)?.[field] ?? '')]))); setAllowReserve(profile.budget?.allowFamilyReserve ?? true); }, [profile.id, profile.budget]);
  return <View style={{ gap: 12 }}><Text variant="headingSm">Monatliches Profilbudget</Text><Text variant="bodySm">Leer bedeutet unbegrenzt. Die Warnschwelle zeigt einen Hinweis; das feste Limit stoppt weitere Erstellungen.</Text>
    {Object.entries({ storySoftCap: 'Geschichten: Warnschwelle', storyHardCap: 'Geschichten: festes Limit', dokuSoftCap: 'Dokus: Warnschwelle', dokuHardCap: 'Dokus: festes Limit' }).map(([field, label]) => <Input key={field} label={label} value={caps[field] ?? ''} keyboardType="number-pad" onChangeText={(value) => setCaps((prev) => ({ ...prev, [field]: value }))} />)}
    <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ flex: 1 }}>Familienreserve nutzen</Text><Switch value={allowReserve} onValueChange={setAllowReserve} accessibilityLabel="Familienreserve nutzen" /></View>
    <Button label="Profilbudget speichern" loading={isMutating} variant="secondary" onPress={async () => {
      try {
        const parsed = Object.fromEntries(Object.entries(caps).map(([key, value]) => { if (value.trim() && !/^\d+$/.test(value.trim())) throw new Error('Bitte ganze Zahlen ab null eingeben.'); return [key, value.trim() ? Number(value) : null]; }));
        for (const prefix of ['story', 'doku']) { const soft = parsed[`${prefix}SoftCap`]; const hard = parsed[`${prefix}HardCap`]; if (soft != null && hard != null && soft > hard) throw new Error('Die Warnschwelle darf nicht über dem festen Limit liegen.'); }
        await saveProfileBudget({ profileId: profile.id, ...parsed, allowFamilyReserve: allowReserve }); toast.success('Profilbudget gespeichert');
      } catch (error) { toast.error('Budget nicht gespeichert', error instanceof Error ? error.message : undefined); }
    }} />
  </View>;
}

export function FamilyReserveControls() {
  const { reserve, saveFamilyReserve, isMutating } = useChildProfiles();
  const toast = useToast();
  const [story, setStory] = useState('0'); const [doku, setDoku] = useState('0');
  useEffect(() => { setStory(String(reserve?.story ?? 0)); setDoku(String(reserve?.doku ?? 0)); }, [reserve?.story, reserve?.doku]);
  return <View style={{ gap: 12 }}><Text variant="headingSm">Familienreserve</Text><Text variant="bodySm">Bisher genutzt: {reserve?.storyUsed ?? 0} Geschichten · {reserve?.dokuUsed ?? 0} Dokus</Text><Input label="Geschichten in Reserve" value={story} onChangeText={setStory} keyboardType="number-pad" /><Input label="Dokus in Reserve" value={doku} onChangeText={setDoku} keyboardType="number-pad" /><Button label="Reserve speichern" variant="secondary" loading={isMutating} onPress={async () => {
    try { if (!/^\d+$/.test(story) || !/^\d+$/.test(doku)) throw new Error('Bitte ganze Zahlen ab null eingeben.'); await saveFamilyReserve({ story: Number(story), doku: Number(doku) }); toast.success('Familienreserve gespeichert'); }
    catch (error) { toast.error('Reserve nicht gespeichert', error instanceof Error ? error.message : undefined); }
  }} /></View>;
}
