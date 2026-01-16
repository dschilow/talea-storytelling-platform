"use client";

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles, Wand2, Check, Rocket } from 'lucide-react';
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
import { colors } from '../../utils/constants/colors';

const AvatarWizardScreen: React.FC = () => {
  const navigate = useNavigate();
  const backend = useBackend();
  const { t } = useTranslation();

  const [formData, setFormData] = useState<AvatarFormData>(DEFAULT_AVATAR_FORM_DATA);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState<'form' | 'preview' | 'creating'>('form');

  // Handle form changes
  const handleFormChange = useCallback((data: AvatarFormData) => {
    setFormData(data);
  }, []);

  // Generate preview image
  const handleGeneratePreview = async (data: AvatarFormData) => {
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
      });

      setPreviewUrl(result.imageUrl);

      // Show success toast
      import('../../utils/toastUtils').then(({ showSuccessToast }) => {
        showSuccessToast('Avatar-Bild wurde generiert!');
      });

      // Move to preview step
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

      // Initialize visual profile from form data
      let visualProfile = formDataToVisualProfile(formData);

      // If we have an image, analyze it to get accurate visual profile
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
            // Merge form data with analysis (form data takes priority for explicit fields)
            visualProfile = {
              ...analysis.visualProfile,
              // Override with explicit form data
              ageApprox: `${formData.age} years old`,
              gender: formData.gender === 'male' ? 'male' : 'female',
            };
          }
        } catch (err) {
          console.warn('Image analysis failed, using form-based visual profile:', err);
        }
      }

      // Create neutral personality traits (all start at 0)
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

      // Create avatar
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

      // Show success notification
      import('../../utils/toastUtils').then(({ showAvatarCreatedToast, showSuccessToast }) => {
        showAvatarCreatedToast(formData.name);
        showSuccessToast(`Avatar "${formData.name}" wurde erfolgreich erstellt!`);
      });

      // Navigate back
      navigate('/avatar');
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

  // Render based on current step
  const renderStep = () => {
    switch (step) {
      case 'form':
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
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

            {/* Quick actions */}
            {previewUrl && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-4"
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep('preview')}
                  className="flex-1 py-4 px-6 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold shadow-lg flex items-center justify-center gap-2"
                >
                  <ArrowRight className="w-5 h-5" />
                  <span>Weiter zur Vorschau</span>
                </motion.button>
              </motion.div>
            )}
          </motion.div>
        );

      case 'preview':
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Preview Card */}
            <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 rounded-3xl p-8 text-center space-y-6">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                className="relative inline-block"
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={formData.name}
                    className="w-48 h-48 rounded-3xl object-cover shadow-2xl border-4 border-white"
                  />
                ) : (
                  <div className="w-48 h-48 rounded-3xl bg-white/50 border-2 border-dashed border-purple-200 flex items-center justify-center">
                    <span className="text-6xl">🎨</span>
                  </div>
                )}

                {/* Sparkle decorations */}
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 10, -10, 0],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -top-4 -right-4 text-3xl"
                >
                  ✨
                </motion.div>
              </motion.div>

              <div>
                <h2 className="text-3xl font-bold text-gray-800 mb-2">{formData.name}</h2>
                <p className="text-gray-600">
                  {CHARACTER_TYPES.find(t => t.id === formData.characterType)?.labelDe || 'Avatar'}
                  {' · '}
                  {formData.age} Jahre
                  {isHumanCharacter(formData.characterType) && ` · ${formData.height} cm`}
                </p>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 rounded-2xl p-4 text-left">
                <p className="text-sm text-blue-800">
                  <strong>💡 Info:</strong> Die Persönlichkeit deines Avatars startet bei 0 und
                  entwickelt sich durch Abenteuer in Geschichten weiter. Alter und Größe werden
                  für konsistente Darstellung in Bildern gespeichert.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setStep('form')}
                className="flex-1 py-4 px-6 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Zurück bearbeiten</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCreateAvatar}
                disabled={isCreating || !formData.name.trim()}
                className="flex-1 py-4 px-6 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Rocket className="w-5 h-5" />
                <span>Avatar erstellen</span>
              </motion.button>
            </div>

            {/* Regenerate Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleGeneratePreview(formData)}
              disabled={isGeneratingPreview}
              className="w-full py-3 px-6 rounded-xl border-2 border-purple-200 text-purple-600 font-medium hover:bg-purple-50 flex items-center justify-center gap-2"
            >
              {isGeneratingPreview ? (
                <>
                  <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <span>Generiere neues Bild...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>Neues Bild generieren</span>
                </>
              )}
            </motion.button>
          </motion.div>
        );

      case 'creating':
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 space-y-8"
          >
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0],
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-8xl"
            >
              ✨
            </motion.div>

            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-gray-800">
                Erstelle {formData.name}...
              </h2>
              <p className="text-gray-600">
                Dein Avatar wird gerade zum Leben erweckt!
              </p>
            </div>

            <div className="flex items-center gap-2">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: Infinity, delay: 0 }}
                className="w-3 h-3 bg-purple-500 rounded-full"
              />
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: Infinity, delay: 0.1 }}
                className="w-3 h-3 bg-pink-500 rounded-full"
              />
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: Infinity, delay: 0.2 }}
                className="w-3 h-3 bg-blue-500 rounded-full"
              />
            </div>
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen pb-24" style={{ background: colors.background.primary }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 backdrop-blur-xl border-b"
        style={{
          background: colors.glass.background,
          borderColor: colors.glass.border,
        }}
      >
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/avatar')}
            className="p-2 rounded-full hover:bg-purple-50 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </motion.button>

          <div className="flex-1 flex items-center justify-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-500" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Avatar erstellen
            </h1>
          </div>

          <div className="w-10" />
        </div>

        {/* Progress indicator */}
        <div className="h-1 bg-purple-100">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
            initial={{ width: '33%' }}
            animate={{
              width: step === 'form' ? '33%' : step === 'preview' ? '66%' : '100%',
            }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AvatarWizardScreen;
