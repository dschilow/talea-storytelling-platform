import React from 'react';
import { useTranslation } from 'react-i18next';

import Card from '../../../components/common/Card';
import FadeInView from '../../../components/animated/FadeInView';
import {
  DEFAULT_OPENROUTER_STORY_MODEL,
  type AIModel,
  type AIProvider,
  type OpenRouterStoryModel,
} from '@/types/story';

interface StoryParametersStepProps {
  length: 'short' | 'medium' | 'long';
  complexity: 'simple' | 'medium' | 'complex';
  ageGroup: '3-5' | '6-8' | '9-12' | '13+';
  aiModel?: AIModel;
  aiProvider?: AIProvider;
  openRouterModel?: OpenRouterStoryModel | string;
  showAiModelSelection?: boolean;
  onLengthChange: (length: 'short' | 'medium' | 'long') => void;
  onComplexityChange: (complexity: 'simple' | 'medium' | 'complex') => void;
  onAgeGroupChange: (ageGroup: '3-5' | '6-8' | '9-12' | '13+') => void;
  onAiModelChange: (aiModel: AIModel) => void;
  onAiProviderChange?: (provider: AIProvider) => void;
  onOpenRouterModelChange?: (model: OpenRouterStoryModel | string) => void;
}

type Option = {
  key: string;
  label: string;
  icon: string;
  description: string;
};

const StoryParametersStep: React.FC<StoryParametersStepProps> = ({
  length,
  complexity,
  ageGroup,
  aiModel,
  aiProvider = 'native',
  openRouterModel = DEFAULT_OPENROUTER_STORY_MODEL,
  showAiModelSelection = true,
  onLengthChange,
  onComplexityChange,
  onAgeGroupChange,
  onAiModelChange,
  onAiProviderChange,
  onOpenRouterModelChange,
}) => {
  const { t } = useTranslation();

  const lengthOptions: Option[] = [
    {
      key: 'short',
      label: t('story.wizard.parameters.length.options.short'),
      icon: 'S',
      description: t('story.wizard.parameters.length.options.shortDesc'),
    },
    {
      key: 'medium',
      label: t('story.wizard.parameters.length.options.medium'),
      icon: 'M',
      description: t('story.wizard.parameters.length.options.mediumDesc'),
    },
    {
      key: 'long',
      label: t('story.wizard.parameters.length.options.long'),
      icon: 'L',
      description: t('story.wizard.parameters.length.options.longDesc'),
    },
  ];

  const complexityOptions: Option[] = [
    {
      key: 'simple',
      label: t('story.wizard.parameters.complexity.options.simple'),
      icon: '1',
      description: t('story.wizard.parameters.complexity.options.simpleDesc'),
    },
    {
      key: 'medium',
      label: t('story.wizard.parameters.complexity.options.medium'),
      icon: '2',
      description: t('story.wizard.parameters.complexity.options.mediumDesc'),
    },
    {
      key: 'complex',
      label: t('story.wizard.parameters.complexity.options.complex'),
      icon: '3',
      description: t('story.wizard.parameters.complexity.options.complexDesc'),
    },
  ];

  const ageGroupOptions: Option[] = [
    {
      key: '3-5',
      label: t('story.wizard.parameters.ageGroup.options.3-5'),
      icon: 'A',
      description: t('story.wizard.parameters.ageGroup.options.3-5Desc'),
    },
    {
      key: '6-8',
      label: t('story.wizard.parameters.ageGroup.options.6-8'),
      icon: 'B',
      description: t('story.wizard.parameters.ageGroup.options.6-8Desc'),
    },
    {
      key: '9-12',
      label: t('story.wizard.parameters.ageGroup.options.9-12'),
      icon: 'C',
      description: t('story.wizard.parameters.ageGroup.options.9-12Desc'),
    },
    {
      key: '13+',
      label: t('story.wizard.parameters.ageGroup.options.13+'),
      icon: 'D',
      description: t('story.wizard.parameters.ageGroup.options.13+Desc'),
    },
  ];

  const aiModelOptions = [
    {
      key: 'claude-sonnet-4-6',
      label: 'Claude Sonnet 4.6',
      icon: 'C4',
      description: '$3 in / $15 out - Starke Prosa',
    },
    {
      key: 'gemini-3-pro-preview',
      label: 'Gemini 3 Pro Preview',
      icon: 'G3',
      description: 'Google AI (Preview, Pro)',
    },
    {
      key: 'gemini-3.1-pro-preview',
      label: 'Gemini 3.1 Pro Preview',
      icon: 'G3P',
      description: 'Google AI (Preview, Pro)',
    },
    {
      key: 'gemini-3-flash-preview',
      label: 'Gemini 3 Flash',
      icon: 'G3',
      description: 'KOSTENLOS - Google AI (Preview)',
      recommended: true,
    },
    {
      key: 'gpt-5.4',
      label: 'GPT-5.4',
      icon: 'P',
      description: '$1.25/1M - Beste Qualitaet',
    },
    {
      key: 'gpt-5.4-mini',
      label: 'GPT-5.4 Mini',
      icon: 'M',
      description: '$0.75 in / $4.50 out - Ausgewogen',
    },
    {
      key: 'minimax-m2.7',
      label: 'MiniMax M2.7',
      icon: 'MM',
      description: 'Runware - MiniMax Highspeed',
    },
  ];

  const openRouterModelOptions = [
    { key: 'moonshotai/kimi-k2.6', label: 'Kimi K2.6', description: 'Moonshot AI - $0.15 in / $0.45 out' },
    { key: '~moonshotai/kimi-latest', label: 'Kimi Latest', description: 'Moonshot AI - $0.75 in / $3.50 out' },
    { key: 'aion-labs/aion-3.0-mini', label: 'Aion 3.0 Mini', description: 'AionLabs - Story/Roleplay - $0.70 in / $1.40 out' },
    { key: 'moonshotai/kimi-k2.5', label: 'Kimi K2.5', description: 'Moonshot AI - $0.44 in / $2.00 out' },
    { key: 'aion-labs/aion-3.0', label: 'Aion 3.0', description: 'AionLabs - Premium Story/Roleplay - $3 in / $6 out' },
    { key: 'minimax/minimax-m2.7', label: 'MiniMax M2.7', description: 'MiniMax - $0.24 in / $0.96 out' },
    { key: 'qwen/qwen3.6-flash', label: 'Qwen 3.6 Flash', description: 'Qwen - $0.1875 in / $1.125 out' },
    { key: 'x-ai/grok-4.3', label: 'Grok 4.3', description: 'xAI - $1.25 in / $2.50 out' },
    { key: 'x-ai/grok-4.5', label: 'Grok 4.5', description: 'xAI - $2 in / $6 out' },
    { key: 'openrouter/owl-alpha', label: 'Owl Alpha', description: 'OpenRouter - Free' },
    { key: 'google/gemini-3.6-flash', label: 'Gemini 3.6 Flash', description: 'Google - $1.50 in / $7.50 out' },
    { key: 'google/gemini-3.5-flash', label: 'Gemini 3.5 Flash', description: 'Google - $1.50 in / $9 out' },
    { key: '~google/gemini-pro-latest', label: 'Gemini Pro Latest', description: 'Google - $2 in / $12 out' },
    { key: '~google/gemini-flash-latest', label: 'Gemini Flash Latest', description: 'Google - $0.50 in / $3 out' },
    { key: '~anthropic/claude-sonnet-latest', label: 'Claude Sonnet Latest', description: 'Anthropic - $3 in / $15 out' },
    { key: '~openai/gpt-mini-latest', label: 'GPT Mini Latest', description: 'OpenAI - $0.75 in / $4.50 out' },
    { key: 'deepseek/deepseek-v4-pro', label: 'DeepSeek V4 Pro', description: 'DeepSeek - $0.44 in / $0.87 out' },
    { key: 'qwen/qwen3.6-max-preview', label: 'Qwen 3.6 Max', description: 'Qwen - $1.04 in / $6.24 out' },
    { key: 'openai/gpt-5.6-luna', label: 'GPT-5.6 Luna', description: 'OpenAI - Test-Modell' },
    { key: 'openai/gpt-5.6-terra', label: 'GPT-5.6 Terra', description: 'OpenAI - Test-Modell' },
  ];

  const renderParameterSection = (
    title: string,
    subtitle: string,
    options: Option[],
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
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-gray-300 hover:border-amber-300'
                }`}
              >
                <span className="text-xl mb-2 block">{option.icon}</span>
                <h3
                  className={`font-semibold text-sm mb-1 ${
                    selectedValue === option.key ? 'text-amber-700' : 'text-gray-800'
                  }`}
                >
                  {option.label}
                </h3>
                <p
                  className={`text-xs ${
                    selectedValue === option.key ? 'text-amber-600' : 'text-gray-600'
                  }`}
                >
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

      {showAiModelSelection && (
        <FadeInView delay={400}>
          <Card variant="elevated">
            <h2 className="text-xl font-bold text-gray-800 text-center mb-2">
              {t('story.wizard.parameters.aiModel.title')}
            </h2>
            <p className="text-gray-600 text-center mb-6">
              {t('story.wizard.parameters.aiModel.subtitle')}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {aiModelOptions.map((option, index) => (
                <FadeInView key={option.key} delay={450 + index * 30}>
                  <button
                    onClick={() => {
                      onAiProviderChange?.('native');
                      onAiModelChange(option.key as AIModel);
                    }}
                    className={`p-3 rounded-lg border-2 transition-colors text-center relative ${
                      aiProvider === 'native' && aiModel === option.key
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-300 hover:border-amber-300'
                    }`}
                  >
                    {option.recommended && (
                      <div className="absolute top-1 right-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded">
                        OK
                      </div>
                    )}
                    <span className="text-2xl mb-1 block">{option.icon}</span>
                    <h3
                      className={`font-semibold text-xs mb-1 ${
                        aiProvider === 'native' && aiModel === option.key ? 'text-amber-700' : 'text-gray-800'
                      }`}
                    >
                      {option.label}
                    </h3>
                    <p
                      className={`text-xs ${
                        aiProvider === 'native' && aiModel === option.key ? 'text-amber-600' : 'text-gray-600'
                      }`}
                    >
                      {option.description}
                    </p>
                  </button>
                </FadeInView>
              ))}
              <FadeInView delay={450 + aiModelOptions.length * 30}>
                <button
                  onClick={() => {
                    onAiProviderChange?.('openrouter');
                    onOpenRouterModelChange?.(openRouterModel || DEFAULT_OPENROUTER_STORY_MODEL);
                  }}
                  className={`p-3 rounded-lg border-2 transition-colors text-center relative ${
                    aiProvider === 'openrouter'
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-300 hover:border-amber-300'
                  }`}
                >
                  <span className="text-2xl mb-1 block">OR</span>
                  <h3 className={`font-semibold text-xs mb-1 ${aiProvider === 'openrouter' ? 'text-amber-700' : 'text-gray-800'}`}>
                    OpenRouter
                  </h3>
                  <p className={`text-xs ${aiProvider === 'openrouter' ? 'text-amber-600' : 'text-gray-600'}`}>
                    Viele Modelle ueber einen API-Key
                  </p>
                </button>
              </FadeInView>
            </div>

            {aiProvider === 'openrouter' && (
              <div className="mt-4 rounded-lg border border-gray-300 bg-white/70 p-3">
                <label htmlFor="old-openrouter-model" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  OpenRouter Modell
                </label>
                <select
                  id="old-openrouter-model"
                  value={openRouterModel || DEFAULT_OPENROUTER_STORY_MODEL}
                  onChange={(event) => onOpenRouterModelChange?.(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-amber-500"
                >
                  {openRouterModelOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label} - {option.description}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </Card>
        </FadeInView>
      )}
    </div>
  );
};

export default StoryParametersStep;
