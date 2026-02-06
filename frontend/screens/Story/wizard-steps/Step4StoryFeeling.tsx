// Step 4: Story Feeling — Dark magical theme with glow cards

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smile, Heart, Zap, Stars, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Feeling = 'funny' | 'warm' | 'exciting' | 'crazy' | 'meaningful';
interface Props { state: { feelings: Feeling[] }; updateState: (updates: any) => void; }

export default function Step4StoryFeeling({ state, updateState }: Props) {
  const { t } = useTranslation();

  const FEELINGS = [
    { id: 'funny', title: `😂 ${t('wizard.feelings.funny.title')}`, description: t('wizard.feelings.funny.description'), icon: Smile, gradient: 'from-yellow-500 to-orange-500', color: '#FBBF24', glow: 'rgba(251,191,36,0.35)' },
    { id: 'warm', title: `❤️ ${t('wizard.feelings.warm.title')}`, description: t('wizard.feelings.warm.description'), icon: Heart, gradient: 'from-red-500 to-pink-500', color: '#F87171', glow: 'rgba(248,113,113,0.35)' },
    { id: 'exciting', title: `⚡ ${t('wizard.feelings.exciting.title')}`, description: t('wizard.feelings.exciting.description'), icon: Zap, gradient: 'from-blue-500 to-cyan-500', color: '#60A5FA', glow: 'rgba(96,165,250,0.35)' },
    { id: 'crazy', title: `🤪 ${t('wizard.feelings.crazy.title')}`, description: t('wizard.feelings.crazy.description'), icon: Stars, gradient: 'from-purple-500 to-pink-500', color: '#A989F2', glow: 'rgba(169,137,242,0.35)' },
    { id: 'meaningful', title: `💭 ${t('wizard.feelings.meaningful.title')}`, description: t('wizard.feelings.meaningful.description'), icon: MessageCircle, gradient: 'from-emerald-500 to-teal-500', color: '#34D399', glow: 'rgba(52,211,153,0.35)' },
  ];

  const handleToggleFeeling = (feelingId: Feeling) => {
    const current = state.feelings;
    if (current.includes(feelingId)) {
      updateState({ feelings: current.filter(f => f !== feelingId) });
    } else if (current.length < 3) {
      updateState({ feelings: [...current, feelingId] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h2 className="text-2xl font-extrabold text-white mb-2" style={{ fontFamily: '"Fredoka", sans-serif' }}>
          🎭 {t('wizard.titles.feeling')}
        </h2>
        <p className="text-white/50 text-sm">{t('wizard.subtitles.feeling')}</p>
      </motion.div>

      {/* Feelings Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {FEELINGS.map((feeling, i) => {
          const isSelected = state.feelings.includes(feeling.id as Feeling);
          const Icon = feeling.icon;
          const isDisabled = !isSelected && state.feelings.length >= 3;

          return (
            <motion.button
              key={feeling.id}
              onClick={() => handleToggleFeeling(feeling.id as Feeling)}
              disabled={isDisabled}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, type: 'spring' as const, damping: 20 }}
              whileHover={!isDisabled ? { y: -5, scale: 1.03 } : {}}
              whileTap={!isDisabled ? { scale: 0.97 } : {}}
              className={`relative ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {/* Glow behind selected */}
              {isSelected && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  className="absolute -inset-1 rounded-2xl z-0"
                  style={{ background: feeling.glow, filter: 'blur(14px)' }}
                />
              )}

              <div className={`relative z-10 p-6 rounded-2xl transition-all duration-300 ${
                isSelected ? 'border-2 shadow-xl' : 'bg-white/[0.06] border border-white/10 hover:bg-white/10'
              }`} style={isSelected ? { background: `${feeling.color}12`, borderColor: `${feeling.color}60` } : undefined}>
                {/* Check badge */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1, rotate: 360 }} exit={{ scale: 0 }}
                      transition={{ type: 'spring' as const, damping: 12 }}
                      className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold shadow-lg z-20"
                      style={{ background: 'linear-gradient(135deg, #34D399, #10B981)' }}>✓</motion.div>
                  )}
                </AnimatePresence>

                {/* Icon */}
                <div className={`w-14 h-14 mx-auto mb-3 rounded-xl bg-gradient-to-br ${feeling.gradient} flex items-center justify-center shadow-lg`}>
                  <Icon size={28} className="text-white" />
                </div>

                <h3 className="font-bold text-base text-white mb-1">{feeling.title}</h3>
                <p className="text-xs text-white/40">{feeling.description}</p>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Selection counter */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className={`p-4 rounded-2xl text-center border transition-all ${
          state.feelings.length === 0
            ? 'border-white/10 bg-white/[0.04]'
            : state.feelings.length < 3
              ? 'border-blue-400/30 bg-blue-500/10'
              : 'border-emerald-500/30 bg-emerald-500/10'
        }`}
      >
        <p className="font-semibold text-white/70">
          {state.feelings.length === 0 && `👆 ${t('wizard.subtitles.feeling')}`}
          {state.feelings.length > 0 && state.feelings.length < 3 && `✓ ${state.feelings.length}/3 ${t('wizard.common.selected')} — noch ${3 - state.feelings.length} möglich`}
          {state.feelings.length >= 3 && `✅ ${state.feelings.length}/3 ${t('wizard.common.selected')}`}
        </p>
      </motion.div>
    </div>
  );
}
