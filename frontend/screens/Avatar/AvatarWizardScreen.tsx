"use client";

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle, Sparkles, Star, Heart, Palette, Users, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
  return (
    <AnimatedGroup className="space-y-6">
      <div className="text-center mb-8">
        <TextEffect preset="scale" className="text-3xl font-bold text-gray-800 mb-2">
          ✨ Grundangaben
        </TextEffect>
        <TextEffect preset="fade" delay={200} className="text-gray-600">
          Erzähl uns von deinem Charakter
        </TextEffect>
      </div>

      {inputMode === 'simple' ? (
        // Klickbare Auswahl für Kinder
        <div className="space-y-6">
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-3">Name</label>
            <input
              type="text"
              value={config.name}
              onChange={(e) => updateConfig({ name: e.target.value })}
              placeholder="Wie soll dein Avatar heißen?"
              className="w-full p-4 text-lg rounded-2xl border-2 border-purple-200 focus:border-purple-400 bg-white shadow-sm"
            />
          </div>

          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-3">Typ</label>
            <div className="grid grid-cols-2 gap-3">
              {['👤 Mensch', '🐱 Tier', '🦄 Fantasie-Wesen', '🤖 Roboter', '🌱 Pflanze', '✨ Anderes'].map((type) => (
                <motion.button
                  key={type}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => updateConfig({ type: type.split(' ')[1] })}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    config.type === type.split(' ')[1]
                      ? 'border-purple-400 bg-purple-50 text-purple-700'
                      : 'border-gray-200 bg-white hover:border-purple-200'
                  }`}
                >
                  <div className="text-xl">{type}</div>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-3">Alter</label>
              <select
                value={config.age}
                onChange={(e) => updateConfig({ age: parseInt(e.target.value) })}
                className="w-full p-4 text-lg rounded-2xl border-2 border-purple-200 focus:border-purple-400 bg-white"
              >
                <option value={5}>🍼 Baby</option>
                <option value={10}>🧒 Kind</option>
                <option value={16}>🌟 Jugendlich</option>
                <option value={30}>👨 Erwachsen</option>
                <option value={60}>👴 Alt</option>
              </select>
            </div>

            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-3">Geschlecht</label>
              <select
                value={config.gender}
                onChange={(e) => updateConfig({ gender: e.target.value })}
                className="w-full p-4 text-lg rounded-2xl border-2 border-purple-200 focus:border-purple-400 bg-white"
              >
                <option value="junge">👦 Junge</option>
                <option value="mädchen">👧 Mädchen</option>
                <option value="divers">🌈 Divers</option>
                <option value="nicht-angegeben">❓ Nicht angegeben</option>
              </select>
            </div>
          </div>
        </div>
      ) : (
        // Freier Text für Erwachsene/Kreative
        <div className="space-y-6">
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-3">Beschreibe deinen Avatar</label>
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
              placeholder="z.B. Luna - Ein neugieriges Mädchen, 8 Jahre alt, mit großen grünen Augen und einem verschmitzten Lächeln..."
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
  return (
    <AnimatedGroup className="space-y-6">
      <div className="text-center mb-8">
        <TextEffect preset="scale" className="text-3xl font-bold text-gray-800 mb-2">
          🎨 Aussehen
        </TextEffect>
        <TextEffect preset="fade" delay={200} className="text-gray-600">
          Wie sieht dein Avatar aus?
        </TextEffect>
      </div>

      {inputMode === 'simple' ? (
        <div className="space-y-6">
          {/* Augenfarbe */}
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-3">Augenfarbe</label>
            <div className="flex flex-wrap gap-3">
              {[
                { color: 'blau', bg: 'bg-blue-400', emoji: '💙' },
                { color: 'grün', bg: 'bg-green-400', emoji: '💚' },
                { color: 'braun', bg: 'bg-amber-600', emoji: '🤎' },
                { color: 'grau', bg: 'bg-gray-400', emoji: '🩶' },
                { color: 'bunt', bg: 'bg-gradient-to-r from-purple-400 to-pink-400', emoji: '🌈' }
              ].map((eye) => (
                <motion.button
                  key={eye.color}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => updateConfig({ eyeColor: eye.color })}
                  className={`w-16 h-16 rounded-full border-4 flex items-center justify-center text-xl ${
                    config.eyeColor === eye.color ? 'border-purple-500 shadow-lg' : 'border-white shadow-md'
                  } ${eye.bg}`}
                >
                  {eye.emoji}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Haarfarbe */}
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-3">Haarfarbe</label>
            <div className="flex flex-wrap gap-3">
              {[
                { color: 'blond', bg: 'bg-yellow-300', emoji: '👱' },
                { color: 'braun', bg: 'bg-amber-700', emoji: '👩' },
                { color: 'schwarz', bg: 'bg-gray-900', emoji: '🖤' },
                { color: 'rot', bg: 'bg-red-500', emoji: '🦰' },
                { color: 'glatze', bg: 'bg-pink-200', emoji: '👨‍🦲' }
              ].map((hair) => (
                <motion.button
                  key={hair.color}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => updateConfig({ hairColor: hair.color })}
                  className={`w-16 h-16 rounded-full border-4 flex items-center justify-center text-xl ${
                    config.hairColor === hair.color ? 'border-purple-500 shadow-lg' : 'border-white shadow-md'
                  } ${hair.bg}`}
                >
                  {hair.emoji}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Besonderheiten */}
          <div>
            <label className="block text-lg font-semibold text-gray-700 mb-3">Besonderheiten</label>
            <div className="flex flex-wrap gap-3">
              {['👓 Brille', '🦋 Flügel', '👑 Hörner', '🐾 Schwanz', '✨ Narbe', '🎨 Tattoo'].map((feature) => (
                <motion.button
                  key={feature}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    const featureName = feature.split(' ')[1];
                    const currentFeatures = config.specialFeatures || [];
                    const isSelected = currentFeatures.includes(featureName);
                    updateConfig({
                      specialFeatures: isSelected
                        ? currentFeatures.filter(f => f !== featureName)
                        : [...currentFeatures, featureName]
                    });
                  }}
                  className={`px-4 py-2 rounded-xl border-2 transition-all ${
                    config.specialFeatures?.includes(feature.split(' ')[1])
                      ? 'border-purple-400 bg-purple-50 text-purple-700'
                      : 'border-gray-200 bg-white hover:border-purple-200'
                  }`}
                >
                  {feature}
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <textarea
          placeholder="Beschreibe das Aussehen deines Avatars im Detail..."
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
  return (
    <AnimatedGroup className="space-y-6">
      <div className="text-center mb-8">
        <TextEffect preset="scale" className="text-3xl font-bold text-gray-800 mb-2">
          👗 Stil & Ausdruck
        </TextEffect>
        <TextEffect preset="fade" delay={200} className="text-gray-600">
          Wie kleidet sich dein Avatar?
        </TextEffect>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-3">Kleidungsstil</label>
          <div className="grid grid-cols-2 gap-3">
            {['🏢 Modern', '🏰 Mittelalterlich', '✨ Märchenhaft', '🚀 Zukunft', '⚔️ Rüstung', '🔮 Magisch'].map((style) => (
              <motion.button
                key={style}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => updateConfig({ clothing: style.split(' ')[1] })}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  config.clothing === style.split(' ')[1]
                    ? 'border-purple-400 bg-purple-50 text-purple-700'
                    : 'border-gray-200 bg-white hover:border-purple-200'
                }`}
              >
                <div className="text-xl">{style}</div>
              </motion.button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-3">Stimme</label>
          <div className="flex gap-3">
            {['🎵 Hoch', '🎤 Normal', '🎙️ Tief', '😄 Witzig', '🤫 Geheimnisvoll'].map((voice) => (
              <motion.button
                key={voice}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => updateConfig({ voice: voice.split(' ')[1] })}
                className={`px-4 py-2 rounded-xl border-2 transition-all ${
                  config.voice === voice.split(' ')[1]
                    ? 'border-purple-400 bg-purple-50 text-purple-700'
                    : 'border-gray-200 bg-white hover:border-purple-200'
                }`}
              >
                {voice}
              </motion.button>
            ))}
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
  return (
    <AnimatedGroup className="space-y-6">
      <div className="text-center mb-8">
        <TextEffect preset="scale" className="text-3xl font-bold text-gray-800 mb-2">
          🌍 Herkunft & Geschichte
        </TextEffect>
        <TextEffect preset="fade" delay={200} className="text-gray-600">
          Woher kommt dein Avatar?
        </TextEffect>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-3">Welt</label>
          <div className="grid grid-cols-2 gap-3">
            {['🌲 Wald', '🏙️ Stadt', '🏰 Schloss', '🚀 Zukunft', '🌊 Unterwasser', '🌌 Weltraum'].map((world) => (
              <motion.button
                key={world}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => updateConfig({ world: world.split(' ')[1] })}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  config.world === world.split(' ')[1]
                    ? 'border-purple-400 bg-purple-50 text-purple-700'
                    : 'border-gray-200 bg-white hover:border-purple-200'
                }`}
              >
                <div className="text-xl">{world}</div>
              </motion.button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-3">Hintergrundgeschichte</label>
          <div className="space-y-3">
            {[
              '🏃 Verloren gegangenes Kind',
              '🗺️ Abenteurer auf Reise',
              '🧙 Zauberschüler',
              '🐾 Tier mit besonderem Talent',
              '😊 Einfach "normales" Kind'
            ].map((backstory) => (
              <motion.button
                key={backstory}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => updateConfig({ backstory: backstory.substring(2) })}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  config.backstory === backstory.substring(2)
                    ? 'border-purple-400 bg-purple-50 text-purple-700'
                    : 'border-gray-200 bg-white hover:border-purple-200'
                }`}
              >
                <div className="text-lg">{backstory}</div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </AnimatedGroup>
  );
};

const AvatarWizardScreen: React.FC = () => {
  const navigate = useNavigate();
  const backend = useBackend();
  
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
    { title: 'Modus wählen', component: 'mode' },
    { title: 'Grundangaben', component: 'basic' },
    { title: 'Aussehen', component: 'appearance' },
    { title: 'Stil', component: 'style' },
    { title: 'Herkunft', component: 'background' },
    { title: 'Erstellen', component: 'create' }
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
              🎯 Wie möchtest du deinen Avatar erstellen?
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
                <h3 className="text-2xl font-bold mb-2">Einfach & Spaßig</h3>
                <p className="text-lg opacity-90">
                  Klicke dich durch bunte Optionen. Perfekt für Kinder!
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
                <h3 className="text-2xl font-bold mb-2">Kreativ & Frei</h3>
                <p className="text-lg opacity-90">
                  Beschreibe deinen Avatar mit eigenen Worten. Für Kreative!
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
              🎉 Dein Avatar ist bereit!
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
                  <strong>💡 Info:</strong> Persönlichkeitsmerkmale starten neutral und entwickeln sich durch deine Geschichten!
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
                      Generiere Bild...
                    </>
                  ) : (
                    <>
                      🎨 Bild generieren
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
                {loading ? 'Erstelle Avatar... ✨' : '🚀 Avatar erstellen'}
              </motion.button>
            </div>
          </AnimatedGroup>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-purple-200 p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => currentStep === 0 ? navigate('/avatar') : prevStep()}
            className="p-2 rounded-full hover:bg-purple-100 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-purple-600" />
          </button>

          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800">Avatar Wizard</h1>
            <p className="text-sm text-gray-600">Schritt {currentStep + 1} von {steps.length}</p>
          </div>

          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Progress Bar */}
        <div className="max-w-4xl mx-auto mt-4">
          <div className="flex items-center space-x-2">
            {steps.map((step, index) => (
              <React.Fragment key={index}>
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ 
                    scale: index === currentStep ? 1.2 : index <= currentStep ? 1 : 0.8,
                    backgroundColor: index <= currentStep ? '#8b5cf6' : '#e5e7eb'
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                >
                  {index < currentStep ? <CheckCircle size={16} /> : index + 1}
                </motion.div>
                {index < steps.length - 1 && (
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ 
                      width: '100%',
                      backgroundColor: index < currentStep ? '#8b5cf6' : '#e5e7eb'
                    }}
                    className="flex-1 h-2 rounded-full"
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4 }}
            className="min-h-[60vh]"
          >
            {renderCurrentStep()}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        {currentStep > 0 && steps[currentStep].component !== 'create' && (
          <div className="flex justify-between mt-8">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={prevStep}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-2xl font-semibold hover:bg-gray-300 transition-colors"
            >
              Zurück
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={nextStep}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl font-semibold shadow-lg flex items-center gap-2"
            >
              Weiter <ArrowRight size={16} />
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AvatarWizardScreen;