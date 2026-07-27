import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { KeyRound, ShieldCheck } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useBackend } from '@/api/backend';
import { useOptionalUserAccess } from '@/providers/UserAccessProvider';
import { useToast } from '@/providers/ToastProvider';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Stepper } from '@/components/form/Stepper';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface ParentalControls {
  onboardingCompleted?: boolean;
  hasPin?: boolean;
  dailyStoryLimit?: number | null;
  dailyMinutesLimit?: number | null;
  requirePinForSettings?: boolean;
  blockedTopics?: string[];
}

/**
 * Parental controls setup.
 *
 * Gates the child-facing app on first run (see RootNavigator): a parent decides
 * limits and whether settings need a PIN before a child ever opens the app.
 * The PIN is verified server-side — it is never stored on the device.
 */
export function ParentalOnboardingScreen() {
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<Nav>();
  const backend = useBackend();
  const toast = useToast();
  const { refresh, hasParentalPin } = useOptionalUserAccess();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [requirePinForSettings, setRequirePinForSettings] = useState(true);
  const [dailyStoryLimit, setDailyStoryLimit] = useState(3);
  const [dailyMinutesLimit, setDailyMinutesLimit] = useState(45);
  const [limitsEnabled, setLimitsEnabled] = useState(true);
  const [blockedTopics, setBlockedTopics] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const controls = (await (backend.user as any).getParentalControls({})) as ParentalControls;
        setRequirePinForSettings(controls?.requirePinForSettings ?? true);
        if (typeof controls?.dailyStoryLimit === 'number') setDailyStoryLimit(controls.dailyStoryLimit);
        if (typeof controls?.dailyMinutesLimit === 'number') setDailyMinutesLimit(controls.dailyMinutesLimit);
        setLimitsEnabled(controls?.dailyStoryLimit !== null);
        setBlockedTopics((controls?.blockedTopics ?? []).join(', '));
      } catch {
        // First run — defaults above are the intended starting point.
      } finally {
        setLoading(false);
      }
    })();
  }, [backend.user]);

  const handleSave = useCallback(async () => {
    const wantsNewPin = pin.length > 0;

    if (wantsNewPin) {
      if (pin.length < 4) {
        toast.warning('PIN zu kurz', 'Mindestens 4 Ziffern.');
        return;
      }
      if (pin !== pinConfirm) {
        toast.warning('PINs stimmen nicht überein');
        return;
      }
    }

    setSaving(true);
    try {
      await (backend.user as any).saveParentalControls({
        onboardingCompleted: true,
        ...(wantsNewPin ? { pin } : {}),
        requirePinForSettings,
        dailyStoryLimit: limitsEnabled ? dailyStoryLimit : null,
        dailyMinutesLimit: limitsEnabled ? dailyMinutesLimit : null,
        blockedTopics: blockedTopics
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean),
      });

      await refresh();
      toast.success('Elternbereich eingerichtet');

      // On first run this screen IS the root; afterwards it is pushed.
      if (navigation.canGoBack()) navigation.goBack();
    } catch (error) {
      toast.error('Speichern fehlgeschlagen', error instanceof Error ? error.message : undefined);
    } finally {
      setSaving(false);
    }
  }, [
    backend.user,
    blockedTopics,
    dailyMinutesLimit,
    dailyStoryLimit,
    limitsEnabled,
    navigation,
    pin,
    pinConfirm,
    refresh,
    requirePinForSettings,
    toast,
  ]);

  return (
    <Screen>
      <ScreenHeader
        title="Elternbereich"
        subtitle="Einmal einrichten — danach kann dein Kind loslegen."
        showBack={navigation.canGoBack()}
      />

      <View style={{ gap: spacing.base }}>
        <Card variant="inset">
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <ShieldCheck size={20} color={colors.success} />
            <Text variant="bodySm" tone="secondary" style={{ flex: 1 }}>
              Diese Einstellungen gelten für alle Kinderprofile. Du kannst sie jederzeit in den Einstellungen ändern.
            </Text>
          </View>
        </Card>

        <Card>
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <KeyRound size={17} color={colors.text.secondary} />
              <Text variant="label" style={{ flex: 1 }}>
                Eltern-PIN
              </Text>
            </View>

            <Text variant="caption" tone="tertiary">
              {hasParentalPin
                ? 'Ein PIN ist gesetzt. Lass die Felder leer, um ihn zu behalten.'
                : 'Schützt Einstellungen und den Elternbereich vor neugierigen Fingern.'}
            </Text>

            <Input
              label={hasParentalPin ? 'Neuer PIN (optional)' : 'PIN'}
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              placeholder="4–8 Ziffern"
            />
            <Input
              label="PIN wiederholen"
              value={pinConfirm}
              onChangeText={setPinConfirm}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
            />
          </View>
        </Card>

        <Card padded={false}>
          <View style={[styles.toggleRow, { padding: spacing.md, gap: spacing.md }]}>
            <View style={{ flex: 1 }}>
              <Text variant="label">PIN für Einstellungen</Text>
              <Text variant="caption" tone="tertiary">
                Einstellungen und Abo nur nach PIN-Eingabe
              </Text>
            </View>
            <Switch
              value={requirePinForSettings}
              onValueChange={setRequirePinForSettings}
              trackColor={{ false: colors.progressTrack, true: colors.primary }}
              thumbColor={colors.media.foreground}
              accessibilityLabel="PIN für Einstellungen"
            />
          </View>
        </Card>

        <Card padded={false}>
          <View style={[styles.toggleRow, { padding: spacing.md, gap: spacing.md }]}>
            <View style={{ flex: 1 }}>
              <Text variant="label">Tageslimits</Text>
              <Text variant="caption" tone="tertiary">
                Begrenzt neue Geschichten und Lesezeit pro Tag
              </Text>
            </View>
            <Switch
              value={limitsEnabled}
              onValueChange={setLimitsEnabled}
              trackColor={{ false: colors.progressTrack, true: colors.primary }}
              thumbColor={colors.media.foreground}
              accessibilityLabel="Tageslimits"
            />
          </View>

          {limitsEnabled ? (
            <View
              style={{
                padding: spacing.md,
                gap: spacing.base,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border.light,
              }}
            >
              <Stepper
                label="Neue Geschichten pro Tag"
                value={dailyStoryLimit}
                min={1}
                max={20}
                onChange={setDailyStoryLimit}
              />
              <Stepper
                label="Lesezeit pro Tag"
                value={dailyMinutesLimit}
                min={10}
                max={180}
                step={5}
                onChange={setDailyMinutesLimit}
                unit="Min"
              />
            </View>
          ) : null}
        </Card>

        <Input
          label="Themen ausschließen"
          value={blockedTopics}
          onChangeText={setBlockedTopics}
          placeholder="Gewalt, Tod, Trennung"
          hint="Kommagetrennt — diese Themen kommen in keiner Geschichte vor."
          multilineRows={2}
        />

        <Button
          label="Einrichtung abschließen"
          onPress={handleSave}
          loading={saving || loading}
          size="lg"
          fullWidth
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', alignItems: 'center' },
});
