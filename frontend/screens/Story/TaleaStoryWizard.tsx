// Talea Story Wizard - Magical, Immersive, Professional
// Full-screen enchanted experience with particles, aurora background, and premium glass UI

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles, CheckCircle, Wand2, BookOpen, Users, Brain, FileText, Image, Loader2, Check, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useBackend } from '../../hooks/useBackend';
import { useTranslation } from 'react-i18next';
import LevelUpModal from '../../components/gamification/LevelUpModal';
import type { InventoryItem } from '../../types/avatar';

import Step1AvatarSelection from './wizard-steps/Step1AvatarSelection';
import Step2CategorySelection from './wizard-steps/Step2CategorySelection';
import Step3AgeAndLength from './wizard-steps/Step3AgeAndLength';
import Step4StoryFeeling from './wizard-steps/Step4StoryFeeling';
import Step5SpecialWishes from './wizard-steps/Step5SpecialWishes';
import Step6Summary from './wizard-steps/Step6Summary';

interface WizardState {
  selectedAvatars: string[];
  mainCategory: 'fairy-tales' | 'adventure' | 'magic' | 'animals' | 'scifi' | 'modern' | null;
  subCategory: string | null;
  ageGroup: '3-5' | '6-8' | '9-12' | '13+' | null;
  length: 'short' | 'medium' | 'long' | null;
  feelings: ('funny' | 'warm' | 'exciting' | 'crazy' | 'meaningful')[];
  rhymes: boolean;
  moral: boolean;
  avatarIsHero: boolean;
  famousCharacters: boolean;
  happyEnd: boolean;
  surpriseEnd: boolean;
  customWish: string;
  aiModel: 'gpt-5-nano' | 'gpt-5-mini' | 'gpt-5.2' | 'gemini-3-flash-preview';
}

type GenerationStep = 'profiles' | 'memories' | 'text' | 'validation' | 'images' | 'complete';

const GENERATION_STEPS: { key: GenerationStep; icon: React.ElementType; label: string; description: string; duration: string }[] = [
  { key: 'profiles', icon: Users, label: 'Avatar-Profile', description: 'Lade visuelle Profile und Eigenschaften', duration: '~3s' },
  { key: 'memories', icon: Brain, label: 'Erinnerungen', description: 'Sammle Erlebnisse und Entwicklung', duration: '~3s' },
  { key: 'text', icon: FileText, label: 'Geschichte', description: 'KI schreibt die Geschichte', duration: '~30s' },
  { key: 'validation', icon: CheckCircle, label: 'Validierung', description: 'Prüfe Struktur und Konsistenz', duration: '~3s' },
  { key: 'images', icon: Image, label: 'Bilder', description: 'Erstelle Cover und Illustrationen', duration: '~45s' },
  { key: 'complete', icon: Sparkles, label: 'Fertig', description: 'Speichere und aktualisiere Avatare', duration: '~3s' },
];

/* ═══════════════════════════════════════════════════════
   FLOATING PARTICLES - Magical star field
   ═══════════════════════════════════════════════════════ */
const FloatingParticles: React.FC = () => {
  const particles = useMemo(() =>
    Array.from({ length: 35 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 12 + 8,
      delay: Math.random() * 6,
      opacity: Math.random() * 0.5 + 0.1,
      emoji: ['✦', '✧', '⋆', '✵', '·'][Math.floor(Math.random() * 5)],
    })),
  []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute text-white/30 select-none"
          style={{ left: `${p.x}%`, top: `${p.y}%`, fontSize: `${p.size * 3}px` }}
          animate={{
            y: [0, -40, 0],
            x: [0, Math.sin(p.id) * 15, 0],
            opacity: [p.opacity * 0.5, p.opacity, p.opacity * 0.5],
            scale: [0.8, 1.2, 0.8],
          }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        >
          {p.emoji}
        </motion.div>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   AURORA BACKGROUND - Animated gradient backdrop
   ═══════════════════════════════════════════════════════ */
const AuroraBackground: React.FC = () => (
  <div className="fixed inset-0 pointer-events-none z-0">
    {/* Deep base gradient */}
    <div className="absolute inset-0 bg-gradient-to-br from-[#0F0A1A] via-[#1A1033] to-[#0D1B2A]" />

    {/* Aurora streaks */}
    <motion.div
      className="absolute top-0 left-0 right-0 h-[70vh] opacity-40"
      style={{
        background: 'linear-gradient(135deg, rgba(169,137,242,0.3) 0%, rgba(255,107,157,0.2) 30%, rgba(45,212,191,0.15) 60%, transparent 100%)',
        filter: 'blur(60px)',
      }}
      animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.05, 1] }}
      transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute bottom-0 right-0 w-[70vw] h-[50vh] opacity-30"
      style={{
        background: 'radial-gradient(ellipse at bottom right, rgba(255,155,92,0.25) 0%, rgba(169,137,242,0.15) 40%, transparent 70%)',
        filter: 'blur(50px)',
      }}
      animate={{ opacity: [0.2, 0.4, 0.2] }}
      transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
    />

    {/* Animated orbs */}
    <motion.div
      className="absolute top-[20%] left-[15%] w-40 h-40 rounded-full"
      style={{ background: 'radial-gradient(circle, rgba(169,137,242,0.4), transparent 70%)', filter: 'blur(30px)' }}
      animate={{ x: [0, 50, 0], y: [0, -30, 0], scale: [1, 1.3, 1] }}
      transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute bottom-[25%] right-[20%] w-32 h-32 rounded-full"
      style={{ background: 'radial-gradient(circle, rgba(255,107,157,0.35), transparent 70%)', filter: 'blur(25px)' }}
      animate={{ x: [0, -40, 0], y: [0, 20, 0], scale: [1, 1.2, 1] }}
      transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute top-[50%] left-[50%] w-28 h-28 rounded-full"
      style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.3), transparent 70%)', filter: 'blur(25px)' }}
      animate={{ x: [-20, 30, -20], y: [-10, 20, -10] }}
      transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
    />
  </div>
);

/* ═══════════════════════════════════════════════════════
   STEP INDICATOR - Enchanted journey progress
   ═══════════════════════════════════════════════════════ */
const STEP_ICONS = ['🧸', '📚', '🎯', '🎭', '✨', '🚀'];
const STEP_COLORS = ['#A989F2', '#FF6B9D', '#FF9B5C', '#2DD4BF', '#A989F2', '#34D399'];

const StepIndicator: React.FC<{ activeStep: number; totalSteps: number; labels: string[] }> = ({ activeStep, totalSteps, labels }) => (
  <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8 px-4">
    {Array.from({ length: totalSteps }).map((_, i) => (
      <React.Fragment key={i}>
        <motion.button
          className="relative group"
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.95 }}
        >
          {/* Glow behind active step */}
          {i === activeStep && (
            <motion.div
              className="absolute inset-0 rounded-2xl"
              style={{ background: STEP_COLORS[i], filter: 'blur(12px)', opacity: 0.5 }}
              animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}

          <motion.div
            animate={{ scale: i === activeStep ? 1 : 0.9 }}
            className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-sm font-bold transition-all duration-300 ${
              i < activeStep
                ? 'bg-emerald-500/90 text-white shadow-lg shadow-emerald-500/30'
                : i === activeStep
                ? 'text-white shadow-xl'
                : 'bg-white/10 text-white/40 border border-white/10'
            }`}
            style={i === activeStep ? {
              background: `linear-gradient(135deg, ${STEP_COLORS[i]}, ${STEP_COLORS[(i + 1) % 6]})`,
              boxShadow: `0 8px 32px ${STEP_COLORS[i]}40`,
            } : undefined}
          >
            {i < activeStep ? (
              <Check className="w-4 h-4" />
            ) : (
              <span className="text-base sm:text-lg">{STEP_ICONS[i]}</span>
            )}
          </motion.div>

          {/* Label below on hover */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-white/50 font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {labels[i]}
          </div>
        </motion.button>

        {/* Connector line */}
        {i < totalSteps - 1 && (
          <div className="relative w-6 sm:w-10 h-1 mx-0.5">
            <div className="absolute inset-0 rounded-full bg-white/10" />
            {i < activeStep && (
              <motion.div
                className="absolute inset-0 rounded-full bg-emerald-400/80"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.4 }}
                style={{ transformOrigin: 'left' }}
              />
            )}
            {i === activeStep && (
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ background: `linear-gradient(90deg, ${STEP_COLORS[i]}, transparent)`, transformOrigin: 'left' }}
                animate={{ scaleX: [0, 0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </div>
        )}
      </React.Fragment>
    ))}
  </div>
);

/* ═══════════════════════════════════════════════════════
   GENERATION PROGRESS - Immersive fullscreen magic
   ═══════════════════════════════════════════════════════ */
const GenerationProgress: React.FC<{ currentStep: GenerationStep }> = ({ currentStep }) => {
  const currentIndex = GENERATION_STEPS.findIndex(s => s.key === currentStep);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center relative">
      <FloatingParticles />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md text-center"
      >
        {/* Central animated icon */}
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          className="w-24 h-24 mx-auto mb-8 rounded-3xl flex items-center justify-center shadow-2xl relative"
          style={{ background: 'linear-gradient(135deg, #A989F2 0%, #FF6B9D 100%)' }}
        >
          <Wand2 className="w-12 h-12 text-white" />
          {/* Glow */}
          <div className="absolute inset-0 rounded-3xl" style={{ background: 'linear-gradient(135deg, #A989F2, #FF6B9D)', filter: 'blur(20px)', opacity: 0.5 }} />
        </motion.div>

        <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: '"Fredoka", sans-serif' }}>
          Deine Geschichte entsteht...
        </h2>
        <p className="text-sm text-white/50 mb-10">Geschätzte Dauer: 75-90 Sekunden</p>

        <div className="space-y-3 text-left">
          {GENERATION_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentIndex;
            const isComplete = index < currentIndex;

            return (
              <motion.div
                key={step.key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 ${
                  isActive
                    ? 'bg-white/15 backdrop-blur-xl border border-white/20 shadow-lg shadow-[#A989F2]/10'
                    : isComplete
                    ? 'bg-white/5'
                    : 'opacity-30'
                }`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isComplete ? 'bg-emerald-500 text-white' :
                  isActive ? 'bg-gradient-to-br from-[#A989F2] to-[#FF6B9D] text-white shadow-lg' :
                  'bg-white/10 text-white/40'
                }`}>
                  {isComplete ? <Check className="w-5 h-5" /> :
                   isActive ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}><Loader2 className="w-5 h-5" /></motion.div> :
                   <Icon className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isActive ? 'text-white' : isComplete ? 'text-white/60' : 'text-white/30'}`}>{step.label}</p>
                  <p className="text-xs text-white/40 truncate">{step.description}</p>
                </div>
                <span className="text-[10px] text-white/30 flex-shrink-0">
                  {isComplete ? '✓' : isActive ? '...' : step.duration}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-8 w-full h-2 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #A989F2, #FF6B9D, #FF9B5C)' }}
            animate={{ width: `${((currentIndex + 1) / GENERATION_STEPS.length) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   MAIN WIZARD
   ═══════════════════════════════════════════════════════ */
export default function TaleaStoryWizard() {
  const navigate = useNavigate();
  const backend = useBackend();
  const { userId } = useAuth();
  const { t, i18n } = useTranslation();

  const STEPS = [
    t('wizard.steps.avatars'), t('wizard.steps.category'), t('wizard.steps.ageLength'),
    t('wizard.steps.feeling'), t('wizard.steps.wishes'), t('wizard.steps.summary'),
  ];

  const [activeStep, setActiveStep] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<GenerationStep>('profiles');
  const [userLanguage, setUserLanguage] = useState<string>('de');
  const [lootArtifact, setLootArtifact] = useState<InventoryItem | null>(null);
  const [showLootModal, setShowLootModal] = useState(false);
  const [pendingStoryId, setPendingStoryId] = useState<string | null>(null);

  useEffect(() => { if (i18n.language) setUserLanguage(i18n.language); }, [i18n.language]);

  const [state, setState] = useState<WizardState>({
    selectedAvatars: [], mainCategory: null, subCategory: null, ageGroup: null,
    length: null, feelings: [], rhymes: false, moral: false, avatarIsHero: true,
    famousCharacters: false, happyEnd: true, surpriseEnd: false, customWish: '',
    aiModel: 'gemini-3-flash-preview',
  });

  const updateState = (updates: Partial<WizardState>) => setState(prev => ({ ...prev, ...updates }));
  const handleNext = () => { if (activeStep < STEPS.length - 1) setActiveStep(prev => prev + 1); };
  const handleBack = () => { if (activeStep > 0) setActiveStep(prev => prev - 1); };

  const canProceed = () => {
    switch (activeStep) {
      case 0: return state.selectedAvatars.length > 0;
      case 1: return state.mainCategory !== null;
      case 2: return state.ageGroup !== null && state.length !== null;
      case 3: return state.feelings.length > 0;
      case 4: return true;
      case 5: return true;
      default: return false;
    }
  };

  const handleGenerate = async () => {
    if (!userId) { alert(t('story.wizard.alerts.loginRequired')); return; }
    try {
      setGenerating(true);
      setGenerationStep('profiles');
      await new Promise(r => setTimeout(r, 1200));
      setGenerationStep('memories');
      await new Promise(r => setTimeout(r, 1200));
      setGenerationStep('text');
      const storyConfig = mapWizardStateToAPI(state, userLanguage);
      const story = await backend.story.generate({ userId, config: storyConfig });
      setGenerationStep('validation');
      await new Promise(r => setTimeout(r, 900));
      setGenerationStep('images');
      await new Promise(r => setTimeout(r, 1200));
      setGenerationStep('complete');
      await new Promise(r => setTimeout(r, 800));

      const storyData = story as any;
      const newArtifact = storyData.newArtifact || storyData.metadata?.newArtifact;
      if (newArtifact) {
        const lootItem: InventoryItem = {
          id: crypto.randomUUID(), name: newArtifact.name, type: newArtifact.type || 'TOOL',
          level: 1, sourceStoryId: story.id, description: newArtifact.description,
          visualPrompt: newArtifact.visualDescriptorKeywords?.join(', ') || '',
          tags: newArtifact.visualDescriptorKeywords || [],
          acquiredAt: new Date().toISOString(), imageUrl: newArtifact.imageUrl,
          storyEffect: newArtifact.storyEffect,
        };
        setLootArtifact(lootItem);
        setPendingStoryId(story.id);
        setShowLootModal(true);
      } else {
        navigate(`/story-reader/${story.id}`);
      }
    } catch (error) {
      console.error('[TaleaWizard] Error:', error);
      let errorMessage = t('story.wizard.alerts.error');
      if (error instanceof Error) {
        if (error.message.includes('length limit exceeded')) errorMessage = t('story.wizard.alerts.tooLong');
        else if (error.message.includes('timeout')) errorMessage = t('story.wizard.alerts.timeout');
        else if (error.message.includes('Abo-Limit erreicht')) errorMessage = 'Abo-Limit erreicht. Bitte im Profil dein Abo upgraden.';
      }
      alert(errorMessage);
    } finally {
      setGenerating(false);
      setGenerationStep('profiles');
    }
  };

  const handleLootModalClose = () => {
    setShowLootModal(false);
    setLootArtifact(null);
    if (pendingStoryId) { navigate(`/story-reader/${pendingStoryId}`); setPendingStoryId(null); }
  };

  const renderStep = () => {
    switch (activeStep) {
      case 0: return <Step1AvatarSelection state={state} updateState={updateState} />;
      case 1: return <Step2CategorySelection state={state} updateState={updateState} />;
      case 2: return <Step3AgeAndLength state={state} updateState={updateState} />;
      case 3: return <Step4StoryFeeling state={state} updateState={updateState} />;
      case 4: return <Step5SpecialWishes state={state} updateState={updateState} />;
      case 5: return <Step6Summary state={state} onGenerate={handleGenerate} />;
      default: return null;
    }
  };

  if (generating) {
    return (
      <div className="relative min-h-screen">
        <AuroraBackground />
        <FloatingParticles />
        <GenerationProgress currentStep={generationStep} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-8">
      {/* Magical background */}
      <AuroraBackground />
      <FloatingParticles />

      <div className="relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-6 pt-6"
        >
          <motion.div
            className="inline-flex items-center gap-3 mb-3"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl relative"
              style={{ background: 'linear-gradient(135deg, #A989F2 0%, #FF6B9D 100%)' }}
            >
              <Wand2 className="w-6 h-6 text-white" />
              <div className="absolute inset-0 rounded-2xl" style={{ background: 'linear-gradient(135deg, #A989F2, #FF6B9D)', filter: 'blur(15px)', opacity: 0.4 }} />
            </div>
            <h1
              className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-[#A989F2] via-[#FF6B9D] to-[#FF9B5C] bg-clip-text text-transparent"
              style={{ fontFamily: '"Fredoka", sans-serif' }}
            >
              {t('story.wizard.title')}
            </h1>
          </motion.div>
          <p className="text-sm text-white/50 font-medium">
            {t('story.wizard.stepCounter', { current: activeStep + 1, total: STEPS.length })}
          </p>
        </motion.div>

        {/* Step indicator */}
        <StepIndicator activeStep={activeStep} totalSteps={STEPS.length} labels={STEPS} />

        {/* Glass content container with gradient border */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative mx-auto max-w-4xl"
        >
          {/* Animated gradient border */}
          <div className="absolute -inset-[1px] rounded-[28px] overflow-hidden">
            <motion.div
              className="absolute inset-0"
              style={{
                background: 'conic-gradient(from 0deg, #A989F2, #FF6B9D, #FF9B5C, #2DD4BF, #A989F2)',
                opacity: 0.4,
              }}
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />
          </div>

          {/* Inner glass container */}
          <div className="relative rounded-[27px] bg-[#13102B]/80 backdrop-blur-2xl p-6 md:p-8 min-h-[420px] shadow-2xl">
            {/* Subtle inner glow */}
            <div className="absolute top-0 left-0 right-0 h-40 rounded-t-[27px] bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none" />

            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, x: 30, filter: 'blur(8px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, x: -30, filter: 'blur(8px)' }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Navigation buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex justify-between items-center mt-6 mx-auto max-w-4xl px-1"
        >
          <motion.button
            whileHover={{ x: -3, scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleBack}
            disabled={activeStep === 0}
            className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-semibold transition-all ${
              activeStep === 0
                ? 'text-white/20 cursor-not-allowed'
                : 'text-white bg-white/10 backdrop-blur-xl border border-white/10 hover:bg-white/15 hover:border-white/20 shadow-lg'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            {t('wizard.buttons.back')}
          </motion.button>

          {activeStep < STEPS.length - 1 ? (
            <motion.button
              whileHover={{ x: 3, scale: 1.04, boxShadow: `0 12px 40px ${STEP_COLORS[activeStep]}50` }}
              whileTap={{ scale: 0.95 }}
              onClick={handleNext}
              disabled={!canProceed()}
              className={`flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-lg transition-all ${
                !canProceed() ? 'bg-white/10 text-white/30 cursor-not-allowed' : 'text-white shadow-xl'
              }`}
              style={canProceed() ? {
                background: `linear-gradient(135deg, ${STEP_COLORS[activeStep]}, ${STEP_COLORS[(activeStep + 1) % 6]})`,
                boxShadow: `0 8px 30px ${STEP_COLORS[activeStep]}40`,
              } : undefined}
            >
              {t('wizard.buttons.next')}
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          ) : null}
        </motion.div>
      </div>

      <LevelUpModal isOpen={showLootModal} onClose={handleLootModalClose} item={lootArtifact || undefined} type="new_item" />
    </div>
  );
}

function mapWizardStateToAPI(state: WizardState, userLanguage: string) {
  const genreMap: Record<string, string> = {
    'fairy-tales': 'fairy_tales', 'adventure': 'adventure', 'magic': 'magic',
    'animals': 'animals', 'scifi': 'scifi', 'modern': 'modern',
  };
  let tone: 'warm' | 'witty' | 'epic' | 'soothing' | 'mischievous' | 'wonder' = 'warm';
  if (state.feelings.includes('funny')) tone = 'witty';
  else if (state.feelings.includes('exciting')) tone = 'epic';
  else if (state.feelings.includes('warm')) tone = 'warm';
  else if (state.feelings.includes('crazy')) tone = 'mischievous';
  else if (state.feelings.includes('meaningful')) tone = 'soothing';
  else if (state.mainCategory === 'magic') tone = 'wonder';
  const genre = state.mainCategory ? genreMap[state.mainCategory] || 'adventure' : 'adventure';
  return {
    avatarIds: state.selectedAvatars,
    ageGroup: (state.ageGroup || '6-8') as '3-5' | '6-8' | '9-12' | '13+',
    genre, length: (state.length || 'medium') as 'short' | 'medium' | 'long',
    complexity: 'medium' as 'simple' | 'medium' | 'complex',
    setting: state.mainCategory === 'fairy-tales' ? 'fantasy' : 'varied',
    suspenseLevel: state.feelings.includes('exciting') ? 2 : 1,
    humorLevel: state.feelings.includes('funny') ? 2 : 1,
    tone, pacing: (state.feelings.includes('exciting') ? 'fast' : 'balanced') as 'fast' | 'balanced' | 'slow',
    allowRhymes: state.rhymes, hasTwist: state.surpriseEnd,
    customPrompt: state.customWish || undefined,
    language: userLanguage as 'de' | 'en' | 'fr' | 'es' | 'it' | 'nl' | 'ru',
    aiModel: state.aiModel,
    preferences: { useFairyTaleTemplate: state.mainCategory === 'fairy-tales' || state.mainCategory === 'magic' },
  } as any;
}
