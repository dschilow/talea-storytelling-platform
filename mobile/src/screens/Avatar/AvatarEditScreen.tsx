import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Save } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useBackend } from '@/api/backend';
import { queryKeys, useAvatar } from '@/hooks/queries';
import { useOptionalChildProfiles } from '@/providers/ChildProfilesProvider';
import { useToast } from '@/providers/ToastProvider';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { CoverImage } from '@/components/ui/CoverImage';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { NARRATIVE_TRAIT_OPTIONS } from '@/types/avatarForm';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type EditRoute = RouteProp<RootStackParamList, 'AvatarEdit'>;

const MAX_TRAITS = 4;

/**
 * Avatar editing.
 *
 * Scoped deliberately to name, description and narrative profile. Visual
 * attributes are intentionally not editable here: changing them after images
 * exist would break the cross-story visual consistency the `visualProfile`
 * guarantees. Regenerating the portrait is offered instead.
 */
export function AvatarEditScreen() {
  const { colors, spacing, radius } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<EditRoute>();
  const backend = useBackend();
  const toast = useToast();
  const queryClient = useQueryClient();
  const profileId = useOptionalChildProfiles()?.activeProfileId ?? null;

  const { avatarId } = route.params;
  const avatarQuery = useAvatar(avatarId);
  const avatar = avatarQuery.data;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dominantPersonality, setDominantPersonality] = useState('');
  const [quirk, setQuirk] = useState('');
  const [catchphrase, setCatchphrase] = useState('');
  const [backstory, setBackstory] = useState('');
  const [traits, setTraits] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!avatar) return;
    setName(avatar.name ?? '');
    setDescription(avatar.description ?? '');
    setDominantPersonality(avatar.narrativeProfile?.dominantPersonality ?? '');
    setQuirk(avatar.narrativeProfile?.quirk ?? '');
    setCatchphrase(avatar.narrativeProfile?.catchphrase ?? '');
    setBackstory(avatar.narrativeProfile?.backstory ?? '');
    setTraits(avatar.narrativeProfile?.traits ?? []);
  }, [avatar]);

  const toggleTrait = (traitId: string) => {
    setTraits((current) => {
      if (current.includes(traitId)) return current.filter((entry) => entry !== traitId);
      if (current.length >= MAX_TRAITS) return current;
      return [...current, traitId];
    });
  };

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.avatar(avatarId, profileId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.avatars(profileId) });
  }, [avatarId, profileId, queryClient]);

  const handleSave = useCallback(async () => {
    if (name.trim().length < 2) {
      toast.warning('Name zu kurz', 'Der Name braucht mindestens zwei Zeichen.');
      return;
    }

    setSaving(true);
    try {
      await (backend.avatar as any).update({
        id: avatarId,
        name: name.trim(),
        description: description.trim() || undefined,
        narrativeProfile: {
          dominantPersonality: dominantPersonality.trim() || undefined,
          traits,
          quirk: quirk.trim() || undefined,
          catchphrase: catchphrase.trim() || undefined,
          backstory: backstory.trim() || undefined,
        },
      });
      invalidate();
      toast.success('Gespeichert');
      navigation.goBack();
    } catch (error) {
      toast.error('Speichern fehlgeschlagen', error instanceof Error ? error.message : undefined);
    } finally {
      setSaving(false);
    }
  }, [avatarId, backend.avatar, backstory, catchphrase, description, dominantPersonality, invalidate, name, navigation, quirk, toast, traits]);

  const handleRegenerateImage = useCallback(async () => {
    if (!avatar) return;
    setRegenerating(true);
    try {
      // `visualProfile` is present on the API payload but not on the shared
      // Avatar type (it is an opaque record the image pipeline owns).
      await (backend.ai as any).generateAvatarImage({
        avatarId,
        visualProfile: (avatar as { visualProfile?: Record<string, unknown> }).visualProfile,
      });
      invalidate();
      toast.success('Neues Bild wird gemalt', 'Es erscheint in Kürze im Profil.');
    } catch (error) {
      toast.error('Bild konnte nicht erstellt werden', error instanceof Error ? error.message : undefined);
    } finally {
      setRegenerating(false);
    }
  }, [avatar, avatarId, backend.ai, invalidate, toast]);

  if (avatarQuery.isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Avatar bearbeiten" />
        <SkeletonCard height={180} />
      </Screen>
    );
  }

  if (!avatar) {
    return (
      <Screen>
        <ScreenHeader title="Avatar bearbeiten" />
        <EmptyState title="Avatar nicht gefunden" actionLabel="Zurück" onAction={() => navigation.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Avatar bearbeiten" subtitle={avatar.name} />

      <View style={{ gap: spacing.base }}>
        <Card padded={false}>
          <View style={{ flexDirection: 'row', padding: spacing.base, gap: spacing.base, alignItems: 'center' }}>
            <CoverImage uri={avatar.imageUrl} style={{ width: 84, height: 84 }} radius={radius.md} fallbackGradient="lavender" />
            <View style={{ flex: 1, gap: spacing.sm }}>
              <Text variant="caption" tone="secondary">
                Aussehen bleibt über alle Geschichten hinweg gleich. Du kannst das Bild neu malen lassen.
              </Text>
              <Button
                label="Bild neu malen"
                onPress={handleRegenerateImage}
                variant="secondary"
                size="sm"
                loading={regenerating}
                icon={<RefreshCw size={14} color={colors.text.primary} />}
              />
            </View>
          </View>
        </Card>

        <Input label="Name" value={name} onChangeText={setName} maxLength={40} autoCapitalize="words" />

        <Input
          label="Beschreibung"
          value={description}
          onChangeText={setDescription}
          placeholder="Kurze Beschreibung für Bilder und Geschichten"
          multilineRows={3}
          maxLength={400}
        />

        <View style={{ gap: spacing.sm }}>
          <Text variant="labelSm" tone="secondary">
            Charakterzüge (max. {MAX_TRAITS})
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {NARRATIVE_TRAIT_OPTIONS.map((option) => (
              <Chip
                key={option.id}
                label={option.label}
                selected={traits.includes(option.id)}
                onPress={() => toggleTrait(option.id)}
              />
            ))}
          </View>
        </View>

        <Input
          label="Dominante Persönlichkeit"
          value={dominantPersonality}
          onChangeText={setDominantPersonality}
          maxLength={80}
        />
        <Input label="Eigenheit" value={quirk} onChangeText={setQuirk} maxLength={120} />
        <Input label="Lieblingsspruch" value={catchphrase} onChangeText={setCatchphrase} maxLength={120} />
        <Input
          label="Hintergrund"
          value={backstory}
          onChangeText={setBackstory}
          multilineRows={4}
          maxLength={600}
          showCounter
        />

        <Button
          label="Speichern"
          onPress={handleSave}
          loading={saving}
          icon={<Save size={16} color={colors.primaryForeground} />}
          size="lg"
          fullWidth
        />
      </View>
    </Screen>
  );
}
