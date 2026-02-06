// Step 3: Age Group, Story Length & AI Model — Dark magical theme

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Baby, Users, GraduationCap, UserCheck, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type AgeGroup = '3-5' | '6-8' | '9-12' | '13+' | null;
type Length = 'short' | 'medium' | 'long' | null;
type AIModel = 'gpt-5-nano' | 'gpt-5-mini' | 'gpt-5.2' | 'gemini-3-flash-preview';

interface Props {
  state: { ageGroup: AgeGroup; length: Length; aiModel: AIModel };
  updateState: (updates: any) => void;
}

export default function Step3AgeAndLength({ state, updateState }: Props) {
  const { t } = useTranslation();

  const AGE_GROUPS = [
    { id: '3-5', title: t('wizard.ageGroups.3-5.title'), icon: Baby, description: t('wizard.ageGroups.3-5.description'), color: '#FF6B9D', glow: 'rgba(255,107,157,0.35)' },
    { id: '6-8', title: t('wizard.ageGroups.6-8.title'), icon: Users, description: t('wizard.ageGroups.6-8.description'), color: '#6366F1', glow: 'rgba(99,102,241,0.35)' },
    { id: '9-12', title: t('wizard.ageGroups.9-12.title'), icon: GraduationCap, description: t('wizard.ageGroups.9-12.description'), color: '#A989F2', glow: 'rgba(169,137,242,0.35)' },
    { id: '13+', title: t('wizard.ageGroups.13+.title'), icon: UserCheck, description: t('wizard.ageGroups.13+.description'), color: '#2DD4BF', glow: 'rgba(45,212,191,0.35)' },
  ];

  const LENGTHS = [
    { id: 'short', title: '⚡', label: t('wizard.lengths.short.title'), duration: t('wizard.lengths.short.duration'), chapters: t('wizard.lengths.short.chapters'), color: '#34D399', glow: 'rgba(52,211,153,0.35)' },
    { id: 'medium', title: '📖', label: t('wizard.lengths.medium.title'), duration: t('wizard.lengths.medium.duration'), chapters: t('wizard.lengths.medium.chapters'), color: '#FBBF24', glow: 'rgba(251,191,36,0.35)' },
    { id: 'long', title: '📚', label: t('wizard.lengths.long.title'), duration: t('wizard.lengths.long.duration'), chapters: t('wizard.lengths.long.chapters'), color: '#FF9B5C', glow: 'rgba(255,155,92,0.35)' },
  ];

  const AI_MODELS = [
    { id: 'gemini-3-flash-preview', title: '🔥 Gemini 3 Flash', description: 'KOSTENLOS - Google AI', cost: 'FREE', recommended: true, color: '#34D399', glow: 'rgba(52,211,153,0.35)' },
    { id: 'gpt-5-nano', title: '⚡ GPT-5 Nano', description: 'Schnell & günstig', cost: '$0.05/1M', color: '#60A5FA', glow: 'rgba(96,165,250,0.35)' },
    { id: 'gpt-5-mini', title: '✨ GPT-5 Mini', description: 'Bewährt', cost: '$0.25/1M', color: '#A989F2', glow: 'rgba(169,137,242,0.35)' },
    { id: 'gpt-5.2', title: '🌟 GPT-5.2', description: 'Beste Qualität', cost: '$1.25/1M', color: '#F472B6', glow: 'rgba(244,114,182,0.35)' },
  ];

  const handleSelectAge = (ageGroup: AgeGroup) => updateState({ ageGroup });
  const handleSelectLength = (length: Length) => updateState({ length });
  const handleSelectAiModel = (aiModel: AIModel) => updateState({ aiModel });

  return (
    <div className="space-y-8">
      {/* Title */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h2 className="text-2xl font-extrabold text-white mb-2" style={{ fontFamily: '"Fredoka", sans-serif' }}>
          🎯 {t('wizard.titles.ageLength')}
        </h2>
        <p className="text-white/50 text-sm">{t('wizard.subtitles.ageLength')}</p>
      </motion.div>

      {/* Age Group Selection */}
      <div>
        <h3 className="text-base font-semibold text-white/80 mb-3 flex items-center gap-2">
          <Users size={18} className="text-white/60" /> {t('wizard.steps.ageLength')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {AGE_GROUPS.map((group, i) => {
            const isSelected = state.ageGroup === group.id;
            const Icon = group.icon;
            return (
              <motion.button
                key={group.id}
                onClick={() => handleSelectAge(group.id as AgeGroup)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, type: 'spring' as const, damping: 20 }}
                whileHover={{ y: -4, scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="relative"
              >
                {isSelected && (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    className="absolute -inset-1 rounded-2xl z-0"
                    style={{ background: group.glow, filter: 'blur(12px)' }} />
                )}
                <div className={`relative z-10 p-4 rounded-2xl transition-all duration-300 flex flex-col items-center text-center gap-2 ${
                  isSelected ? 'border-2 shadow-xl' : 'bg-white/[0.06] border border-white/10 hover:bg-white/10'
                }`} style={isSelected ? { background: `${group.color}12`, borderColor: `${group.color}60` } : undefined}>
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg z-20"
                        style={{ background: 'linear-gradient(135deg, #34D399, #10B981)' }}>✓</motion.div>
                    )}
                  </AnimatePresence>
                  <Icon size={28} style={{ color: isSelected ? group.color : 'rgba(255,255,255,0.4)' }} />
                  <p className="font-bold text-sm text-white">{group.title}</p>
                  <p className="text-[11px] text-white/40">{group.description}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Length Selection */}
      <div>
        <h3 className="text-base font-semibold text-white/80 mb-3 flex items-center gap-2">
          <Clock size={18} className="text-white/60" /> {t('wizard.summary.length')}
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {LENGTHS.map((length, i) => {
            const isSelected = state.length === length.id;
            return (
              <motion.button
                key={length.id}
                onClick={() => handleSelectLength(length.id as Length)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, type: 'spring' as const, damping: 20 }}
                whileHover={{ y: -4, scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="relative"
              >
                {isSelected && (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    className="absolute -inset-1 rounded-2xl z-0"
                    style={{ background: length.glow, filter: 'blur(12px)' }} />
                )}
                <div className={`relative z-10 p-5 rounded-2xl transition-all duration-300 text-center ${
                  isSelected ? 'border-2 shadow-xl' : 'bg-white/[0.06] border border-white/10 hover:bg-white/10'
                }`} style={isSelected ? { background: `${length.color}12`, borderColor: `${length.color}60` } : undefined}>
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg z-20"
                        style={{ background: 'linear-gradient(135deg, #34D399, #10B981)' }}>✓</motion.div>
                    )}
                  </AnimatePresence>
                  <p className="text-3xl mb-2">{length.title}</p>
                  <p className="font-bold text-sm text-white">{length.label}</p>
                  <p className="text-xs text-white/50 mt-1">{length.duration}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{length.chapters}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* AI Model Selection */}
      <div>
        <h3 className="text-base font-semibold text-white/80 mb-1 flex items-center gap-2">
          🤖 AI Model
        </h3>
        <p className="text-xs text-white/40 mb-3">Wähle das KI-Modell für die Story-Generierung</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {AI_MODELS.map((model, i) => {
            const isSelected = state.aiModel === model.id;
            return (
              <motion.button
                key={model.id}
                onClick={() => handleSelectAiModel(model.id as AIModel)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, type: 'spring' as const, damping: 20 }}
                whileHover={{ y: -4, scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="relative"
              >
                {isSelected && (
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    className="absolute -inset-1 rounded-2xl z-0"
                    style={{ background: model.glow, filter: 'blur(12px)' }} />
                )}
                <div className={`relative z-10 p-4 rounded-2xl transition-all duration-300 text-center ${
                  isSelected ? 'border-2 shadow-xl' : 'bg-white/[0.06] border border-white/10 hover:bg-white/10'
                }`} style={isSelected ? { background: `${model.color}12`, borderColor: `${model.color}60` } : undefined}>
                  {model.recommended && (
                    <div className="absolute -top-2 -left-2 text-[10px] px-2 py-0.5 rounded-full font-bold text-white shadow-md z-20"
                      style={{ background: 'linear-gradient(135deg, #34D399, #10B981)' }}>⭐ NEU</div>
                  )}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg z-20"
                        style={{ background: 'linear-gradient(135deg, #34D399, #10B981)' }}>✓</motion.div>
                    )}
                  </AnimatePresence>
                  <p className="text-lg mb-1">{model.title}</p>
                  <p className="text-[11px] text-white/40 mb-1">{model.description}</p>
                  <p className={`text-xs font-bold ${model.cost === 'FREE' ? 'text-emerald-400' : 'text-white/30'}`}>
                    {model.cost}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Selection Summary */}
      <AnimatePresence>
        {state.ageGroup && state.length && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="rounded-2xl p-4 border border-emerald-500/30 bg-emerald-500/10"
          >
            <p className="font-semibold text-emerald-300 mb-1">✓ {t('wizard.common.selected')}</p>
            <p className="text-sm text-emerald-400/80">
              {t('wizard.summary.age')}: {state.ageGroup}, {t('wizard.summary.length')}: {
                state.length === 'short' ? t('wizard.lengths.short.duration') :
                  state.length === 'medium' ? t('wizard.lengths.medium.duration') :
                    t('wizard.lengths.long.duration')
              }
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

