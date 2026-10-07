import React, { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useBackend } from '@/api/backend';
import { useOptionalUserAccess } from '@/providers/UserAccessProvider';
import { useToast } from '@/providers/ToastProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Stepper } from '@/components/form/Stepper';

type Preset = { id: string; label: string; keywords: string[] };
type Presets = { blockedThemePresets: Preset[]; blockedWordPresets: Preset[]; goalPresets: Preset[] };
export type ParentalControls = {
  enabled: boolean; onboardingCompleted: boolean; hasPin: boolean;
  blockedThemes: string[]; blockedWords: string[]; learningGoals: string[]; profileKeywords: string[];
  dailyLimits: { stories: number | null; dokus: number | null };
};
const keywords = (text: string) => [...new Set(text.split(',').map((word) => word.trim()).filter(Boolean))];

/** Same controls, presets and server-verified PIN contract as web. */
export function ParentalOnboardingScreen() {
  const { colors, spacing } = useTheme();
  const backend = useBackend();
  const navigation = useNavigation();
  const { refresh } = useOptionalUserAccess();
  const toast = useToast();
  const [controls, setControls] = useState<ParentalControls | null>(null);
  const [presets, setPresets] = useState<Presets | null>(null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [textFields, setTextFields] = useState({ blockedThemes: '', blockedWords: '', learningGoals: '', profileKeywords: '' });

  async function load() {
    setError(false);
    try {
      const response = await backend.user.getParentalControls();
      setControls(response.controls);
      setPresets(response.presets);
      setTextFields(Object.fromEntries(Object.keys(textFields).map((field) => [field, response.controls[field].join(', ')])) as typeof textFields);
    } catch { setError(true); }
  }
  useEffect(() => { void load(); }, [backend.user]);

  async function save() {
    if (!controls || saving) return;
    if (newPin && (!/^\d{4,8}$/.test(newPin) || newPin !== confirmPin)) {
      toast.warning('PIN prüfen', '4–8 Ziffern und eine identische Bestätigung sind erforderlich.');
      return;
    }
    setSaving(true);
    try {
      const result = await backend.user.saveParentalControls({
        currentPin: controls.hasPin ? currentPin : undefined, newPin: newPin || undefined,
        enabled: controls.enabled, onboardingCompleted: true,
        ...Object.fromEntries(Object.entries(textFields).map(([key, text]) => [key, keywords(text)])),
        dailyStoryLimit: controls.dailyLimits.stories, dailyDokuLimit: controls.dailyLimits.dokus,
      });
      setControls(result.controls);
      setCurrentPin(''); setNewPin(''); setConfirmPin('');
      await refresh();
      toast.success('Elterneinstellungen gespeichert');
      if (navigation.canGoBack()) navigation.goBack();
    } catch (err) { toast.error('Speichern fehlgeschlagen', err instanceof Error ? err.message : undefined); }
    finally { setSaving(false); }
  }

  return <Screen>
    <ScreenHeader title="Elternbereich" subtitle="Schutz, Tageslimits und Lernziele" showBack={navigation.canGoBack()} />
    {error ? <EmptyState title="Einstellungen konnten nicht geladen werden" actionLabel="Erneut versuchen" onAction={() => void load()} /> : !controls ?
      <Text>Lädt …</Text> : <View style={{ gap: spacing.base }}>
      <Card><View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Text variant="label" style={{ flex: 1 }}>Inhaltsfilter aktiv</Text>
        <Switch value={controls.enabled} onValueChange={(enabled) => setControls({ ...controls, enabled })}
          trackColor={{ true: colors.primary }} accessibilityLabel="Inhaltsfilter aktiv" />
      </View></Card>
      {controls.hasPin ? <Input label="Aktuelle Eltern-PIN" value={currentPin} onChangeText={setCurrentPin} secureTextEntry keyboardType="number-pad" maxLength={8} /> : null}
      <Input label={controls.hasPin ? 'Neue PIN (optional)' : 'Eltern-PIN (4–8 Ziffern)'} value={newPin} onChangeText={setNewPin} secureTextEntry keyboardType="number-pad" maxLength={8} />
      {newPin ? <Input label="Neue PIN bestätigen" value={confirmPin} onChangeText={setConfirmPin} secureTextEntry keyboardType="number-pad" maxLength={8} /> : null}
      {(['stories', 'dokus'] as const).map((kind) => <Card key={kind}><View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text variant="label" style={{ flex: 1 }}>{kind === 'stories' ? 'Geschichtenlimit' : 'Dokulimit'} pro Tag</Text>
          <Switch value={controls.dailyLimits[kind] !== null} accessibilityLabel={`${kind === 'stories' ? 'Geschichten' : 'Doku'} begrenzen`}
            onValueChange={(on) => setControls({ ...controls, dailyLimits: { ...controls.dailyLimits, [kind]: on ? 3 : null } })} />
        </View>
        {controls.dailyLimits[kind] !== null ? <Stepper label="Neue Inhalte" value={controls.dailyLimits[kind]!} min={0} max={30}
          onChange={(value) => setControls({ ...controls, dailyLimits: { ...controls.dailyLimits, [kind]: value } })} /> : null}
      </View></Card>)}
      {([
        ['blockedThemes', 'Themen ausschließen', presets?.blockedThemePresets],
        ['blockedWords', 'Wörter ausschließen', presets?.blockedWordPresets],
        ['learningGoals', 'Lernziele', presets?.goalPresets],
        ['profileKeywords', 'Interessen und Hinweise', undefined],
      ] as const).map(([field, label, options]) => <View key={field} style={{ gap: spacing.sm }}>
        <Input label={label} value={textFields[field]} onChangeText={(value) => setTextFields({ ...textFields, [field]: value })} multilineRows={2} hint="Kommagetrennt" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {options?.map((preset) => {
            const existing = keywords(textFields[field]);
            const selected = preset.keywords.every((word) => existing.includes(word));
            return <Chip key={preset.id} label={preset.label} selected={selected} onPress={() => setTextFields({ ...textFields,
              [field]: (selected ? existing.filter((word) => !preset.keywords.includes(word)) : [...new Set([...existing, ...preset.keywords])]).join(', '),
            })} />;
          })}
        </View>
      </View>)}
      <Button label="Einstellungen speichern" onPress={() => void save()} loading={saving} fullWidth />
    </View>}
  </Screen>;
}
