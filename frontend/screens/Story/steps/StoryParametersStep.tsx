import React from 'react';

import Card from '../../../components/common/Card';
import FadeInView from '../../../components/animated/FadeInView';

interface StoryParametersStepProps {
  length: 'short' | 'medium' | 'long';
  complexity: 'simple' | 'medium' | 'complex';
  ageGroup: '3-5' | '6-8' | '9-12' | '13+';
  onLengthChange: (length: 'short' | 'medium' | 'long') => void;
  onComplexityChange: (complexity: 'simple' | 'medium' | 'complex') => void;
  onAgeGroupChange: (ageGroup: '3-5' | '6-8' | '9-12' | '13+') => void;
}

const StoryParametersStep: React.FC<StoryParametersStepProps> = ({
  length,
  complexity,
  ageGroup,
  onLengthChange,
  onComplexityChange,
  onAgeGroupChange,
}) => {
  const lengthOptions = [
    { key: 'short', label: 'Kurz', icon: '📄', description: '3-5 Kapitel, ~10 Min.' },
    { key: 'medium', label: 'Mittel', icon: '📖', description: '5-8 Kapitel, ~20 Min.' },
    { key: 'long', label: 'Lang', icon: '📚', description: '8-12 Kapitel, ~30 Min.' },
  ];

  const complexityOptions = [
    { key: 'simple', label: 'Einfach', icon: '🌟', description: 'Leichte Sprache, einfache Handlung' },
    { key: 'medium', label: 'Mittel', icon: '⭐', description: 'Ausgewogene Komplexität' },
    { key: 'complex', label: 'Komplex', icon: '🌠', description: 'Vielschichtige Handlung' },
  ];

  const ageGroupOptions = [
    { key: '3-5', label: '3-5 Jahre', icon: '🧸', description: 'Vorschulkinder' },
    { key: '6-8', label: '6-8 Jahre', icon: '🎒', description: 'Grundschulkinder' },
    { key: '9-12', label: '9-12 Jahre', icon: '📝', description: 'Schulkinder' },
    { key: '13+', label: '13+ Jahre', icon: '🎓', description: 'Jugendliche' },
  ];

  const renderParameterSection = (
    title: string,
    subtitle: string,
    options: any[],
    selectedValue: string,
    onSelect: (value: any) => void,
    delay: number
  ) => (
    <FadeInView delay={delay}>
      <Card variant="elevated">
        <h2 className="text-xl font-bold text-gray-800 text-center mb-2">{title}</h2>
        <p className="text-gray-600 text-center mb-6">{subtitle}</p>
        
        <div className="grid grid-cols-3 gap-3">
          {options.map((option, index) => (
            <FadeInView key={option.key} delay={delay + 50 + index * 30}>
              <button
                onClick={() => onSelect(option.key)}
                className={`p-3 rounded-lg border-2 transition-colors text-center ${
                  selectedValue === option.key
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-300 hover:border-purple-300'
                }`}
              >
                <span className="text-xl mb-2 block">{option.icon}</span>
                <h3 className={`font-semibold text-sm mb-1 ${
                  selectedValue === option.key ? 'text-purple-700' : 'text-gray-800'
                }`}>
                  {option.label}
                </h3>
                <p className={`text-xs ${
                  selectedValue === option.key ? 'text-purple-600' : 'text-gray-600'
                }`}>
                  {option.description}
                </p>
              </button>
            </FadeInView>
          ))}
        </div>
      </Card>
    </FadeInView>
  );

  return (
    <div className="space-y-6">
      {renderParameterSection(
        'Geschichtenlänge',
        'Wie lang soll deine Geschichte werden?',
        lengthOptions,
        length,
        onLengthChange,
        100
      )}
      
      {renderParameterSection(
        'Komplexität',
        'Wie komplex soll die Handlung sein?',
        complexityOptions,
        complexity,
        onComplexityChange,
        200
      )}
      
      {renderParameterSection(
        'Altersgruppe',
        'Für welche Altersgruppe ist die Geschichte?',
        ageGroupOptions,
        ageGroup,
        onAgeGroupChange,
        300
      )}
    </div>
  );
};

export default StoryParametersStep;
