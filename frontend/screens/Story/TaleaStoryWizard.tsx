// Talea Story Wizard - Immersive, Professional, Child-Friendly
// Redesigned with smooth animations, gradient accents, and clear visual hierarchy

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles, CheckCircle, Wand2, BookOpen, Users, Brain, FileText, Image, Loader2, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useBackend } from '../../hooks/useBackend';
import { useTranslation } from 'react-i18next';
import LevelUpModal from '../../components/gamification/LevelUpModal';
import type { InventoryItem } from '../../types/avatar';

// Import Steps (reuse existing step components)
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

// =====================================================
// GENERATION PROGRESS - Immersive fullscreen view
// =====================================================
const GenerationProgress: React.FC<{ currentStep: GenerationStep }> = ({ currentStep }) => {
  const currentIndex = GENERATION_STEPS.findIndex(s => s.key === currentStep);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center relative">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(169,137,242,0.5), transparent)' }}
          animate={{ scale: [1, 1.3, 1], x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 6, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(255,107,157,0.5), transparent)' }}
          animate={{ scale: [1, 1.2, 1], x: [0, -20, 0], y: [0, 15, 0] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md text-center"
      >
        {/* Central animated icon */}
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          className="w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #A989F2 0%, #FF6B9D 100%)' }}
        >
          <Wand2 className="w-10 h-10 text-white" />
        </motion.div>

        <h2 className="text-2xl font-bold text-foreground mb-2" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
          Deine Geschichte entsteht...
        </h2>
        <p className="text-sm text-muted-foreground mb-10">
          Geschätzte Dauer: 75-90 Sekunden
        </p>

        {/* Step list */}
        <div className="space-y-3 text-left">
          {GENERATION_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentIndex;
            const isComplete = index < currentIndex;
            const isPending = index > currentIndex;

            return (
              <motion.div
                key={step.key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-center gap-4 p-3.5 rounded-2xl transition-all duration-300 ${
                  isActive
                    ? 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg border border-[#A989F2]/30 shadow-lg shadow-[#A989F2]/10'
                    : isComplete
                    ? 'bg-white/40 dark:bg-slate-800/40'
                    : 'opacity-40'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isComplete
                    ? 'bg-emerald-500 text-white'
                    : isActive
                    ? 'bg-gradient-to-br from-[#A989F2] to-[#FF6B9D] text-white'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {isComplete ? (
                    <Check className="w-5 h-5" />
                  ) : isActive ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
                      <Loader2 className="w-5 h-5" />
                    </motion.div>
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isActive ? 'text-foreground' : isComplete ? 'text-foreground/70' : 'text-muted-foreground'}`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                </div>

                <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">
                  {isComplete ? '✓' : isActive ? '...' : step.duration}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-8 w-full h-2 rounded-full bg-muted overflow-hidden">
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

// =====================================================
// STEP INDICATOR - Minimal, elegant progress dots
// =====================================================
const StepIndicator: React.FC<{ activeStep: number; totalSteps: number; labels: string[] }> = ({ activeStep, totalSteps, labels }) => (
  <div className="flex items-center justify-center gap-2 mb-8">
    {Array.from({ length: totalSteps }).map((_, i) => (
      <React.Fragment key={i}>
        <motion.button
          className="relative group"
          whileHover={{ scale: 1.1 }}
        >
          <motion.div
            animate={{
              width: i === activeStep ? 40 : i < activeStep ? 32 : 32,
              height: 32,
            }}
            className={`rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              i < activeStep
                ? 'bg-emerald-500 text-white'
                : i === activeStep
                ? 'bg-gradient-to-br from-[#A989F2] to-[#FF6B9D] text-white shadow-lg shadow-[#A989F2]/25'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {i < activeStep ? <Check className="w-4 h-4" /> : i + 1}
          </motion.div>

          {/* Tooltip label */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted-foreground font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            {labels[i]}
          </div>
        </motion.button>

        {i < totalSteps - 1 && (
          <div className={`w-6 h-0.5 rounded-full transition-colors ${i < activeStep ? 'bg-emerald-500' : 'bg-muted'}`} />
        )}
      </React.Fragment>
    ))}
  </div>
);

// =====================================================
// MAIN WIZARD
// =====================================================
export default function TaleaStoryWizard() {
  const navigate = useNavigate();
  const backend = useBackend();
  const { userId } = useAuth();
  const { t, i18n } = useTranslation();

  const STEPS = [
    t('wizard.steps.avatars'),
    t('wizard.steps.category'),
    t('wizard.steps.ageLength'),
    t('wizard.steps.feeling'),
    t('wizard.steps.wishes'),
    t('wizard.steps.summary'),
  ];

  const [activeStep, setActiveStep] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<GenerationStep>('profiles');
  const [userLanguage, setUserLanguage] = useState<string>('de');
  const [lootArtifact, setLootArtifact] = useState<InventoryItem | null>(null);
  const [showLootModal, setShowLootModal] = useState(false);
  const [pendingStoryId, setPendingStoryId] = useState<string | null>(null);

  useEffect(() => {
    if (i18n.language) setUserLanguage(i18n.language);
  }, [i18n.language]);

  const [state, setState] = useState<WizardState>({
    selectedAvatars: [],
    mainCategory: null,
    subCategory: null,
    ageGroup: null,
    length: null,
    feelings: [],
    rhymes: false,
    moral: false,
    avatarIsHero: true,
    famousCharacters: false,
    happyEnd: true,
    surpriseEnd: false,
    customWish: '',
    aiModel: 'gemini-3-flash-preview',
  });

  const updateState = (updates: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (activeStep < STEPS.length - 1) setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    if (activeStep > 0) setActiveStep(prev => prev - 1);
  };

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
    if (!userId) {
      alert(t('story.wizard.alerts.loginRequired'));
      return;
    }

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
          id: crypto.randomUUID(),
          name: newArtifact.name,
          type: newArtifact.type || 'TOOL',
          level: 1,
          sourceStoryId: story.id,
          description: newArtifact.description,
          visualPrompt: newArtifact.visualDescriptorKeywords?.join(', ') || '',
          tags: newArtifact.visualDescriptorKeywords || [],
          acquiredAt: new Date().toISOString(),
          imageUrl: newArtifact.imageUrl,
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
    if (pendingStoryId) {
      navigate(`/story-reader/${pendingStoryId}`);
      setPendingStoryId(null);
    }
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

  // Generating view
  if (generating) {
    return (
      <div className="relative">
        <GenerationProgress currentStep={generationStep} />
      </div>
    );
  }

  return (
    <div className="relative pb-8">
      {/* Background accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full opacity-15" style={{ background: 'radial-gradient(circle, rgba(169,137,242,0.4), transparent)' }} />
        <div className="absolute -bottom-32 -left-32 w-[300px] h-[300px] rounded-full opacity-15" style={{ background: 'radial-gradient(circle, rgba(255,107,157,0.3), transparent)' }} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-6 pt-2"
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#A989F2] to-[#FF6B9D] flex items-center justify-center shadow-lg shadow-[#A989F2]/20">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
              {t('story.wizard.title')}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('story.wizard.stepCounter', { current: activeStep + 1, total: STEPS.length })}
          </p>
        </motion.div>

        {/* Step indicator */}
        <StepIndicator activeStep={activeStep} totalSteps={STEPS.length} labels={STEPS} />

        {/* Step content with animation */}
        <motion.div
          className="rounded-3xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-xl p-6 md:p-8 min-h-[400px]"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex justify-between items-center mt-6"
        >
          <motion.button
            whileHover={{ x: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleBack}
            disabled={activeStep === 0}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold transition-all ${
              activeStep === 0
                ? 'text-muted-foreground/40 cursor-not-allowed'
                : 'text-foreground bg-white/60 dark:bg-slate-800/60 backdrop-blur-lg border border-white/40 dark:border-white/10 hover:bg-white/80 shadow-sm'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            {t('wizard.buttons.back')}
          </motion.button>

          {activeStep < STEPS.length - 1 ? (
            <motion.button
              whileHover={{ x: 2, scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleNext}
              disabled={!canProceed()}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all ${
                !canProceed()
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'text-white shadow-lg shadow-[#A989F2]/25 hover:shadow-xl hover:shadow-[#A989F2]/35'
              }`}
              style={canProceed() ? { background: 'linear-gradient(135deg, #A989F2 0%, #FF6B9D 100%)' } : undefined}
            >
              {t('wizard.buttons.next')}
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleGenerate}
              className="flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-white shadow-xl shadow-emerald-500/25 hover:shadow-2xl hover:shadow-emerald-500/35 transition-shadow"
              style={{ background: 'linear-gradient(135deg, #34D399 0%, #10B981 100%)' }}
            >
              <Sparkles className="w-5 h-5" />
              {t('wizard.buttons.generate')}
            </motion.button>
          )}
        </motion.div>
      </div>

      <LevelUpModal
        isOpen={showLootModal}
        onClose={handleLootModalClose}
        item={lootArtifact || undefined}
        type="new_item"
      />
    </div>
  );
}

// Helper: Map wizard state to API format (unchanged logic)
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
    genre,
    length: (state.length || 'medium') as 'short' | 'medium' | 'long',
    complexity: 'medium' as 'simple' | 'medium' | 'complex',
    setting: state.mainCategory === 'fairy-tales' ? 'fantasy' : 'varied',
    suspenseLevel: state.feelings.includes('exciting') ? 2 : 1,
    humorLevel: state.feelings.includes('funny') ? 2 : 1,
    tone,
    pacing: (state.feelings.includes('exciting') ? 'fast' : 'balanced') as 'fast' | 'balanced' | 'slow',
    allowRhymes: state.rhymes,
    hasTwist: state.surpriseEnd,
    customPrompt: state.customWish || undefined,
    language: userLanguage as 'de' | 'en' | 'fr' | 'es' | 'it' | 'nl' | 'ru',
    aiModel: state.aiModel,
    preferences: {
      useFairyTaleTemplate: state.mainCategory === 'fairy-tales' || state.mainCategory === 'magic',
    },
  } as any;
}
