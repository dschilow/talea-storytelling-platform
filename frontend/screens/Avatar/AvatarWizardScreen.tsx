"use client";

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle, Sparkles, Star, Heart, Palette, Users, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useBackend } from '../../hooks/useBackend';
import { colors, gradients } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows } from '../../utils/constants/spacing';

// Animated Components (based on Motion Primitives)
const AnimatedGroup = ({ children, className = "", delay = 0 }: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.4, delay: delay / 1000 }}
    className={className}
  >
    {children}
  </motion.div>
);

const TextEffect = ({
  children,
  className = "",
  preset = "fade",
  delay = 0
}: {
  children: string;
  className?: string;
  preset?: 'fade' | 'slide' | 'scale';
  delay?: number;
}) => {
  const variants = {
    fade: {
      hidden: { opacity: 0 },
      visible: { opacity: 1 }
    },
    slide: {
      hidden: { opacity: 0, x: -20 },
      visible: { opacity: 1, x: 0 }
    },
    scale: {
      hidden: { opacity: 0, scale: 0.8 },
      visible: { opacity: 1, scale: 1 }
    }
  };

  return (
    <motion.div
      variants={variants[preset]}
      initial="hidden"
      animate="visible"
      transition={{ duration: 0.6, delay: delay / 1000 }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// Avatar Configuration Types
interface BasicInfo {
  name: string;
  type: string;
  age: number;
  gender: string;
  size: string;
  build: string;
}

interface Appearance {
  eyeColor: string;
  hairColor: string;
  skinColor: string;
  specialFeatures: string[];
}

interface Style {
  clothing: string;
  accessories: string[];
  voice: string;
  expression: string;
}

interface Background {
  world: string;
  backstory: string;
}

interface AvatarConfig {
  basicInfo: BasicInfo;
  appearance: Appearance;
  style: Style;
  background: Background;
  inputMode: 'simple' | 'advanced';
}

// Step Components
const StepBasicInfo = ({
  config,
  updateConfig,
  inputMode
}: {
  config: BasicInfo;
  updateConfig: (updates: Partial<BasicInfo>) => void;
  inputMode: 'simple' | 'advanced';
}) => {
  const { t } = useTranslation();

  return (
    <AnimatedGroup className="space-y-6">
      <div className="text-center mb-8">
        <TextEffect preset="scale" className="text-3xl font-bold text-gray-800 mb-2">
          {`✨ ${t('avatar.wizard.basic.title')}`}
        </TextEffect>
        <TextEffect preset="fade" delay={200} className="text-gray-600">
          {t('avatar.wizard.basic.subtitle')}
        </TextEffect>
      </div>

      {inputMode === 'simple' ? (
        // Klickbare Auswahl für Kinder
        <div className="space-y-6">
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-3">{t('avatar.wizard.basic.name')}</label>
            <input
              type="text"
              value={config.name}
              onChange={(e) => updateConfig({ name: e.target.value })}
              placeholder={t('avatar.wizard.basic.namePlaceholder')}
              className="w-full p-4 text-lg rounded-2xl border-2 border-purple-200 focus:border-purple-400 bg-white shadow-sm"
            />
          </div>

          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-3">{t('avatar.wizard.basic.type')}</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'human', label: `👤 ${t('avatar.wizard.options.types.human')}` },
                { key: 'animal', label: `🐱 ${t('avatar.wizard.options.types.animal')}` },
                { key: 'fantasy', label: `🦄 ${t('avatar.wizard.options.types.fantasy')}` },
                { key: 'robot', label: `🤖 ${t('avatar.wizard.options.types.robot')}` },
                { key: 'plant', label: `🌱 ${t('avatar.wizard.options.types.plant')}` },
                { key: 'other', label: `✨ ${t('avatar.wizard.options.types.other')}` }
              ].map((type) => (
                <motion.button
                  key={type.key}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => updateConfig({ type: type.label.split(' ')[1] })}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${config.type === type.label.split(' ')[1]
                      ? 'border-purple-400 bg-purple-50 text-purple-700'
                      : 'border-gray-200 bg-white hover:border-purple-200'
                    }`}
                >
                  <div className="text-xl">{type.label}</div>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-3">{t('avatar.wizard.basic.age')}</label>
              <select
                value={config.age}
                onChange={(e) => updateConfig({ age: parseInt(e.target.value) })}
                className="w-full p-4 text-lg rounded-2xl border-2 border-purple-200 focus:border-purple-400 bg-white"
              >
                <option value={5}>🍼 {t('avatar.wizard.options.ages.baby')}</option>
                <option value={10}>🧒 {t('avatar.wizard.options.ages.child')}</option>
                <option value={16}>🌟 {t('avatar.wizard.options.ages.teen')}</option>
                <option value={30}>👨 {t('avatar.wizard.options.ages.adult')}</option>
                <option value={60}>👴 {t('avatar.wizard.options.ages.old')}</option>
              </select>
            </div>

            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-3">{t('avatar.wizard.basic.gender')}</label>
              <select
                value={config.gender}
                onChange={(e) => updateConfig({ gender: e.target.value })}
                className="w-full p-4 text-lg rounded-2xl border-2 border-purple-200 focus:border-purple-400 bg-white"
              >
                <option value="junge">👦 {t('avatar.wizard.options.genders.boy')}</option>
                <option value="mädchen">👧 {t('avatar.wizard.options.genders.girl')}</option>
                <option value="divers">🌈 {t('avatar.wizard.options.genders.diverse')}</option>
                <option value="nicht-angegeben">❓ {t('avatar.wizard.options.genders.none')}</option>
              </select>
            </div>
          </div>
        </div>
      ) : (
        // Freier Text für Erwachsene/Kreative
        <div className="space-y-6">
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-3">{t('avatar.wizard.basic.description')}</label>
            <textarea
              value={`${config.name} - ${config.type}, ${config.age} Jahre alt`}
              onChange={(e) => {
                // Einfache Parsing-Logik für Freitext
                const text = e.target.value;
                const parts = text.split(' - ');
                if (parts.length >= 2) {
                  updateConfig({
                    name: parts[0],
                    type: parts[1].split(',')[0] || config.type
                  });
                }
              }}
              placeholder={t('avatar.wizard.basic.descriptionPlaceholder')}
              rows={4}
              className="w-full p-4 text-lg rounded-2xl border-2 border-purple-200 focus:border-purple-400 bg-white resize-none"
            />
          </div>
        </div>
      )}
    </AnimatedGroup>
  );
};

const StepAppearance = ({
  config,
  updateConfig,
  inputMode
}: {
  config: Appearance;
  updateConfig: (updates: Partial<Appearance>) => void;
  inputMode: 'simple' | 'advanced';
}) => {
  const { t } = useTranslation();

  return (
    <AnimatedGroup className="space-y-6">
      <div className="text-center mb-8">
        <TextEffect preset="scale" className="text-3xl font-bold text-gray-800 mb-2">
          {`🎨 ${t('avatar.wizard.appearance.title')}`}
        </TextEffect>
        <TextEffect preset="fade" delay={200} className="text-gray-600">
          {t('avatar.wizard.appearance.subtitle')}
        </TextEffect>
      </div>

      {inputMode === 'simple' ? (
        <div className="space-y-6">
          {/* Augenfarbe */}
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-3">{t('avatar.wizard.appearance.eyeColor')}</label>
            <div className="flex flex-wrap gap-3">
              {[
                { color: 'blau', key: 'blue', bg: 'bg-blue-400', emoji: '💙' },
                { color: 'grün', key: 'green', bg: 'bg-green-400', emoji: '💚' },
                { color: 'braun', key: 'brown', bg: 'bg-amber-600', emoji: '🤎' },
                { color: 'grau', key: 'gray', bg: 'bg-gray-400', emoji: '🩶' },
                { color: 'bunt', key: 'colorful', bg: 'bg-gradient-to-r from-purple-400 to-pink-400', emoji: '🌈' }
              ].map((eye) => (
                <motion.button
                  key={eye.color}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => updateConfig({ eyeColor: t(`avatar.wizard.options.eyes.${eye.key}`) })}
                  className={`w-16 h-16 rounded-full border-4 flex items-center justify-center text-xl ${config.eyeColor === t(`avatar.wizard.options.eyes.${eye.key}`) ? 'border-purple-500 shadow-lg' : 'border-white shadow-md'
                    } ${eye.bg}`}
                >
                  {eye.emoji}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Haarfarbe */}
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-3">{t('avatar.wizard.appearance.hairColor')}</label>
            <div className="flex flex-wrap gap-3">
              {[
                { color: 'blond', key: 'blonde', bg: 'bg-yellow-300', emoji: '👱' },
                { color: 'braun', key: 'brown', bg: 'bg-amber-700', emoji: '👩' },
                { color: 'schwarz', key: 'black', bg: 'bg-gray-900', emoji: '🖤' },
                { color: 'rot', key: 'red', bg: 'bg-red-500', emoji: '🦰' },
                { color: 'glatze', key: 'bald', bg: 'bg-pink-200', emoji: '👨‍🦲' }
              ].map((hair) => (
                <motion.button
                  key={hair.color}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => updateConfig({ hairColor: t(`avatar.wizard.options.hair.${hair.key}`) })}
                  className={`w-16 h-16 rounded-full border-4 flex items-center justify-center text-xl ${config.hairColor === t(`avatar.wizard.options.hair.${hair.key}`) ? 'border-purple-500 shadow-lg' : 'border-white shadow-md'
                    } ${hair.bg}`}
                >
                  {hair.emoji}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Besonderheiten */}
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-3">{t('avatar.wizard.appearance.specialFeatures')}</label>
            <div className="flex flex-wrap gap-3">
              {[
                { key: 'glasses', icon: '👓' },
                { key: 'wings', icon: '🦋' },
                { key: 'horns', icon: '👑' },
                { key: 'tail', icon: '🐾' },
                { key: 'scar', icon: '✨' },
                { key: 'tattoo', icon: '🎨' }
              ].map((feature) => {
                const label = `${feature.icon} ${t(`avatar.wizard.options.features.${feature.key}`)}`;
                return (
                  <motion.button
                    key={feature.key}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      const featureName = t(`avatar.wizard.options.features.${feature.key}`);
                      const currentFeatures = config.specialFeatures || [];
                      const isSelected = currentFeatures.includes(featureName);
                      updateConfig({
                        specialFeatures: isSelected
                          ? currentFeatures.filter(f => f !== featureName)
                          : [...currentFeatures, featureName]
                      });
                    }}
                    className={`px-4 py-2 rounded-xl border-2 transition-all ${config.specialFeatures?.includes(t(`avatar.wizard.options.features.${feature.key}`))
                        ? 'border-purple-400 bg-purple-50 text-purple-700'
                        : 'border-gray-200 bg-white hover:border-purple-200'
                      }`}
                  >
                    {label}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <textarea
          placeholder={t('avatar.wizard.appearance.descriptionPlaceholder')}
          rows={6}
          className="w-full p-4 text-lg rounded-2xl border-2 border-purple-200 focus:border-purple-400 bg-white resize-none"
        />
      )}
    </AnimatedGroup>
  );
};

const StepStyle = ({
  config,
  updateConfig
}: {
  config: Style;
  updateConfig: (updates: Partial<Style>) => void;
}) => {
  const { t } = useTranslation();

  return (
    <AnimatedGroup className="space-y-6">
      <div className="text-center mb-8">
        <TextEffect preset="scale" className="text-3xl font-bold text-gray-800 mb-2">
          {`👗 ${t('avatar.wizard.style.title')}`}
        </TextEffect>
        <TextEffect preset="fade" delay={200} className="text-gray-600">
          {t('avatar.wizard.style.subtitle')}
        </TextEffect>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-3">{t('avatar.wizard.style.clothing')}</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'modern', icon: '🏢' },
              { key: 'medieval', icon: '🏰' },
              { key: 'fairytale', icon: '✨' },
              { key: 'future', icon: '🚀' },
              { key: 'armor', icon: '⚔️' },
              { key: 'magic', icon: '🔮' }
            ].map((style) => {
              const label = `${style.icon} ${t(`avatar.wizard.options.clothing.${style.key}`)}`;
              return (
                <motion.button
                  key={style.key}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => updateConfig({ clothing: t(`avatar.wizard.options.clothing.${style.key}`) })}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${config.clothing === t(`avatar.wizard.options.clothing.${style.key}`)
                      ? 'border-purple-400 bg-purple-50 text-purple-700'
                      : 'border-gray-200 bg-white hover:border-purple-200'
                    }`}
                >
                  <div className="text-xl">{label}</div>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-3">{t('avatar.wizard.style.voice')}</label>
          <div className="flex gap-3">
            {[
              { key: 'high', icon: '🎵' },
              { key: 'normal', icon: '🎤' },
              { key: 'deep', icon: '🎙️' },
              { key: 'funny', icon: '😄' },
              { key: 'mysterious', icon: '🤫' }
            ].map((voice) => {
              const label = `${voice.icon} ${t(`avatar.wizard.options.voice.${voice.key}`)}`;
              return (
                <motion.button
                  key={voice.key}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => updateConfig({ voice: t(`avatar.wizard.options.voice.${voice.key}`) })}
                  className={`px-4 py-2 rounded-xl border-2 transition-all ${config.voice === t(`avatar.wizard.options.voice.${voice.key}`)
                      ? 'border-purple-400 bg-purple-50 text-purple-700'
                      : 'border-gray-200 bg-white hover:border-purple-200'
                    }`}
                >
                  {label}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </AnimatedGroup>
  );
};

const StepBackground = ({
  config,
  updateConfig
}: {
  config: Background;
  updateConfig: (updates: Partial<Background>) => void;
}) => {
  const { t } = useTranslation();

  return (
    <AnimatedGroup className="space-y-6">
      <div className="text-center mb-8">
        <TextEffect preset="scale" className="text-3xl font-bold text-gray-800 mb-2">
          {`🌍 ${t('avatar.wizard.background.title')}`}
        </TextEffect>
        <TextEffect preset="fade" delay={200} className="text-gray-600">
          {t('avatar.wizard.background.subtitle')}
        </TextEffect>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-3">{t('avatar.wizard.background.world')}</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'forest', icon: '🌲' },
              { key: 'city', icon: '🏙️' },
              { key: 'castle', icon: '🏰' },
              { key: 'future', icon: '🚀' },
              { key: 'underwater', icon: '🌊' },
              { key: 'space', icon: '🌌' }
            ].map((world) => {
              const label = `${world.icon} ${t(`avatar.wizard.options.world.${world.key}`)}`;
              return (
                <motion.button
                  key={world.key}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => updateConfig({ world: t(`avatar.wizard.options.world.${world.key}`) })}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${config.world === t(`avatar.wizard.options.world.${world.key}`)
                      ? 'border-purple-400 bg-purple-50 text-purple-700'
                      : 'border-gray-200 bg-white hover:border-purple-200'
                    }`}
                >
                  <div className="text-xl">{label}</div>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-3">{t('avatar.wizard.background.backstory')}</label>
          <div className="space-y-3">
            {[
              { key: 'lost', icon: '🏃' },
              { key: 'adventurer', icon: '🗺️' },
              { key: 'wizard', icon: '🧙' },
              { key: 'talent', icon: '🐾' },
              { key: 'normal', icon: '😊' }
            ].map((backstory) => {
              const label = `${backstory.icon} ${t(`avatar.wizard.options.backstory.${backstory.key}`)}`;
              return (
                <motion.button
                  key={backstory.key}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => updateConfig({ backstory: t(`avatar.wizard.options.backstory.${backstory.key}`) })}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${config.backstory === t(`avatar.wizard.options.backstory.${backstory.key}`)
                      ? 'border-purple-400 bg-purple-50 text-purple-700'
                      : 'border-gray-200 bg-white hover:border-purple-200'
                    }`}
                >
                  <div className="text-lg">{label}</div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </AnimatedGroup>
  );
};

const AvatarWizardScreen: React.FC = () => {
  const navigate = useNavigate();
  const backend = useBackend();
  const { t } = useTranslation();

  const [currentStep, setCurrentStep] = useState(0);
  const [inputMode, setInputMode] = useState<'simple' | 'advanced'>('simple');
  const [loading, setLoading] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);

  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>({
    basicInfo: {
      name: '',
      type: '',
      age: 10,
      gender: '',
      size: 'mittel',
      build: 'normal'
    },
    appearance: {
      eyeColor: '',
      hairColor: '',
      skinColor: 'hell',
      specialFeatures: []
    },
    style: {
      clothing: '',
      accessories: [],
      voice: '',
      expression: ''
    },
    background: {
      world: '',
      backstory: ''
    },
    inputMode
  });

  const steps = [
    { title: t('avatar.wizard.steps.mode'), component: 'mode' },
    { title: t('avatar.wizard.steps.basic'), component: 'basic' },
    { title: t('avatar.wizard.steps.appearance'), component: 'appearance' },
    { title: t('avatar.wizard.steps.style'), component: 'style' },
    { title: t('avatar.wizard.steps.background'), component: 'background' },
    { title: t('avatar.wizard.steps.create'), component: 'create' }
  ];

  const updateBasicInfo = useCallback((updates: Partial<BasicInfo>) => {
    setAvatarConfig(prev => ({
      ...prev,
      basicInfo: { ...prev.basicInfo, ...updates }
    }));
  }, []);

  const updateAppearance = useCallback((updates: Partial<Appearance>) => {
    setAvatarConfig(prev => ({
      ...prev,
      appearance: { ...prev.appearance, ...updates }
    }));
  }, []);

  const updateStyle = useCallback((updates: Partial<Style>) => {
    setAvatarConfig(prev => ({
      ...prev,
      style: { ...prev.style, ...updates }
    }));
  }, []);

  const updateBackground = useCallback((updates: Partial<Background>) => {
    setAvatarConfig(prev => ({
      ...prev,
      background: { ...prev.background, ...updates }
    }));
  }, []);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const generateAvatar = async () => {
    setLoading(true);
    try {
      // Hier wird der Avatar mit neutralen Persönlichkeitswerten erstellt (matching backend schema)
      const neutralPersonality = {
        knowledge: { value: 0, description: 'Wissensakkumulation in verschiedenen Bereichen' },
        creativity: { value: 0, description: 'Kreative Problemlösung und Fantasie' },
        vocabulary: { value: 0, description: 'Sprachlicher Ausdruck und Kommunikation' },
        courage: { value: 0, description: 'Bereitschaft Risiken einzugehen' },
        curiosity: { value: 0, description: 'Wissensdurst und Entdeckergeist' },
        teamwork: { value: 0, description: 'Zusammenarbeit und Kooperation' },
        empathy: { value: 0, description: 'Mitgefühl und Verständnis für andere' },
        persistence: { value: 0, description: 'Durchhaltevermögen und Beharrlichkeit' },
        logic: { value: 0, description: 'Analytisches Denken und Schlussfolgerung' },
      };

      // Generiere Avatar-Beschreibung aus den Einstellungen
      const safeValues = {
        name: avatarConfig.basicInfo.name || 'Unbekannt',
        type: avatarConfig.basicInfo.type || 'Charakter',
        world: avatarConfig.background.world || 'einer unbekannten Welt',
        backstory: avatarConfig.background.backstory || 'Hat eine geheimnisvolle Vergangenheit',
        eyeColor: avatarConfig.appearance.eyeColor || 'braune',
        hairColor: avatarConfig.appearance.hairColor || 'dunkle'
      };

      const description = `${safeValues.name} ist ein ${safeValues.type} aus ${safeValues.world}. ${safeValues.backstory}. Hat ${safeValues.eyeColor} Augen und ${safeValues.hairColor} Haare.`;

      const physicalTraits = {
        characterType: safeValues.type,
        appearance: description
      };

      // Create avatar using backend API
      const createAvatarRequest = {
        name: safeValues.name,
        description,
        physicalTraits,
        personalityTraits: neutralPersonality,
        imageUrl: generatedImageUrl || undefined,
        visualProfile: undefined,
        creationType: 'ai-generated' as const,
      };

      console.log('Creating avatar via backend API...', createAvatarRequest);
      const avatar = await (backend.avatar as any).create(createAvatarRequest);
      console.log('Avatar created successfully:', avatar);

      // Initialize personality data for this avatar in localStorage (for local tracking)
      const personalityKey = `avatar_personality_${avatar.id}`;
      const initialPersonality = {
        traits: [
          { trait: 'Mut', value: 50, history: [] },
          { trait: 'Kreativität', value: 50, history: [] },
          { trait: 'Empathie', value: 50, history: [] },
          { trait: 'Intelligenz', value: 50, history: [] },
          { trait: 'Sozialität', value: 50, history: [] },
          { trait: 'Energie', value: 50, history: [] },
        ],
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(personalityKey, JSON.stringify(initialPersonality));

      // Show success toast notification
      import('../../utils/toastUtils').then(({ showAvatarCreatedToast, showSuccessToast }) => {
        showAvatarCreatedToast(safeValues.name);
        showSuccessToast(`Avatar bereit! Persönlichkeitsmerkmale entwickeln sich durch Geschichten.`);
      });

      navigate('/avatar');
    } catch (error) {
      console.error('Error creating avatar:', error);
      alert('Avatar konnte nicht erstellt werden. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    try {
      setGeneratingImage(true);

      // Create neutral personality traits for image generation
      const neutralPersonality = {
        courage: 5,
        intelligence: 5,
        creativity: 5,
        empathy: 5,
        strength: 5,
        humor: 5,
        adventure: 5,
        patience: 5,
        curiosity: 5,
        leadership: 5,
      };

      // Generate Avatar-Beschreibung aus den Einstellungen
      const appearance = `${avatarConfig.basicInfo.type} mit ${avatarConfig.appearance.eyeColor} Augen und ${avatarConfig.appearance.hairColor} Haaren. ${avatarConfig.appearance.specialFeatures.join(', ')}`;

      const result = await backend.ai.generateAvatarImage({
        characterType: avatarConfig.basicInfo.type,
        appearance,
        personalityTraits: neutralPersonality,
        style: 'disney',
      });

      setGeneratedImageUrl(result.imageUrl);

      // Show success notification
      import('../../utils/toastUtils').then(({ showSuccessToast }) => {
        showSuccessToast('🎨 Avatar-Bild wurde erfolgreich generiert!');
      });

    } catch (error) {
      console.error('Error generating avatar image:', error);
      import('../../utils/toastUtils').then(({ showErrorToast }) => {
        showErrorToast('Fehler beim Generieren des Avatar-Bildes. Bitte versuche es erneut.');
      });
    } finally {
      setGeneratingImage(false);
    }
  };

  const renderCurrentStep = () => {
    switch (steps[currentStep].component) {
      case 'mode':
        return (
          <AnimatedGroup className="text-center space-y-8">
            <TextEffect preset="scale" className="text-3xl font-bold text-gray-800 mb-4">
              {`🎯 ${t('avatar.wizard.mode.title')}`}
            </TextEffect>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <motion.button
                whileHover={{ scale: 1.02, y: -5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setInputMode('simple');
                  nextStep();
                }}
                className="p-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-3xl text-white text-left shadow-2xl"
              >
                <div className="text-6xl mb-4">🎮</div>
                <h3 className="text-2xl font-bold mb-2">{t('avatar.wizard.mode.simple.title')}</h3>
                <p className="text-lg opacity-90">
                  {t('avatar.wizard.mode.simple.description')}
                </p>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02, y: -5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setInputMode('advanced');
                  nextStep();
                }}
                className="p-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl text-white text-left shadow-2xl"
              >
                <div className="text-6xl mb-4">✍️</div>
                <h3 className="text-2xl font-bold mb-2">{t('avatar.wizard.mode.advanced.title')}</h3>
                <p className="text-lg opacity-90">
                  {t('avatar.wizard.mode.advanced.description')}
                </p>
              </motion.button>
            </div>
          </AnimatedGroup>
        );

      case 'basic':
        return <StepBasicInfo config={avatarConfig.basicInfo} updateConfig={updateBasicInfo} inputMode={inputMode} />;

      case 'appearance':
        return <StepAppearance config={avatarConfig.appearance} updateConfig={updateAppearance} inputMode={inputMode} />;

      case 'style':
        return <StepStyle config={avatarConfig.style} updateConfig={updateStyle} />;

      case 'background':
        return <StepBackground config={avatarConfig.background} updateConfig={updateBackground} />;

      case 'create':
        return (
          <AnimatedGroup className="text-center space-y-8">
            <TextEffect preset="scale" className="text-3xl font-bold text-gray-800 mb-4">
              {`🎉 ${t('avatar.wizard.create.title')}`}
            </TextEffect>

            <div className="bg-gradient-to-br from-yellow-100 to-orange-100 rounded-3xl p-8 max-w-md mx-auto">
              <div className="w-32 h-32 bg-white rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg">
                {generatedImageUrl ? (
                  <img src={generatedImageUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <div className="text-4xl">✨</div>
                )}
              </div>

              <h3 className="text-2xl font-bold text-gray-800 mb-2">{avatarConfig.basicInfo.name}</h3>
              <p className="text-gray-600 mb-4">{avatarConfig.basicInfo.type} aus {avatarConfig.background.world}</p>

              <div className="bg-blue-50 rounded-2xl p-4 mb-6">
                <p className="text-sm text-blue-800">
                  <strong>💡 Info:</strong> {t('avatar.wizard.create.info')}
                </p>
              </div>

              <div className="flex flex-col gap-3 mb-6">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleGenerateImage}
                  disabled={generatingImage || !avatarConfig.basicInfo.name || !avatarConfig.basicInfo.type}
                  className="bg-gradient-to-r from-pink-400 to-purple-400 text-white px-6 py-3 rounded-2xl text-base font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {generatingImage ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      {t('avatar.wizard.create.generatingImage')}
                    </>
                  ) : (
                    <>
                      🎨 {t('avatar.wizard.create.generateImage')}
                    </>
                  )}
                </motion.button>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={generateAvatar}
                disabled={loading}
                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-4 rounded-2xl text-lg font-bold shadow-lg disabled:opacity-50"
              >
                {loading ? `${t('avatar.wizard.create.creatingAvatar')} ✨` : `🚀 ${t('avatar.wizard.create.createAvatar')}`}
              </motion.button>
            </div>
          </AnimatedGroup>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 pb-20">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-purple-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/avatar')}
            className="p-2 rounded-full hover:bg-purple-50 transition-colors text-gray-600"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-500" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Avatar Wizard
            </h1>
          </div>

          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-purple-100">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {renderCurrentStep()}
        </AnimatePresence>
      </div>

      {/* Navigation Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-purple-100 p-6 z-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${currentStep === 0
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            <ArrowLeft className="w-5 h-5" />
            {t('common.back')}
          </button>

          <div className="flex gap-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2.5 h-2.5 rounded-full transition-all ${index === currentStep
                    ? 'bg-purple-500 scale-125'
                    : index < currentStep
                      ? 'bg-purple-200'
                      : 'bg-gray-200'
                  }`}
              />
            ))}
          </div>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={nextStep}
              className="flex items-center gap-2 px-8 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              {t('common.next')}
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-24" /> // Spacer
          )}
        </div>
      </div>
    </div>
  );
};

export default AvatarWizardScreen;