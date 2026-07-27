import React, { useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type BottomSheet from '@gorhom/bottom-sheet';
import { Check, Plus, Users } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useChildProfiles } from '@/providers/ChildProfilesProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { Sheet } from '@/components/ui/Sheet';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Deterministic per-profile colour when the profile has no explicit one. */
const FALLBACK_COLORS = ['#7ba89c', '#dca5aa', '#a4bedf', '#e0af92', '#b5b8dc', '#d8bf8f'];

function colorFor(profileId: string, explicit?: string): string {
  if (explicit) return explicit;
  let hash = 0;
  for (let i = 0; i < profileId.length; i += 1) hash = (hash * 31 + profileId.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

/**
 * Horizontal child-profile rail.
 *
 * Switching profile changes what the whole app shows (avatars, stories, dokus
 * are all profile-scoped), so it deserves persistent presence on Home rather
 * than being buried in Settings. Tapping the row opens the management sheet.
 */
export function ProfileSwitcher() {
  const { colors, spacing, radius } = useTheme();
  const { profiles, activeProfileId, setActiveProfileId, profileLimit } = useChildProfiles();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const sheetRef = useRef<BottomSheet>(null);

  if (profiles.length === 0) return null;

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.base, gap: spacing.sm }}
      >
        {profiles.map((profile) => {
          const isActive = profile.id === activeProfileId;
          const tint = colorFor(profile.id, profile.avatarColor);

          return (
            <Touchable
              key={profile.id}
              onPress={() => {
                if (isActive) {
                  sheetRef.current?.expand();
                  return;
                }
                setActiveProfileId(profile.id);
                toast.info(`Profil gewechselt`, `Du siehst jetzt die Inhalte von ${profile.name}.`);
              }}
              onLongPress={() => sheetRef.current?.expand()}
              style={[
                styles.chip,
                {
                  borderRadius: radius.pill,
                  paddingLeft: 5,
                  paddingRight: spacing.md,
                  paddingVertical: 5,
                  gap: spacing.sm,
                  backgroundColor: isActive ? colors.surface.item : colors.surface.secondary,
                  borderColor: isActive ? colors.border.accent : colors.border.light,
                  borderWidth: isActive ? 1.4 : StyleSheet.hairlineWidth,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Profil ${profile.name}${isActive ? ' (aktiv)' : ''}`}
            >
              <View style={[styles.dot, { backgroundColor: tint }]}>
                <Text variant="caption" style={{ color: '#fff', fontSize: 11 }}>
                  {profile.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text variant="labelSm" tone={isActive ? 'primary' : 'secondary'} numberOfLines={1}>
                {profile.name}
              </Text>
              {isActive ? <Check size={13} color={colors.primary} /> : null}
            </Touchable>
          );
        })}

        {profiles.length < profileLimit ? (
          <Touchable
            onPress={() => navigation.navigate('Profiles')}
            style={[
              styles.chip,
              {
                borderRadius: radius.pill,
                paddingHorizontal: spacing.md,
                paddingVertical: 9,
                gap: 6,
                borderColor: colors.border.soft,
                borderWidth: StyleSheet.hairlineWidth,
                borderStyle: 'dashed',
              },
            ]}
            accessibilityLabel="Profil hinzufügen"
          >
            <Plus size={14} color={colors.text.tertiary} />
            <Text variant="labelSm" tone="tertiary">
              Profil
            </Text>
          </Touchable>
        ) : null}
      </ScrollView>

      <Sheet ref={sheetRef} snapPoints={['40%']} title="Profile" subtitle={`${profiles.length} von ${profileLimit} Profilen`}>
        <View style={{ gap: spacing.sm }}>
          {profiles.map((profile) => (
            <Touchable
              key={profile.id}
              onPress={() => {
                setActiveProfileId(profile.id);
                sheetRef.current?.close();
              }}
              style={[
                styles.sheetRow,
                {
                  borderRadius: radius.md,
                  padding: spacing.md,
                  gap: spacing.md,
                  backgroundColor: profile.id === activeProfileId ? colors.surface.item : 'transparent',
                },
              ]}
            >
              <View style={[styles.dotLarge, { backgroundColor: colorFor(profile.id, profile.avatarColor) }]}>
                <Text variant="label" style={{ color: '#fff' }}>
                  {profile.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="label">{profile.name}</Text>
                <Text variant="caption" tone="tertiary">
                  {profile.age ? `${profile.age} Jahre · ` : ''}
                  {profile.usage.storyCount} Geschichten
                </Text>
              </View>
              {profile.id === activeProfileId ? <Check size={17} color={colors.primary} /> : null}
            </Touchable>
          ))}

          <Touchable
            onPress={() => {
              sheetRef.current?.close();
              navigation.navigate('Profiles');
            }}
            style={[styles.sheetRow, { borderRadius: radius.md, padding: spacing.md, gap: spacing.md }]}
          >
            <View style={[styles.dotLarge, { backgroundColor: colors.surface.inset }]}>
              <Users size={17} color={colors.text.secondary} />
            </View>
            <Text variant="label" tone="accent" style={{ flex: 1 }}>
              Profile verwalten
            </Text>
          </Touchable>
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  dotLarge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sheetRow: { flexDirection: 'row', alignItems: 'center' },
});
