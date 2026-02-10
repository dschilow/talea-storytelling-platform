import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, MessageCircle, Smile, Sparkles, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

type Feeling = 'funny' | 'warm' | 'exciting' | 'crazy' | 'meaningful';

interface Props {
  state: { feelings: Feeling[] };
  updateState: (updates: any) => void;
}

const feelingMeta: Record<Feeling, { icon: React.ComponentType<any>; tone: string }> = {
  funny: { icon: Smile, tone: '#be8f55' },
  warm: { icon: Heart, tone: '#c5828c' },
  exciting: { icon: Zap, tone: '#a88f80' },
  crazy: { icon: Sparkles, tone: '#8e7daf' },
  meaningful: { icon: MessageCircle, tone: '#b79f8e' },
};

export default function Step4StoryFeeling({ state, updateState }: Props) {
  const { t } = useTranslation();

  const toggleFeeling = (id: Feeling) => {
    const selected = state.feelings.includes(id);
    if (selected) {
      updateState({ feelings: state.feelings.filter((item) => item !== id) });
      return;
    }
    if (state.feelings.length >= 3) return;
    updateState({ feelings: [...state.feelings, id] });
  };

  const remaining = Math.max(0, 3 - state.feelings.length);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h2 className="mb-1 text-2xl font-bold text-foreground" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
          {t('wizard.titles.feeling')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('wizard.subtitles.feeling')}</p>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {(Object.keys(feelingMeta) as Feeling[]).map((id) => {
          const selected = state.feelings.includes(id);
          const blocked = !selected && state.feelings.length >= 3;
          const Icon = feelingMeta[id].icon;
          const tone = feelingMeta[id].tone;

          return (
            <button
              key={id}
              type="button"
              disabled={blocked}
              onClick={() => toggleFeeling(id)}
              className={cn(
                'relative rounded-2xl border p-4 text-left transition-colors',
                selected ? 'bg-accent/55' : 'bg-card/70 hover:bg-accent/35',
                blocked && 'cursor-not-allowed opacity-45'
              )}
              style={{ borderColor: selected ? `${tone}66` : 'var(--color-border)' }}
            >
              <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${tone}1f` }}>
                <Icon className="h-4 w-4" style={{ color: tone }} />
              </div>
              <p className="text-sm font-semibold text-foreground">{t(`wizard.feelings.${id}.title`)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t(`wizard.feelings.${id}.description`)}</p>

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

      <div className="rounded-2xl border border-border bg-card/65 px-4 py-3">
        <p className="text-sm font-semibold text-foreground/85">
          {state.feelings.length === 0 && t('wizard.subtitles.feeling')}
          {state.feelings.length > 0 && state.feelings.length < 3 && `${state.feelings.length}/3 ${t('wizard.common.selected')} - noch ${remaining} moeglich`}
          {state.feelings.length >= 3 && `${state.feelings.length}/3 ${t('wizard.common.selected')}`}
        </p>
      </div>
    </div>
  );
}

