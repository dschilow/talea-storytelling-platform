// Step 2: Smart Category Selection
// Instead of 150 individual fairy tales, show 6 smart categories
// Each category uses 3 fairy tales + 71 character pool intelligently

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Mountain, Wand2, Dog, Rocket, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } } as const;
const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, damping: 20 } } };

type MainCategory = 'fairy-tales' | 'adventure' | 'magic' | 'animals' | 'scifi' | 'modern' | null;

interface Props {
  state: {
    mainCategory: MainCategory;
  };
  updateState: (updates: any) => void;
}

export default function Step2CategorySelection({ state, updateState }: Props) {
  const { t } = useTranslation();

  const CATEGORIES = [
    {
      id: 'fairy-tales',
      title: t('wizard.categories.fairy_tales.title'),
      description: t('wizard.categories.fairy_tales.description'),
      icon: Sparkles,
      color: 'purple',
      examples: t('wizard.categories.fairy_tales.examples'),
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      id: 'adventure',
      title: t('wizard.categories.adventure.title'),
      description: t('wizard.categories.adventure.description'),
      icon: Mountain,
      color: 'orange',
      examples: t('wizard.categories.adventure.examples'),
      gradient: 'from-orange-500 to-red-500'
    },
    {
      id: 'magic',
      title: t('wizard.categories.magic.title'),
      description: t('wizard.categories.magic.description'),
      icon: Wand2,
      color: 'blue',
      examples: t('wizard.categories.magic.examples'),
      gradient: 'from-blue-500 to-indigo-500'
    },
    {
      id: 'animals',
      title: t('wizard.categories.animals.title'),
      description: t('wizard.categories.animals.description'),
      icon: Dog,
      color: 'green',
      examples: t('wizard.categories.animals.examples'),
      gradient: 'from-green-500 to-emerald-500'
    },
    {
      id: 'scifi',
      title: t('wizard.categories.scifi.title'),
      description: t('wizard.categories.scifi.description'),
      icon: Rocket,
      color: 'cyan',
      examples: t('wizard.categories.scifi.examples'),
      gradient: 'from-cyan-500 to-blue-500'
    },
    {
      id: 'modern',
      title: t('wizard.categories.modern.title'),
      description: t('wizard.categories.modern.description'),
      icon: Home,
      color: 'gray',
      examples: t('wizard.categories.modern.examples'),
      gradient: 'from-gray-500 to-slate-500'
    }
  ];

  const handleSelectCategory = (categoryId: MainCategory) => {
    updateState({ mainCategory: categoryId });
  };

  return (
    <motion.div className="space-y-6" variants={stagger} initial="hidden" animate="show">
      {/* Title & Description */}
      <motion.div className="text-center" variants={fadeUp}>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2" style={{ fontFamily: 'Fredoka, sans-serif' }}>
          📚 {t('wizard.titles.category')}
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          {t('wizard.subtitles.category')}
        </p>
      </motion.div>

      {/* Category Grid */}
      <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-4" variants={fadeUp}>
        {CATEGORIES.map((category, i) => {
          const isSelected = state.mainCategory === category.id;
          const Icon = category.icon;

          return (
            <motion.button
              key={category.id}
              onClick={() => handleSelectCategory(category.id as MainCategory)}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, type: 'spring', damping: 20 }}
              whileHover={{ y: -4, boxShadow: '0 12px 30px rgba(169,137,242,0.15)' }}
              whileTap={{ scale: 0.98 }}
              className={`
                relative p-6 rounded-2xl border-2 text-left transition-colors
                ${isSelected
                  ? 'border-purple-500 bg-purple-50/80 dark:bg-purple-900/30 ring-4 ring-purple-200/60 shadow-xl'
                  : 'border-white/60 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl shadow-lg'}
              `}
            >
              {/* Selection Badge */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}
                    transition={{ type: 'spring', damping: 15 }}
                    className="absolute -top-3 -right-3 w-10 h-10 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg"
                  >
                    ✓
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Icon & Title */}
              <div className="flex items-start gap-4 mb-3">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${category.gradient} shadow-lg`}>
                  <Icon size={32} className="text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-xl text-gray-800 dark:text-white mb-1">
                    {category.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {category.description}
                  </p>
                </div>
              </div>

              {/* Examples */}
              <div className="mt-4 pt-4 border-t border-gray-200/60 dark:border-gray-600/40">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{t('wizard.common.examples')}</p>
                <p className="text-sm text-gray-700 dark:text-gray-200">{category.examples}</p>
              </div>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Info Box */}
      <motion.div className="bg-blue-50/80 dark:bg-blue-900/30 border-2 border-blue-400/60 rounded-2xl p-4 backdrop-blur-sm" variants={fadeUp}>
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>{t('wizard.common.note')}</strong> {t('wizard.common.categoryNote')}
        </p>
      </motion.div>
    </motion.div>
  );
}
