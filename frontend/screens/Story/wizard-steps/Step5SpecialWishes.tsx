// Step 5: Special Wishes (Optional)
// Additional story preferences

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, BookHeart, Star, Shuffle, Smile, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } } as const;
const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, damping: 20 } } };

interface Props {
  state: {
    rhymes: boolean;
    moral: boolean;
    avatarIsHero: boolean;
    famousCharacters: boolean;
    happyEnd: boolean;
    surpriseEnd: boolean;
    customWish: string;
  };
  updateState: (updates: any) => void;
}

export default function Step5SpecialWishes({ state, updateState }: Props) {
  const { t } = useTranslation();

  const WISHES = [
    {
      id: 'rhymes',
      title: `🎵 ${t('wizard.wishes.rhymes.title')}`,
      description: t('wizard.wishes.rhymes.description'),
      icon: Music,
      color: 'pink'
    },
    {
      id: 'moral',
      title: `📖 ${t('wizard.wishes.moral.title')}`,
      description: t('wizard.wishes.moral.description'),
      icon: BookHeart,
      color: 'blue'
    },
    {
      id: 'avatarIsHero',
      title: `⭐ ${t('wizard.wishes.avatarIsHero.title')}`,
      description: t('wizard.wishes.avatarIsHero.description'),
      icon: Star,
      color: 'yellow',
      defaultActive: true
    },
    {
      id: 'famousCharacters',
      title: `👑 ${t('wizard.wishes.famousCharacters.title')}`,
      description: t('wizard.wishes.famousCharacters.description'),
      icon: Shuffle,
      color: 'purple'
    },
    {
      id: 'happyEnd',
      title: `😊 ${t('wizard.wishes.happyEnd.title')}`,
      description: t('wizard.wishes.happyEnd.description'),
      icon: Smile,
      color: 'green',
      defaultActive: true
    },
    {
      id: 'surpriseEnd',
      title: `❗ ${t('wizard.wishes.surpriseEnd.title')}`,
      description: t('wizard.wishes.surpriseEnd.description'),
      icon: AlertCircle,
      color: 'orange'
    }
  ];

  const handleToggleWish = (wishId: string) => {
    updateState({ [wishId]: !state[wishId as keyof typeof state] });
  };

  const handleCustomWishChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateState({ customWish: e.target.value });
  };

  return (
    <motion.div className="space-y-6" variants={stagger} initial="hidden" animate="show">
      {/* Title & Description */}
      <motion.div className="text-center" variants={fadeUp}>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2" style={{ fontFamily: 'Fredoka, sans-serif' }}>
          ✨ {t('wizard.titles.wishes')}
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          {t('wizard.subtitles.wishes')}
        </p>
      </motion.div>

      {/* Wishes Grid */}
      <motion.div className="grid grid-cols-2 md:grid-cols-3 gap-3" variants={fadeUp}>
        {WISHES.map((wish, i) => {
          const isSelected = state[wish.id as keyof typeof state] as boolean;
          const Icon = wish.icon;

          return (
            <motion.button
              key={wish.id}
              onClick={() => handleToggleWish(wish.id)}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05, type: 'spring', damping: 20 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              className={`
                relative p-4 rounded-2xl border-2 transition-colors
                ${isSelected
                  ? 'border-purple-500 bg-purple-50/80 dark:bg-purple-900/30 ring-2 ring-purple-200/60'
                  : 'border-white/60 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl hover:border-purple-300'}
              `}
            >
              {/* Selection Badge */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md z-10">
                    ✓
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Icon & Text */}
              <div className="flex flex-col items-center text-center">
                <Icon size={28} className={`mb-2 ${isSelected ? 'text-purple-500' : 'text-gray-400'}`} />
                <p className="font-semibold text-sm text-gray-800 dark:text-white mb-1">{wish.title}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{wish.description}</p>
              </div>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Custom Wish Input */}
      <motion.div variants={fadeUp}>
        <label className="block mb-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('wizard.common.customWish')}</span>
        </label>
        <textarea
          value={state.customWish}
          onChange={handleCustomWishChange}
          placeholder={t('wizard.common.customWishPlaceholder')}
          maxLength={200}
          className="
            w-full p-4 border-2 border-white/60 dark:border-slate-600/60 rounded-2xl
            bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl
            text-gray-800 dark:text-white
            focus:border-purple-500 focus:ring-4 focus:ring-purple-200/40
            resize-none transition-all
          "
          rows={3}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {state.customWish.length}/200 {t('wizard.common.chars')}
        </p>
      </motion.div>

      {/* Info Box */}
      <motion.div className="bg-blue-50/80 dark:bg-blue-900/30 border-2 border-blue-400/60 rounded-2xl p-4 backdrop-blur-sm" variants={fadeUp}>
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>{t('wizard.common.note')}</strong> {t('wizard.common.wishesNote')}
        </p>
      </motion.div>
    </motion.div>
  );
}
