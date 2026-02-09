import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Dog, Home, Mountain, Rocket, Sparkles, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

type MainCategory = 'fairy-tales' | 'adventure' | 'magic' | 'animals' | 'scifi' | 'modern' | null;

interface Props {
  state: { mainCategory: MainCategory };
  updateState: (updates: any) => void;
}

const categories = [
  { id: 'fairy-tales', icon: Sparkles, tone: '#a180bf' },
  { id: 'adventure', icon: Mountain, tone: '#d0885e' },
  { id: 'magic', icon: Wand2, tone: '#6e90bf' },
  { id: 'animals', icon: Dog, tone: '#4f8f7c' },
  { id: 'scifi', icon: Rocket, tone: '#5a8db6' },
  { id: 'modern', icon: Home, tone: '#7d8795' },
] as const;

export default function Step2CategorySelection({ state, updateState }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h2 className="mb-1 text-2xl font-bold text-foreground" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
          {t('wizard.titles.category')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('wizard.subtitles.category')}</p>
      </motion.div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {categories.map((category, index) => {
          const selected = state.mainCategory === category.id;
          const Icon = category.icon;
          const title = t(`wizard.categories.${category.id.replace('-', '_')}.title`);
          const description = t(`wizard.categories.${category.id.replace('-', '_')}.description`);
          const examples = t(`wizard.categories.${category.id.replace('-', '_')}.examples`);

          return (
            <motion.button
              key={category.id}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => updateState({ mainCategory: category.id })}
              className={cn(
                'relative rounded-2xl border p-4 text-left transition-colors',
                selected ? 'bg-accent/55 shadow-[0_10px_24px_rgba(41,56,77,0.14)]' : 'bg-card/70 hover:bg-accent/35'
              )}
              style={{ borderColor: selected ? `${category.tone}60` : 'var(--color-border)' }}
            >
              <div className="mb-3 flex items-start gap-3">
                <div
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ background: `${category.tone}1f` }}
                >
                  <Icon className="h-5 w-5" style={{ color: category.tone }} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-foreground">{title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                </div>
              </div>

              <p className="line-clamp-2 text-xs text-foreground/75">{examples}</p>

              <AnimatePresence>
                {selected && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute right-3 top-3 rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                    style={{ background: '#4f8f7c' }}
                  >
                    OK
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
