import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, BookHeart, Music, Shuffle, Smile, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

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

const wishes = [
  { id: 'rhymes', icon: Music, tone: '#c5828c' },
  { id: 'moral', icon: BookHeart, tone: '#a88f80' },
  { id: 'avatarIsHero', icon: Star, tone: '#be8f55' },
  { id: 'famousCharacters', icon: Shuffle, tone: '#8e7daf' },
  { id: 'happyEnd', icon: Smile, tone: '#b79f8e' },
  { id: 'surpriseEnd', icon: AlertCircle, tone: '#d0885e' },
] as const;

export default function Step5SpecialWishes({ state, updateState }: Props) {
  const { t } = useTranslation();

  const toggleWish = (id: (typeof wishes)[number]['id']) => {
    updateState({ [id]: !state[id] });
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h2 className="mb-1 text-2xl font-bold text-foreground" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
          {t('wizard.titles.wishes')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('wizard.subtitles.wishes')}</p>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {wishes.map((wish) => {
          const selected = state[wish.id];
          const Icon = wish.icon;

          return (
            <button
              key={wish.id}
              type="button"
              onClick={() => toggleWish(wish.id)}
              className={cn(
                'relative rounded-2xl border p-4 text-left transition-colors',
                selected ? 'bg-accent/55' : 'bg-card/70 hover:bg-accent/35'
              )}
              style={{ borderColor: selected ? `${wish.tone}66` : 'var(--color-border)' }}
            >
              <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${wish.tone}1f` }}>
                <Icon className="h-4 w-4" style={{ color: wish.tone }} />
              </div>
              <p className="text-sm font-semibold text-foreground">{t(`wizard.wishes.${wish.id}.title`)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t(`wizard.wishes.${wish.id}.description`)}</p>

              <AnimatePresence>
                {selected && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute right-2 top-2 rounded-full bg-[#b79f8e] px-2 py-0.5 text-[11px] font-bold text-white"
                  >
                    OK
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </div>

      <section>
        <label className="mb-2 block text-sm font-semibold text-foreground/85">{t('wizard.common.customWish')}</label>
        <textarea
          value={state.customWish}
          onChange={(event) => updateState({ customWish: event.target.value })}
          placeholder={t('wizard.common.customWishPlaceholder')}
          maxLength={200}
          rows={3}
          className="w-full resize-none rounded-2xl border border-border bg-card/70 px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-[#a88f80]"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {state.customWish.length}/200 {t('wizard.common.chars')}
        </p>
      </section>
    </div>
  );
}

