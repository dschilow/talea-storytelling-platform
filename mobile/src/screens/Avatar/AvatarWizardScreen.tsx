import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useBackend } from '@/api/backend';
import { useInvalidateContent } from '@/hooks/queries';
import { useOptionalChildProfiles } from '@/providers/ChildProfilesProvider';
import { useToast } from '@/providers/ToastProvider';
import { haptic } from '@/lib/haptics';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CoverImage } from '@/components/ui/CoverImage';
import * as ImagePicker from 'expo-image-picker';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { StepIdentity } from './wizard/StepIdentity';
import { StepBody } from './wizard/StepBody';
import { StepAppearance } from './wizard/StepAppearance';
import { StepCharacter } from './wizard/StepCharacter';
import { StepAvatarPreview } from './wizard/StepAvatarPreview';
import { AvatarGenerationOverlay } from './wizard/AvatarGenerationOverlay';
import {
  DEFAULT_AVATAR_FORM_DATA,
  formDataToNarrativeProfile,
  formDataToDescription,
  formDataToVisualProfile,
  type AvatarFormData,
} from '@/types/avatarForm';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type WizardRoute = RouteProp<RootStackParamList, 'AvatarWizard'>;

const STEP_LABELS = ['Wer bist du?', 'Alter & Statur', 'Aussehen', 'Charakter', 'Fertig'] as const;
const LAST_STEP = STEP_LABELS.length - 1;

/**
 * Avatar creation wizard.
 *
 * The payload mirrors the web wizard exactly: `visualProfile` drives image
 * generation and cross-story visual consistency, `narrativeProfile` drives how
 * the avatar behaves in prose. Personality traits are NOT set here — every
 * avatar starts with all nine base traits at 0 and earns them through stories.
 */
export function AvatarWizardScreen() {
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<WizardRoute>();
  const backend = useBackend();
  const toast = useToast();
  const invalidateContent = useInvalidateContent();
  const childProfiles = useOptionalChildProfiles();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<AvatarFormData>(DEFAULT_AVATAR_FORM_DATA);
  const [creating, setCreating] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | undefined>();
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  const [previewSignature, setPreviewSignature] = useState('');
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const signature = JSON.stringify([formDataToVisualProfile(form), referenceImageUrl]);

  async function choosePhoto(camera: boolean) {
    try {
    const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { toast.info('Zugriff erforderlich', 'Bitte erlaube Talea den Zugriff in den Android-Einstellungen.'); return; }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, base64: true, allowsEditing: true, aspect: [1, 1] };
      const picked = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!picked.canceled && picked.assets[0].base64) setReferenceImageUrl(`data:${picked.assets[0].mimeType ?? 'image/jpeg'};base64,${picked.assets[0].base64}`);
    } catch (error) { toast.error('Foto konnte nicht geöffnet werden', error instanceof Error ? error.message : undefined); }
  }

  async function generatePreview() {
    const result = await backend.ai.generateAvatarImage({ characterType: form.characterType === 'other' ? form.customCharacterType : form.characterType, appearance: formDataToDescription(form), personalityTraits: {}, style: 'disney', referenceImageUrl });
    setPreviewUrl(result.imageUrl); setPreviewSignature(signature); return result.imageUrl as string;
  }

  // A family's first avatar is the child themself; later ones are companions.
  const isChildMode = route.params?.childMode ?? false;

  const update = useCallback((patch: Partial<AvatarFormData>) => setForm((prev) => ({ ...prev, ...patch })), []);

  const canAdvance = useMemo(() => {
    switch (step) {
      case 0:
        return form.name.trim().length >= 2 && (form.characterType !== 'other' || Boolean(form.customCharacterType?.trim()));
      case 1:
      case 2:
      case 3:
      case 4:
        return true;
      default:
        return false;
    }
  }, [form, step]);

  const isDirty = form.name.trim().length > 0;

  const goBack = useCallback(() => {
    if (step === 0) {
      if (isDirty) setConfirmExit(true);
      else navigation.goBack();
      return;
    }
    haptic('light');
    setStep((value) => value - 1);
  }, [isDirty, navigation, step]);

  const goNext = useCallback(() => {
    if (!canAdvance) return;
    haptic('light');
    setStep((value) => Math.min(LAST_STEP, value + 1));
  }, [canAdvance]);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      const visualProfile = formDataToVisualProfile(form);
      const narrativeProfile = formDataToNarrativeProfile(form);

      const characterType =
        form.characterType === 'other' && form.customCharacterType ? form.customCharacterType : form.characterType;
      const imageUrl = previewUrl && previewSignature === signature ? previewUrl : await generatePreview();

      const created = (await (backend.avatar as any).create({
        name: form.name.trim(),
        description: form.additionalDescription?.trim() || undefined,
        physicalTraits: {
          characterType,
          appearance: formDataToDescription(form),
        },
        visualProfile,
        narrativeProfile,
        imageUrl,
        creationType: 'ai-generated' as const,
        avatarRole: isChildMode ? ('child' as const) : ('companion' as const),
        profileId: childProfiles?.activeProfileId ?? undefined,
      })) as { id: string };

      invalidateContent();
      haptic('celebrate');
      toast.success(`${form.name} ist da!`, 'Alle Eigenschaften starten bei 0 und wachsen mit jeder Geschichte.');

      navigation.replace('AvatarDetail', { avatarId: created.id });
    } catch (error) {
      console.error('[AvatarWizard] Creation failed', error);
      toast.error('Avatar konnte nicht erstellt werden', error instanceof Error ? error.message : undefined);
      setCreating(false);
    }
  }, [backend.avatar, backend.ai, childProfiles?.activeProfileId, form, invalidateContent, isChildMode, navigation, toast, referenceImageUrl, previewUrl, previewSignature, signature]);

  if (creating) {
    return <AvatarGenerationOverlay name={form.name} />;
  }

  const steps = [
    <StepIdentity key="identity" form={form} onChange={update} isChildMode={isChildMode} />,
    <StepBody key="body" form={form} onChange={update} />,
    <StepAppearance key="appearance" form={form} onChange={update} />,
    <StepCharacter key="character" form={form} onChange={update} />,
    <StepAvatarPreview key="preview" form={form} isChildMode={isChildMode} />,
  ];

  return (
    <Screen scroll={false} padded={false}>
      <ScreenHeader
        title="Neuer Avatar"
        subtitle={`Schritt ${step + 1} von ${STEP_LABELS.length} · ${STEP_LABELS[step]}`}
        onBack={goBack}
        showBack
      />

      <View style={{ paddingHorizontal: spacing.base, paddingBottom: spacing.md }}>
        <ProgressBar progress={(step + 1) / STEP_LABELS.length} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: spacing.xxxl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View key={step} entering={SlideInRight.duration(240)} exiting={SlideOutLeft.duration(160)}>
          {steps[step]}
          {step === 2 ? <View style={{ gap: spacing.sm, marginTop: spacing.base }}>
            <Button label="Foto als Vorlage wählen" variant="secondary" onPress={() => void choosePhoto(false)} />
            <Button label="Foto aufnehmen" variant="secondary" onPress={() => void choosePhoto(true)} />
            {referenceImageUrl ? <><CoverImage uri={referenceImageUrl} style={{ height: 180 }} /><Button label="Fotovorlage entfernen" variant="ghost" onPress={() => setReferenceImageUrl(undefined)} /></> : null}
          </View> : null}
          {step === LAST_STEP ? <View style={{ gap: spacing.sm, marginTop: spacing.base }}>
            {previewUrl && previewSignature === signature ? <CoverImage uri={previewUrl} style={{ height: 240 }} /> : null}
            <Button label="Avatar-Bild als Vorschau erstellen" loading={generatingPreview} variant="secondary" onPress={async () => { if (generatingPreview) return; setGeneratingPreview(true); try { await generatePreview(); } catch (error) { toast.error('Bildgenerierung fehlgeschlagen', error instanceof Error ? error.message : undefined); } finally { setGeneratingPreview(false); } }} />
          </View> : null}
        </Animated.View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingHorizontal: spacing.base,
            paddingTop: spacing.md,
            paddingBottom: spacing.base,
            borderTopColor: colors.border.light,
            backgroundColor: colors.surface.panel,
            gap: spacing.sm,
          },
        ]}
      >
        {step === LAST_STEP ? (
          <Button
            label="Avatar erschaffen"
            disabled={generatingPreview}
            onPress={handleCreate}
            icon={<Sparkles size={17} color={colors.primaryForeground} />}
            size="lg"
            fullWidth
            hapticIntent="celebrate"
          />
        ) : (
          <View style={[styles.footerRow, { gap: spacing.sm }]}>
            {step > 0 ? (
              <Button
                label="Zurück"
                onPress={goBack}
                variant="secondary"
                icon={<ChevronLeft size={16} color={colors.text.primary} />}
              />
            ) : null}
            <Button
              label="Weiter"
              onPress={goNext}
              disabled={!canAdvance}
              trailingIcon={<ChevronRight size={16} color={colors.primaryForeground} />}
              style={{ flex: 1 }}
            />
          </View>
        )}

        {!canAdvance && step === 0 ? (
          <Text variant="caption" tone="tertiary" center>
            Gib deinem Avatar einen Namen
          </Text>
        ) : null}
      </View>

      <ConfirmSheet
        open={confirmExit}
        title="Avatar verwerfen?"
        message="Deine Eingaben gehen verloren."
        confirmLabel="Verwerfen"
        destructive
        onConfirm={() => {
          setConfirmExit(false);
          navigation.goBack();
        }}
        onCancel={() => setConfirmExit(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
  footerRow: { flexDirection: 'row', alignItems: 'center' },
});
