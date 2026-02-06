// Step 6: Summary & Create — Dark magical theme with glowing summary cards

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, User, BookOpen, Clock, Heart, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  state: {
    selectedAvatars: string[];
    mainCategory: string | null;
    ageGroup: string | null;
    length: string | null;
    feelings: string[];
    rhymes: boolean;
    moral: boolean;
    avatarIsHero: boolean;
    famousCharacters: boolean;
    happyEnd: boolean;
    surpriseEnd: boolean;
    customWish: string;
  };
  onGenerate: () => void;
  storyCredits?: {
    limit: number | null;
    used: number;
    remaining: number | null;
    costPerGeneration: 1;
  } | null;
  generateDisabled?: boolean;
  generateDisabledMessage?: string;
}

export default function Step6Summary({
  state,
  onGenerate,
  storyCredits,
  generateDisabled = false,
  generateDisabledMessage,
}: Props) {
  const { t } = useTranslation();

  const CATEGORY_NAMES: Record<string, string> = {
    'fairy-tales': `🏰 ${t('wizard.categories.fairy_tales.title')}`,
    'adventure': `🗺️ ${t('wizard.categories.adventure.title')}`,
    'magic': `✨ ${t('wizard.categories.magic.title')}`,
    'animals': `🦊 ${t('wizard.categories.animals.title')}`,
    'scifi': `🚀 ${t('wizard.categories.scifi.title')}`,
    'modern': `🏡 ${t('wizard.categories.modern.title')}`,
  };

  const AGE_LABELS: Record<string, string> = {
    '3-5': t('wizard.ageGroups.3-5.title'), '6-8': t('wizard.ageGroups.6-8.title'),
    '9-12': t('wizard.ageGroups.9-12.title'), '13+': t('wizard.ageGroups.13+.title'),
  };

  const LENGTH_LABELS: Record<string, string> = {
    'short': `⚡ ${t('wizard.lengths.short.title')} (${t('wizard.lengths.short.duration')})`,
    'medium': `📖 ${t('wizard.lengths.medium.title')} (${t('wizard.lengths.medium.duration')})`,
    'long': `📚 ${t('wizard.lengths.long.title')} (${t('wizard.lengths.long.duration')})`,
  };

  const FEELING_EMOJIS: Record<string, string> = {
    'funny': `😂 ${t('wizard.feelings.funny.title')}`, 'warm': `❤️ ${t('wizard.feelings.warm.title')}`,
    'exciting': `⚡ ${t('wizard.feelings.exciting.title')}`, 'crazy': `🤪 ${t('wizard.feelings.crazy.title')}`,
    'meaningful': `💭 ${t('wizard.feelings.meaningful.title')}`,
  };

  const activeWishes = [
    state.rhymes && `🎵 ${t('wizard.wishes.rhymes.title')}`,
    state.moral && `📖 ${t('wizard.wishes.moral.title')}`,
    state.avatarIsHero && `⭐ ${t('wizard.wishes.avatarIsHero.title')}`,
    state.famousCharacters && `👑 ${t('wizard.wishes.famousCharacters.title')}`,
    state.happyEnd && `😊 ${t('wizard.wishes.happyEnd.title')}`,
    state.surpriseEnd && `❗ ${t('wizard.wishes.surpriseEnd.title')}`,
  ].filter(Boolean);

  const summaryItems = [
    { icon: User, color: '#A989F2', label: t('wizard.summary.avatars'), value: `${state.selectedAvatars.length} ${t('wizard.summary.avatars')} ${t('wizard.common.selected')}` },
    { icon: BookOpen, color: '#60A5FA', label: t('wizard.summary.category'), value: state.mainCategory ? CATEGORY_NAMES[state.mainCategory] : t('wizard.common.notSelected') },
    { icon: Clock, color: '#34D399', label: `${t('wizard.summary.age')} & ${t('wizard.summary.length')}`, value: `${state.ageGroup && AGE_LABELS[state.ageGroup]}, ${state.length && LENGTH_LABELS[state.length]}` },
    { icon: Heart, color: '#FF6B9D', label: t('wizard.summary.feelings'), value: state.feelings.map(f => FEELING_EMOJIS[f]).join(', ') },
  ];

  return (
    <div className="space-y-6">
      {/* Title */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h2 className="text-2xl font-extrabold text-white mb-2" style={{ fontFamily: '"Fredoka", sans-serif' }}>
          🎉 {t('wizard.titles.summary')}
        </h2>
        <p className="text-white/50 text-sm">{t('wizard.subtitles.summary')}</p>
      </motion.div>

      {/* Summary Cards */}
      <div className="space-y-3">
        {summaryItems.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, type: 'spring' as const, damping: 20 }}
              className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.06] border border-white/10"
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${item.color}20` }}>
                <Icon size={22} style={{ color: item.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm mb-0.5">{item.label}</p>
                <p className="text-xs text-white/50">{item.value}</p>
              </div>
              <CheckCircle size={18} className="text-emerald-400 flex-shrink-0 mt-1" />
            </motion.div>
          );
        })}

        {/* Special Wishes */}
        {(activeWishes.length > 0 || state.customWish) && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35, type: 'spring' as const, damping: 20 }}
            className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.06] border border-white/10"
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(251,191,36,0.15)' }}>
              <Sparkles size={22} className="text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm mb-0.5">{t('wizard.titles.wishes')}</p>
              {activeWishes.length > 0 && <p className="text-xs text-white/50">{activeWishes.join(', ')}</p>}
              {state.customWish && <p className="text-xs text-white/40 italic mt-1">"{state.customWish}"</p>}
            </div>
            <CheckCircle size={18} className="text-emerald-400 flex-shrink-0 mt-1" />
          </motion.div>
        )}
      </div>

      {/* Ready Box */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="rounded-2xl p-5 border border-[#A989F2]/30"
        style={{ background: 'linear-gradient(135deg, rgba(169,137,242,0.1), rgba(255,107,157,0.08))' }}
      >
        <div className="flex items-start gap-4">
          <Sparkles size={28} className="text-[#A989F2] flex-shrink-0" />
          <div>
            <p className="font-bold text-white mb-1">✨ {t('wizard.summary.ready')}</p>
            <p className="text-sm text-white/50">{t('wizard.common.summaryNote')}</p>
          </div>
        </div>
      </motion.div>

      {storyCredits && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[#A989F2]/30 bg-[#A989F2]/10 p-4"
        >
          <p className="text-xs uppercase tracking-wider text-white/70 font-semibold mb-2">StoryCredits</p>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold text-white">
                {storyCredits.remaining === null ? 'unbegrenzt' : storyCredits.remaining}
              </p>
              <p className="text-xs text-white/60">verbleibend</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-white">
                {storyCredits.used} / {storyCredits.limit === null ? 'unbegrenzt' : storyCredits.limit}
              </p>
              <p className="text-xs text-white/60">verbraucht / limit</p>
            </div>
          </div>
          <p className="text-xs text-white/60 mt-2">Kosten pro Generierung: {storyCredits.costPerGeneration} StoryCredit</p>
        </motion.div>
      )}

      {/* Big Create Button */}
      <motion.button
        onClick={onGenerate}
        disabled={generateDisabled}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className={`w-full py-5 rounded-2xl font-bold text-xl text-white flex items-center justify-center gap-4 relative overflow-hidden ${
          generateDisabled ? 'opacity-60 cursor-not-allowed' : ''
        }`}
        style={{
          fontFamily: '"Fredoka", sans-serif',
          background: 'linear-gradient(135deg, #A989F2, #FF6B9D, #FF9B5C)',
          boxShadow: '0 8px 40px rgba(169,137,242,0.4), 0 0 60px rgba(255,107,157,0.2)',
        }}
      >
        {/* Shimmer overlay */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -inset-full animate-[shimmer_3s_ease-in-out_infinite]"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)', transform: 'translateX(-100%)' }} />
        </div>
        <Sparkles size={28} className="relative z-10" />
        <span className="relative z-10">
          {generateDisabled ? 'Nicht verfuegbar' : `${t('wizard.buttons.generate')} (1 StoryCredit)`}
        </span>
        <Sparkles size={28} className="relative z-10" />
      </motion.button>

      {generateDisabledMessage && (
        <p className="text-xs text-rose-300 text-center">{generateDisabledMessage}</p>
      )}
    </div>
  );
}
