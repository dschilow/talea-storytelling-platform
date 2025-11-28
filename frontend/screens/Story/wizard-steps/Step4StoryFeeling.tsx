// Step 4: Story Feeling
// Select 1-3 emotions/tones for the story

import React from 'react';
import { Smile, Heart, Zap, Stars, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Feeling = 'funny' | 'warm' | 'exciting' | 'crazy' | 'meaningful';

interface Props {
  state: {
    feelings: Feeling[];
  };
  updateState: (updates: any) => void;
}

export default function Step4StoryFeeling({ state, updateState }: Props) {
  const { t } = useTranslation();

  const FEELINGS = [
    {
      id: 'funny',
      title: `😂 ${t('wizard.feelings.funny.title')}`,
      description: t('wizard.feelings.funny.description'),
      icon: Smile,
      color: 'yellow',
      gradient: 'from-yellow-400 to-orange-400'
    },
    {
      id: 'warm',
      title: `❤️ ${t('wizard.feelings.warm.title')}`,
      description: t('wizard.feelings.warm.description'),
      icon: Heart,
      color: 'red',
      gradient: 'from-red-400 to-pink-400'
    },
    {
      id: 'exciting',
      title: `⚡ ${t('wizard.feelings.exciting.title')}`,
      description: t('wizard.feelings.exciting.description'),
      icon: Zap,
      color: 'blue',
      gradient: 'from-blue-400 to-cyan-400'
    },
    {
      id: 'crazy',
      title: `🤪 ${t('wizard.feelings.crazy.title')}`,
      description: t('wizard.feelings.crazy.description'),
      icon: Stars,
      color: 'purple',
      gradient: 'from-purple-400 to-pink-400'
    },
    {
      id: 'meaningful',
      title: `💭 ${t('wizard.feelings.meaningful.title')}`,
      description: t('wizard.feelings.meaningful.description'),
      icon: MessageCircle,
      color: 'green',
      gradient: 'from-green-400 to-emerald-400'
    }
  ];

  const handleToggleFeeling = (feelingId: Feeling) => {
    const currentFeelings = state.feelings;

    if (currentFeelings.includes(feelingId)) {
      // Remove feeling
      updateState({ feelings: currentFeelings.filter(f => f !== feelingId) });
    } else {
      // Add feeling (max 3)
      if (currentFeelings.length < 3) {
        updateState({ feelings: [...currentFeelings, feelingId] });
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Description */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          🎭 {t('wizard.titles.feeling')}
        </h2>
        <p className="text-gray-600">
          {t('wizard.subtitles.feeling')}
        </p>
      </div>

      {/* Feelings Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {FEELINGS.map((feeling) => {
          const isSelected = state.feelings.includes(feeling.id as Feeling);
          const Icon = feeling.icon;
          const isDisabled = !isSelected && state.feelings.length >= 3;

          return (
            <button
              key={feeling.id}
              onClick={() => handleToggleFeeling(feeling.id as Feeling)}
              disabled={isDisabled}
              className={`
                relative p-6 rounded-2xl border-2 transition-all transform
                ${isSelected
                  ? `border-${feeling.color}-600 bg-${feeling.color}-50 ring-4 ring-${feeling.color}-200 scale-105 shadow-xl`
                  : isDisabled
                    ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 bg-white hover:border-gray-400 hover:scale-102 shadow-lg'}
              `}
            >
              {/* Selection Badge */}
              {isSelected && (
                <div className="absolute -top-3 -right-3 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                  ✓
                </div>
              )}

              {/* Icon */}
              <div className={`
                w-16 h-16 mx-auto mb-3 rounded-xl bg-gradient-to-br ${feeling.gradient} 
                flex items-center justify-center shadow-lg
              `}>
                <Icon size={32} className="text-white" />
              </div>

              {/* Title & Description */}
              <div className="text-center">
                <h3 className="font-bold text-lg text-gray-800 mb-1">
                  {feeling.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {feeling.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selection Counter */}
      <div className={`
        p-4 rounded-xl border-2 transition-all
        ${state.feelings.length === 0 ? 'border-gray-300 bg-gray-50' :
          state.feelings.length < 3 ? 'border-blue-400 bg-blue-50' :
            'border-green-500 bg-green-50'}
      `}>
        <p className="font-semibold text-center">
          {state.feelings.length === 0 && `👆 ${t('wizard.subtitles.feeling')}`}
          {state.feelings.length > 0 && `✓ ${state.feelings.length} ${t('wizard.common.selected')}`}
        </p>
      </div>
    </div>
  );
}
