import React, { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useBackend } from '@/api/backend';
import { useAvatar, useInvalidateContent } from '@/hooks/queries';
import { useToast } from '@/providers/ToastProvider';
import { avatarToFormData, toCompleteFormData, getDirtyFormFields, formDataToBackendFormat, mergeAnalyzedVisualProfile } from '@/lib/avatarEditorModel';
import { formDataToDescription, formDataToNarrativeProfile, AVATAR_NARRATIVE_FORM_FIELDS, AVATAR_VISUAL_FORM_FIELDS, type AvatarFormData } from '@/types/avatarForm';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { CoverImage } from '@/components/ui/CoverImage';
import { EmptyState } from '@/components/ui/EmptyState';
import { StepIdentity } from './wizard/StepIdentity';
import { StepBody } from './wizard/StepBody';
import { StepAppearance } from './wizard/StepAppearance';
import { StepCharacter } from './wizard/StepCharacter';
import type { RootStackParamList } from '@/navigation/types';

export function AvatarEditScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'AvatarEdit'>>();
  const backend = useBackend(); const toast = useToast(); const navigation = useNavigation();
  const query = useAvatar(params.avatarId); const invalidate = useInvalidateContent(); const queryClient = useQueryClient();
  const [form, setForm] = useState<AvatarFormData | null>(null); const [initial, setInitial] = useState<AvatarFormData | null>(null);
  const [visualProfile, setVisualProfile] = useState<any>(); const [preview, setPreview] = useState<string>();
  const [isPublic, setIsPublic] = useState(false); const [tab, setTab] = useState(0); const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!query.data) return;
    const loaded = toCompleteFormData(avatarToFormData(query.data)); setForm(loaded); setInitial(loaded);
    setVisualProfile((query.data as any).visualProfile); setPreview(query.data.imageUrl); setIsPublic(Boolean((query.data as any).isPublic));
  }, [query.data?.id]);
  if (query.isLoading) return <Screen><ScreenHeader title="Avatar bearbeiten" /><Text>Avatar wird geladen …</Text></Screen>;
  if (!form || !query.data || !initial) return <Screen><ScreenHeader title="Avatar bearbeiten" /><EmptyState title="Avatar konnte nicht geladen werden" actionLabel="Erneut versuchen" onAction={() => void query.refetch()} /></Screen>;
  const avatar = query.data; const isChild = avatar.avatarRole === 'child';
  const update = (patch: Partial<AvatarFormData>) => setForm((current) => current && ({ ...current, ...patch }));
  async function regenerate() {
    if (busy || !form) return; setBusy(true);
    try { const image = await backend.ai.generateAvatarImage({ characterType: form.characterType === 'other' ? form.customCharacterType : form.characterType, appearance: formDataToDescription(form), personalityTraits: {}, style: 'disney', referenceImageUrl: avatar.imageUrl }); setPreview(image.imageUrl); toast.info('Vorschau erstellt', 'Speichere den Avatar, um das neue Bild zu übernehmen.'); }
    catch (error) { toast.error('Bildgenerierung fehlgeschlagen', error instanceof Error ? error.message : undefined); } finally { setBusy(false); }
  }
  async function save() {
    if (busy || !form || !initial || form.name.trim().length < 2) return;
    setBusy(true);
    try {
      const dirty = getDirtyFormFields(initial, form);
      const fields = formDataToBackendFormat(form, isChild, visualProfile, dirty);
      const visualChanged = AVATAR_VISUAL_FORM_FIELDS.some((field) => dirty.has(field)) || visualProfile !== (avatar as any).visualProfile;
      await backend.avatar.update({ id: avatar.id, name: fields.name.trim(), description: fields.description, narrativeProfile: formDataToNarrativeProfile(form), isPublic: isChild ? false : isPublic,
        ...(visualChanged ? { physicalTraits: fields.physicalTraits, visualProfile: fields.visualProfile } : {}), ...(preview !== avatar.imageUrl ? { imageUrl: preview } : {}) });
      invalidate(); await queryClient.invalidateQueries({ queryKey: ['avatar', avatar.id] }); toast.success('Avatar gespeichert'); navigation.goBack();
    } catch (error) { toast.error('Speichern fehlgeschlagen', error instanceof Error ? error.message : undefined); } finally { setBusy(false); }
  }
  return <Screen><ScreenHeader title="Avatar bearbeiten" /><View style={{ gap: 16 }}><CoverImage uri={preview} style={{ height: 210 }} />
    <Button label="Bild neu malen" variant="secondary" disabled={busy} onPress={() => void regenerate()} />
    <Button label="Aussehen aus vorhandenem Bild erkennen" variant="secondary" disabled={busy || !avatar.imageUrl} onPress={async () => { if (busy) return; setBusy(true); try { const analyzed = await backend.ai.analyzeAvatarImage({ imageUrl: avatar.imageUrl!, hints: { name: form.name } }); if (!analyzed.success) throw new Error('Das Bild konnte nicht analysiert werden.'); const merged = mergeAnalyzedVisualProfile(visualProfile, analyzed.visualProfile); setVisualProfile(merged); setForm((current) => { const analyzedForm = toCompleteFormData(avatarToFormData({ ...avatar, visualProfile: merged })); if (current) { analyzedForm.name = current.name; for (const field of AVATAR_NARRATIVE_FORM_FIELDS) (analyzedForm as any)[field] = current[field]; } return analyzedForm; }); } catch (error) { toast.error('Analyse fehlgeschlagen', error instanceof Error ? error.message : undefined); } finally { setBusy(false); } }} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{['Name & Typ', 'Alter & Statur', 'Aussehen', 'Charakter'].map((label, index) => <Chip key={label} label={label} selected={tab === index} onPress={() => setTab(index)} />)}</View>
    {tab === 0 ? <StepIdentity form={form} onChange={update} isChildMode={isChild} /> : tab === 1 ? <StepBody form={form} onChange={update} /> : tab === 2 ? <StepAppearance form={form} onChange={update} /> : <StepCharacter form={form} onChange={update} />}
    {!isChild ? <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ flex: 1 }}>Avatar öffentlich sichtbar</Text><Switch value={isPublic} onValueChange={setIsPublic} accessibilityLabel="Avatar öffentlich sichtbar" /></View> : null}
    <Button label="Speichern" loading={busy} disabled={form.name.trim().length < 2} onPress={() => void save()} />
  </View></Screen>;
}

