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
import { useBackend } from '../../hooks/useBackend';

type StepType = 'avatar' | 'genre' | 'parameters' | 'learning' | 'generation';

interface StoryConfig {
  avatarIds: string[];
  genre: string;
  setting: string;
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
  const [storyConfig, setStoryConfig] = useState<StoryConfig>({
    avatarIds: [],
    genre: '',
    setting: '',
    length: 'medium',
    complexity: 'medium',
    ageGroup: '6-8',
  });
  const backend = useBackend();
  const { user } = useUser();

  const steps = [
    { key: 'avatar', title: 'Avatare', icon: '👤' },
    { key: 'genre', title: 'Genre', icon: '🎭' },
    { key: 'parameters', title: 'Parameter', icon: '⚙️' },
    { key: 'learning', title: 'Lernen', icon: '🎓' },
    { key: 'generation', title: 'Erstellen', icon: '✨' },
  ];

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
        return storyConfig.genre && storyConfig.setting;
      case 'parameters':
        return true; // All parameters have defaults
      case 'learning':
        return true; // Learning mode is optional
      case 'generation':
        return false; // No next step
      default:
        return false;
    }
  };

  const handleGenerateStory = async () => {
    if (!user) {
      alert("Bitte melde dich an, um eine Geschichte zu erstellen.");
      return;
    }

    try {
      setGenerating(true);
      console.log('Starting story generation with config:', storyConfig);
      
      const limitedConfig = {
        ...storyConfig,
        avatarIds: storyConfig.avatarIds.slice(0, 3)
      };
      
      const story = await backend.story.generate({
        userId: user.id,
        config: limitedConfig,
      });

      console.log('Story generated successfully:', story.title);
      alert(`Geschichte "${story.title}" wurde erfolgreich generiert! 🎉`);
      window.location.href = '/';
    } catch (error) {
      console.error('Error generating story:', error);
      
      let errorMessage = 'Die Geschichte konnte nicht erstellt werden. Bitte versuche es erneut.';
      
      if (error instanceof Error) {
        if (error.message.includes('length limit exceeded')) {
          errorMessage = 'Die Anfrage ist zu groß. Bitte wähle weniger Avatare oder kleinere Bilder aus.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Die Generierung dauert zu lange. Bitte versuche es mit einer kürzeren Geschichte.';
        }
      }
      
      alert(errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'avatar':
        return (
          <AvatarSelectionStep
            selectedAvatarIds={storyConfig.avatarIds}
            onSelectionChange={(avatarIds) => updateStoryConfig({ avatarIds })}
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
      case 'parameters':
        return (
          <StoryParametersStep
            length={storyConfig.length}
            complexity={storyConfig.complexity}
            ageGroup={storyConfig.ageGroup}
            onLengthChange={(length) => updateStoryConfig({ length })}
            onComplexityChange={(complexity) => updateStoryConfig({ complexity })}
            onAgeGroupChange={(ageGroup) => updateStoryConfig({ ageGroup })}
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
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
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
              <p className="text-gray-600">
                Erschaffe eine magische Geschichte mit deinen Avataren
              </p>
            </div>
          </div>
        </div>
      </FadeInView>

      <div className="px-6 py-6">
        {/* Progress Bar */}
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

        {/* Step Content */}
        <div className="mb-6">
          {renderStepContent()}
        </div>

        {/* Navigation Buttons */}
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
