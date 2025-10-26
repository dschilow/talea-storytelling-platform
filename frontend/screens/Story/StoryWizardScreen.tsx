import React, { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useUser } from '@clerk/clerk-react';

import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import FadeInView from '../../components/animated/FadeInView';
import AvatarSelectionStep from './steps/AvatarSelectionStep';
import GenreSettingStep from './steps/GenreSettingStep';
import StoryParametersStep from './steps/StoryParametersStep';
import LearningModeStep from './steps/LearningModeStep';
import GenerationStep from './steps/GenerationStep';
import StoryStyleStep, { StylePresetKey } from './steps/StoryStyleStep';
import StoryFlavorStep, { PlotHookKey, Pacing } from './steps/StoryFlavorStep';
import { useBackend } from '../../hooks/useBackend';
import { StoryGenerationStep } from '../../components/story/StoryGenerationProgress';

type StepType = 'avatar' | 'genre' | 'style' | 'flavor' | 'parameters' | 'learning' | 'generation';

interface StoryConfig {
  avatarIds: string[];
  genre: string;
  setting: string;

  // NEW: Stil & Ton
  stylePreset?: StylePresetKey;
  allowRhymes?: boolean;           // z.B. bei „Grüffelo“-Anmutung
  tone?: 'warm' | 'witty' | 'epic' | 'soothing' | 'mischievous' | 'wonder';
  language?: 'de' | 'en';

  // NEW: Würze & Hooks
  suspenseLevel?: 0 | 1 | 2 | 3;   // 0=sehr ruhig … 3=spannend aber kindgerecht
  humorLevel?: 0 | 1 | 2 | 3;
  pacing?: Pacing;                  // 'slow' | 'balanced' | 'fast'
  pov?: 'ich' | 'personale';
  hooks?: PlotHookKey[];
  hasTwist?: boolean;
  customPrompt?: string;            // optionaler Freitext

  // AI Model selection
  aiModel?: 'gpt-5-nano' | 'gpt-5-mini' | 'gpt-5' | 'gpt-5-pro' | 'gpt-4.1-nano' | 'gpt-4.1-mini' | 'gpt-4.1' | 'o4-mini';

  // Bestehende Parameter
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
}

const StoryWizardScreen: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<StepType>('avatar');
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<StoryGenerationStep>('profiles');
  const [storyConfig, setStoryConfig] = useState<StoryConfig>({
    avatarIds: [],
    genre: '',
    setting: '',
    // Defaults für neue Felder
    stylePreset: undefined,
    allowRhymes: false,
    tone: 'warm',
    language: 'de',
    suspenseLevel: 1,
    humorLevel: 2,
    aiModel: 'gpt-5-mini', // Default model
    pacing: 'balanced',
    pov: 'personale',
    hooks: [],
    hasTwist: false,
    customPrompt: '',

    length: 'medium',
    complexity: 'medium',
    ageGroup: '6-8',
  });

  const backend = useBackend();
  const { user } = useUser();

  // UPDATED: Neue Steps eingefügt
  const steps = [
    { key: 'avatar',      title: 'Avatare',        icon: '👤' },
    { key: 'genre',       title: 'Genre & Welt',   icon: '🌍' },
    { key: 'style',       title: 'Stil & Ton',     icon: '🎨' },
    { key: 'flavor',      title: 'Würze & Hooks',  icon: '🧪' },
    { key: 'parameters',  title: 'Parameter',      icon: '⚙️' },
    { key: 'learning',    title: 'Lernmodus',      icon: '🎓' },
    { key: 'generation',  title: 'Erstellen',      icon: '✨' },
  ] as const;

  const currentStepIndex = steps.findIndex(step => step.key === currentStep);

  const updateStoryConfig = (updates: Partial<StoryConfig>) => {
    setStoryConfig(prev => ({ ...prev, ...updates }));
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
      case 'style':
        return true; // optional
      case 'flavor':
        return true; // alles optional und kindgerecht begrenzt
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
      alert("Bitte melde dich an, um eine Geschichte zu erstellen.");
      return;
    }
    if (storyConfig.avatarIds.length === 0) {
      alert("Bitte wähle mindestens einen Avatar für die Geschichte aus.");
      return;
    }

    try {
      setGenerating(true);

      setGenerationStep('profiles');
      await new Promise(r => setTimeout(r, 1200));
      setGenerationStep('memories');
      await new Promise(r => setTimeout(r, 1200));
      setGenerationStep('text');

      // Wichtig: stylePreset/hook-Infos werden an Backend gegeben.
      const story = await backend.story.generate({
        userId: user.id,
        config: storyConfig,
      });

      setGenerationStep('validation');
      await new Promise(r => setTimeout(r, 900));
      setGenerationStep('images');
      await new Promise(r => setTimeout(r, 1200));
      setGenerationStep('complete');
      await new Promise(r => setTimeout(r, 800));

      alert(`Geschichte "${story.title}" wurde erfolgreich generiert! 🎉`);
      window.location.href = '/';
    } catch (error) {
      console.error('❌ Error generating story:', error);
      let errorMessage = 'Die Geschichte konnte nicht erstellt werden. Bitte versuche es erneut.';
      if (error instanceof Error) {
        if (error.message.includes('length limit exceeded')) {
          errorMessage = 'Die Anfrage ist zu groß. Bitte versuche es erneut.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Die Generierung dauert zu lange. Bitte wähle eine kürzere Geschichte.';
        }
      }
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
            onGenreChange={(genre) => updateStoryConfig({ genre })}
            onSettingChange={(setting) => updateStoryConfig({ setting })}
          />
        );
      case 'style':
        return (
          <StoryStyleStep
            stylePreset={storyConfig.stylePreset}
            allowRhymes={Boolean(storyConfig.allowRhymes)}
            tone={storyConfig.tone ?? 'warm'}
            language={storyConfig.language ?? 'de'}
            onChange={(u) => updateStoryConfig(u)}
          />
        );
      case 'flavor':
        return (
          <StoryFlavorStep
            suspenseLevel={storyConfig.suspenseLevel ?? 1}
            humorLevel={storyConfig.humorLevel ?? 2}
            pacing={storyConfig.pacing ?? 'balanced'}
            pov={storyConfig.pov ?? 'personale'}
            hooks={storyConfig.hooks ?? []}
            hasTwist={Boolean(storyConfig.hasTwist)}
            customPrompt={storyConfig.customPrompt ?? ''}
            onChange={(u) => updateStoryConfig(u)}
          />
        );
      case 'parameters':
        return (
          <StoryParametersStep
            length={storyConfig.length}
            complexity={storyConfig.complexity}
            ageGroup={storyConfig.ageGroup}
            aiModel={storyConfig.aiModel}
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
    <div className="min-h-screen bg-gray-50 pb-20">
      <FadeInView delay={0}>
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center mb-4">
            <button
              onClick={goBack}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors mr-3"
              disabled={generating}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="text-center flex-1">
              <h1 className="text-2xl font-bold text-gray-800">Geschichte erstellen</h1>
              <p className="text-gray-600">Erschaffe eine magische Geschichte mit deinen Avataren</p>
            </div>
          </div>
        </div>
      </FadeInView>

      <div className="px-6 py-6">
        <FadeInView delay={100}>
          <Card variant="elevated" className="mb-6">
            <div className="text-center mb-4">
              <h2 className="text-lg font-semibold text-gray-700">
                Schritt {currentStepIndex + 1} von {steps.length}
              </h2>
              <p className="text-gray-600">{steps[currentStepIndex].title}</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
              />
            </div>
            <div className="flex justify-between">
              {steps.map((step, index) => (
                <div
                  key={step.key}
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    index <= currentStepIndex
                      ? index === currentStepIndex
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-100 text-purple-600'
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
                title="Zurück"
                onPress={goToPreviousStep}
                variant="outline"
                className="flex-1"
                icon={<ArrowLeft className="w-4 h-4" />}
                disabled={generating}
              />
            )}
            {currentStep !== 'generation' && (
              <Button
                title="Weiter"
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
