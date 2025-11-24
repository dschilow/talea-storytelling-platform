import React from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import FadeInView from '../../../components/animated/FadeInView';
import { StoryGenerationProgress, StoryGenerationStep } from '../../../components/story/StoryGenerationProgress';
import { STORY_SOUL_OPTIONS, STYLE_PRESET_OPTIONS } from './StoryStyleStep';
import {
  EMOTIONAL_FLAVOR_OPTIONS,
  STORY_TEMPO_OPTIONS,
  SPECIAL_INGREDIENT_OPTIONS,
} from './StoryFlavorStep';

interface StoryConfig {
  avatarIds: string[];
  genre: string;
  setting: string;
  stylePreset?: string;
  allowRhymes: boolean;
  storySoul?: string;
  emotionalFlavors?: string[];
  storyTempo?: string;
  specialIngredients?: string[];
  customPrompt?: string;
  language?: 'de' | 'en';
  aiModel?: string;
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

interface GenerationStepProps {
  storyConfig: StoryConfig;
  onGenerate: () => void;
  generating?: boolean;
  generationStep?: StoryGenerationStep;
}

const GenerationStep: React.FC<GenerationStepProps> = ({
  storyConfig,
  onGenerate,
  generating = false,
  generationStep = 'profiles',
}) => {
  const { t } = useTranslation();

  const getGenreLabel = (genre: string) => {
    // Map backend values to translation keys if necessary, or rely on consistent keys
    // For now, assuming genre values might be keys or English strings that need mapping
    const genres: Record<string, string> = {
      'Klassische Märchen': t('story.wizard.genre.options.fairytale'),
      'Märchenwelten und Magie': t('story.wizard.genre.options.magic'),
      adventure: t('story.wizard.genre.options.adventure'),
      fantasy: t('story.wizard.genre.options.fantasy'),
      mystery: t('story.wizard.genre.options.mystery'),
      friendship: t('story.wizard.genre.options.friendship'),
      learning: t('story.wizard.genre.options.learning'),
      comedy: t('story.wizard.genre.options.comedy'),
    };
    return genres[genre] || genre;
  };

  const getSettingLabel = (setting: string) => {
    const settings: Record<string, string> = {
      forest: t('story.wizard.setting.options.forest'),
      castle: t('story.wizard.setting.options.castle'),
      ocean: t('story.wizard.setting.options.ocean'),
      space: t('story.wizard.setting.options.space'),
      city: t('story.wizard.setting.options.city'),
      village: t('story.wizard.setting.options.village'),
    };
    return settings[setting] || setting;
  };

  const getLengthLabel = (length: string) => {
    const lengths: Record<string, string> = {
      short: t('story.wizard.parameters.length.options.short'),
      medium: t('story.wizard.parameters.length.options.medium'),
      long: t('story.wizard.parameters.length.options.long'),
    };
    return lengths[length] || length;
  };

  const getComplexityLabel = (complexity: string) => {
    const complexities: Record<string, string> = {
      simple: t('story.wizard.parameters.complexity.options.simple'),
      medium: t('story.wizard.parameters.complexity.options.medium'),
      complex: t('story.wizard.parameters.complexity.options.complex'),
    };
    return complexities[complexity] || complexity;
  };

  const getStyleLabel = (style?: string) => {
    if (!style) return t('story.wizard.style.auto');
    // Note: STYLE_PRESET_OPTIONS needs to be refactored to use translations as well
    // For now, we might need to rely on the label from the options if they are translated there
    // Or map keys here. Let's assume we'll translate options in StoryStyleStep and export them or use keys.
    // Ideally, we should use keys here and translate them.
    return style;
  };

  const getSoulLabel = (soul?: string) => {
    if (!soul) return t('story.wizard.soul.notSelected');
    return soul;
  };

  const getFlavorLabels = (flavors?: string[]) => {
    if (!flavors || flavors.length === 0) return t('story.wizard.flavor.none');
    return flavors.join(', ');
  };

  const getTempoLabel = (tempo?: string) => {
    if (!tempo) return t('story.wizard.tempo.balanced');
    return tempo;
  };

  const getIngredientLabels = (ingredients?: string[]) => {
    if (!ingredients || ingredients.length === 0) return t('story.wizard.ingredients.none');
    return ingredients.join(', ');
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <FadeInView delay={100}>
        <Card variant="elevated">
          <h2 className="text-xl font-bold text-gray-800 text-center mb-2">{t('story.wizard.summary.title')}</h2>
          <p className="text-gray-600 text-center mb-6">
            {t('story.wizard.summary.subtitle')}
          </p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">{t('story.wizard.summary.avatars')}</h3>
              <p className="text-gray-800">{t('story.wizard.summary.avatarsCount', { count: storyConfig.avatarIds.length })}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">{t('story.wizard.summary.genre')}</h3>
              <p className="text-gray-800">{getGenreLabel(storyConfig.genre)}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">{t('story.wizard.summary.setting')}</h3>
              <p className="text-gray-800">{getSettingLabel(storyConfig.setting)}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">{t('story.wizard.summary.length')}</h3>
              <p className="text-gray-800">{getLengthLabel(storyConfig.length)}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">{t('story.wizard.summary.complexity')}</h3>
              <p className="text-gray-800">{getComplexityLabel(storyConfig.complexity)}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">{t('story.wizard.summary.ageGroup')}</h3>
              <p className="text-gray-800">{storyConfig.ageGroup} {t('story.wizard.summary.years')}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">{t('story.wizard.summary.style')}</h3>
              <p className="text-gray-800">
                {getStyleLabel(storyConfig.stylePreset)}
                {storyConfig.allowRhymes ? ` (${t('story.wizard.summary.rhymesAllowed')})` : ''}
              </p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">{t('story.wizard.summary.soul')}</h3>
              <p className="text-gray-800">{getSoulLabel(storyConfig.storySoul)}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">{t('story.wizard.summary.flavor')}</h3>
              <p className="text-gray-800">{getFlavorLabels(storyConfig.emotionalFlavors)}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">{t('story.wizard.summary.tempo')}</h3>
              <p className="text-gray-800">{getTempoLabel(storyConfig.storyTempo)}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">{t('story.wizard.summary.ingredients')}</h3>
              <p className="text-gray-800">{getIngredientLabels(storyConfig.specialIngredients)}</p>
            </div>
          </div>

          {storyConfig.customPrompt && storyConfig.customPrompt.trim().length > 0 && (
            <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg mb-6">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">{t('story.wizard.summary.customPrompt')}</h3>
              <p className="text-gray-800 text-sm whitespace-pre-line">{storyConfig.customPrompt}</p>
            </div>
          )}

          {storyConfig.learningMode?.enabled && (
            <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
              <h3 className="font-bold text-purple-700 mb-3 text-center">{t('story.wizard.summary.learningModeActive')}</h3>

              {storyConfig.learningMode.subjects.length > 0 && (
                <div className="mb-3">
                  <h4 className="font-semibold text-purple-600 text-sm mb-1">{t('story.wizard.summary.subjects')}:</h4>
                  <p className="text-purple-700">{storyConfig.learningMode.subjects.join(', ')}</p>
                </div>
              )}

              <div className="mb-3">
                <h4 className="font-semibold text-purple-600 text-sm mb-1">{t('story.wizard.summary.difficulty')}:</h4>
                <p className="text-purple-700">{storyConfig.learningMode.difficulty}</p>
              </div>

              {storyConfig.learningMode.learningObjectives.length > 0 && (
                <div>
                  <h4 className="font-semibold text-purple-600 text-sm mb-1">{t('story.wizard.summary.objectives')}:</h4>
                  {storyConfig.learningMode.learningObjectives.map((objective, index) => (
                    <p key={index} className="text-purple-700 text-sm">- {objective}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      </FadeInView>

      {/* Generation Info */}
      <FadeInView delay={200}>
        <Card variant="elevated">
          <div className="text-center">
            <Sparkles className="w-16 h-16 mx-auto mb-4 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              {generating ? t('story.wizard.generation.generatingTitle') : t('story.wizard.generation.readyTitle')}
            </h2>
            <p className="text-gray-600 mb-6">
              {generating
                ? t('story.wizard.generation.generatingDesc')
                : t('story.wizard.generation.readyDesc')}
            </p>

            {!generating && (
              <div className="space-y-3 text-left">
                <div className="flex items-center">
                  <span className="text-lg mr-3">*</span>
                  <span className="text-gray-700">{t('story.wizard.generation.feature1')}</span>
                </div>

                <div className="flex items-center">
                  <span className="text-lg mr-3">*</span>
                  <span className="text-gray-700">{t('story.wizard.generation.feature2')}</span>
                </div>

                <div className="flex items-center">
                  <span className="text-lg mr-3">*</span>
                  <span className="text-gray-700">{t('story.wizard.generation.feature3')}</span>
                </div>

                {storyConfig.learningMode?.enabled && (
                  <div className="flex items-center">
                    <span className="text-lg mr-3">*</span>
                    <span className="text-gray-700">{t('story.wizard.generation.featureLearning')}</span>
                  </div>
                )}
              </div>
            )}

            {generating && (
              <div className="mt-6">
                <StoryGenerationProgress currentStep={generationStep} />
              </div>
            )}
          </div>
        </Card>
      </FadeInView>

      <FadeInView delay={300}>
        <Button
          title={generating ? t('story.wizard.generation.buttonGenerating') : t('story.wizard.generation.buttonCreate')}
          onPress={onGenerate}
          size="lg"
          className="w-full"
          disabled={generating}
        />
      </FadeInView>
    </div>
  );
};

export default GenerationStep;
