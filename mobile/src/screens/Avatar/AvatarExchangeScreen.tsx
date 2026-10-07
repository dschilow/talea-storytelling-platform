import React, { useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useBackend } from '@/api/backend';
import { useChildProfiles } from '@/providers/ChildProfilesProvider';
import { useToast } from '@/providers/ToastProvider';
import { useInvalidateContent } from '@/hooks/queries';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { CoverImage } from '@/components/ui/CoverImage';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import type { RootStackParamList } from '@/navigation/types';

type Contact = { id: string; email: string; label: string; trusted: boolean };
export function AvatarExchangeScreen() {
  const backend = useBackend();
  const { profiles, activeProfileId } = useChildProfiles();
  const { params } = useRoute<RouteProp<RootStackParamList, 'AvatarExchange'>>();
  const avatarId = params?.avatarId;
  const navigation = useNavigation();
  const toast = useToast();
  const invalidate = useInvalidateContent();
  const [target, setTarget] = useState(activeProfileId);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ action: 'share' | 'unshare' | 'delete'; contact: Contact } | null>(null);
  const contacts = useQuery<{ contacts: Contact[] }>({ queryKey: ['share-contacts'], queryFn: () => backend.avatar.listShareContacts(), enabled: Boolean(avatarId) });
  const shares = useQuery<{ shares: Array<{ contactId: string }> }>({ queryKey: ['avatar-shares', avatarId], queryFn: () => backend.avatar.listAvatarShares({ id: avatarId! }), enabled: Boolean(avatarId) });
  const templates = useQuery<{ templates: Array<{ id: string; name: string; description?: string; imageUrl?: string }> }>({ queryKey: ['avatar-templates'], queryFn: () => backend.avatar.listPoolTemplates(), enabled: !avatarId });
  async function run(action: () => Promise<unknown>, message = 'Gespeichert') {
    if (busy) return; setBusy(true);
    try { await action(); invalidate(); if (avatarId) await Promise.all([contacts.refetch(), shares.refetch()]); toast.success(message); }
    catch (error) { toast.error('Aktion fehlgeschlagen', error instanceof Error ? error.message : undefined); }
    finally { setBusy(false); }
  }
  return <Screen><ScreenHeader title={avatarId ? 'Avatar kopieren und teilen' : 'Avatar-Vorlagen'} /><View style={{ gap: 16 }}>
    <Text variant="label">Zielprofil</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{profiles.map((profile) => <Chip key={profile.id} label={profile.name} selected={target === profile.id} onPress={() => setTarget(profile.id)} />)}</View>
    <Input label="Neuer Name (optional)" value={name} onChangeText={setName} />
    <Text variant="bodySm">Die Kopie beginnt mit eigenen Erinnerungen und Persönlichkeitswerten bei null.</Text>
    {avatarId ? <>
      <Button label="In das ausgewählte Profil kopieren" disabled={!target || busy} onPress={() => void run(() => backend.avatar.cloneToProfile({ id: avatarId, targetProfileId: target!, name: name.trim() || undefined }), 'Avatar kopiert')} />
      <Text variant="headingSm">Kontakte</Text><Input label="E-Mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" /><Input label="Name" value={label} onChangeText={setLabel} />
      <Button label="Kontakt speichern" disabled={busy || !email.includes('@')} variant="secondary" onPress={() => void run(async () => { await backend.avatar.upsertShareContact({ email: email.trim(), label: label.trim() || undefined, trusted: true }); setEmail(''); setLabel(''); })} />
      {contacts.isError || shares.isError ? <EmptyState title="Kontakte konnten nicht geladen werden" actionLabel="Erneut versuchen" onAction={() => { void contacts.refetch(); void shares.refetch(); }} /> : null}
      {contacts.data?.contacts.map((contact) => { const shared = shares.data?.shares.some((share) => share.contactId === contact.id); return <Card key={contact.id}><View style={{ gap: 8 }}><Text variant="label">{contact.label}</Text><Text>{contact.email}</Text><Button label={shared ? 'Freigabe aufheben' : 'Avatar an diesen Kontakt teilen'} disabled={busy} onPress={() => setPending({ action: shared ? 'unshare' : 'share', contact })} /><Button label="Kontakt entfernen" variant="secondary" disabled={busy} onPress={() => setPending({ action: 'delete', contact })} /></View></Card>; })}
    </> : templates.isError ? <EmptyState title="Vorlagen konnten nicht geladen werden" actionLabel="Erneut versuchen" onAction={() => void templates.refetch()} /> : templates.data?.templates.map((template) => <Card key={template.id}><View style={{ gap: 8 }}><CoverImage uri={template.imageUrl} style={{ height: 180 }} /><Text variant="headingSm">{template.name}</Text><Text>{template.description}</Text><Button label="Als eigenen Avatar übernehmen" disabled={busy || !target} onPress={() => void run(async () => { await backend.avatar.adoptPoolTemplate({ templateId: template.id, targetProfileId: target!, name: name.trim() || undefined }); navigation.goBack(); }, 'Avatar übernommen')} /></View></Card>)}
  </View><ConfirmSheet open={Boolean(pending)} title={pending?.action === 'share' ? 'Avatar teilen?' : pending?.action === 'unshare' ? 'Freigabe aufheben?' : 'Kontakt entfernen?'} message={pending?.action === 'share' ? `${pending.contact.email} erhält eine eigene Kopie dieses Avatars.` : 'Bereits erstellte Kopien bleiben beim Empfänger erhalten.'} confirmLabel="Bestätigen" loading={busy} onCancel={() => setPending(null)} onConfirm={async () => { if (!pending || !avatarId) return; const action = pending; setPending(null); await run(() => action.action === 'share' ? backend.avatar.shareAvatarWithContact({ id: avatarId, contactId: action.contact.id }) : action.action === 'unshare' ? backend.avatar.unshareAvatarFromContact({ id: avatarId, contactId: action.contact.id }) : backend.avatar.deleteShareContact({ contactId: action.contact.id })); }} /></Screen>;
}
