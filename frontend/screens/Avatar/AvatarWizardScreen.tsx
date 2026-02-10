import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import {
  AvatarFormData,
  DEFAULT_AVATAR_FORM_DATA,
  formDataToVisualProfile,
  formDataToDescription,
  CHARACTER_TYPES,
  isHumanCharacter,
  isAnimalCharacter,
} from '../../types/avatarForm';
import { useBackend } from '../../hooks/useBackend';
import { useTheme } from '../../contexts/ThemeContext';

import Step1Basics from './wizard-steps/Step1Basics';
import Step2AgeBody from './wizard-steps/Step2AgeBody';
import Step3Appearance from './wizard-steps/Step3Appearance';
import Step4Details from './wizard-steps/Step4Details';
import Step5Preview from './wizard-steps/Step5Preview';

const WIZARD_STEPS = [
  { key: 'basics', label: 'Grundlagen' },
  { key: 'age-body', label: 'Koerper' },
  { key: 'appearance', label: 'Aussehen' },
  { key: 'details', label: 'Details' },
  { key: 'preview', label: 'Fertig' },
];

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

const StepIndicator: React.FC<{ activeStep: number; palette: WizardPalette }> = ({ activeStep, palette }) => (
  <div className="flex items-center justify-center gap-2.5 mb-5 px-2">
    {WIZARD_STEPS.map((step, i) => (
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
        {i < WIZARD_STEPS.length - 1 && (
          <div
            className="w-7 h-px rounded-full -mt-4"
            style={{ background: i < activeStep ? ACCENT : palette.border }}
          />
        )}
      </React.Fragment>
    ))}
  </div>
);

const CreatingAnimation: React.FC<{ name: string; palette: WizardPalette }> = ({ name, palette }) => (
  <div className="relative min-h-screen">
    <WizardBackground palette={palette} />
    <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
        <Loader2 className="w-10 h-10" style={{ color: ACCENT }} />
      </motion.div>
      <div className="text-center">
        <h2 className="text-xl font-semibold" style={{ color: palette.text }}>
          {name} wird erstellt
        </h2>
        <p className="text-sm mt-1" style={{ color: palette.muted }}>
          Einen Moment noch...
        </p>
      </div>
    </div>
  </div>
);

const AvatarWizardScreen: React.FC = () => {
  const navigate = useNavigate();
  const backend = useBackend();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const palette = useMemo(() => paletteFor(isDark), [isDark]);

  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<AvatarFormData>(DEFAULT_AVATAR_FORM_DATA);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | undefined>();
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const updateFormData = useCallback((updates: Partial<AvatarFormData>) => {
    setFormData((prev) => {
      const newData = { ...prev, ...updates };
      if (updates.characterType) {
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
  }, []);

  const canProceed = useMemo(() => {
    if (activeStep === 0) return formData.name.trim().length > 0;
    return true;
  }, [activeStep, formData.name]);

  const handleNext = () => {
    if (canProceed && activeStep < WIZARD_STEPS.length - 1) setActiveStep((s) => s + 1);
  };

  const handleBack = () => {
    if (activeStep > 0) setActiveStep((s) => s - 1);
  };

  const handleGeneratePreview = async () => {
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

      setPreviewUrl(result.imageUrl);
      import('../../utils/toastUtils').then(({ showSuccessToast }) => {
        showSuccessToast('Avatar-Bild wurde generiert!');
      });
    } catch (error) {
      console.error('Error generating preview:', error);
      import('../../utils/toastUtils').then(({ showErrorToast }) => {
        showErrorToast('Fehler beim Generieren des Bildes.');
      });
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleCreateAvatar = async () => {
    if (!formData.name.trim()) {
      import('../../utils/toastUtils').then(({ showErrorToast }) => {
        showErrorToast('Bitte gib deinem Avatar einen Namen.');
      });
      return;
    }

    try {
      setIsCreating(true);

      const description = formDataToDescription(formData);
      const characterType = CHARACTER_TYPES.find((t) => t.id === formData.characterType);
      let visualProfile = formDataToVisualProfile(formData);

      if (previewUrl) {
        try {
          const analysis = await backend.ai.analyzeAvatarImage({
            imageUrl: previewUrl,
            hints: {
              name: formData.name,
              expectedType: isHumanCharacter(formData.characterType) ? 'human' : 'animal',
            },
          });
          if (analysis.visualProfile) {
            visualProfile = {
              ...analysis.visualProfile,
              characterType:
                formData.characterType === 'other' && formData.customCharacterType
                  ? formData.customCharacterType
                  : characterType?.labelEn || 'human',
              speciesCategory: isHumanCharacter(formData.characterType)
                ? 'human'
                : isAnimalCharacter(formData.characterType)
                ? 'animal'
                : 'fantasy',
              locomotion: isAnimalCharacter(formData.characterType) ? 'quadruped' : 'bipedal',
              ageApprox: `${formData.age} years old`,
              ageNumeric: formData.age,
              gender: formData.gender === 'male' ? 'male' : 'female',
              heightCm: isHumanCharacter(formData.characterType) ? formData.height : undefined,
              bodyBuild: isHumanCharacter(formData.characterType) ? formData.bodyBuild : undefined,
            };
          }
        } catch (err) {
          console.warn('Image analysis failed, using form-based visual profile:', err);
        }
      }

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
        name: formData.name.trim(),
        description: formData.additionalDescription || description,
        physicalTraits: {
          characterType:
            formData.characterType === 'other' && formData.customCharacterType
              ? formData.customCharacterType
              : characterType?.labelDe || 'Mensch',
          appearance: description,
        },
        personalityTraits: neutralPersonality,
        imageUrl: previewUrl,
        visualProfile,
        creationType: 'ai-generated' as const,
      };

      await (backend.avatar as any).create(createRequest);
      import('../../utils/toastUtils').then(({ showAvatarCreatedToast, showSuccessToast }) => {
        showAvatarCreatedToast(formData.name);
        showSuccessToast(`Avatar "${formData.name}" wurde erfolgreich erstellt!`);
      });
      navigate('/avatar', { state: { refresh: true } });
    } catch (error) {
      console.error('Error creating avatar:', error);
      import('../../utils/toastUtils').then(({ showErrorToast }) => {
        showErrorToast('Avatar konnte nicht erstellt werden. Bitte versuche es erneut.');
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (isCreating) {
    return <CreatingAnimation name={formData.name} palette={palette} />;
  }

  const renderStep = () => {
    switch (activeStep) {
      case 0:
        return <Step1Basics formData={formData} updateFormData={updateFormData} />;
      case 1:
        return <Step2AgeBody formData={formData} updateFormData={updateFormData} />;
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
            onClick={() => navigate('/avatar')}
            className="p-2 rounded-lg transition-all"
            style={{ color: palette.muted, background: palette.panel, border: `1px solid ${palette.border}` }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-3xl leading-none" style={{ color: palette.text, fontFamily: headingFont }}>
              Avatar erstellen
            </h1>
            <p className="text-xs mt-1" style={{ color: palette.muted }}>
              Schritt {activeStep + 1} von {WIZARD_STEPS.length}
            </p>
          </div>
        </div>

        <StepIndicator activeStep={activeStep} palette={palette} />

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
                Zurueck
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
                Weiter
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
