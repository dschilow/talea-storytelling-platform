import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import {
  AvatarFormData,
  DEFAULT_AVATAR_FORM_DATA,
  formDataToVisualProfile,
  formDataToNarrativeProfile,
  getAvatarVisualPromptSignature,
  formDataToDescription,
  CHARACTER_TYPES,
  isHumanCharacter,
  isAnimalCharacter,
} from '../../types/avatarForm';
import { useBackend } from '../../hooks/useBackend';
import { useTheme } from '../../contexts/ThemeContext';
import { useOptionalChildProfiles } from '../../contexts/ChildProfilesContext';
import { cn } from '@/lib/utils';
import {
  TaleaActionButton,
  TaleaPageBackground,
  TaleaProgressSteps,
  taleaChipClass,
  taleaDisplayFont,
  taleaPageShellClass,
  taleaSurfaceClass,
} from '@/components/talea/TaleaPastelPrimitives';

import Step1Basics from './wizard-steps/Step1Basics';
import Step2AgeBody from './wizard-steps/Step2AgeBody';
import Step3Appearance from './wizard-steps/Step3Appearance';
import Step4Character from './wizard-steps/Step4Character';
import Step4Details from './wizard-steps/Step4Details';
import Step5Preview from './wizard-steps/Step5Preview';


const headingFont = taleaDisplayFont;

/**
 * Kept as a thin shim so the step components below can stay untouched: every
 * value now resolves through the shared Talea theme tokens instead of the
 * wizard's own hard-coded teal/beige palette.
 */
type WizardPalette = {
  border: string;
  panel: string;
  text: string;
  muted: string;
  stepIdle: string;
};

const PALETTE: WizardPalette = {
  border: 'var(--talea-border-light)',
  panel: 'var(--talea-surface-primary)',
  text: 'var(--talea-text-primary)',
  muted: 'var(--talea-text-secondary)',
  stepIdle: 'var(--talea-surface-inset)',
};

const CreatingAnimation: React.FC<{ name: string; isDark: boolean }> = ({ name, isDark }) => {
  const { t } = useTranslation();
  return (
    <div className="relative min-h-screen">
      <TaleaPageBackground isDark={isDark} />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-6 px-6">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
          <Loader2 className="h-10 w-10 text-[var(--primary)]" />
        </motion.div>
        <div className="text-center">
          <h2 className="text-2xl text-[var(--talea-text-primary)]" style={{ fontFamily: headingFont }}>
            {t('avatar.wizard.creating', '{{name}} wird gezaubert...', { name })}
          </h2>
          <p className="mt-1 text-sm text-[var(--talea-text-secondary)]">
            {t('avatar.wizard.creatingSubtitle', 'Gleich ist dein Avatar fertig!')}
          </p>
        </div>
      </div>
    </div>
  );
};

const AvatarWizardScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const backend = useBackend();
  const childProfiles = useOptionalChildProfiles();
  const activeProfile = childProfiles?.activeProfile ?? null;
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const palette = PALETTE;

  const WIZARD_STEPS = useMemo(() => [
    { key: 'basics', label: t('avatar.wizard.steps.who', 'Wer?') },
    { key: 'age-body', label: t('avatar.wizard.steps.body', 'Körper') },
    { key: 'appearance', label: t('avatar.wizard.steps.look', 'Aussehen') },
    { key: 'character', label: t('avatar.wizard.steps.character', 'Charakter') },
    { key: 'details', label: t('avatar.wizard.steps.extras', 'Bild-Extras') },
    { key: 'preview', label: t('avatar.wizard.steps.done', 'Fertig!') },
  ], [t]);
  const childMode = searchParams.get('mode') === 'child';
  const requestedProfileId = searchParams.get('profileId')?.trim() || null;
  const targetProfileId = childMode
    ? requestedProfileId
    : requestedProfileId || activeProfile?.id || null;
  const targetProfile = targetProfileId
    ? childProfiles?.profiles.find((profile) => profile.id === targetProfileId) ?? null
    : null;
  const effectiveChildMode = childMode;
  const backTarget = '/avatar';

  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<AvatarFormData>(DEFAULT_AVATAR_FORM_DATA);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | undefined>();
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const taviPrefillAppliedRef = React.useRef(false);
  const latestPromptSignatureRef = React.useRef('');
  const generatedPreviewSignatureRef = React.useRef<string | undefined>();
  const visualPromptSignature = useMemo(
    () => getAvatarVisualPromptSignature(formData, referenceImageUrl),
    [formData, referenceImageUrl]
  );

  React.useEffect(() => {
    latestPromptSignatureRef.current = visualPromptSignature;
    if (
      previewUrl &&
      generatedPreviewSignatureRef.current &&
      generatedPreviewSignatureRef.current !== visualPromptSignature
    ) {
      generatedPreviewSignatureRef.current = undefined;
      setPreviewUrl(undefined);
    }
  }, [previewUrl, visualPromptSignature]);


  const updateFormData = useCallback((updates: Partial<AvatarFormData>) => {
    setFormData((prev) => {
      const newData = { ...prev, ...updates };

      if (effectiveChildMode) {
        if (targetProfile && targetProfile.age != null) {
          newData.name = targetProfile.name;
          newData.age = targetProfile.age;
        }
        newData.characterType = 'human';
        newData.customCharacterType = undefined;
      } else if (updates.characterType) {
        if (isHumanCharacter(updates.characterType)) {
          newData.skinTone = 'medium';
        } else if (isAnimalCharacter(updates.characterType)) {
          newData.skinTone = 'brown';
        } else {
          newData.skinTone = 'golden';
        }
      }

      return newData;
    });
  }, [effectiveChildMode, targetProfile]);

  React.useEffect(() => {
    if (!effectiveChildMode || !targetProfile || targetProfile.age == null) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      name: targetProfile.name,
      age: targetProfile.age,
      characterType: 'human',
      customCharacterType: undefined,
      skinTone: prev.skinTone || 'medium',
    }));
  }, [effectiveChildMode, targetProfile]);

  // Tavi prefill: apply wizard data from Tavi chat
  React.useEffect(() => {
    const taviPrefill = (location.state as any)?.taviPrefill;
    if (!taviPrefill) return;
    if (taviPrefillAppliedRef.current) return;
    taviPrefillAppliedRef.current = true;

    const updates: Partial<AvatarFormData> = {};
    if (!effectiveChildMode && taviPrefill.name) updates.name = taviPrefill.name;
    if (!effectiveChildMode && taviPrefill.characterType) {
      const known = CHARACTER_TYPES.find(
        (ct) => ct.id === taviPrefill.characterType || ct.labelEn?.toLowerCase() === taviPrefill.characterType?.toLowerCase()
      );
      if (known) {
        updates.characterType = known.id;
      } else {
        updates.characterType = 'other';
        updates.customCharacterType = taviPrefill.characterType;
      }
    }
    if (taviPrefill.gender) updates.gender = taviPrefill.gender;
    if (taviPrefill.appearance) updates.additionalDescription = taviPrefill.appearance;

    if (Object.keys(updates).length > 0) {
      updateFormData(updates);
    }

    // Clear the navigation state to prevent re-applying on re-render
    window.history.replaceState({}, document.title);
  }, [effectiveChildMode, location.state, updateFormData]);

  const canProceed = useMemo(() => {
    if ((requestedProfileId || effectiveChildMode) && !targetProfile) return false;
    if (effectiveChildMode && targetProfile?.age == null) return false;
    if (activeStep === 0) return formData.name.trim().length > 0;
    return true;
  }, [activeStep, effectiveChildMode, formData.name, requestedProfileId, targetProfile]);

  const handleNext = () => {
    if (canProceed && activeStep < WIZARD_STEPS.length - 1) setActiveStep((s) => s + 1);
  };

  const handleBack = () => {
    if (activeStep > 0) setActiveStep((s) => s - 1);
  };

  const handleGeneratePreview = async () => {
    const requestSignature = visualPromptSignature;
    try {
      setIsGeneratingPreview(true);
      const description = formDataToDescription(formData);
      const characterType = CHARACTER_TYPES.find((t) => t.id === formData.characterType);

      const result = await backend.ai.generateAvatarImage({
        characterType:
          formData.characterType === 'other' && formData.customCharacterType
            ? formData.customCharacterType
            : characterType?.labelEn || 'human',
        appearance: description,
        personalityTraits: {},
        style: 'disney',
        referenceImageUrl,
      });

      if (latestPromptSignatureRef.current !== requestSignature) {
        return;
      }

      generatedPreviewSignatureRef.current = requestSignature;
      setPreviewUrl(result.imageUrl);
      import('../../utils/toastUtils').then(({ showSuccessToast }) => {
        showSuccessToast(t('avatar.wizard.previewSuccess', 'Dein Avatar-Bild ist fertig!'));
      });
    } catch (error) {
      console.error('Error generating preview:', error);
      import('../../utils/toastUtils').then(({ showErrorToast }) => {
        showErrorToast(t('avatar.wizard.previewError', 'Das Bild konnte leider nicht erstellt werden. Versuch es nochmal!'));
      });
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleCreateAvatar = async () => {
    if ((requestedProfileId || effectiveChildMode) && !targetProfile) {
      import('../../utils/toastUtils').then(({ showErrorToast }) => {
        showErrorToast('Das ausgewaehlte Kinderprofil ist noch nicht verfuegbar.');
      });
      return;
    }
    if (effectiveChildMode && targetProfile?.age == null) {
      import('../../utils/toastUtils').then(({ showErrorToast }) => {
        showErrorToast('Bitte trage zuerst das Alter im Kinderprofil ein.');
      });
      return;
    }

    const createFormData: AvatarFormData =
      effectiveChildMode && targetProfile && targetProfile.age != null
        ? {
            ...formData,
            name: targetProfile.name,
            age: targetProfile.age,
            characterType: 'human',
            customCharacterType: undefined,
          }
        : formData;

    if (!createFormData.name.trim()) {
      import('../../utils/toastUtils').then(({ showErrorToast }) => {
        showErrorToast(t('avatar.wizard.nameRequired', 'Dein Avatar braucht noch einen Namen!'));
      });
      return;
    }

    try {
      setIsCreating(true);

      const description = formDataToDescription(createFormData);
      const characterType = CHARACTER_TYPES.find((t) => t.id === createFormData.characterType);
      const visualProfile = formDataToVisualProfile(createFormData);
      const narrativeProfile = formDataToNarrativeProfile(createFormData);

      const neutralPersonality = {
        knowledge: { value: 0 },
        creativity: { value: 0 },
        vocabulary: { value: 0 },
        courage: { value: 0 },
        curiosity: { value: 0 },
        teamwork: { value: 0 },
        empathy: { value: 0 },
        persistence: { value: 0 },
        logic: { value: 0 },
      };

      const createRequest = {
        profileId: targetProfileId || undefined,
        name: createFormData.name.trim(),
        description: createFormData.additionalDescription?.trim() || (effectiveChildMode ? `Das ist ${createFormData.name.trim()}. Dieser Avatar stellt das Kind selbst in Geschichten dar.` : `${createFormData.name.trim()} ist ein Begleiter in gemeinsamen Geschichten.`),
        physicalTraits: {
          characterType:
            createFormData.characterType === 'other' && createFormData.customCharacterType
              ? createFormData.customCharacterType
              : characterType?.labelEn || 'human',
          appearance: description,
        },
        personalityTraits: neutralPersonality,
        imageUrl: previewUrl,
        visualProfile,
        narrativeProfile,
        creationType: 'ai-generated' as const,
        avatarRole: effectiveChildMode ? ('child' as const) : ('companion' as const),
      };

      await (backend.avatar as any).create(createRequest);
      if (effectiveChildMode) {
        await childProfiles?.refresh();
      }
      import('../../utils/toastUtils').then(({ showAvatarCreatedToast, showSuccessToast }) => {
        showAvatarCreatedToast(formData.name);
        showSuccessToast(t('avatar.wizard.createSuccess', '{{name}} ist da! Viel Spaß mit deinem Avatar!', { name: formData.name }));
      });
      navigate('/avatar', { state: { refresh: true } });
    } catch (error) {
      console.error('Error creating avatar:', error);
      import('../../utils/toastUtils').then(({ showErrorToast }) => {
        showErrorToast(t('avatar.wizard.createError', 'Das hat leider nicht geklappt. Versuch es nochmal!'));
      });
    } finally {
      setIsCreating(false);
    }
  };

  const profileIsRequired = Boolean(requestedProfileId || effectiveChildMode);
  const isResolvingProfile = Boolean(
    profileIsRequired && childProfiles?.isLoading && !targetProfile
  );
  const isProfileUnavailable = Boolean(
    profileIsRequired && !childProfiles?.isLoading && !targetProfile
  );
  const isProfileIncomplete = Boolean(
    effectiveChildMode && targetProfile && targetProfile.age == null
  );

  if (isResolvingProfile || isProfileUnavailable || isProfileIncomplete) {
    return (
      <div className="relative min-h-screen">
        <TaleaPageBackground isDark={isDark} />
        <div className="relative z-10 flex min-h-screen items-center justify-center px-5">
          <div className={cn(taleaSurfaceClass, 'w-full max-w-md p-6 text-center')}>
            {isResolvingProfile ? (
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--primary)]" />
            ) : (
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold" style={{ borderColor: palette.border, color: palette.muted }}>
                !
              </div>
            )}
            <h2 className="mt-4 text-xl font-semibold" style={{ color: palette.text }}>
              {isResolvingProfile
                ? 'Kinderprofil wird geladen'
                : isProfileIncomplete
                  ? 'Alter im Kinderprofil fehlt'
                  : 'Kinderprofil nicht gefunden'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: palette.muted }}>
              {isResolvingProfile
                ? 'Einen Moment bitte. Der Avatar wird gleich dem richtigen Profil zugeordnet.'
                : isProfileIncomplete
                  ? `Bitte ergänze zuerst das Alter von ${targetProfile?.name || 'dem Kind'}. Name und Alter des Kind-Avatars kommen immer direkt aus diesem Profil.`
                  : 'Der Avatar kann ohne ein eindeutiges Kinderprofil nicht angelegt werden.'}
            </p>
            {!isResolvingProfile && (
              <TaleaActionButton
                variant="secondary"
                className="mt-5"
                onClick={() => navigate(isProfileIncomplete ? '/settings' : backTarget)}
              >
                {isProfileIncomplete ? 'Kinderprofil bearbeiten' : 'Zur Avatar-Übersicht'}
              </TaleaActionButton>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isCreating) {
    return <CreatingAnimation name={formData.name} isDark={isDark} />;
  }

  const renderStep = () => {
    switch (activeStep) {
      case 0:
        return <Step1Basics formData={formData} updateFormData={updateFormData} childMode={effectiveChildMode} />;
      case 1:
        return <Step2AgeBody formData={formData} updateFormData={updateFormData} childMode={effectiveChildMode} />;
      case 2:
        return <Step3Appearance formData={formData} updateFormData={updateFormData} />;
      case 3:
        return <Step4Character formData={formData} updateFormData={updateFormData} />;
      case 4:
        return (
          <Step4Details
            formData={formData}
            updateFormData={updateFormData}
            referenceImageUrl={referenceImageUrl}
            onReferenceImageChange={setReferenceImageUrl}
          />
        );
      case 5:
        return (
          <Step5Preview
            formData={formData}
            previewUrl={previewUrl}
            isGeneratingPreview={isGeneratingPreview}
            onGeneratePreview={handleGeneratePreview}
            onCreateAvatar={handleCreateAvatar}
            isCreating={isCreating}
            childMode={effectiveChildMode}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative min-h-screen pb-10 pt-2">
      <TaleaPageBackground isDark={isDark} />

      <div className={cn(taleaPageShellClass, 'relative z-10')}>
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(taleaSurfaceClass, 'mb-4 flex flex-wrap items-end justify-between gap-4 px-4 py-4 md:px-5')}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={taleaChipClass}>Avatar Wizard</span>
              <span className="inline-flex items-center rounded-full border border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)] px-3 py-1 text-[11px] font-medium text-[var(--talea-text-secondary)]">
                {t('avatar.wizard.stepOf', 'Schritt {{current}} von {{total}}', {
                  current: activeStep + 1,
                  total: WIZARD_STEPS.length,
                })}
              </span>
            </div>
            <h1
              className="mt-3 text-[1.85rem] leading-[0.98] text-[var(--talea-text-primary)] sm:text-[2.25rem]"
              style={{ fontFamily: headingFont }}
            >
              {effectiveChildMode
                ? t('avatar.wizard.createChildTitle', 'Kind-Avatar erstellen')
                : t('avatar.wizard.createTitle', 'Avatar erstellen')}
            </h1>
          </div>

          <TaleaActionButton
            variant="secondary"
            onClick={() => navigate(backTarget)}
            icon={<ArrowLeft className="h-4 w-4" />}
          >
            {t('avatar.wizard.toOverview', 'Zur Übersicht')}
          </TaleaActionButton>
        </motion.header>

        <div className={cn(taleaSurfaceClass, 'mb-4 px-3 py-3')}>
          <TaleaProgressSteps
            steps={WIZARD_STEPS.map((step) => ({ id: step.key, label: step.label }))}
            activeIndex={activeStep}
          />
        </div>

        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(taleaSurfaceClass, 'p-5 md:p-7')}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.22 }}
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          </motion.div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <TaleaActionButton
              variant="secondary"
              onClick={activeStep === 0 ? () => navigate(backTarget) : handleBack}
              icon={<ArrowLeft className="h-4 w-4" />}
            >
              {t('avatar.wizard.back', 'Zurück')}
            </TaleaActionButton>

            {activeStep < WIZARD_STEPS.length - 1 && (
              <div className="flex min-w-0 items-center gap-3">
                {!canProceed && activeStep === 0 && (
                  <p className="min-w-0 text-right text-xs text-[var(--talea-text-secondary)]">
                    {t('avatar.wizard.nameRequiredHint', 'Dein Avatar braucht noch einen Namen.')}
                  </p>
                )}
                <TaleaActionButton onClick={handleNext} disabled={!canProceed}>
                  {t('avatar.wizard.next', 'Weiter')}
                </TaleaActionButton>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvatarWizardScreen;
