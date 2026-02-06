// Step 3: Age Group & Story Length
// Simple choices for target age and story duration

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Baby, Users, GraduationCap, UserCheck, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } } as const;
const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, damping: 20 } } };

type AgeGroup = '3-5' | '6-8' | '9-12' | '13+' | null;
type Length = 'short' | 'medium' | 'long' | null;
type AIModel = 'gpt-5-nano' | 'gpt-5-mini' | 'gpt-5.2' | 'gemini-3-flash-preview';

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
      id: 'gemini-3-flash-preview',
      title: '🔥 Gemini 3 Flash',
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
      id: 'gpt-5.2',
      title: '🌟 GPT-5.2',
      description: 'Beste Qualität',
      cost: '$1.25/1M',
      color: 'indigo'
    }
  ];

  return (
    <motion.div className="space-y-8" variants={stagger} initial="hidden" animate="show">
      {/* Title & Description */}
      <motion.div className="text-center" variants={fadeUp}>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2" style={{ fontFamily: 'Fredoka, sans-serif' }}>
          🎯 {t('wizard.titles.ageLength')}
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          {t('wizard.subtitles.ageLength')}
        </p>
      </motion.div>

      {/* Age Group Selection */}
      <motion.div variants={fadeUp}>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
          <Users size={20} />
          {t('wizard.steps.ageLength')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {AGE_GROUPS.map((group, i) => {
            const isSelected = state.ageGroup === group.id;
            const Icon = group.icon;

            return (
              <motion.button
                key={group.id}
                onClick={() => handleSelectAge(group.id as AgeGroup)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05, type: 'spring', damping: 20 }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.97 }}
                className={`
                  relative p-4 rounded-2xl border-2 transition-colors
                  ${isSelected
                    ? 'border-purple-500 bg-purple-50/80 dark:bg-purple-900/30 ring-4 ring-purple-200/60'
                    : 'border-white/60 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl hover:border-purple-300'}
                `}
              >
                <AnimatePresence>
                  {isSelected && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md z-10">
                      ✓
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex flex-col items-center text-center">
                  <Icon size={32} className={`mb-2 ${isSelected ? 'text-purple-500' : 'text-gray-400'}`} />
                  <p className="font-bold text-sm text-gray-800 dark:text-white mb-1">{group.title}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{group.description}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Length Selection */}
      <motion.div variants={fadeUp}>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
          <Clock size={20} />
          {t('wizard.summary.length')}
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {LENGTHS.map((length, i) => {
            const isSelected = state.length === length.id;

            return (
              <motion.button
                key={length.id}
                onClick={() => handleSelectLength(length.id as Length)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05, type: 'spring', damping: 20 }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.97 }}
                className={`
                  relative p-5 rounded-2xl border-2 transition-colors
                  ${isSelected
                    ? 'border-pink-500 bg-pink-50/80 dark:bg-pink-900/30 ring-4 ring-pink-200/60'
                    : 'border-white/60 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl hover:border-pink-300'}
                `}
              >
                <AnimatePresence>
                  {isSelected && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md z-10">
                      ✓
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="text-center">
                  <p className="text-2xl mb-2">{length.title}</p>
                  <p className="font-semibold text-gray-800 dark:text-white mb-1">{length.duration}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{length.chapters}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* AI Model Selection */}
      <motion.div variants={fadeUp}>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
          🤖 AI Model
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Wähle das KI-Modell für die Story-Generierung
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {AI_MODELS.map((model, i) => {
            const isSelected = state.aiModel === model.id;

            return (
              <motion.button
                key={model.id}
                onClick={() => handleSelectAiModel(model.id as AIModel)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05, type: 'spring', damping: 20 }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.97 }}
                className={`
                  relative p-4 rounded-2xl border-2 transition-colors
                  ${isSelected
                    ? 'border-purple-500 bg-purple-50/80 dark:bg-purple-900/30 ring-4 ring-purple-200/60'
                    : 'border-white/60 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl hover:border-purple-300'}
                `}
              >
                {model.recommended && (
                  <div className="absolute -top-2 -left-2 bg-gradient-to-r from-emerald-400 to-green-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow-md">
                    ⭐ NEU
                  </div>
                )}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md z-10">
                      ✓
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex flex-col items-center text-center">
                  <p className="text-2xl mb-2">{model.title}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{model.description}</p>
                  <p className={`text-xs font-bold ${model.cost === 'FREE' ? 'text-emerald-600' : 'text-gray-500'}`}>
                    {model.cost}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Selection Summary */}
      <AnimatePresence>
        {state.ageGroup && state.length && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="bg-emerald-50/80 dark:bg-emerald-900/30 border-2 border-emerald-400 rounded-2xl p-4 backdrop-blur-sm"
          >
            <p className="font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
              ✓ {t('wizard.common.selected')}
            </p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              {t('wizard.summary.age')}: {state.ageGroup}, {t('wizard.summary.length')}: {
                state.length === 'short' ? t('wizard.lengths.short.duration') :
                  state.length === 'medium' ? t('wizard.lengths.medium.duration') :
                    t('wizard.lengths.long.duration')
              }
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

