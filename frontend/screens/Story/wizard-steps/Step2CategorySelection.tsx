// Step 2: Category Selection — Bold colored cards on dark theme

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Mountain, Wand2, Dog, Rocket, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type MainCategory = 'fairy-tales' | 'adventure' | 'magic' | 'animals' | 'scifi' | 'modern' | null;
interface Props { state: { mainCategory: MainCategory }; updateState: (updates: any) => void; }

export default function Step2CategorySelection({ state, updateState }: Props) {
  const { t } = useTranslation();

  const CATEGORIES = [
    { id: 'fairy-tales', title: t('wizard.categories.fairy_tales.title'), description: t('wizard.categories.fairy_tales.description'), icon: Sparkles, examples: t('wizard.categories.fairy_tales.examples'), gradient: 'from-purple-500 to-pink-500', color: '#A989F2', glow: 'rgba(169,137,242,0.4)' },
    { id: 'adventure', title: t('wizard.categories.adventure.title'), description: t('wizard.categories.adventure.description'), icon: Mountain, examples: t('wizard.categories.adventure.examples'), gradient: 'from-orange-500 to-red-500', color: '#FF9B5C', glow: 'rgba(255,155,92,0.4)' },
    { id: 'magic', title: t('wizard.categories.magic.title'), description: t('wizard.categories.magic.description'), icon: Wand2, examples: t('wizard.categories.magic.examples'), gradient: 'from-blue-500 to-indigo-500', color: '#6366F1', glow: 'rgba(99,102,241,0.4)' },
    { id: 'animals', title: t('wizard.categories.animals.title'), description: t('wizard.categories.animals.description'), icon: Dog, examples: t('wizard.categories.animals.examples'), gradient: 'from-emerald-500 to-teal-500', color: '#2DD4BF', glow: 'rgba(45,212,191,0.4)' },
    { id: 'scifi', title: t('wizard.categories.scifi.title'), description: t('wizard.categories.scifi.description'), icon: Rocket, examples: t('wizard.categories.scifi.examples'), gradient: 'from-cyan-500 to-blue-500', color: '#06B6D4', glow: 'rgba(6,182,212,0.4)' },
    { id: 'modern', title: t('wizard.categories.modern.title'), description: t('wizard.categories.modern.description'), icon: Home, examples: t('wizard.categories.modern.examples'), gradient: 'from-slate-400 to-slate-600', color: '#94A3B8', glow: 'rgba(148,163,184,0.3)' },
  ];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h2 className="text-2xl font-extrabold text-white mb-2" style={{ fontFamily: '"Fredoka", sans-serif' }}>
          📚 {t('wizard.titles.category')}
        </h2>
        <p className="text-white/50 text-sm">{t('wizard.subtitles.category')}</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CATEGORIES.map((cat, i) => {
          const isSelected = state.mainCategory === cat.id;
          const Icon = cat.icon;

          return (
            <motion.button
              key={cat.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, type: 'spring' as const, damping: 20 }}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => updateState({ mainCategory: cat.id })}
              className="relative text-left group"
            >
              {/* Glow behind selected */}
              {isSelected && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute -inset-1 rounded-3xl z-0"
                  style={{ background: `linear-gradient(135deg, ${cat.glow}, transparent)`, filter: 'blur(15px)' }}
                />
              )}

              <div className={`relative z-10 p-5 rounded-2xl transition-all duration-300 ${
                isSelected
                  ? 'border-2 shadow-xl'
                  : 'bg-white/[0.06] border border-white/10 hover:bg-white/10 hover:border-white/20'
              }`}
              style={isSelected ? {
                background: `linear-gradient(135deg, ${cat.color}15, ${cat.color}08)`,
                borderColor: `${cat.color}60`,
                boxShadow: `0 8px 30px ${cat.glow}`,
              } : undefined}
              >
                {/* Check badge */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                      className="absolute -top-3 -right-3 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-lg z-20"
                      style={{ background: 'linear-gradient(135deg, #34D399, #10B981)' }}
                    >
                      ✓
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-start gap-4 mb-3">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${cat.gradient} shadow-lg flex-shrink-0`}>
                    <Icon size={28} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-white mb-1">{cat.title}</h3>
                    <p className="text-sm text-white/50">{cat.description}</p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1">{t('wizard.common.examples')}</p>
                  <p className="text-sm text-white/60">{cat.examples}</p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="rounded-2xl p-4 bg-blue-500/10 border border-blue-400/20"
      >
        <p className="text-sm text-blue-300/80">
          <strong className="text-blue-300">{t('wizard.common.note')}</strong> {t('wizard.common.categoryNote')}
        </p>
      </motion.div>
    </div>
  );
}
