import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import * as Application from 'expo-application';
import { ChevronRight, Coins, Database, Download, Globe, LogOut, Moon, ShieldCheck, Sparkles, Sun, SunMoon, Users, Vibrate } from 'lucide-react-native';

import { useTheme, type ThemePreference } from '@/theme/ThemeProvider';
import { useBackend } from '@/api/backend';
import { useOptionalUserAccess } from '@/providers/UserAccessProvider';
import { useOptionalChildProfiles } from '@/providers/ChildProfilesProvider';
import { useOffline } from '@/providers/OfflineProvider';
import { useToast } from '@/providers/ToastProvider';
import { areHapticsEnabled, setHapticsEnabled } from '@/lib/haptics';
import { clearAudioCache, getAudioCacheSize } from '@/lib/audioCache';
import { formatBytes } from '@/lib/content';
import { persistLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Settings.
 *
 * Groups by who the setting is for: the child (appearance, language), the parent
 * (profiles, parental controls, plan) and the device (offline data, haptics).
 * Theme and language changes are written back to the account so the web app
 * picks them up, matching the web's behaviour.
 */
export function SettingsScreen() {
  const { colors, spacing, radius, preference, setPreference } = useTheme();
  const navigation = useNavigation<Nav>();
  const backend = useBackend();
  const toast = useToast();
  const { t, i18n } = useTranslation();
  const { user } = useUser();
  const { signOut } = useAuth();

  const { billing, subscription, isAdmin, hasParentalPin } = useOptionalUserAccess();
  const childProfiles = useOptionalChildProfiles();
  const offline = useOffline();

  const [haptics, setHaptics] = useState(areHapticsEnabled());
  const [audioCache, setAudioCache] = useState<{ entries: number; bytes: number }>({ entries: 0, bytes: 0 });
  const [offlineUsage, setOfflineUsage] = useState<{ items: number; bytes: number }>({ items: 0, bytes: 0 });
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmClearCache, setConfirmClearCache] = useState(false);

  const refreshStorage = useCallback(async () => {
    setAudioCache(await getAudioCacheSize());
    setOfflineUsage(await offline.storageUsage());
  }, [offline]);

  useEffect(() => {
    void refreshStorage();
  }, [refreshStorage]);

  const handleThemeChange = useCallback(
    async (next: ThemePreference) => {
      setPreference(next);
      try {
        await (backend.user as any).updateTheme({ theme: next });
      } catch {
        // Local preference already applied; the server sync is best-effort.
      }
    },
    [backend.user, setPreference]
  );

  const handleLanguageChange = useCallback(
    async (language: SupportedLanguage) => {
      await persistLanguage(language);
      try {
        await (backend.user as any).updateLanguage({ language });
      } catch {
        // Same as theme: local wins, server sync is best-effort.
      }
    },
    [backend.user]
  );

  const handleClearCache = useCallback(async () => {
    setConfirmClearCache(false);
    await clearAudioCache();
    await refreshStorage();
    toast.success('Audio-Cache geleert');
  }, [refreshStorage, toast]);

  const themeOptions: { id: ThemePreference; label: string; Icon: typeof Sun }[] = [
    { id: 'light', label: 'Hell', Icon: Sun },
    { id: 'dark', label: 'Dunkel', Icon: Moon },
    { id: 'system', label: 'System', Icon: SunMoon },
  ];

  return (
    <Screen>
      <ScreenHeader title={t('navigation.settings', 'Einstellungen')} />

      <View style={{ gap: spacing.xl }}>
        {/* Account */}
        <Section title="Konto">
          <Card>
            <View style={{ gap: 4 }}>
              <Text variant="label">{user?.primaryEmailAddress?.emailAddress ?? user?.username ?? 'Angemeldet'}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: 4 }}>
                <Chip label={planLabel(subscription)} size="sm" tone="accent" />
                {isAdmin ? <Chip label="Admin" size="sm" tone="warning" /> : null}
              </View>
            </View>
          </Card>

          {billing ? (
            <Card>
              <View style={{ gap: spacing.md }}>
                <View style={styles.row}>
                  <Coins size={16} color={colors.accent.gold} />
                  <Text variant="label" style={{ flex: 1 }}>
                    Verbrauch diesen Monat
                  </Text>
                </View>
                <CreditRow label="Geschichten" usage={billing.storyCredits} />
                <CreditRow label="Dokus" usage={billing.dokuCredits} />
                <CreditRow label="Hörfassungen" usage={billing.audioCredits} />
              </View>
            </Card>
          ) : null}
        </Section>

        {/* Appearance */}
        <Section title="Darstellung">
          <Card>
            <View style={{ gap: spacing.md }}>
              <Text variant="labelSm" tone="secondary">
                Design
              </Text>
              <View style={[styles.themeRow, { gap: spacing.sm }]}>
                {themeOptions.map(({ id, label, Icon }) => {
                  const selected = preference === id;
                  return (
                    <Touchable
                      key={id}
                      onPress={() => void handleThemeChange(id)}
                      style={[
                        styles.themeTile,
                        {
                          borderRadius: radius.md,
                          paddingVertical: spacing.md,
                          gap: 6,
                          backgroundColor: selected ? colors.surface.item : colors.surface.inset,
                          borderColor: selected ? colors.border.accent : colors.border.light,
                          borderWidth: selected ? 1.6 : StyleSheet.hairlineWidth,
                        },
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={label}
                    >
                      <Icon size={18} color={selected ? colors.primary : colors.text.tertiary} />
                      <Text variant="caption" tone={selected ? 'accent' : 'secondary'}>
                        {label}
                      </Text>
                    </Touchable>
                  );
                })}
              </View>
            </View>
          </Card>

          <Card>
            <View style={{ gap: spacing.md }}>
              <View style={styles.row}>
                <Globe size={16} color={colors.text.secondary} />
                <Text variant="labelSm" tone="secondary" style={{ flex: 1 }}>
                  Sprache
                </Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {SUPPORTED_LANGUAGES.map((language) => (
                  <Chip
                    key={language.code}
                    label={`${language.flag} ${language.nativeName}`}
                    selected={i18n.language === language.code}
                    onPress={() => void handleLanguageChange(language.code)}
                  />
                ))}
              </View>
            </View>
          </Card>

          <Card padded={false}>
            <View style={[styles.toggleRow, { padding: spacing.md, gap: spacing.md }]}>
              <Vibrate size={17} color={colors.text.secondary} />
              <View style={{ flex: 1 }}>
                <Text variant="label">Haptisches Feedback</Text>
                <Text variant="caption" tone="tertiary">
                  Leichte Vibration bei Tippen und Erfolgen
                </Text>
              </View>
              <Switch
                value={haptics}
                onValueChange={(value) => {
                  setHaptics(value);
                  setHapticsEnabled(value);
                }}
                trackColor={{ false: colors.progressTrack, true: colors.primary }}
                thumbColor={colors.media.foreground}
                accessibilityLabel="Haptisches Feedback"
              />
            </View>
          </Card>
        </Section>

        {/* Family */}
        <Section title="Familie">
          <Card padded={false}>
            <NavRow
              icon={<Users size={17} color={colors.text.secondary} />}
              label="Kinderprofile"
              value={`${childProfiles?.profiles.length ?? 0} von ${childProfiles?.profileLimit ?? 1}`}
              onPress={() => navigation.navigate('Profiles')}
            />
            <NavRow
              icon={<ShieldCheck size={17} color={colors.text.secondary} />}
              label="Elternbereich"
              value={hasParentalPin ? 'PIN aktiv' : 'Kein PIN'}
              onPress={() => navigation.navigate('ParentalOnboarding')}
              last
            />
          </Card>
        </Section>

        {/* Learning */}
        <Section title="Lernen">
          <Card padded={false}>
            <NavRow
              icon={<Sparkles size={17} color={colors.text.secondary} />}
              label="Wissenskosmos"
              onPress={() => navigation.navigate('Cosmos')}
            />
            <NavRow
              icon={<Sparkles size={17} color={colors.text.secondary} />}
              label="Elternüberblick"
              onPress={() => navigation.navigate('CosmosParent')}
              last
            />
          </Card>
        </Section>

        {/* Storage */}
        <Section title="Daten auf diesem Gerät">
          <Card padded={false}>
            <NavRow
              icon={<Download size={17} color={colors.text.secondary} />}
              label="Offline-Bibliothek"
              value={`${offlineUsage.items} Titel · ${formatBytes(offlineUsage.bytes)}`}
              onPress={() => navigation.navigate('OfflineLibrary')}
            />
            <NavRow
              icon={<Database size={17} color={colors.text.secondary} />}
              label="Audio-Cache leeren"
              value={`${audioCache.entries} Dateien · ${formatBytes(audioCache.bytes)}`}
              onPress={() => setConfirmClearCache(true)}
              last
            />
          </Card>
        </Section>

        {/* Admin */}
        {isAdmin ? (
          <Section title="Administration">
            <Card padded={false}>
              <NavRow label="Dashboard" onPress={() => navigation.navigate('AdminDashboard')} />
              <NavRow label="Logs" onPress={() => navigation.navigate('Logs')} />
              <NavRow label="Charakter-Pool" onPress={() => navigation.navigate('CharacterPool')} />
              <NavRow label="Artefakt-Pool" onPress={() => navigation.navigate('ArtifactPool')} />
              <NavRow label="Märchen" onPress={() => navigation.navigate('FairyTales')} last />
            </Card>
          </Section>
        ) : null}

        <Touchable
          onPress={() => setConfirmSignOut(true)}
          style={[styles.signOut, { borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.dangerSoft }]}
          accessibilityRole="button"
          accessibilityLabel="Abmelden"
        >
          <LogOut size={17} color={colors.danger} />
          <Text variant="label" tone="danger">
            Abmelden
          </Text>
        </Touchable>

        <Text variant="caption" tone="muted" center>
          Talea {Application.nativeApplicationVersion ?? '1.0.0'}
          {Application.nativeBuildVersion ? ` (${Application.nativeBuildVersion})` : ''}
        </Text>
      </View>

      <ConfirmSheet
        open={confirmSignOut}
        title="Abmelden?"
        message="Offline gespeicherte Geschichten bleiben auf diesem Gerät erhalten."
        confirmLabel="Abmelden"
        destructive
        onConfirm={() => {
          setConfirmSignOut(false);
          void signOut();
        }}
        onCancel={() => setConfirmSignOut(false)}
      />

      <ConfirmSheet
        open={confirmClearCache}
        title="Audio-Cache leeren?"
        message="Gespeicherte Hörfassungen werden gelöscht und beim nächsten Abspielen neu erzeugt."
        confirmLabel="Leeren"
        destructive
        onConfirm={handleClearCache}
        onCancel={() => setConfirmClearCache(false)}
      />
    </Screen>
  );
}

function planLabel(plan: string | null): string {
  const labels: Record<string, string> = {
    free: 'Kostenlos',
    starter: 'Starter',
    familie: 'Familie',
    premium: 'Premium',
  };
  return labels[plan ?? 'free'] ?? 'Kostenlos';
}

function CreditRow({ label, usage }: { label: string; usage: { limit: number | null; used: number; remaining: number | null } }) {

  const unlimited = usage.limit === null;

  return (
    <View style={{ gap: 4 }}>
      <View style={styles.row}>
        <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
          {label}
        </Text>
        <Text variant="caption" tone="tertiary">
          {unlimited ? 'unbegrenzt' : `${usage.used} / ${usage.limit}`}
        </Text>
      </View>
      {!unlimited ? <ProgressBar progress={usage.limit ? usage.used / usage.limit : 0} height={4} /> : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="overline" tone="tertiary">
        {title}
      </Text>
      {children}
    </View>
  );
}

function NavRow({
  icon,
  label,
  value,
  onPress,
  last,
}: {
  icon?: React.ReactNode;
  label: string;
  value?: string;
  onPress: () => void;
  last?: boolean;
}) {
  const { colors, spacing } = useTheme();

  return (
    <Touchable
      onPress={onPress}
      pressScale={0.99}
      style={[
        styles.navRow,
        {
          padding: spacing.md,
          gap: spacing.md,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: colors.border.light,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon}
      <Text variant="label" style={{ flex: 1 }}>
        {label}
      </Text>
      {value ? (
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      <ChevronRight size={16} color={colors.text.tertiary} />
    </Touchable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  themeRow: { flexDirection: 'row' },
  themeTile: { flex: 1, alignItems: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center' },
  navRow: { flexDirection: 'row', alignItems: 'center' },
  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
