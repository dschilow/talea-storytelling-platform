import React, { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useUser } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import AvatarSelectionStep from './steps/AvatarSelectionStep';
import GenreSettingStep from './steps/GenreSettingStep';
import StoryParametersStep from './steps/StoryParametersStep';
import LearningModeStep from './steps/LearningModeStep';
import GenerationStep from './steps/GenerationStep';
import StoryStyleStep, { StorySoulKey, StylePresetKey } from './steps/StoryStyleStep';
import StoryFlavorStep, {
  EmotionalFlavorKey,
  StoryTempoKey,
  SpecialIngredientKey,
} from './steps/StoryFlavorStep';
import { useBackend } from '../../hooks/useBackend';
import { StoryGenerationStep } from '../../components/story/StoryGenerationProgress';
import { useOptionalChildProfiles } from '../../contexts/ChildProfilesContext';
import { generateStoryWithModelFallback } from './storyGenerateWithModelFallback';
import { useTheme } from '../../contexts/ThemeContext';
import { TaleaPageBackground, taleaDisplayFont, taleaPageShellClass } from '@/components/talea/TaleaPastelPrimitives';

type StepType = 'avatar' | 'genre' | 'soul' | 'experience' | 'parameters' | 'learning' | 'generation';

interface StoryConfig {
  avatarIds: string[];
  genre: string;
  setting: string;

  stylePreset?: StylePresetKey;
  allowRhymes: boolean;
  storySoul?: StorySoulKey;
  emotionalFlavors: EmotionalFlavorKey[];
  storyTempo?: StoryTempoKey;
  specialIngredients: SpecialIngredientKey[];
  customPrompt?: string;
  language?: 'de' | 'en';

  aiModel?:
    | 'claude-sonnet-4-6'
    | 'gpt-5.4'
    | 'gpt-5.4-mini'
    | 'gemini-3-flash-preview'
    | 'gemini-3-pro-preview'
    | 'gemini-3.1-pro-preview'
    | 'minimax-m2.7';

  length: 'short' | 'medium' | 'long';
  complexity: 'simple' | 'medium' | 'complex';
  ageGroup: '3-5' | '6-8' | '9-12' | '13+';

  learningMode?: {
    enabled: boolean;
    subjects: string[];
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    learningObjectives: string[];
    assessmentType: 'quiz' | 'interactive' | 'discussion';
  };
  preferences?: {
    useFairyTaleTemplate?: boolean;
  };
}

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

const StoryWizardScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [currentStep, setCurrentStep] = useState<StepType>('avatar');
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<StoryGenerationStep>('profiles');
  const [storyConfig, setStoryConfig] = useState<StoryConfig>({
    avatarIds: [],
    genre: '',
    setting: '',
    stylePreset: undefined,
    allowRhymes: false,
    storySoul: undefined,
    emotionalFlavors: [],
    storyTempo: 'balanced',
    specialIngredients: [],
    customPrompt: '',
    language: i18n.language as 'de' | 'en',
    aiModel: 'gemini-3-flash-preview',
    length: 'medium',
    complexity: 'medium',
    ageGroup: '6-8',
    preferences: {
      useFairyTaleTemplate: false,
    },
  });

  const backend = useBackend();
  const { user } = useUser();
  const activeProfileId = useOptionalChildProfiles()?.activeProfileId;
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // UPDATED: Neue Steps eingefügt
  const steps = [
    { key: 'avatar', title: t('story.wizard.steps.avatar'), icon: 'A' },
    { key: 'genre', title: t('story.wizard.steps.genre'), icon: 'G' },
    { key: 'soul', title: t('story.wizard.steps.soul'), icon: 'S' },
    { key: 'experience', title: t('story.wizard.steps.experience'), icon: 'E' },
    { key: 'parameters', title: t('story.wizard.steps.parameters'), icon: 'P' },
    { key: 'learning', title: t('story.wizard.steps.learning'), icon: 'L' },
    { key: 'generation', title: t('story.wizard.steps.generation'), icon: '!' },
  ] as const;

  const currentStepIndex = steps.findIndex(step => step.key === currentStep);

  const updateStoryConfig = (updates: Partial<StoryConfig>) => {
    setStoryConfig(prev => {
      const next: StoryConfig = { ...prev, ...updates } as StoryConfig;
      if (updates.preferences) {
        next.preferences = {
          ...prev.preferences,
          ...updates.preferences,
        };
      }
      return next;
    });
  };

  const handleGenreChange = (genre: string) => {
    // Normalize to catch Umlauts/underscores/dashes (e.g., "Märchen", "maerchen", "fairy_tales")
    const normalized = genre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[-_\s]/g, '');

    const isFairyTaleGenre =
      normalized.includes('maerchen') ||
      normalized.includes('marchen') ||
      normalized.includes('fairytale') ||
      normalized.includes('fairytales') ||
      normalized.includes('fairy') ||
      normalized.includes('magic');

    updateStoryConfig({
      genre,
      preferences: { useFairyTaleTemplate: isFairyTaleGenre },
    });
  };

  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].key as StepType);
    }
  };

  const goToPreviousStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].key as StepType);
    }
  };

  const goBack = () => {
    window.location.href = '/';
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'avatar':
        return storyConfig.avatarIds.length > 0;
      case 'genre':
        return Boolean(storyConfig.genre && storyConfig.setting);
      case 'soul':
        return Boolean(storyConfig.storySoul);
      case 'experience':
        return Boolean(storyConfig.storyTempo);
      case 'parameters':
        return true;
      case 'learning':
        return true;
      case 'generation':
        return false;
      default:
        return false;
    }
  };

  const handleGenerateStory = async () => {
    if (!user) {
      alert(t('story.wizard.alerts.loginRequired'));
      return;
    }
    if (storyConfig.avatarIds.length === 0) {
      alert(t('story.wizard.alerts.selectAvatar'));
      return;
    }

    try {
      setGenerating(true);
      setGenerationStep('profiles');
      await new Promise(r => setTimeout(r, 1200));
      setGenerationStep('memories');
      await new Promise(r => setTimeout(r, 1200));
      setGenerationStep('text');

      // Story-Experience-Einstellungen werden ueber storyConfig uebergeben.
      const story = await generateStoryWithModelFallback(backend.story.generate, {
        userId: user.id,
        config: storyConfig,
        profileId: activeProfileId || undefined,
      });

      setGenerationStep('validation');
      await new Promise(r => setTimeout(r, 900));
      setGenerationStep('images');
      await new Promise(r => setTimeout(r, 1200));
      setGenerationStep('complete');
      await new Promise(r => setTimeout(r, 800));

      alert(t('story.wizard.alerts.success', { title: story.title }));
      window.location.href = '/';
    } catch (error) {
      console.error('❌ Error generating story:', error);
      const fallback = t('story.wizard.alerts.error');
      const errorMessage = getStoryGenerationErrorMessage(error, fallback);
      alert(errorMessage);
    } finally {
      setGenerating(false);
      setGenerationStep('profiles');
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'avatar':
        return (
          <AvatarSelectionStep
            selectedAvatarIds={storyConfig.avatarIds}
            onSelectionChange={(avatarIds) => updateStoryConfig({ avatarIds })}
          // Optionales Mini-Facelift (falls Step es unterstützt)
          // variant="grid-badges"
          />
        );
      case 'genre':
        return (
          <GenreSettingStep
            genre={storyConfig.genre}
            setting={storyConfig.setting}
            onGenreChange={handleGenreChange}
            onSettingChange={(setting) => updateStoryConfig({ setting })}
          />
        );
      case 'soul':
        return (
          <StoryStyleStep
            storySoul={storyConfig.storySoul}
            stylePreset={storyConfig.stylePreset}
            allowRhymes={storyConfig.allowRhymes}
            onSelectSoul={(storySoul) => updateStoryConfig({ storySoul })}
            onStyleChange={(update) => updateStoryConfig(update)}
          />
        );
      case 'experience':
        return (
          <StoryFlavorStep
            emotionalFlavors={storyConfig.emotionalFlavors}
            storyTempo={storyConfig.storyTempo}
            specialIngredients={storyConfig.specialIngredients}
            customPrompt={storyConfig.customPrompt ?? ''}
            onChange={(update) => updateStoryConfig(update)}
          />
        );
      case 'parameters':
        return (
          <StoryParametersStep
            length={storyConfig.length}
            complexity={storyConfig.complexity}
            ageGroup={storyConfig.ageGroup}
            aiModel={storyConfig.aiModel}
            showAiModelSelection
            onLengthChange={(length) => updateStoryConfig({ length })}
            onComplexityChange={(complexity) => updateStoryConfig({ complexity })}
            onAgeGroupChange={(ageGroup) => updateStoryConfig({ ageGroup })}
            onAiModelChange={(aiModel) => updateStoryConfig({ aiModel })}
          />
        );
      case 'learning':
        return (
          <LearningModeStep
            learningMode={storyConfig.learningMode}
            onLearningModeChange={(learningMode) => updateStoryConfig({ learningMode })}
          />
        );
      case 'generation':
        return (
          <GenerationStep
            storyConfig={storyConfig}
            onGenerate={handleGenerateStory}
            generating={generating}
            generationStep={generationStep}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative min-h-screen pb-20">
      <TaleaPageBackground isDark={isDark} />
      <FadeInView delay={0}>
        <div className={`${taleaPageShellClass} pt-4`}>
          <div className="rounded-[28px] border border-white/75 bg-white/72 p-4 shadow-[0_20px_48px_-30px_rgba(150,122,99,0.42)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/5 dark:shadow-[0_22px_52px_-32px_rgba(2,8,23,0.88)]">
          <div className="flex items-center mb-4">
            <button
              onClick={goBack}
              className="p-2 rounded-full hover:bg-white/70 dark:hover:bg-white/10 transition-colors mr-3"
              disabled={generating}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="text-center flex-1">
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-white" style={{ fontFamily: taleaDisplayFont }}>{t('story.wizard.title')}</h1>
              <p className="text-slate-600 dark:text-slate-300">{t('story.wizard.subtitle')}</p>
            </div>
          </div>
        </div>
        </div>
      </FadeInView>

      <div className={`${taleaPageShellClass} py-6`}>
        <FadeInView delay={100}>
          <Card variant="elevated" className="mb-6">
            <div className="text-center mb-4">
              <h2 className="text-lg font-semibold text-gray-700">
                {t('story.wizard.stepCounter', { current: currentStepIndex + 1, total: steps.length })}
              </h2>
              <p className="text-gray-600">{steps[currentStepIndex].title}</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className="bg-amber-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
              />
            </div>
            <div className="flex justify-between">
              {steps.map((step, index) => (
                <div
                  key={step.key}
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${index <= currentStepIndex
                      ? index === currentStepIndex
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-100 text-amber-600'
                      : 'bg-gray-200 text-gray-400'
                    }`}
                >
                  <span>{step.icon}</span>
                </div>
              ))}
            </div>
          </Card>
        </FadeInView>

        <div className="mb-6">{renderStepContent()}</div>

        <FadeInView delay={300}>
          <div className="flex gap-4">
            {currentStepIndex > 0 && (
              <Button
                title={t('story.wizard.back')}
                onPress={goToPreviousStep}
                variant="outline"
                className="flex-1"
                icon={<ArrowLeft className="w-4 h-4" />}
                disabled={generating}
              />
            )}
            {currentStep !== 'generation' && (
              <Button
                title={t('story.wizard.next')}
                onPress={goToNextStep}
                disabled={!canProceed() || generating}
                className="flex-1"
                icon={<ArrowRight className="w-4 h-4" />}
              />
            )}
          </div>
        </FadeInView>
      </div>
    </div>
  );
};

export default StoryWizardScreen;

