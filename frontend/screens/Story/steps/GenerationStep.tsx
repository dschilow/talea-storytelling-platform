import React from 'react';
import { Sparkles } from 'lucide-react';

import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import FadeInView from '../../../components/animated/FadeInView';

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

interface GenerationStepProps {
  storyConfig: StoryConfig;
  onGenerate: () => void;
}

const GenerationStep: React.FC<GenerationStepProps> = ({
  storyConfig,
  onGenerate,
}) => {
  const getGenreLabel = (genre: string) => {
    const genres: { [key: string]: string } = {
      adventure: 'Abenteuer',
      fantasy: 'Fantasy',
      mystery: 'Geheimnis',
      friendship: 'Freundschaft',
      learning: 'Lernen',
      comedy: 'Komödie',
    };
    return genres[genre] || genre;
  };

  const getSettingLabel = (setting: string) => {
    const settings: { [key: string]: string } = {
      forest: 'Zauberwald',
      castle: 'Schloss',
      ocean: 'Unterwasserwelt',
      space: 'Weltraum',
      city: 'Moderne Stadt',
      village: 'Märchendorf',
    };
    return settings[setting] || setting;
  };

  const getLengthLabel = (length: string) => {
    const lengths: { [key: string]: string } = {
      short: 'Kurz (3-5 Kapitel)',
      medium: 'Mittel (5-8 Kapitel)',
      long: 'Lang (8-12 Kapitel)',
    };
    return lengths[length] || length;
  };

  const getComplexityLabel = (complexity: string) => {
    const complexities: { [key: string]: string } = {
      simple: 'Einfach',
      medium: 'Mittel',
      complex: 'Komplex',
    };
    return complexities[complexity] || complexity;
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <FadeInView delay={100}>
        <Card variant="elevated">
          <h2 className="text-xl font-bold text-gray-800 text-center mb-2">Zusammenfassung</h2>
          <p className="text-gray-600 text-center mb-6">
            Überprüfe deine Einstellungen vor der Generierung
          </p>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">Avatare</h3>
              <p className="text-gray-800">{storyConfig.avatarIds.length} ausgewählt</p>
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
              <h3 className="font-semibold text-gray-700 text-sm mb-1">Länge</h3>
              <p className="text-gray-800">{getLengthLabel(storyConfig.length)}</p>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">Komplexität</h3>
              <p className="text-gray-800">{getComplexityLabel(storyConfig.complexity)}</p>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">Altersgruppe</h3>
              <p className="text-gray-800">{storyConfig.ageGroup} Jahre</p>
            </div>
          </div>

          {storyConfig.learningMode?.enabled && (
            <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
              <h3 className="font-bold text-purple-700 mb-3 text-center">🎓 Lernmodus aktiviert</h3>
              
              {storyConfig.learningMode.subjects.length > 0 && (
                <div className="mb-3">
                  <h4 className="font-semibold text-purple-600 text-sm mb-1">Fächer:</h4>
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
                    <p key={index} className="text-purple-700 text-sm">• {objective}</p>
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
            <h2 className="text-xl font-bold text-gray-800 mb-4">Bereit für die Magie?</h2>
            <p className="text-gray-600 mb-6">
              Deine Geschichte wird mit modernster KI-Technologie erstellt. 
              Dieser Prozess kann einige Minuten dauern, aber das Warten lohnt sich!
            </p>
            
            <div className="space-y-3 text-left">
              <div className="flex items-center">
                <span className="text-lg mr-3">📖</span>
                <span className="text-gray-700">Personalisierte Kapitel mit deinen Avataren</span>
              </div>
              
              <div className="flex items-center">
                <span className="text-lg mr-3">🎨</span>
                <span className="text-gray-700">Wunderschöne Illustrationen für jedes Kapitel</span>
              </div>
              
              <div className="flex items-center">
                <span className="text-lg mr-3">🧠</span>
                <span className="text-gray-700">Intelligente Handlung basierend auf deinen Einstellungen</span>
              </div>
              
              {storyConfig.learningMode?.enabled && (
                <div className="flex items-center">
                  <span className="text-lg mr-3">🎓</span>
                  <span className="text-gray-700">Integrierte Lernelemente für maximalen Bildungswert</span>
                </div>
              )}
            </div>
          </div>
        </Card>
      </FadeInView>
      
      <FadeInView delay={300}>
        <Button
          title="🚀 Geschichte erstellen"
          onPress={onGenerate}
          size="lg"
          className="w-full"
        />
      </FadeInView>
    </div>
  );
};

export default GenerationStep;
