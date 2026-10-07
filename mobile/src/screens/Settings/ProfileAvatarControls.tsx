import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useBackend } from '@/api/backend';
import { useChildProfiles, type ProfileDetails } from '@/providers/ChildProfilesProvider';
import { useToast } from '@/providers/ToastProvider';
import { Text } from '@/components/ui/Text';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';

export function ProfileAvatarControls({ profile }: { profile: ProfileDetails }) {
  const backend = useBackend(); const { updateProfile } = useChildProfiles(); const toast = useToast();
  const query = useQuery({ queryKey: ['profile-avatars', profile.id], queryFn: () => backend.avatar.list({ profileId: profile.id }) });
  const [child, setChild] = useState<string | null>(profile.childAvatarId ?? null);
  const [preferred, setPreferred] = useState(profile.preferredAvatarIds);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setChild(profile.childAvatarId ?? null); setPreferred(profile.preferredAvatarIds); }, [profile.id]);
  return <View style={{ gap: 12 }}><Text variant="label">Avatare für dieses Kind</Text>
    <Text variant="caption">Kinder-Avatar</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Chip label="Keiner" selected={!child} onPress={() => setChild(null)} />
      {(query.data?.avatars ?? []).filter((avatar: any) => avatar.avatarRole === 'child').map((avatar: any) => <Chip key={avatar.id} label={avatar.name} selected={child === avatar.id} onPress={() => setChild(avatar.id)} />)}
    </View><Text variant="caption">Bevorzugte Begleiter für Geschichten</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(query.data?.avatars ?? []).filter((avatar: any) => avatar.avatarRole !== 'child').map((avatar: any) => <Chip key={avatar.id} label={avatar.name} selected={preferred.includes(avatar.id)} onPress={() => setPreferred(preferred.includes(avatar.id) ? preferred.filter((id) => id !== avatar.id) : [...preferred, avatar.id])} />)}</View>
    {query.isError ? <Button label="Avatare erneut laden" variant="secondary" onPress={() => void query.refetch()} /> : null}
    <Button label="Avatar-Auswahl speichern" variant="secondary" loading={busy} disabled={query.isLoading || query.isError} onPress={async () => { if (busy) return; setBusy(true); try { await updateProfile({ profileId: profile.id, childAvatarId: child, preferredAvatarIds: preferred }); toast.success('Avatar-Auswahl gespeichert'); } catch (error) { toast.error('Speichern fehlgeschlagen', error instanceof Error ? error.message : undefined); } finally { setBusy(false); } }} />
  </View>;
}
