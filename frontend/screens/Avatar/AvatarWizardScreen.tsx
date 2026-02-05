// Talea Avatar Wizard - Immersive, Professional, Child-Friendly
// Redesigned with Talea design system: gradients, glass-morphism, animations

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles, Wand2, Rocket, RefreshCw, Eye, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { AvatarForm } from '../../components/avatar-form';
import {
  AvatarFormData,
  DEFAULT_AVATAR_FORM_DATA,
  formDataToVisualProfile,
  formDataToDescription,
  CHARACTER_TYPES,
  isHumanCharacter,
} from '../../types/avatarForm';
import { useBackend } from '../../hooks/useBackend';

// =====================================================
// ANIMATED BACKGROUND
// =====================================================
const WizardBackground: React.FC = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
    <motion.div
      className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-20"
      style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.4) 0%, rgba(14,165,233,0.2) 50%, transparent 70%)' }}
      animate={{ scale: [1, 1.15, 1], x: [0, 20, 0] }}
      transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full opacity-20"
      style={{ background: 'radial-gradient(circle, rgba(169,137,242,0.3) 0%, rgba(255,107,157,0.15) 50%, transparent 70%)' }}
      animate={{ scale: [1, 1.2, 1], y: [0, -20, 0] }}
      transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
    />
    {['🎨', '✨', '🧙‍♂️', '🌟', '🦋', '🎭'].map((emoji, i) => (
      <motion.div
        key={i}
        className="absolute text-2xl select-none opacity-10"
        style={{ left: `${10 + i * 15}%`, top: `${20 + (i % 3) * 25}%` }}
        animate={{ y: [0, -20, 0], rotate: [0, 10, -10, 0], opacity: [0.05, 0.12, 0.05] }}
        transition={{ duration: 8 + i * 2, delay: i * 0.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        {emoji}
      </motion.div>
    ))}
  </div>
);

// =====================================================
// STEP INDICATOR - Elegant animated progress
// =====================================================
const StepIndicator: React.FC<{ step: 'form' | 'preview' | 'creating' }> = ({ step }) => {
  const steps = [
    { key: 'form', label: 'Gestalten', icon: '🎨' },
    { key: 'preview', label: 'Vorschau', icon: '👀' },
    { key: 'creating', label: 'Erstellen', icon: '✨' },
  ];
  const currentIndex = steps.findIndex(s => s.key === step);

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          <motion.div
            className="flex items-center gap-2"
            animate={{ scale: i === currentIndex ? 1.05 : 1 }}
          >
            <motion.div
              animate={{
                width: i === currentIndex ? 40 : 32,
                height: 32,
              }}
              className={`rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                i < currentIndex
                  ? 'bg-emerald-500 text-white'
                  : i === currentIndex
                  ? 'bg-gradient-to-br from-[#2DD4BF] to-[#0EA5E9] text-white shadow-lg shadow-[#2DD4BF]/25'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {i < currentIndex ? <Check className="w-4 h-4" /> : s.icon}
            </motion.div>
            <span className={`text-xs font-semibold hidden sm:block ${
              i === currentIndex ? 'text-foreground' : 'text-muted-foreground'
            }`}>
              {s.label}
            </span>
          </motion.div>
          {i < steps.length - 1 && (
            <div className={`w-8 h-0.5 rounded-full transition-colors ${i < currentIndex ? 'bg-emerald-500' : 'bg-muted'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// =====================================================
// MAIN WIZARD
// =====================================================
const AvatarWizardScreen: React.FC = () => {
  const navigate = useNavigate();
  const backend = useBackend();
  const { t } = useTranslation();

  const [formData, setFormData] = useState<AvatarFormData>(DEFAULT_AVATAR_FORM_DATA);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState<'form' | 'preview' | 'creating'>('form');

  const handleFormChange = useCallback((data: AvatarFormData) => {
    setFormData(data);
  }, []);

  // Generate preview image
  const handleGeneratePreview = async (data: AvatarFormData, referenceImageUrl?: string) => {
    try {
      setIsGeneratingPreview(true);
      const description = formDataToDescription(data);
      const characterType = CHARACTER_TYPES.find(t => t.id === data.characterType);

      const result = await backend.ai.generateAvatarImage({
        characterType: data.characterType === 'other' && data.customCharacterType
          ? data.customCharacterType
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
      setStep('preview');
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
      setStep('creating');

      const description = formDataToDescription(formData);
      const characterType = CHARACTER_TYPES.find(t => t.id === formData.characterType);
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
        knowledge: { value: 0 }, creativity: { value: 0 }, vocabulary: { value: 0 },
        courage: { value: 0 }, curiosity: { value: 0 }, teamwork: { value: 0 },
        empathy: { value: 0 }, persistence: { value: 0 }, logic: { value: 0 },
      };

      const createRequest = {
        name: formData.name.trim(),
        description: formData.additionalDescription || description,
        physicalTraits: {
          characterType: formData.characterType === 'other' && formData.customCharacterType
            ? formData.customCharacterType
            : characterType?.labelDe || 'Mensch',
          appearance: description,
        },
        personalityTraits: neutralPersonality,
        imageUrl: previewUrl,
        visualProfile,
        creationType: 'ai-generated' as const,
      };

      const avatar = await (backend.avatar as any).create(createRequest);
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
      setStep('preview');
    } finally {
      setIsCreating(false);
    }
  };

  // ─── Render Steps ──────────────────────────────────

  const renderStep = () => {
    switch (step) {
      case 'form':
        return (
          <motion.div
            key="form"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            <AvatarForm
              initialData={formData}
              onChange={handleFormChange}
              onPreview={handleGeneratePreview}
              previewUrl={previewUrl}
              isGeneratingPreview={isGeneratingPreview}
              mode="create"
            />

            {previewUrl && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep('preview')}
                  className="w-full py-4 px-6 rounded-2xl text-white font-bold shadow-lg shadow-[#2DD4BF]/25 hover:shadow-xl transition-shadow flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #2DD4BF 0%, #0EA5E9 100%)' }}
                >
                  <Eye className="w-5 h-5" />
                  Weiter zur Vorschau
                </motion.button>
              </motion.div>
            )}
          </motion.div>
        );

      case 'preview':
        return (
          <motion.div
            key="preview"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            {/* Preview Card */}
            <div className="relative overflow-hidden rounded-3xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-xl p-8 text-center">
              {/* Decorative gradient */}
              <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#2DD4BF]/10 to-transparent pointer-events-none" />

              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                className="relative inline-block"
              >
                {previewUrl ? (
                  <div className="relative">
                    <img
                      src={previewUrl}
                      alt={formData.name}
                      className="w-48 h-48 rounded-3xl object-cover shadow-2xl border-4 border-white dark:border-slate-800"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute -top-3 -right-3 text-3xl"
                    >
                      ✨
                    </motion.div>
                  </div>
                ) : (
                  <div className="w-48 h-48 rounded-3xl bg-muted/30 border-2 border-dashed border-[#2DD4BF]/30 flex items-center justify-center">
                    <span className="text-6xl">🎨</span>
                  </div>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-6"
              >
                <h2 className="text-3xl font-bold text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
                  {formData.name}
                </h2>
                <p className="text-muted-foreground mt-1">
                  {CHARACTER_TYPES.find(t => t.id === formData.characterType)?.labelDe || 'Avatar'}
                  {' · '}{formData.age} Jahre
                  {isHumanCharacter(formData.characterType) && ` · ${formData.height} cm`}
                </p>
              </motion.div>

              {/* Info Box */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-6 bg-[#2DD4BF]/5 border border-[#2DD4BF]/20 rounded-2xl p-4 text-left"
              >
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">💡 Info:</strong> Die Persönlichkeit deines Avatars startet bei 0 und entwickelt sich durch Abenteuer in Geschichten weiter. Alter und Größe werden für konsistente Darstellung in Bildern gespeichert.
                </p>
              </motion.div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setStep('form')}
                className="flex-1 py-4 px-6 rounded-2xl font-semibold bg-white/60 dark:bg-slate-800/60 backdrop-blur-lg border border-white/40 dark:border-white/10 text-foreground hover:bg-white/80 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <ArrowLeft className="w-5 h-5" />
                Bearbeiten
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCreateAvatar}
                disabled={isCreating || !formData.name.trim()}
                className="flex-1 py-4 px-6 rounded-2xl text-white font-bold shadow-lg shadow-emerald-500/25 hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                style={{ background: 'linear-gradient(135deg, #34D399 0%, #10B981 100%)' }}
              >
                <Rocket className="w-5 h-5" />
                Avatar erstellen
              </motion.button>
            </div>

            {/* Regenerate Button */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => handleGeneratePreview(formData)}
              disabled={isGeneratingPreview}
              className="w-full py-3 px-6 rounded-2xl border border-[#A989F2]/30 text-[#A989F2] font-medium hover:bg-[#A989F2]/5 transition-all flex items-center justify-center gap-2"
            >
              {isGeneratingPreview ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                    <RefreshCw className="w-4 h-4" />
                  </motion.div>
                  Generiere neues Bild...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Neues Bild generieren
                </>
              )}
            </motion.button>
          </motion.div>
        );

      case 'creating':
        return (
          <motion.div
            key="creating"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 space-y-8"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <div
                className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl"
                style={{ background: 'linear-gradient(135deg, #2DD4BF 0%, #0EA5E9 100%)' }}
              >
                <Sparkles className="w-12 h-12 text-white" />
              </div>
            </motion.div>

            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
                Erstelle {formData.name}...
              </h2>
              <p className="text-muted-foreground mt-2">
                Dein Avatar wird gerade zum Leben erweckt!
              </p>
            </div>

            <div className="flex items-center gap-2">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                  className="w-3 h-3 rounded-full"
                  style={{ background: ['#2DD4BF', '#A989F2', '#FF6B9D'][i] }}
                />
              ))}
            </div>
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen relative pb-28">
      <WizardBackground />

      <div className="relative z-10 pt-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-4"
        >
          <div className="flex items-center justify-center gap-3 mb-2 relative">
            <motion.button
              whileHover={{ x: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/avatar')}
              className="absolute left-0 p-2.5 rounded-xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-lg border border-white/40 dark:border-white/10 text-muted-foreground hover:text-foreground transition-colors shadow-sm"
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>

            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2DD4BF] to-[#0EA5E9] flex items-center justify-center shadow-lg shadow-[#2DD4BF]/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
              Avatar erstellen
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Erschaffe deinen einzigartigen Charakter
          </p>
        </motion.div>

        {/* Step indicator */}
        <StepIndicator step={step} />

        {/* Content with glass container */}
        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AvatarWizardScreen;
