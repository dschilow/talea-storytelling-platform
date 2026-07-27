import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useBackend } from '@/api/backend';
import { useAvatars, useInvalidateContent } from '@/hooks/queries';
import { useOptionalChildProfiles } from '@/providers/ChildProfilesProvider';
import { useOptionalUserAccess } from '@/providers/UserAccessProvider';
import { useToast } from '@/providers/ToastProvider';
import { haptic } from '@/lib/haptics';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { StepAvatars } from './wizard/StepAvatars';
import { StepCategory } from './wizard/StepCategory';
import { StepScope } from './wizard/StepScope';
import { StepFeeling } from './wizard/StepFeeling';
import { StepWishes } from './wizard/StepWishes';
import { StepSummary } from './wizard/StepSummary';
import { GenerationOverlay, type GenerationPhase } from './wizard/GenerationOverlay';
import {
  canProceed,
  createStoryGenerationId,
  generateStoryWithModelFallback,
  initialWizardState,
  mapWizardStateToAPI,
  recoverGeneratedStoryAfterFailure,
  shouldAttemptStoryGenerationRecovery,
  WIZARD_STEP_LABELS,
  type WizardState,
} from './storyWizardModel';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type WizardRoute = RouteProp<RootStackParamList, 'StoryWizard'>;

const LAST_STEP = WIZARD_STEP_LABELS.length - 1;

/**
 * Story creation wizard.
 *
 * Six steps, ported 1:1 from the web wizard's flow and gating. The generation
 * phase runs as a full-screen overlay rather than a step, because it can take
 * minutes and the user must be able to see progress without the wizard chrome
 * implying they can still navigate.
 */
export function StoryWizardScreen() {
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<WizardRoute>();
  const backend = useBackend();
  const { userId } = useAuth();
  const { i18n } = useTranslation();
  const toast = useToast();
  const invalidateContent = useInvalidateContent();

  const childProfiles = useOptionalChildProfiles();
  const activeProfileId = childProfiles?.activeProfileId ?? null;
  const activeProfile = childProfiles?.activeProfile ?? null;
  const { billing } = useOptionalUserAccess();

  const avatarsQuery = useAvatars();
  const avatars = avatarsQuery.data ?? [];

  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(initialWizardState);
  const [generating, setGenerating] = useState(false);
  const [phase, setPhase] = useState<GenerationPhase>('profiles');
  const [recoveryAttempt, setRecoveryAttempt] = useState<number | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);

  const storyCredits = billing?.storyCredits ?? null;
  const creditsExhausted = storyCredits?.remaining !== null && storyCredits !== null && storyCredits.remaining <= 0;

  const update = useCallback((patch: Partial<WizardState>) => setState((prev) => ({ ...prev, ...patch })), []);

  // Deep-link prefill: /story?mapAvatarId=…&tags=… mirrors the web query params.
  useEffect(() => {
    const params = route.params;
    if (!params) return;

    const patch: Partial<WizardState> = {};
    if (params.mapAvatarId) patch.selectedAvatars = [params.mapAvatarId];

    if (params.tags) {
      const validCategories = ['fairy-tales', 'adventure', 'magic', 'animals', 'scifi', 'modern'] as const;
      const tagList = params.tags.split(',').map((tag) => tag.trim());
      const category = validCategories.find((entry) => tagList.includes(entry));
      if (category) patch.mainCategory = category;

      const customTags = tagList.filter((tag) => !validCategories.includes(tag as never)).join(', ');
      if (customTags) patch.customWish = customTags;
    }

    if (params.bringArtifact && params.bringAvatar) {
      patch.broughtArtifact = { artifactId: params.bringArtifact, avatarId: params.bringAvatar };
      patch.selectedAvatars = [...new Set([...(patch.selectedAvatars ?? []), params.bringAvatar])];
    }

    if (Object.keys(patch).length > 0) setState((prev) => ({ ...prev, ...patch }));
  }, [route.params]);

  // Seed age group from the active child profile so the default is already right.
  useEffect(() => {
    if (state.ageGroup || !activeProfile?.age) return;
    const age = activeProfile.age;
    const ageGroup = age <= 5 ? '3-5' : age <= 8 ? '6-8' : age <= 12 ? '9-12' : '13+';
    update({ ageGroup });
  }, [activeProfile?.age, state.ageGroup, update]);

  const canAdvance = useMemo(() => canProceed(step, state), [state, step]);
  const isDirty = state.selectedAvatars.length > 0 || state.mainCategory !== null;

  const goBack = useCallback(() => {
    if (step === 0) {
      if (isDirty) {
        setConfirmExit(true);
      } else {
        navigation.goBack();
      }
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

  const openGeneratedStory = useCallback(
    (story: any) => {
      invalidateContent();
      navigation.replace('StoryReader', { storyId: story.id });
    },
    [invalidateContent, navigation]
  );

  const handleGenerate = useCallback(async () => {
    if (!userId) {
      toast.error('Nicht angemeldet', 'Bitte melde dich erneut an.');
      return;
    }

    if (creditsExhausted) {
      toast.warning(
        'Keine Geschichten-Münzen mehr',
        'Die Münzen für diesen Monat sind aufgebraucht. Frag deine Eltern nach einem größeren Plan.'
      );
      return;
    }

    const storyId = createStoryGenerationId();
    setGenerating(true);
    setRecoveryAttempt(null);

    try {
      // The backend does not stream progress, so the phases before `text` are
      // paced locally to reflect the real pipeline order (the web does the same).
      setPhase('profiles');
      await new Promise((resolve) => setTimeout(resolve, 1200));
      setPhase('memories');
      await new Promise((resolve) => setTimeout(resolve, 1200));
      setPhase('text');

      const config = mapWizardStateToAPI(state, i18n.language);
      const story = await generateStoryWithModelFallback(
        (request) => (backend.story as any).generate(request),
        { storyId, userId, config, profileId: activeProfileId ?? undefined } as any
      );

      setPhase('validation');
      await new Promise((resolve) => setTimeout(resolve, 900));
      setPhase('images');
      await new Promise((resolve) => setTimeout(resolve, 1200));
      setPhase('complete');
      haptic('celebrate');
      await new Promise((resolve) => setTimeout(resolve, 800));

      openGeneratedStory(story);
    } catch (error) {
      console.error('[StoryWizard] Generation failed', error);

      if (shouldAttemptStoryGenerationRecovery(error)) {
        // The generation is very likely still running server-side; poll for it
        // rather than making the user pay another credit.
        setPhase('recovering');
        const recovered = await recoverGeneratedStoryAfterFailure(
          backend.story as any,
          storyId,
          activeProfileId ?? undefined,
          (attempt) => setRecoveryAttempt(attempt)
        );

        if (recovered) {
          setPhase('complete');
          haptic('celebrate');
          openGeneratedStory(recovered);
          return;
        }
      }

      const message = error instanceof Error ? error.message : '';
      if (message.includes('length limit exceeded')) {
        toast.error('Geschichte zu lang', 'Wähle eine kürzere Länge und versuche es nochmal.');
      } else if (message.includes('timeout')) {
        toast.error('Zeitüberschreitung', 'Der Server hat zu lange gebraucht. Bitte versuche es erneut.');
      } else if (message.includes('Abo-Limit erreicht')) {
        toast.warning('Abo-Limit erreicht', message);
      } else {
        toast.error('Erstellung fehlgeschlagen', 'Bitte versuche es in einem Moment erneut.');
      }
      setGenerating(false);
      setRecoveryAttempt(null);
    }
  }, [
    activeProfileId,
    backend.story,
    creditsExhausted,
    i18n.language,
    openGeneratedStory,
    state,
    toast,
    userId,
  ]);

  if (generating) {
    return <GenerationOverlay phase={phase} recoveryAttempt={recoveryAttempt} />;
  }

  const stepContent = [
    <StepAvatars
      key="avatars"
      avatars={avatars}
      loading={avatarsQuery.isLoading}
      selected={state.selectedAvatars}
      onToggle={(avatarId) =>
        update({
          selectedAvatars: state.selectedAvatars.includes(avatarId)
            ? state.selectedAvatars.filter((id) => id !== avatarId)
            : [...state.selectedAvatars, avatarId],
        })
      }
      onCreateAvatar={() => navigation.navigate('AvatarWizard')}
    />,
    <StepCategory
      key="category"
      value={state.mainCategory}
      onChange={(mainCategory) => update({ mainCategory })}
      onPickFairyTale={() => navigation.navigate('FairyTaleSelection')}
    />,
    <StepScope
      key="scope"
      ageGroup={state.ageGroup}
      length={state.length}
      onChangeAge={(ageGroup) => update({ ageGroup })}
      onChangeLength={(length) => update({ length })}
    />,
    <StepFeeling
      key="feeling"
      feelings={state.feelings}
      onToggle={(feeling) =>
        update({
          feelings: state.feelings.includes(feeling)
            ? state.feelings.filter((entry) => entry !== feeling)
            : [...state.feelings, feeling],
        })
      }
    />,
    <StepWishes key="wishes" state={state} onChange={update} selectedAvatarIds={state.selectedAvatars} />,
    <StepSummary
      key="summary"
      state={state}
      avatars={avatars}
      storyCredits={storyCredits}
      onEditStep={setStep}
    />,
  ];

  return (
    <Screen scroll={false} padded={false}>
      <ScreenHeader
        title="Neue Geschichte"
        subtitle={`Schritt ${step + 1} von ${WIZARD_STEP_LABELS.length} · ${WIZARD_STEP_LABELS[step]}`}
        onBack={goBack}
        showBack
      />

      <View style={{ paddingHorizontal: spacing.base, paddingBottom: spacing.md }}>
        <ProgressBar progress={(step + 1) / WIZARD_STEP_LABELS.length} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: spacing.xxxl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          key={step}
          entering={SlideInRight.duration(260)}
          exiting={SlideOutLeft.duration(180)}
        >
          {stepContent[step]}
        </Animated.View>
      </ScrollView>

      <Animated.View
        entering={FadeIn}
        exiting={FadeOut}
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
            label={creditsExhausted ? 'Keine Münzen mehr' : 'Geschichte erschaffen'}
            onPress={handleGenerate}
            disabled={creditsExhausted}
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

        {!canAdvance && step < LAST_STEP ? (
          <Text variant="caption" tone="tertiary" center>
            {step === 0
              ? 'Wähle mindestens einen Avatar'
              : step === 1
                ? 'Wähle ein Thema'
                : step === 2
                  ? 'Wähle Alter und Länge'
                  : 'Wähle mindestens eine Stimmung'}
          </Text>
        ) : null}
      </Animated.View>

      <ConfirmSheet
        open={confirmExit}
        title="Geschichte verwerfen?"
        message="Deine Auswahl geht verloren."
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
