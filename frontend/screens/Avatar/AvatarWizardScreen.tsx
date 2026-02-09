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

// ── Background ────────────────────────────────────────────
const Background: React.FC = () => (
  <div
    className="fixed inset-0 pointer-events-none z-0"
    style={{ background: '#0C0E14' }}
  >
    <div
      className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full"
      style={{
        background: 'radial-gradient(circle, rgba(45,212,191,0.07) 0%, transparent 70%)',
        filter: 'blur(80px)',
      }}
    />
    <div
      className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full"
      style={{
        background: 'radial-gradient(circle, rgba(45,212,191,0.04) 0%, transparent 70%)',
        filter: 'blur(80px)',
      }}
    />
  </div>
);

// ── Step indicator ────────────────────────────────────────
const StepIndicator: React.FC<{ activeStep: number }> = ({ activeStep }) => (
  <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-4 px-2">
    {WIZARD_STEPS.map((step, i) => (
      <React.Fragment key={step.key}>
        <div className="flex flex-col items-center gap-1">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300"
            style={
              i < activeStep
                ? { background: ACCENT, color: '#0C0E14' }
                : i === activeStep
                  ? { background: 'rgba(45,212,191,0.15)', border: `2px solid ${ACCENT}`, color: ACCENT }
                  : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.25)' }
            }
          >
            {i < activeStep ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </div>
          <span
            className={`text-[9px] sm:text-[10px] font-medium transition-colors duration-300 ${
              i === activeStep ? 'text-white/60' : i < activeStep ? 'text-white/30' : 'text-white/15'
            }`}
          >
            {step.label}
          </span>
        </div>
        {i < WIZARD_STEPS.length - 1 && (
          <div
            className="w-4 sm:w-6 h-px rounded-full -mt-3"
            style={{ background: i < activeStep ? ACCENT : 'rgba(255,255,255,0.06)' }}
          />
        )}
      </React.Fragment>
    ))}
  </div>
);

// ── Creating loading state ────────────────────────────────
const CreatingAnimation: React.FC<{ name: string }> = ({ name }) => (
  <div className="relative min-h-screen">
    <Background />
    <div className="relative z-10 flex flex-col items-center justify-center min-h-screen gap-6 px-6">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      >
        <Loader2 className="w-10 h-10" style={{ color: ACCENT }} />
      </motion.div>
      <div className="text-center">
        <h2 className="text-xl font-semibold text-white">
          {name} wird erstellt
        </h2>
        <p className="text-white/35 text-sm mt-1">Einen Moment noch...</p>
      </div>
    </div>
  </div>
);

// ── Main wizard ───────────────────────────────────────────
const AvatarWizardScreen: React.FC = () => {
  const navigate = useNavigate();
  const backend = useBackend();

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
            : characterType?.labelEn || 'human child',
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
              ageApprox: `${formData.age} years old`,
              gender: formData.gender === 'male' ? 'male' : 'female',
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
    return <CreatingAnimation name={formData.name} />;
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
      <Background />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center gap-3 px-3 pt-4 pb-3">
          <button
            onClick={() => navigate('/avatar')}
            className="p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-white">
              Avatar erstellen
            </h1>
            <p className="text-xs text-white/30">
              Schritt {activeStep + 1} von {WIZARD_STEPS.length}
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <StepIndicator activeStep={activeStep} />

        {/* Content card */}
        <div className="mx-3 sm:mx-auto sm:max-w-lg">
          <div
            className="rounded-2xl p-4 sm:p-5"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
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

          {/* Navigation */}
          <div className="flex items-center justify-between mt-4 gap-3">
            {activeStep > 0 ? (
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-all"
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
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-semibold text-[#0C0E14] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: canProceed ? ACCENT : 'rgba(255,255,255,0.1)',
                  color: canProceed ? '#0C0E14' : 'rgba(255,255,255,0.3)',
                }}
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
