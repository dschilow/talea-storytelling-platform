// Step 4: Story Feeling
// Select 1-3 emotions/tones for the story

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smile, Heart, Zap, Stars, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } } as const;
const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, damping: 20 } } };

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
    <motion.div className="space-y-6" variants={stagger} initial="hidden" animate="show">
      {/* Title & Description */}
      <motion.div className="text-center" variants={fadeUp}>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2" style={{ fontFamily: 'Fredoka, sans-serif' }}>
          🎭 {t('wizard.titles.feeling')}
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          {t('wizard.subtitles.feeling')}
        </p>
      </motion.div>

      {/* Feelings Grid */}
      <motion.div className="grid grid-cols-2 md:grid-cols-3 gap-4" variants={fadeUp}>
        {FEELINGS.map((feeling, i) => {
          const isSelected = state.feelings.includes(feeling.id as Feeling);
          const Icon = feeling.icon;
          const isDisabled = !isSelected && state.feelings.length >= 3;

          return (
            <motion.button
              key={feeling.id}
              onClick={() => handleToggleFeeling(feeling.id as Feeling)}
              disabled={isDisabled}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06, type: 'spring', damping: 20 }}
              whileHover={!isDisabled ? { y: -4, boxShadow: '0 12px 30px rgba(169,137,242,0.15)' } : {}}
              whileTap={!isDisabled ? { scale: 0.97 } : {}}
              className={`
                relative p-6 rounded-2xl border-2 transition-colors
                ${isSelected
                  ? 'border-purple-500 bg-purple-50/80 dark:bg-purple-900/30 ring-4 ring-purple-200/60 shadow-xl'
                  : isDisabled
                    ? 'border-gray-200 bg-gray-50 dark:bg-slate-900/50 opacity-50 cursor-not-allowed'
                    : 'border-white/60 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl shadow-lg'}
              `}
            >
              {/* Selection Badge */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    className="absolute -top-3 -right-3 w-8 h-8 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg z-10"
                  >
                    ✓
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Icon */}
              <div className={`
                w-16 h-16 mx-auto mb-3 rounded-xl bg-gradient-to-br ${feeling.gradient} 
                flex items-center justify-center shadow-lg
              `}>
                <Icon size={32} className="text-white" />
              </div>

              {/* Title & Description */}
              <div className="text-center">
                <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-1">
                  {feeling.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {feeling.description}
                </p>
              </div>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Selection Counter */}
      <motion.div variants={fadeUp} className={`
        p-4 rounded-2xl border-2 transition-colors backdrop-blur-sm
        ${state.feelings.length === 0 ? 'border-gray-300/60 bg-gray-50/60 dark:bg-slate-800/60' :
          state.feelings.length < 3 ? 'border-blue-400/60 bg-blue-50/60 dark:bg-blue-900/30' :
            'border-emerald-400 bg-emerald-50/80 dark:bg-emerald-900/30'}
      `}>
        <p className="font-semibold text-center text-gray-700 dark:text-gray-200">
          {state.feelings.length === 0 && `👆 ${t('wizard.subtitles.feeling')}`}
          {state.feelings.length > 0 && `✓ ${state.feelings.length} ${t('wizard.common.selected')}`}
        </p>
      </motion.div>
    </motion.div>
  );
}
