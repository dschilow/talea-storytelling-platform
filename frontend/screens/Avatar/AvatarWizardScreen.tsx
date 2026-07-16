import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import {
  AvatarFormData,
  DEFAULT_AVATAR_FORM_DATA,
  formDataToVisualProfile,
  getAvatarVisualPromptSignature,
  formDataToDescription,
  CHARACTER_TYPES,
  isHumanCharacter,
  isAnimalCharacter,
} from '../../types/avatarForm';
import { useBackend } from '../../hooks/useBackend';
import { useTheme } from '../../contexts/ThemeContext';
import { useOptionalChildProfiles } from '../../contexts/ChildProfilesContext';

import Step1Basics from './wizard-steps/Step1Basics';
import Step2AgeBody from './wizard-steps/Step2AgeBody';
import Step3Appearance from './wizard-steps/Step3Appearance';
import Step4Details from './wizard-steps/Step4Details';
import Step5Preview from './wizard-steps/Step5Preview';


const ACCENT = '#2DD4BF';
const headingFont = '"Cormorant Garamond", serif';

type WizardPalette = {
  pageGradient: string;
  border: string;
  panel: string;
  text: string;
  muted: string;
  stepIdle: string;
};

function paletteFor(isDark: boolean): WizardPalette {
  if (isDark) {
    return {
      pageGradient:
        'radial-gradient(960px 540px at 100% 0%, rgba(94,129,160,0.26) 0%, transparent 56%), radial-gradient(980px 520px at 0% 18%, rgba(78,120,110,0.24) 0%, transparent 62%), linear-gradient(180deg,#111a25 0%, #0e1722 100%)',
      border: '#32455d',
      panel: 'rgba(24,35,49,0.92)',
      text: '#e6eef9',
      muted: '#9db0c8',
      stepIdle: 'rgba(39,53,72,0.92)',
    };
  }

  return {
    pageGradient:
      'radial-gradient(980px 560px at 100% 0%, #f2dfdc 0%, transparent 56%), radial-gradient(980px 540px at 0% 18%, #dbe8de 0%, transparent 61%), linear-gradient(180deg,#f8f1e8 0%, #f6efe4 100%)',
    border: '#dfcfbb',
    panel: 'rgba(255,250,243,0.93)',
    text: '#1b2838',
    muted: '#627487',
    stepIdle: 'rgba(237,226,209,0.85)',
  };
}

const WizardBackground: React.FC<{ palette: WizardPalette }> = ({ palette }) => (
  <div className="fixed inset-0 pointer-events-none -z-10" style={{ background: palette.pageGradient }} />
);

const StepIndicator: React.FC<{ activeStep: number; palette: WizardPalette; steps: { key: string; label: string }[] }> = ({ activeStep, palette, steps }) => (
  <div className="flex items-center justify-center gap-2.5 mb-5 px-2">
    {steps.map((step, i) => (
      <React.Fragment key={step.key}>
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300"
            style={
              i < activeStep
                ? { background: ACCENT, color: '#0e1520' }
                : i === activeStep
                ? { background: `${ACCENT}26`, border: `2px solid ${ACCENT}`, color: ACCENT }
                : { background: palette.stepIdle, border: `1px solid ${palette.border}`, color: palette.muted }
            }
          >
            {i < activeStep ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </div>
          <span
            className="text-[10px] font-medium"
            style={{ color: i <= activeStep ? palette.text : palette.muted }}
          >
            {step.label}
          </span>
        </div>
        {i < steps.length - 1 && (
          <div
            className="w-7 h-px rounded-full -mt-4"
            style={{ background: i < activeStep ? ACCENT : palette.border }}
          />
        )}
      </React.Fragment>
    ))}
  </div>
);

const CreatingAnimation: React.FC<{ name: string; palette: WizardPalette }> = ({ name, palette }) => {
  const { t } = useTranslation();
  return (
    <div className="relative min-h-screen">
      <WizardBackground palette={palette} />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-6 px-6">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
          <Loader2 className="w-10 h-10" style={{ color: ACCENT }} />
        </motion.div>
        <div className="text-center">
          <h2 className="text-xl font-semibold" style={{ color: palette.text }}>
            {t('avatar.wizard.creating', '{{name}} wird gezaubert...', { name })}
          </h2>
          <p className="text-sm mt-1" style={{ color: palette.muted }}>
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
  const palette = useMemo(() => paletteFor(isDark), [isDark]);

  const WIZARD_STEPS = useMemo(() => [
    { key: 'basics', label: t('avatar.wizard.steps.who', 'Wer?') },
    { key: 'age-body', label: t('avatar.wizard.steps.body', 'Körper') },
    { key: 'appearance', label: t('avatar.wizard.steps.look', 'Aussehen') },
    { key: 'details', label: t('avatar.wizard.steps.extras', 'Extras') },
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
        <WizardBackground palette={palette} />
        <div className="relative z-10 flex min-h-screen items-center justify-center px-5">
          <div
            className="w-full max-w-md rounded-3xl border p-6 text-center"
            style={{ background: palette.panel, borderColor: palette.border }}
          >
            {isResolvingProfile ? (
              <Loader2 className="mx-auto h-8 w-8 animate-spin" style={{ color: ACCENT }} />
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
                  ? `Bitte ergaenze zuerst das Alter von ${targetProfile?.name || 'dem Kind'}. Name und Alter des Kind-Avatars kommen immer direkt aus diesem Profil.`
                  : 'Der Avatar kann ohne ein eindeutiges Kinderprofil nicht angelegt werden.'}
            </p>
            {!isResolvingProfile && (
              <button
                type="button"
                onClick={() => navigate(isProfileIncomplete ? '/settings' : backTarget)}
                className="mt-5 rounded-full border px-4 py-2 text-sm font-semibold"
                style={{ borderColor: palette.border, color: palette.text }}
              >
                {isProfileIncomplete ? 'Kinderprofil bearbeiten' : 'Zur Avatar-Uebersicht'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isCreating) {
    return <CreatingAnimation name={formData.name} palette={palette} />;
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
        return (
          <Step4Details
            formData={formData}
            updateFormData={updateFormData}
            referenceImageUrl={referenceImageUrl}
            onReferenceImageChange={setReferenceImageUrl}
          />
        );
      case 4:
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
    <div className="relative min-h-screen pb-6">
      <WizardBackground palette={palette} />

      <div className="relative z-10 pt-4">
        <div className="flex items-center gap-3 px-3 pb-3">
          <button
            onClick={() => navigate(backTarget)}
            className="p-2 rounded-lg transition-all"
            style={{ color: palette.muted, background: palette.panel, border: `1px solid ${palette.border}` }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-3xl leading-none" style={{ color: palette.text, fontFamily: headingFont }}>
              {effectiveChildMode ? t('avatar.wizard.createChildTitle', 'Kind-Avatar erstellen') : t('avatar.wizard.createTitle', 'Avatar erstellen')}
            </h1>
            <p className="text-xs mt-1" style={{ color: palette.muted }}>
              {t('avatar.wizard.stepOf', 'Schritt {{current}} von {{total}}', { current: activeStep + 1, total: WIZARD_STEPS.length })}
            </p>
          </div>
        </div>

        <StepIndicator activeStep={activeStep} palette={palette} steps={WIZARD_STEPS} />

        <div className="mx-3 sm:mx-auto sm:max-w-2xl">
          <div
            className="rounded-3xl p-5"
            style={{ background: palette.panel, border: `1px solid ${palette.border}` }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between mt-4 gap-3">
            {activeStep > 0 ? (
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ color: palette.text, background: palette.panel, border: `1px solid ${palette.border}` }}
              >
                <ArrowLeft className="w-4 h-4" />
                {t('avatar.wizard.back', 'Zurück')}
              </button>
            ) : (
              <div />
            )}

            {activeStep < WIZARD_STEPS.length - 1 && (
              <button
                onClick={handleNext}
                disabled={!canProceed}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: canProceed ? ACCENT : palette.stepIdle, color: canProceed ? '#0f1a28' : palette.muted }}
              >
                {t('avatar.wizard.next', 'Weiter')}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvatarWizardScreen;
