import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Baby, Clock3, GraduationCap, Sparkles, UserCheck, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

type AgeGroup = '3-5' | '6-8' | '9-12' | '13+' | null;
type Length = 'short' | 'medium' | 'long' | null;
type AIModel =
  | 'gpt-5-nano'
  | 'gpt-5-mini'
  | 'gpt-5.2'
  | 'gemini-3-flash-preview'
  | 'gemini-3.1-pro-preview';

type ModelOption = {
  id: AIModel;
  title: string;
  subtitle: string;
  cost: string;
  tone: string;
  recommended?: boolean;
};

interface Props {
  state: { ageGroup: AgeGroup; length: Length; aiModel: AIModel };
  updateState: (updates: any) => void;
  showModelSelection?: boolean;
}

const ageGroups = [
  { id: '3-5', icon: Baby, tone: '#c5828c' },
  { id: '6-8', icon: Users, tone: '#a88f80' },
  { id: '9-12', icon: GraduationCap, tone: '#7a78ab' },
  { id: '13+', icon: UserCheck, tone: '#b79f8e' },
] as const;

const lengths = [
  { id: 'short', tone: '#b79f8e' },
  { id: 'medium', tone: '#be8f55' },
  { id: 'long', tone: '#c5828c' },
] as const;

const models: ModelOption[] = [
  {
    id: 'gemini-3.1-pro-preview',
    title: 'Gemini 3.1 Pro Preview',
    subtitle: 'Google AI',
    cost: 'Preview',
    tone: '#8d7f6c',
  },
  {
    id: 'gemini-3-flash-preview',
    title: 'Gemini 3 Flash',
    subtitle: 'Google AI',
    cost: 'FREE',
    tone: '#b79f8e',
    recommended: true,
  },
  {
    id: 'gpt-5-nano',
    title: 'GPT-5 Nano',
    subtitle: 'Schnell und guenstig',
    cost: '$0.05 / 1M',
    tone: '#a88f80',
  },
  {
    id: 'gpt-5-mini',
    title: 'GPT-5 Mini',
    subtitle: 'Ausgewogen',
    cost: '$0.25 / 1M',
    tone: '#8e7daf',
  },
  {
    id: 'gpt-5.2',
    title: 'GPT-5.2',
    subtitle: 'Beste Qualitaet',
    cost: '$1.25 / 1M',
    tone: '#c5828c',
  },
];

function SelectionBadge() {
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
      className="absolute right-2 top-2 rounded-full bg-[#b79f8e] px-2 py-0.5 text-[11px] font-bold text-white"
    >
      OK
    </motion.span>
  );
}

export default function Step3AgeAndLength({
  state,
  updateState,
  showModelSelection = true,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-7">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h2 className="mb-1 text-2xl font-bold text-foreground" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
          {t('wizard.titles.ageLength')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('wizard.subtitles.ageLength')}</p>
      </motion.div>

      <section>
        <h3 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-foreground/85">
          <Users className="h-4 w-4 text-muted-foreground" />
          {t('wizard.summary.age')}
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {ageGroups.map((item) => {
            const selected = state.ageGroup === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => updateState({ ageGroup: item.id })}
                className={cn(
                  'relative rounded-2xl border p-3 text-left transition-colors',
                  selected ? 'bg-accent/55' : 'bg-card/70 hover:bg-accent/35'
                )}
                style={{ borderColor: selected ? `${item.tone}60` : 'var(--color-border)' }}
              >
                <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${item.tone}1f` }}>
                  <Icon className="h-4 w-4" style={{ color: item.tone }} />
                </div>
                <p className="text-sm font-semibold text-foreground">{t(`wizard.ageGroups.${item.id}.title`)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t(`wizard.ageGroups.${item.id}.description`)}</p>
                <AnimatePresence>{selected && <SelectionBadge />}</AnimatePresence>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-foreground/85">
          <Clock3 className="h-4 w-4 text-muted-foreground" />
          {t('wizard.summary.length')}
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {lengths.map((item) => {
            const selected = state.length === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => updateState({ length: item.id })}
                className={cn(
                  'relative rounded-2xl border p-3 text-center transition-colors',
                  selected ? 'bg-accent/55' : 'bg-card/70 hover:bg-accent/35'
                )}
                style={{ borderColor: selected ? `${item.tone}60` : 'var(--color-border)' }}
              >
                <p className="text-sm font-semibold text-foreground">{t(`wizard.lengths.${item.id}.title`)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t(`wizard.lengths.${item.id}.duration`)}</p>
                <p className="text-[11px] text-muted-foreground/80">{t(`wizard.lengths.${item.id}.chapters`)}</p>
                <AnimatePresence>{selected && <SelectionBadge />}</AnimatePresence>
              </button>
            );
          })}
        </div>
      </section>

      {showModelSelection && (
        <section>
          <h3 className="mb-1 inline-flex items-center gap-2 text-sm font-semibold text-foreground/85">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            AI Modell
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">Waehle das Modell fuer die Story-Generierung.</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {models.map((model) => {
              const selected = state.aiModel === model.id;
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => updateState({ aiModel: model.id as AIModel })}
                  className={cn(
                    'relative rounded-2xl border p-3 text-left transition-colors',
                    selected ? 'bg-accent/55' : 'bg-card/70 hover:bg-accent/35'
                  )}
                  style={{ borderColor: selected ? `${model.tone}60` : 'var(--color-border)' }}
                >
                  {model.recommended && (
                    <span className="mb-2 inline-flex rounded-full bg-[#b79f8e] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Empfohlen
                    </span>
                  )}
                  <p className="text-sm font-semibold text-foreground">{model.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{model.subtitle}</p>
                  <p className="mt-1 text-xs font-semibold" style={{ color: model.tone }}>
                    {model.cost}
                  </p>
                  <AnimatePresence>{selected && <SelectionBadge />}</AnimatePresence>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

