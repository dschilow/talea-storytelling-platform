// Step 3: Age Group & Story Length
// Simple choices for target age and story duration

import React from 'react';
import { Baby, Users, GraduationCap, UserCheck, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type AgeGroup = '3-5' | '6-8' | '9-12' | '13+' | null;
type Length = 'short' | 'medium' | 'long' | null;
type AIModel = 'gpt-5-nano' | 'gpt-5-mini' | 'gpt-5' | 'gpt-5-pro' | 'gpt-4.1-nano' | 'gpt-4.1-mini' | 'gpt-4.1' | 'o4-mini' | 'gemini-2.0-flash';

interface Props {
  state: {
    ageGroup: AgeGroup;
    length: Length;
    aiModel: AIModel;
  };
  updateState: (updates: any) => void;
}

export default function Step3AgeAndLength({ state, updateState }: Props) {
  const { t } = useTranslation();

  const AGE_GROUPS = [
    {
      id: '3-5',
      title: t('wizard.ageGroups.3-5.title'),
      icon: Baby,
      description: t('wizard.ageGroups.3-5.description'),
      color: 'pink'
    },
    {
      id: '6-8',
      title: t('wizard.ageGroups.6-8.title'),
      icon: Users,
      description: t('wizard.ageGroups.6-8.description'),
      color: 'blue'
    },
    {
      id: '9-12',
      title: t('wizard.ageGroups.9-12.title'),
      icon: GraduationCap,
      description: t('wizard.ageGroups.9-12.description'),
      color: 'purple'
    },
    {
      id: '13+',
      title: t('wizard.ageGroups.13+.title'),
      icon: UserCheck,
      description: t('wizard.ageGroups.13+.description'),
      color: 'indigo'
    }
  ];

  const LENGTHS = [
    {
      id: 'short',
      title: `⚡ ${t('wizard.lengths.short.title')}`,
      duration: t('wizard.lengths.short.duration'),
      chapters: t('wizard.lengths.short.chapters'),
      color: 'green'
    },
    {
      id: 'medium',
      title: `📖 ${t('wizard.lengths.medium.title')}`,
      duration: t('wizard.lengths.medium.duration'),
      chapters: t('wizard.lengths.medium.chapters'),
      color: 'yellow'
    },
    {
      id: 'long',
      title: `📚 ${t('wizard.lengths.long.title')}`,
      duration: t('wizard.lengths.long.duration'),
      chapters: t('wizard.lengths.long.chapters'),
      color: 'orange'
    }
  ];

  const handleSelectAge = (ageGroup: AgeGroup) => {
    updateState({ ageGroup });
  };

  const handleSelectLength = (length: Length) => {
    updateState({ length });
  };

  const handleSelectAiModel = (aiModel: AIModel) => {
    updateState({ aiModel });
  };

  const AI_MODELS = [
    {
      id: 'gemini-2.0-flash',
      title: '🔥 Gemini 2.0 Flash',
      description: 'KOSTENLOS - Google AI',
      cost: 'FREE',
      recommended: true,
      color: 'green'
    },
    {
      id: 'gpt-5-nano',
      title: '⚡ GPT-5 Nano',
      description: 'Schnell & günstig',
      cost: '$0.05/1M',
      color: 'blue'
    },
    {
      id: 'gpt-5-mini',
      title: '✨ GPT-5 Mini',
      description: 'Bewährt',
      cost: '$0.25/1M',
      color: 'purple'
    },
    {
      id: 'gpt-5',
      title: '🌟 GPT-5',
      description: 'Beste Qualität',
      cost: '$1.25/1M',
      color: 'indigo'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Title & Description */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          🎯 {t('wizard.titles.ageLength')}
        </h2>
        <p className="text-gray-600">
          {t('wizard.subtitles.ageLength')}
        </p>
      </div>

      {/* Age Group Selection */}
      <div>
        <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Users size={20} />
          {t('wizard.steps.ageLength')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {AGE_GROUPS.map((group) => {
            const isSelected = state.ageGroup === group.id;
            const Icon = group.icon;

            return (
              <button
                key={group.id}
                onClick={() => handleSelectAge(group.id as AgeGroup)}
                className={`
                  relative p-4 rounded-xl border-2 transition-all transform
                  ${isSelected
                    ? `border-${group.color}-600 bg-${group.color}-50 ring-4 ring-${group.color}-200 scale-105`
                    : 'border-gray-200 bg-white hover:border-gray-400 hover:scale-102'}
                `}
              >
                {isSelected && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    ✓
                  </div>
                )}

                <div className="flex flex-col items-center text-center">
                  <Icon size={32} className={`mb-2 ${isSelected ? `text-${group.color}-600` : 'text-gray-400'}`} />
                  <p className="font-bold text-sm text-gray-800 mb-1">{group.title}</p>
                  <p className="text-xs text-gray-600">{group.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Length Selection */}
      <div>
        <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Clock size={20} />
          {t('wizard.summary.length')}
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {LENGTHS.map((length) => {
            const isSelected = state.length === length.id;

            return (
              <button
                key={length.id}
                onClick={() => handleSelectLength(length.id as Length)}
                className={`
                  relative p-5 rounded-xl border-2 transition-all transform
                  ${isSelected
                    ? `border-${length.color}-600 bg-${length.color}-50 ring-4 ring-${length.color}-200 scale-105`
                    : 'border-gray-200 bg-white hover:border-gray-400 hover:scale-102'}
                `}
              >
                {isSelected && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    ✓
                  </div>
                )}

                <div className="text-center">
                  <p className="text-2xl mb-2">{length.title}</p>
                  <p className="font-semibold text-gray-800 mb-1">{length.duration}</p>
                  <p className="text-xs text-gray-600">{length.chapters}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* AI Model Selection */}
      <div>
        <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
          🤖 AI Model
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          Wähle das KI-Modell für die Story-Generierung
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {AI_MODELS.map((model) => {
            const isSelected = state.aiModel === model.id;

            return (
              <button
                key={model.id}
                onClick={() => handleSelectAiModel(model.id as AIModel)}
                className={`
                  relative p-4 rounded-xl border-2 transition-all transform
                  ${isSelected
                    ? `border-${model.color}-600 bg-${model.color}-50 ring-4 ring-${model.color}-200 scale-105`
                    : 'border-gray-200 bg-white hover:border-gray-400 hover:scale-102'}
                `}
              >
                {model.recommended && (
                  <div className="absolute -top-2 -left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                    ⭐ NEU
                  </div>
                )}
                {isSelected && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    ✓
                  </div>
                )}

                <div className="flex flex-col items-center text-center">
                  <p className="text-2xl mb-2">{model.title}</p>
                  <p className="text-xs text-gray-600 mb-1">{model.description}</p>
                  <p className={`text-xs font-bold ${model.cost === 'FREE' ? 'text-green-600' : 'text-gray-500'}`}>
                    {model.cost}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selection Summary */}
      {state.ageGroup && state.length && (
        <div className="bg-green-50 border-2 border-green-500 rounded-xl p-4">
          <p className="font-semibold text-green-800 mb-1">
            ✓ {t('wizard.common.selected')}
          </p>
          <p className="text-sm text-green-600">
            {t('wizard.summary.age')}: {state.ageGroup}, {t('wizard.summary.length')}: {
              state.length === 'short' ? t('wizard.lengths.short.duration') :
                state.length === 'medium' ? t('wizard.lengths.medium.duration') :
                  t('wizard.lengths.long.duration')
            }
          </p>
        </div>
      )}
    </div>
  );
}
