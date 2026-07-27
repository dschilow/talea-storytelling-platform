import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type BottomSheet from '@gorhom/bottom-sheet';
import { Check, Plus, Star, Trash2, Users } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useChildProfiles, type ProfileDetails } from '@/providers/ChildProfilesProvider';
import { useToast } from '@/providers/ToastProvider';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { Sheet } from '@/components/ui/Sheet';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Stepper } from '@/components/form/Stepper';

const PROFILE_COLORS = ['#7ba89c', '#dca5aa', '#a4bedf', '#e0af92', '#b5b8dc', '#d8bf8f'];

/**
 * Child-profile management.
 *
 * Profiles scope the entire content library, so this is also where the plan's
 * profile limit becomes visible: adding beyond it is blocked with an
 * explanation rather than a silent failure.
 */
export function ProfilesScreen() {
  const { colors, spacing } = useTheme();
  const toast = useToast();
  const {
    profiles,
    profileLimit,
    activeProfileId,
    setActiveProfileId,
    createProfile,
    updateProfile,
    deleteProfile,
    isMutating,
    reserve,
  } = useChildProfiles();

  const editorRef = useRef<BottomSheet>(null);
  const [editing, setEditing] = useState<ProfileDetails | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProfileDetails | null>(null);

  const [name, setName] = useState('');
  const [age, setAge] = useState(7);
  const [color, setColor] = useState(PROFILE_COLORS[0]);
  const [interests, setInterests] = useState('');
  const [noGoTopics, setNoGoTopics] = useState('');

  const openEditor = useCallback((profile: ProfileDetails | null) => {
    setEditing(profile);
    setName(profile?.name ?? '');
    setAge(profile?.age ?? 7);
    setColor(profile?.avatarColor ?? PROFILE_COLORS[0]);
    setInterests((profile?.interests ?? []).join(', '));
    setNoGoTopics((profile?.noGoTopics ?? []).join(', '));
    editorRef.current?.expand();
  }, []);

  const parseList = (value: string) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

  const handleSave = useCallback(async () => {
    if (name.trim().length < 2) {
      toast.warning('Name zu kurz');
      return;
    }

    try {
      if (editing) {
        await updateProfile({
          profileId: editing.id,
          name: name.trim(),
          age,
          avatarColor: color,
          interests: parseList(interests),
          noGoTopics: parseList(noGoTopics),
        });
        toast.success('Profil aktualisiert');
      } else {
        await createProfile({
          name: name.trim(),
          age,
          avatarColor: color,
          interests: parseList(interests),
          noGoTopics: parseList(noGoTopics),
        });
        toast.success('Profil angelegt');
      }
      editorRef.current?.close();
    } catch (error) {
      toast.error('Speichern fehlgeschlagen', error instanceof Error ? error.message : undefined);
    }
  }, [age, color, createProfile, editing, interests, name, noGoTopics, toast, updateProfile]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const profile = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteProfile(profile.id);
      toast.success('Profil gelöscht');
    } catch (error) {
      toast.error('Löschen fehlgeschlagen', error instanceof Error ? error.message : undefined);
    }
  }, [deleteProfile, pendingDelete, toast]);

  const canAddProfile = profiles.length < profileLimit;

  return (
    <Screen>
      <ScreenHeader title="Kinderprofile" subtitle={`${profiles.length} von ${profileLimit} Profilen`} />

      <View style={{ gap: spacing.base }}>
        {profiles.length === 0 ? (
          <EmptyState
            icon={<Users size={24} color={colors.accent.lavender} />}
            title="Noch kein Profil"
            description="Ein Profil pro Kind hält Geschichten, Avatare und Fortschritt getrennt."
            actionLabel="Profil anlegen"
            onAction={() => openEditor(null)}
          />
        ) : (
          profiles.map((profile) => (
            <Card key={profile.id} padded={false}>
              <Touchable
                onPress={() => openEditor(profile)}
                pressScale={0.99}
                style={{ padding: spacing.base, gap: spacing.md }}
              >
                <View style={[styles.row, { gap: spacing.md }]}>
                  <View style={[styles.avatar, { backgroundColor: profile.avatarColor ?? PROFILE_COLORS[0] }]}>
                    <Text variant="headingSm" style={{ color: '#fff' }}>
                      {profile.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={[styles.row, { gap: spacing.xs }]}>
                      <Text variant="title" numberOfLines={1} style={{ flex: 1 }}>
                        {profile.name}
                      </Text>
                      {profile.isDefault ? <Star size={14} color={colors.accent.gold} /> : null}
                    </View>
                    <Text variant="caption" tone="tertiary">
                      {profile.age ? `${profile.age} Jahre · ` : ''}
                      {profile.usage.storyCount} Geschichten · {profile.usage.dokuCount} Dokus
                    </Text>
                  </View>

                  {profile.id === activeProfileId ? (
                    <Chip label="Aktiv" size="sm" tone="accent" />
                  ) : (
                    <Touchable
                      onPress={() => setActiveProfileId(profile.id)}
                      style={{ paddingHorizontal: spacing.sm, paddingVertical: 4 }}
                      accessibilityLabel={`Zu ${profile.name} wechseln`}
                    >
                      <Text variant="labelSm" tone="accent">
                        Wechseln
                      </Text>
                    </Touchable>
                  )}
                </View>

                {(profile.interests.length > 0 || profile.noGoTopics.length > 0) && (
                  <View style={{ gap: spacing.xs }}>
                    {profile.interests.length > 0 ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                        {profile.interests.map((interest) => (
                          <Chip key={interest} label={interest} size="sm" />
                        ))}
                      </View>
                    ) : null}
                    {profile.noGoTopics.length > 0 ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                        {profile.noGoTopics.map((topic) => (
                          <Chip key={topic} label={`Kein: ${topic}`} size="sm" tone="danger" />
                        ))}
                      </View>
                    ) : null}
                  </View>
                )}
              </Touchable>

              {profiles.length > 1 ? (
                <Touchable
                  onPress={() => setPendingDelete(profile)}
                  style={[
                    styles.deleteRow,
                    { padding: spacing.md, gap: spacing.sm, borderTopColor: colors.border.light },
                  ]}
                  accessibilityLabel={`${profile.name} löschen`}
                >
                  <Trash2 size={15} color={colors.danger} />
                  <Text variant="labelSm" tone="danger">
                    Profil löschen
                  </Text>
                </Touchable>
              ) : null}
            </Card>
          ))
        )}

        <Button
          label={canAddProfile ? 'Profil hinzufügen' : `Limit erreicht (${profileLimit})`}
          onPress={() => (canAddProfile ? openEditor(null) : toast.info('Mehr Profile', 'Ein größerer Plan schaltet weitere Profile frei.'))}
          variant={canAddProfile ? 'primary' : 'secondary'}
          icon={<Plus size={16} color={canAddProfile ? colors.primaryForeground : colors.text.primary} />}
          fullWidth
        />

        {reserve && (reserve.story > 0 || reserve.doku > 0) ? (
          <Card variant="inset">
            <Text variant="overline" tone="tertiary" style={{ marginBottom: 4 }}>
              Familien-Reserve
            </Text>
            <Text variant="caption" tone="secondary">
              {reserve.storyUsed}/{reserve.story} Geschichten · {reserve.dokuUsed}/{reserve.doku} Dokus genutzt
            </Text>
          </Card>
        ) : null}
      </View>

      <Sheet
        ref={editorRef}
        snapPoints={['72%']}
        title={editing ? `${editing.name} bearbeiten` : 'Neues Profil'}
        subtitle="Alter und Interessen helfen Talea, passende Geschichten zu schreiben."
      >
        <View style={{ gap: spacing.base }}>
          <Input label="Name" value={name} onChangeText={setName} placeholder="z. B. Lina" autoCapitalize="words" maxLength={30} />

          <Stepper label="Alter" value={age} min={1} max={18} onChange={setAge} unit="Jahre" />

          <View style={{ gap: spacing.sm }}>
            <Text variant="labelSm" tone="secondary">
              Farbe
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {PROFILE_COLORS.map((entry) => (
                <Touchable
                  key={entry}
                  onPress={() => setColor(entry)}
                  style={[
                    styles.colorSwatch,
                    {
                      backgroundColor: entry,
                      borderColor: color === entry ? colors.text.primary : 'transparent',
                      borderWidth: color === entry ? 2.5 : 0,
                    },
                  ]}
                  accessibilityLabel={`Farbe ${entry}`}
                  accessibilityState={{ selected: color === entry }}
                >
                  {color === entry ? <Check size={15} color="#fff" /> : null}
                </Touchable>
              ))}
            </View>
          </View>

          <Input
            label="Interessen"
            value={interests}
            onChangeText={setInterests}
            placeholder="Dinosaurier, Weltraum, Pferde"
            hint="Kommagetrennt — Talea baut sie in Geschichten ein."
          />

          <Input
            label="Themen vermeiden"
            value={noGoTopics}
            onChangeText={setNoGoTopics}
            placeholder="Gewitter, Spinnen"
            hint="Kommagetrennt — diese Themen kommen nicht vor."
          />

          <Button label={editing ? 'Speichern' : 'Profil anlegen'} onPress={handleSave} loading={isMutating} fullWidth size="lg" />
        </View>
      </Sheet>

      <ConfirmSheet
        open={Boolean(pendingDelete)}
        title="Profil löschen?"
        message={`Alle Geschichten, Dokus und Avatare von „${pendingDelete?.name ?? ''}“ werden entfernt. Das lässt sich nicht rückgängig machen.`}
        confirmLabel="Löschen"
        destructive
        loading={isMutating}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  deleteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  colorSwatch: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
