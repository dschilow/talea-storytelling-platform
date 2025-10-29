import React from 'react';
import { Sparkles } from 'lucide-react';

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
  const getGenreLabel = (genre: string) => {
    const genres: Record<string, string> = {
      adventure: 'Abenteuer',
      fantasy: 'Fantasy',
      mystery: 'Geheimnis',
      friendship: 'Freundschaft',
      learning: 'Lernen',
      comedy: 'Comedy',
    };
    return genres[genre] || genre;
  };

  const getSettingLabel = (setting: string) => {
    const settings: Record<string, string> = {
      forest: 'Zauberwald',
      castle: 'Schloss',
      ocean: 'Unterwasserwelt',
      space: 'Weltraum',
      city: 'Moderne Stadt',
      village: 'Maerchendorf',
    };
    return settings[setting] || setting;
  };

  const getLengthLabel = (length: string) => {
    const lengths: Record<string, string> = {
      short: 'Kurz (3-5 Kapitel)',
      medium: 'Mittel (5-8 Kapitel)',
      long: 'Lang (8-12 Kapitel)',
    };
    return lengths[length] || length;
  };

  const getComplexityLabel = (complexity: string) => {
    const complexities: Record<string, string> = {
      simple: 'Einfach',
      medium: 'Mittel',
      complex: 'Komplex',
    };
    return complexities[complexity] || complexity;
  };

  const getStyleLabel = (style?: string) => {
    if (!style) return 'Automatisch (Story-Seele)';
    return STYLE_PRESET_OPTIONS.find((option) => option.key === style)?.label || style;
  };

  const getSoulLabel = (soul?: string) => {
    if (!soul) return 'Nicht ausgewaehlt';
    return STORY_SOUL_OPTIONS.find((option) => option.key === soul)?.label || soul;
  };

  const getFlavorLabels = (flavors?: string[]) => {
    if (!flavors || flavors.length === 0) return 'Natuerlich ohne Zusatz';
    return flavors
      .map((key) => EMOTIONAL_FLAVOR_OPTIONS.find((option) => option.key === key)?.label || key)
      .join(', ');
  };

  const getTempoLabel = (tempo?: string) => {
    if (!tempo) return 'Ausgewogen';
    return STORY_TEMPO_OPTIONS.find((option) => option.key === tempo)?.label || tempo;
  };

  const getIngredientLabels = (ingredients?: string[]) => {
    if (!ingredients || ingredients.length === 0) return 'Kein Zusatz';
    return ingredients
      .map((key) => SPECIAL_INGREDIENT_OPTIONS.find((option) => option.key === key)?.label || key)
      .join(', ');
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <FadeInView delay={100}>
        <Card variant="elevated">
          <h2 className="text-xl font-bold text-gray-800 text-center mb-2">Zusammenfassung</h2>
          <p className="text-gray-600 text-center mb-6">
            Ueberpruefe deine Einstellungen vor der Generierung
          </p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">Avatare</h3>
              <p className="text-gray-800">{storyConfig.avatarIds.length} ausgewaehlt</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">Genre</h3>
              <p className="text-gray-800">{getGenreLabel(storyConfig.genre)}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">Schauplatz</h3>
              <p className="text-gray-800">{getSettingLabel(storyConfig.setting)}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">Laenge</h3>
              <p className="text-gray-800">{getLengthLabel(storyConfig.length)}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">Komplexitaet</h3>
              <p className="text-gray-800">{getComplexityLabel(storyConfig.complexity)}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">Altersgruppe</h3>
              <p className="text-gray-800">{storyConfig.ageGroup} Jahre</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">Story-Stil</h3>
              <p className="text-gray-800">
                {getStyleLabel(storyConfig.stylePreset)}
                {storyConfig.allowRhymes ? ' (Reime erlaubt)' : ''}
              </p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">Story-Seele</h3>
              <p className="text-gray-800">{getSoulLabel(storyConfig.storySoul)}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">Emotionale Wuerze</h3>
              <p className="text-gray-800">{getFlavorLabels(storyConfig.emotionalFlavors)}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">Tempo</h3>
              <p className="text-gray-800">{getTempoLabel(storyConfig.storyTempo)}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">Spezialzutaten</h3>
              <p className="text-gray-800">{getIngredientLabels(storyConfig.specialIngredients)}</p>
            </div>
          </div>

          {storyConfig.customPrompt && storyConfig.customPrompt.trim().length > 0 && (
            <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg mb-6">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">Magischer Wunsch</h3>
              <p className="text-gray-800 text-sm whitespace-pre-line">{storyConfig.customPrompt}</p>
            </div>
          )}

          {storyConfig.learningMode?.enabled && (
            <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
              <h3 className="font-bold text-purple-700 mb-3 text-center">Lernmodus aktiviert</h3>

              {storyConfig.learningMode.subjects.length > 0 && (
                <div className="mb-3">
                  <h4 className="font-semibold text-purple-600 text-sm mb-1">Faecher:</h4>
                  <p className="text-purple-700">{storyConfig.learningMode.subjects.join(', ')}</p>
                </div>
              )}

              <div className="mb-3">
                <h4 className="font-semibold text-purple-600 text-sm mb-1">Schwierigkeit:</h4>
                <p className="text-purple-700">{storyConfig.learningMode.difficulty}</p>
              </div>

              {storyConfig.learningMode.learningObjectives.length > 0 && (
                <div>
                  <h4 className="font-semibold text-purple-600 text-sm mb-1">Lernziele:</h4>
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
              {generating ? 'Magie wirkt...' : 'Bereit fuer die Magie?'}
            </h2>
            <p className="text-gray-600 mb-6">
              {generating
                ? 'Deine Geschichte wird gerade erstellt. Das kann einige Minuten dauern...'
                : 'Deine Geschichte wird mit moderner KI-Technologie erstellt. Dieser Prozess braucht etwas Zeit, lohnt sich aber!'}
            </p>

            {!generating && (
              <div className="space-y-3 text-left">
                <div className="flex items-center">
                  <span className="text-lg mr-3">*</span>
                  <span className="text-gray-700">Personalisierte Kapitel mit deinen Avataren</span>
                </div>

                <div className="flex items-center">
                  <span className="text-lg mr-3">*</span>
                  <span className="text-gray-700">Wunderschoene Illustrationen fuer jedes Kapitel</span>
                </div>

                <div className="flex items-center">
                  <span className="text-lg mr-3">*</span>
                  <span className="text-gray-700">Intelligente Handlung basierend auf deinen Einstellungen</span>
                </div>

                {storyConfig.learningMode?.enabled && (
                  <div className="flex items-center">
                    <span className="text-lg mr-3">*</span>
                    <span className="text-gray-700">Integrierte Lernelemente fuer maximalen Bildungswert</span>
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
          title={generating ? 'Geschichte wird erstellt...' : 'Geschichte erstellen'}
          onPress={onGenerate}
          size="lg"
          className="w-full"
          disabled={generating}
          loading={generating}
        />
      </FadeInView>
    </div>
  );
};

export default GenerationStep;
