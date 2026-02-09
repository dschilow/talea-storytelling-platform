// Step 5: Special Wishes â€” Dark magical theme with toggle glow cards

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, BookHeart, Star, Shuffle, Smile, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
    { id: 'rhymes', title: `ðŸŽµ ${t('wizard.wishes.rhymes.title')}`, description: t('wizard.wishes.rhymes.description'), icon: Music, color: '#FF6B9D', glow: 'rgba(255,107,157,0.3)' },
    { id: 'moral', title: `ðŸ“– ${t('wizard.wishes.moral.title')}`, description: t('wizard.wishes.moral.description'), icon: BookHeart, color: '#60A5FA', glow: 'rgba(96,165,250,0.3)' },
    { id: 'avatarIsHero', title: `â­ ${t('wizard.wishes.avatarIsHero.title')}`, description: t('wizard.wishes.avatarIsHero.description'), icon: Star, color: '#FBBF24', glow: 'rgba(251,191,36,0.3)' },
    { id: 'famousCharacters', title: `ðŸ‘‘ ${t('wizard.wishes.famousCharacters.title')}`, description: t('wizard.wishes.famousCharacters.description'), icon: Shuffle, color: '#A989F2', glow: 'rgba(169,137,242,0.3)' },
    { id: 'happyEnd', title: `ðŸ˜Š ${t('wizard.wishes.happyEnd.title')}`, description: t('wizard.wishes.happyEnd.description'), icon: Smile, color: '#34D399', glow: 'rgba(52,211,153,0.3)' },
    { id: 'surpriseEnd', title: `â— ${t('wizard.wishes.surpriseEnd.title')}`, description: t('wizard.wishes.surpriseEnd.description'), icon: AlertCircle, color: '#FF9B5C', glow: 'rgba(255,155,92,0.3)' },
  ];

  const handleToggleWish = (wishId: string) => {
    updateState({ [wishId]: !state[wishId as keyof typeof state] });
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h2 className="text-2xl font-extrabold text-foreground mb-2" style={{ fontFamily: '"Fredoka", sans-serif' }}>
          âœ¨ {t('wizard.titles.wishes')}
        </h2>
        <p className="text-muted-foreground text-sm">{t('wizard.subtitles.wishes')}</p>
      </motion.div>

      {/* Wishes Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {WISHES.map((wish, i) => {
          const isSelected = state[wish.id as keyof typeof state] as boolean;
          const Icon = wish.icon;

          return (
            <motion.button
              key={wish.id}
              onClick={() => handleToggleWish(wish.id)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, type: 'spring' as const, damping: 20 }}
              whileHover={{ y: -3, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="relative"
            >
              {isSelected && (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  className="absolute -inset-1 rounded-2xl z-0"
                  style={{ background: wish.glow, filter: 'blur(12px)' }} />
              )}
              <div className={`relative z-10 p-4 rounded-2xl transition-all duration-300 flex flex-col items-center text-center gap-2 ${
                isSelected ? 'border-2 shadow-xl' : 'bg-card/70 border border-border hover:bg-accent/70'
              }`} style={isSelected ? { background: `${wish.color}12`, borderColor: `${wish.color}50` } : undefined}>
                <AnimatePresence>
                  {isSelected && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg z-20"
                      style={{ background: 'linear-gradient(135deg, #34D399, #10B981)' }}>âœ“</motion.div>
                  )}
                </AnimatePresence>
                <Icon size={24} style={{ color: isSelected ? wish.color : 'rgba(255,255,255,0.35)' }} />
                <p className="font-semibold text-sm text-foreground">{wish.title}</p>
                <p className="text-[11px] text-muted-foreground/80">{wish.description}</p>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Custom Wish Input */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <label className="block mb-2">
          <span className="text-sm font-semibold text-foreground/80">{t('wizard.common.customWish')}</span>
        </label>
        <textarea
          value={state.customWish}
          onChange={(e) => updateState({ customWish: e.target.value })}
          placeholder={t('wizard.common.customWishPlaceholder')}
          maxLength={200}
          className="w-full p-4 rounded-2xl bg-card/70 border border-border text-foreground placeholder:text-muted-foreground/70
            focus:border-[#A989F2]/60 focus:ring-2 focus:ring-[#A989F2]/20 focus:bg-card/70
            resize-none transition-all backdrop-blur-sm outline-none"
          rows={3}
        />
        <p className="text-[11px] text-muted-foreground/70 mt-1">{state.customWish.length}/200 {t('wizard.common.chars')}</p>
      </motion.div>

      {/* Info Box */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        className="rounded-2xl p-4 bg-blue-500/10 border border-blue-400/20"
      >
        <p className="text-sm text-blue-300/80">
          <strong className="text-blue-300">{t('wizard.common.note')}</strong> {t('wizard.common.wishesNote')}
        </p>
      </motion.div>
    </div>
  );
}


