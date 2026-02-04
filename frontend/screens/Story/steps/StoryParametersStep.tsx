import React from 'react';
import { useTranslation } from 'react-i18next';

import Card from '../../../components/common/Card';
import FadeInView from '../../../components/animated/FadeInView';

type AIModel = 'gpt-5-nano' | 'gpt-5-mini' | 'gpt-5.2' | 'gemini-3-flash-preview';

interface StoryParametersStepProps {
  length: 'short' | 'medium' | 'long';
  complexity: 'simple' | 'medium' | 'complex';
  ageGroup: '3-5' | '6-8' | '9-12' | '13+';
  aiModel?: AIModel;
  onLengthChange: (length: 'short' | 'medium' | 'long') => void;
  onComplexityChange: (complexity: 'simple' | 'medium' | 'complex') => void;
  onAgeGroupChange: (ageGroup: '3-5' | '6-8' | '9-12' | '13+') => void;
  onAiModelChange: (aiModel: AIModel) => void;
}

const StoryParametersStep: React.FC<StoryParametersStepProps> = ({
  length,
  complexity,
  ageGroup,
  aiModel,
  onLengthChange,
  onComplexityChange,
  onAgeGroupChange,
  onAiModelChange,
}) => {
  const { t } = useTranslation();

  const lengthOptions = [
    {
      key: 'short',
      label: t('story.wizard.parameters.length.options.short'),
      icon: '📄',
      description: t('story.wizard.parameters.length.options.shortDesc')
    },
    {
      key: 'medium',
      label: t('story.wizard.parameters.length.options.medium'),
      icon: '📖',
      description: t('story.wizard.parameters.length.options.mediumDesc')
    },
    {
      key: 'long',
      label: t('story.wizard.parameters.length.options.long'),
      icon: '📚',
      description: t('story.wizard.parameters.length.options.longDesc')
    },
  ];

  const complexityOptions = [
    {
      key: 'simple',
      label: t('story.wizard.parameters.complexity.options.simple'),
      icon: '🌟',
      description: t('story.wizard.parameters.complexity.options.simpleDesc')
    },
    {
      key: 'medium',
      label: t('story.wizard.parameters.complexity.options.medium'),
      icon: '⭐',
      description: t('story.wizard.parameters.complexity.options.mediumDesc')
    },
    {
      key: 'complex',
      label: t('story.wizard.parameters.complexity.options.complex'),
      icon: '🌠',
      description: t('story.wizard.parameters.complexity.options.complexDesc')
    },
  ];

  const ageGroupOptions = [
    {
      key: '3-5',
      label: t('story.wizard.parameters.ageGroup.options.3-5'),
      icon: '🧸',
      description: t('story.wizard.parameters.ageGroup.options.3-5Desc')
    },
    {
      key: '6-8',
      label: t('story.wizard.parameters.ageGroup.options.6-8'),
      icon: '🎒',
      description: t('story.wizard.parameters.ageGroup.options.6-8Desc')
    },
    {
      key: '9-12',
      label: t('story.wizard.parameters.ageGroup.options.9-12'),
      icon: '📝',
      description: t('story.wizard.parameters.ageGroup.options.9-12Desc')
    },
    {
      key: '13+',
      label: t('story.wizard.parameters.ageGroup.options.13+'),
      icon: '🎓',
      description: t('story.wizard.parameters.ageGroup.options.13+Desc')
    },
  ];

  const aiModelOptions = [
    { key: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', icon: '🔥', description: 'KOSTENLOS - Google AI (Preview)', cost: 'FREE', recommended: true },
    { key: 'gpt-5-nano', label: 'GPT-5 Nano', icon: '⚡', description: '$0.05/1M - Schnell & günstig', cost: '$0.05' },
    { key: 'gpt-5-mini', label: 'GPT-5 Mini', icon: '✨', description: '$0.25/1M - Bewährt', cost: '$0.25' },
    { key: 'gpt-5.2', label: 'GPT-5.2', icon: '🌟', description: '$1.25/1M - Beste Qualität', cost: '$1.25' },
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
                className={`p-3 rounded-lg border-2 transition-colors text-center ${selectedValue === option.key
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-300 hover:border-purple-300'
                  }`}
              >
                <span className="text-xl mb-2 block">{option.icon}</span>
                <h3 className={`font-semibold text-sm mb-1 ${selectedValue === option.key ? 'text-purple-700' : 'text-gray-800'
                  }`}>
                  {option.label}
                </h3>
                <p className={`text-xs ${selectedValue === option.key ? 'text-purple-600' : 'text-gray-600'
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
        t('story.wizard.parameters.length.title'),
        t('story.wizard.parameters.length.subtitle'),
        lengthOptions,
        length,
        onLengthChange,
        100
      )}

      {renderParameterSection(
        t('story.wizard.parameters.complexity.title'),
        t('story.wizard.parameters.complexity.subtitle'),
        complexityOptions,
        complexity,
        onComplexityChange,
        200
      )}

      {renderParameterSection(
        t('story.wizard.parameters.ageGroup.title'),
        t('story.wizard.parameters.ageGroup.subtitle'),
        ageGroupOptions,
        ageGroup,
        onAgeGroupChange,
        300
      )}

      {/* AI Model Selection */}
      <FadeInView delay={400}>
        <Card variant="elevated">
          <h2 className="text-xl font-bold text-gray-800 text-center mb-2">🤖 {t('story.wizard.parameters.aiModel.title')}</h2>
          <p className="text-gray-600 text-center mb-6">{t('story.wizard.parameters.aiModel.subtitle')}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {aiModelOptions.map((option, index) => (
              <FadeInView key={option.key} delay={450 + index * 30}>
                <button
                  onClick={() => onAiModelChange(option.key as AIModel)}
                  className={`p-3 rounded-lg border-2 transition-colors text-center relative ${aiModel === option.key
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-300 hover:border-purple-300'
                    }`}
                >
                  {option.recommended && (
                    <div className="absolute top-1 right-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded">
                      ⭐
                    </div>
                  )}
                  <span className="text-2xl mb-1 block">{option.icon}</span>
                  <h3 className={`font-semibold text-xs mb-1 ${aiModel === option.key ? 'text-purple-700' : 'text-gray-800'
                    }`}>
                    {option.label}
                  </h3>
                  <p className={`text-xs ${aiModel === option.key ? 'text-purple-600' : 'text-gray-600'
                    }`}>
                    {option.description}
                  </p>
                </button>
              </FadeInView>
            ))}
          </div>
        </Card>
      </FadeInView>
    </div>
  );
};

export default StoryParametersStep;
