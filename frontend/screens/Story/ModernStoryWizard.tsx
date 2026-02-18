// Modern Story Wizard - Kindgerecht & Smart
// 6 Schritte statt 20+ Parameter
// Version 2.0 - November 2025

import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Sparkles, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useBackend } from '../../hooks/useBackend';
import { StoryGenerationProgress, StoryGenerationStep } from '../../components/story/StoryGenerationProgress';
import { useTranslation } from 'react-i18next';
import LevelUpModal from '../../components/gamification/LevelUpModal';
import type { InventoryItem } from '../../types/avatar';

// Import Steps
import Step1AvatarSelection from './wizard-steps/Step1AvatarSelection';
import Step2CategorySelection from './wizard-steps/Step2CategorySelection';
import Step3AgeAndLength from './wizard-steps/Step3AgeAndLength';
import Step4StoryFeeling from './wizard-steps/Step4StoryFeeling';
import Step5SpecialWishes from './wizard-steps/Step5SpecialWishes';
import Step6Summary from './wizard-steps/Step6Summary';

interface WizardState {
  // Step 1: Avatar Selection
  selectedAvatars: string[]; // Avatar IDs

  // Step 2: Category
  mainCategory: 'fairy-tales' | 'adventure' | 'magic' | 'animals' | 'scifi' | 'modern' | null;
  subCategory: string | null;

  // Step 3: Age & Length
  ageGroup: '3-5' | '6-8' | '9-12' | '13+' | null;
  length: 'short' | 'medium' | 'long' | null;

  // Step 4: Feeling
  feelings: ('funny' | 'warm' | 'exciting' | 'crazy' | 'meaningful')[];

  // Step 5: Special Wishes
  rhymes: boolean;
  moral: boolean;
  avatarIsHero: boolean;
  famousCharacters: boolean;
  happyEnd: boolean;
  surpriseEnd: boolean;
  customWish: string;

  // AI Model Selection
  aiModel: 'gpt-5-nano' | 'gpt-5-mini' | 'gpt-5.2' | 'gemini-3-flash-preview';
}



import { showNewCharacterToast } from '../../utils/toastUtils';

function getStoryGenerationErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message?.trim() || '';
  if (!message) {
    return fallback;
  }

  if (message.includes('length limit exceeded')) {
    return 'Die Geschichte ist zu lang. Bitte waehle eine kuerzere Laenge.';
  }
  if (message.includes('timeout')) {
    return 'Die Generierung hat zu lange gedauert. Bitte erneut versuchen.';
  }
  if (message.includes('Abo-Limit erreicht')) {
    return 'Abo-Limit erreicht. Bitte im Profil dein Abo upgraden.';
  }
  if (message.includes('invalid token') || message.includes('unauthenticated')) {
    return 'Deine Sitzung ist abgelaufen. Bitte Seite neu laden und erneut anmelden.';
  }
  if (message.includes('Story generation failed')) {
    return `Story-Generierung fehlgeschlagen:\n${message}`;
  }
  return `${fallback}\n\n${message}`;
}

export default function ModernStoryWizard() {
  const navigate = useNavigate();
  const backend = useBackend();
  const { userId } = useAuth();
  const { t, i18n } = useTranslation();

  // Dynamic step labels based on current language
  const STEPS = [
    t('wizard.steps.avatars'),
    t('wizard.steps.category'),
    t('wizard.steps.ageLength'),
    t('wizard.steps.feeling'),
    t('wizard.steps.wishes'),
    t('wizard.steps.summary')
  ];

  const [activeStep, setActiveStep] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<StoryGenerationStep>('profiles');
  const [userLanguage, setUserLanguage] = useState<string>('de');

  // 🎁 Loot reward state
  const [lootArtifact, setLootArtifact] = useState<InventoryItem | null>(null);
  const [showLootModal, setShowLootModal] = useState(false);
  const [pendingStoryId, setPendingStoryId] = useState<string | null>(null);

  // Sync userLanguage with i18n.language
  useEffect(() => {
    if (i18n.language) {
      setUserLanguage(i18n.language);
    }
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
    aiModel: 'gpt-5-mini'
  });

  const updateState = (updates: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (activeStep < STEPS.length - 1) {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(prev => prev - 1);
    }
  };

  const handleGenerate = async () => {
    if (!userId) {
      alert(t('story.wizard.alerts.loginRequired'));
      return;
    }

    try {
      setGenerating(true);

      // Simulate step progression
      setGenerationStep('profiles');
      await new Promise(r => setTimeout(r, 1200));

      setGenerationStep('memories');
      await new Promise(r => setTimeout(r, 1200));

      setGenerationStep('text');

      // Map wizard state to API request and generate story
      const storyConfig = mapWizardStateToAPI(state, userLanguage);
      console.log('[ModernWizard] Generating story with config:', storyConfig);

      const story = await backend.story.generate({
        userId,
        config: storyConfig,
      });

      console.log('[ModernWizard] Story generated:', story);

      setGenerationStep('validation');
      await new Promise(r => setTimeout(r, 900));

      setGenerationStep('images');
      await new Promise(r => setTimeout(r, 1200));

      setGenerationStep('complete');
      await new Promise(r => setTimeout(r, 800));

      // 🎁 Check for new artifact (loot reward)
      // Can be on top level (from generation response) or in metadata (from DB storage)
      const storyData = story as any;
      const newArtifact = storyData.newArtifact || storyData.metadata?.newArtifact;
      
      if (newArtifact) {
        console.log('[ModernWizard] 🎁 New artifact received:', newArtifact);

        // Convert newArtifact to InventoryItem format
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
        // Navigation happens when modal closes
      } else {
        // No artifact - navigate directly
        navigate(`/story-reader/${story.id}`);
      }

    } catch (error) {
      console.error('[ModernWizard] Error generating story:', error);
      const fallback = t('story.wizard.alerts.error');
      const errorMessage = getStoryGenerationErrorMessage(error, fallback);
      alert(errorMessage);
    } finally {
      setGenerating(false);
      setGenerationStep('profiles');
    }
  };

  const canProceed = () => {
    switch (activeStep) {
      case 0: return state.selectedAvatars.length > 0;
      case 1: return state.mainCategory !== null;
      case 2: return state.ageGroup !== null && state.length !== null;
      case 3: return state.feelings.length > 0;
      case 4: return true; // Optional step
      case 5: return true; // Summary
      default: return false;
    }
  };

  const renderStep = () => {
    switch (activeStep) {
      case 0:
        return <Step1AvatarSelection state={state} updateState={updateState} />;
      case 1:
        return <Step2CategorySelection state={state} updateState={updateState} />;
      case 2:
        return <Step3AgeAndLength state={state} updateState={updateState} />;
      case 3:
        return <Step4StoryFeeling state={state} updateState={updateState} />;
      case 4:
        return <Step5SpecialWishes state={state} updateState={updateState} />;
      case 5:
        return <Step6Summary state={state} onGenerate={handleGenerate} />;
      default:
        return null;
    }
  };

  // 🎁 Handle loot modal close - navigate to story
  const handleLootModalClose = () => {
    setShowLootModal(false);
    setLootArtifact(null);
    if (pendingStoryId) {
      navigate(`/story-reader/${pendingStoryId}`);
      setPendingStoryId(null);
    }
  };

  // Show generation progress when generating
  if (generating) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <Sparkles className="w-16 h-16 mx-auto mb-4 text-amber-600 animate-pulse" />
            <h1 className="text-4xl font-bold text-amber-600 mb-2">
              {t('wizard.loading.title')}
            </h1>
            <p className="text-gray-600">
              {t('wizard.loading.subtitle')}
            </p>
          </div>

          {/* Generation Progress */}
          <StoryGenerationProgress currentStep={generationStep} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-amber-600 mb-2">
            {t('story.wizard.title')}
          </h1>
          <p className="text-gray-600">{t('story.wizard.stepCounter', { current: activeStep + 1, total: STEPS.length })}</p>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((label, index) => (
            <div key={label} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                  ${index < activeStep ? 'bg-green-500 text-white' : ''}
                  ${index === activeStep ? 'bg-amber-600 text-white ring-4 ring-amber-200' : ''}
                  ${index > activeStep ? 'bg-gray-200 text-gray-500' : ''}
                `}>
                  {index < activeStep ? <CheckCircle size={20} /> : index + 1}
                </div>
                <span className={`text-xs mt-2 text-center ${index === activeStep ? 'font-bold text-amber-600' : 'text-gray-500'}`}>
                  {label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`h-1 flex-1 mx-2 rounded ${index < activeStep ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-[400px] mb-8">
          {renderStep()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center pt-6 border-t border-gray-200">
          <button
            onClick={handleBack}
            disabled={activeStep === 0}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all
              ${activeStep === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 active:scale-95'}
            `}
          >
            <ArrowLeft size={20} />
            {t('wizard.buttons.back')}
          </button>

          {activeStep < STEPS.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={`
                flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all
                ${!canProceed()
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-amber-600 text-white hover:bg-amber-700 active:scale-95 shadow-lg'}
              `}
            >
              {t('wizard.buttons.next')}
              <ArrowRight size={20} />
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              className="
                flex items-center gap-3 px-8 py-4 rounded-lg font-bold text-xl
                bg-gradient-to-r from-green-500 to-emerald-600 text-white
                hover:from-green-600 hover:to-emerald-700 active:scale-95
                shadow-2xl transform transition-all duration-200
              "
            >
              <Sparkles size={24} />
              {t('wizard.buttons.generate')}
            </button>
          )}
        </div>
      </div>

      {/* 🎁 Loot Reward Modal */}
      <LevelUpModal
        isOpen={showLootModal}
        onClose={handleLootModalClose}
        item={lootArtifact || undefined}
        type="new_item"
      />
    </div>
  );
}

// Helper: Map wizard state to API request format
function mapWizardStateToAPI(state: WizardState, userLanguage: string) {
  // Convert wizard-friendly format to existing API format
  const ageGroupMap: Record<string, string> = {
    '3-5': '3-5',
    '6-8': '6-8',
    '9-12': '9-12',
    '13+': '13+'
  };

  const lengthMap: Record<string, string> = {
    'short': 'short',
    'medium': 'medium',
    'long': 'long'
  };

  const genreMap: Record<string, string> = {
    'fairy-tales': 'fairy_tales',
    'adventure': 'adventure',
    'magic': 'magic',
    'animals': 'animals',
    'scifi': 'scifi',
    'modern': 'modern'
  };

  // Map feelings to tone (must be one of: warm, witty, epic, soothing, mischievous, wonder)
  let tone: 'warm' | 'witty' | 'epic' | 'soothing' | 'mischievous' | 'wonder' = 'warm';
  if (state.feelings.includes('funny')) tone = 'witty';
  else if (state.feelings.includes('exciting')) tone = 'epic';
  else if (state.feelings.includes('warm')) tone = 'warm';
  else if (state.feelings.includes('crazy')) tone = 'mischievous';
  else if (state.feelings.includes('meaningful')) tone = 'soothing';
  else if (state.mainCategory === 'magic') tone = 'wonder';

  // Calculate genre - ensure we always have a valid value
  const rawGenre = state.mainCategory ? genreMap[state.mainCategory] : null;
  const genre = rawGenre || 'adventure'; // Fallback to adventure if null/undefined

  return {
    avatarIds: state.selectedAvatars,
    ageGroup: (state.ageGroup ? ageGroupMap[state.ageGroup] : '6-8') as '3-5' | '6-8' | '9-12' | '13+',
    genre: genre,
    length: (state.length ? lengthMap[state.length] : 'medium') as 'short' | 'medium' | 'long',
    complexity: 'medium' as 'simple' | 'medium' | 'complex',
    setting: state.mainCategory === 'fairy-tales' ? 'fantasy' : 'varied',
    suspenseLevel: state.feelings.includes('exciting') ? 2 : 1,
    humorLevel: state.feelings.includes('funny') ? 2 : 1,
    tone,
    pacing: (state.feelings.includes('exciting') ? 'fast' : 'balanced') as 'fast' | 'balanced' | 'slow',
    allowRhymes: state.rhymes,
    hasTwist: state.surpriseEnd,
    customPrompt: state.customWish || undefined,
    language: userLanguage as 'de' | 'en' | 'fr' | 'es' | 'it' | 'nl' | 'ru',  // All supported languages
    aiModel: state.aiModel || 'gpt-5-mini',
    preferences: {
      useFairyTaleTemplate: state.mainCategory === 'fairy-tales' || state.mainCategory === 'magic'
    }
  } as any; // Type assertion to bypass strict type checking
}

