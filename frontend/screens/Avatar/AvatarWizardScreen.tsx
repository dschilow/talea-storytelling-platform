// Talea Avatar Wizard - Professional Multi-Step Dark Glass Design
// Matches TaleaStoryWizard pattern with aurora background and glass container

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles, Check } from 'lucide-react';
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

// =====================================================
// CONSTANTS
// =====================================================
const STEP_COLORS = ['#2DD4BF', '#A989F2', '#FF6B9D', '#FF9B5C', '#34D399'];

const WIZARD_STEPS = [
  { key: 'basics', label: 'Grundlagen', icon: '🎭' },
  { key: 'age-body', label: 'Koerper', icon: '📏' },
  { key: 'appearance', label: 'Aussehen', icon: '🎨' },
  { key: 'details', label: 'Details', icon: '✨' },
  { key: 'preview', label: 'Erstellen', icon: '🚀' },
];

// =====================================================
// AURORA BACKGROUND
// =====================================================
const AuroraBackground: React.FC = () => (
  <div
    className="fixed inset-0 pointer-events-none overflow-hidden z-0"
    style={{ background: 'linear-gradient(135deg, #0F0A1A 0%, #1A1033 40%, #0D1B2A 100%)' }}
  >
    <motion.div
      className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full"
      style={{
        background: 'radial-gradient(circle, rgba(45,212,191,0.15) 0%, transparent 70%)',
        filter: 'blur(60px)',
      }}
      animate={{ scale: [1, 1.2, 1], x: [0, 40, 0], opacity: [0.6, 1, 0.6] }}
      transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full"
      style={{
        background: 'radial-gradient(circle, rgba(169,137,242,0.12) 0%, transparent 70%)',
        filter: 'blur(60px)',
      }}
      animate={{ scale: [1, 1.15, 1], y: [0, -30, 0], opacity: [0.5, 0.9, 0.5] }}
      transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full"
      style={{
        background: 'radial-gradient(circle, rgba(255,107,157,0.08) 0%, transparent 70%)',
        filter: 'blur(60px)',
      }}
      animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
      transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
    />
    {/* Floating particles */}
    {Array.from({ length: 15 }).map((_, i) => (
      <motion.div
        key={i}
        className="absolute text-white/[0.06] select-none"
        style={{
          left: `${5 + ((i * 47) % 90)}%`,
          top: `${10 + ((i * 31) % 80)}%`,
          fontSize: `${8 + (i % 4) * 4}px`,
        }}
        animate={{ y: [0, -15 - (i % 3) * 8, 0], opacity: [0.03, 0.1, 0.03] }}
        transition={{
          duration: 6 + (i % 5) * 2,
          delay: i * 0.4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {['✦', '✧', '⋆', '✵', '·'][i % 5]}
      </motion.div>
    ))}
  </div>
);

// =====================================================
// STEP INDICATOR
// =====================================================
const StepIndicator: React.FC<{ activeStep: number }> = ({ activeStep }) => (
  <div className="flex items-center justify-center gap-2 mb-6">
    {WIZARD_STEPS.map((step, i) => (
      <React.Fragment key={step.key}>
        <div className="flex flex-col items-center gap-1">
          <motion.div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold relative"
            animate={{ scale: i === activeStep ? 1.15 : 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            style={
              i < activeStep
                ? { background: 'rgba(52,211,153,0.8)' }
                : i === activeStep
                  ? {
                      background: `linear-gradient(135deg, ${STEP_COLORS[i]}, ${STEP_COLORS[i]}CC)`,
                      boxShadow: `0 0 20px ${STEP_COLORS[i]}40`,
                    }
                  : {
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }
            }
          >
            {i < activeStep ? (
              <Check className="w-3.5 h-3.5 text-white" />
            ) : (
              <span className="text-sm">{step.icon}</span>
            )}
          </motion.div>
          <span
            className={`text-[10px] font-medium hidden sm:block ${
              i === activeStep ? 'text-white/70' : i < activeStep ? 'text-emerald-400/50' : 'text-white/25'
            }`}
          >
            {step.label}
          </span>
        </div>
        {i < WIZARD_STEPS.length - 1 && (
          <div
            className="w-6 h-0.5 rounded-full -mt-3 sm:-mt-0"
            style={{
              background: i < activeStep ? '#34D399' : 'rgba(255,255,255,0.08)',
            }}
          />
        )}
      </React.Fragment>
    ))}
  </div>
);

// =====================================================
// CREATING ANIMATION
// =====================================================
const CreatingAnimation: React.FC<{ name: string }> = ({ name }) => (
  <div className="relative min-h-screen">
    <AuroraBackground />
    <div className="relative z-10 flex flex-col items-center justify-center min-h-screen space-y-8">
      <motion.div
        animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #2DD4BF, #0EA5E9)',
            boxShadow: '0 8px 40px rgba(45,212,191,0.4)',
          }}
        >
          <Sparkles className="w-12 h-12 text-white" />
        </div>
      </motion.div>

      <div className="text-center">
        <h2
          className="text-2xl font-bold text-white"
          style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}
        >
          Erstelle {name}...
        </h2>
        <p className="text-white/40 mt-2">Dein Avatar wird gerade zum Leben erweckt!</p>
      </div>

      <div className="flex items-center gap-3">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
            className="w-3 h-3 rounded-full"
            style={{
              background: ['#2DD4BF', '#A989F2', '#FF6B9D'][i],
              boxShadow: `0 0 10px ${['rgba(45,212,191,0.5)', 'rgba(169,137,242,0.5)', 'rgba(255,107,157,0.5)'][i]}`,
            }}
          />
        ))}
      </div>
    </div>
  </div>
);

// =====================================================
// MAIN WIZARD
// =====================================================
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

      // Handle character type change - reset skin tone
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

  // Validation per step
  const canProceed = useMemo(() => {
    switch (activeStep) {
      case 0:
        return formData.name.trim().length > 0;
      default:
        return true;
    }
  }, [activeStep, formData.name]);

  const handleNext = () => {
    if (canProceed && activeStep < WIZARD_STEPS.length - 1) {
      setActiveStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep((s) => s - 1);
    }
  };

  // Generate preview image
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

  // Create the avatar
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

  // Show creating animation
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
    <div className="relative min-h-screen pb-8">
      <AuroraBackground />

      <div className="relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-4 pt-4"
        >
          <div className="flex items-center justify-center gap-3 mb-2 relative">
            <motion.button
              whileHover={{ x: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/avatar')}
              className="absolute left-0 p-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-white/50 hover:text-white hover:bg-white/10 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>

            <motion.div
              className="inline-flex items-center gap-3"
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shadow-xl relative"
                style={{
                  background: 'linear-gradient(135deg, #2DD4BF, #0EA5E9)',
                }}
              >
                <Sparkles className="w-5 h-5 text-white" />
                <div
                  className="absolute inset-0 rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, #2DD4BF, #0EA5E9)',
                    filter: 'blur(12px)',
                    opacity: 0.3,
                  }}
                />
              </div>
              <h1
                className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-[#2DD4BF] via-[#A989F2] to-[#FF6B9D] bg-clip-text text-transparent"
                style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}
              >
                Avatar erstellen
              </h1>
            </motion.div>
          </div>
          <p className="text-sm text-white/40 font-medium">
            Schritt {activeStep + 1} von {WIZARD_STEPS.length}
          </p>
        </motion.div>

        {/* Step Indicator */}
        <StepIndicator activeStep={activeStep} />

        {/* Glass Content Container */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative mx-auto max-w-lg px-4"
        >
          {/* Animated gradient border */}
          <div className="absolute -inset-[1px] rounded-[28px] overflow-hidden">
            <motion.div
              className="absolute inset-0"
              style={{
                background: `conic-gradient(from 0deg, ${STEP_COLORS.join(', ')}, ${STEP_COLORS[0]})`,
                opacity: 0.3,
              }}
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
            />
          </div>

          {/* Inner glass container */}
          <div className="relative rounded-[27px] bg-[#13102B]/80 backdrop-blur-2xl p-6 min-h-[420px] shadow-2xl">
            {/* Subtle inner glow */}
            <div className="absolute top-0 left-0 right-0 h-32 rounded-t-[27px] bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, x: 30, filter: 'blur(6px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, x: -30, filter: 'blur(6px)' }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Navigation Buttons */}
        {activeStep < WIZARD_STEPS.length - 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex justify-between items-center mt-6 mx-auto max-w-lg px-5"
          >
            <motion.button
              whileHover={{ x: -3, scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleBack}
              disabled={activeStep === 0}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all ${
                activeStep === 0
                  ? 'text-white/20 cursor-not-allowed'
                  : 'text-white bg-white/10 backdrop-blur-xl border border-white/10 hover:bg-white/15 hover:border-white/20 shadow-lg'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              Zurueck
            </motion.button>

            <motion.button
              whileHover={{ x: 3, scale: 1.04, boxShadow: `0 12px 40px ${STEP_COLORS[activeStep]}50` }}
              whileTap={{ scale: 0.95 }}
              onClick={handleNext}
              disabled={!canProceed}
              className={`flex items-center gap-2 px-8 py-3 rounded-2xl font-bold text-lg transition-all ${
                !canProceed ? 'bg-white/10 text-white/30 cursor-not-allowed' : 'text-white shadow-xl'
              }`}
              style={
                canProceed
                  ? {
                      background: `linear-gradient(135deg, ${STEP_COLORS[activeStep]}, ${STEP_COLORS[(activeStep + 1) % STEP_COLORS.length]})`,
                      boxShadow: `0 8px 30px ${STEP_COLORS[activeStep]}40`,
                    }
                  : undefined
              }
            >
              Weiter
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </motion.div>
        )}

        {/* Back button on last step */}
        {activeStep === WIZARD_STEPS.length - 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex justify-center mt-6 mx-auto max-w-lg px-5"
          >
            <motion.button
              whileHover={{ x: -3, scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleBack}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-white bg-white/10 backdrop-blur-xl border border-white/10 hover:bg-white/15 hover:border-white/20 shadow-lg transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Zurueck bearbeiten
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AvatarWizardScreen;
