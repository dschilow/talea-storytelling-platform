import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Baby, Clock3, GraduationCap, Sparkles, UserCheck, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import {
  DEFAULT_OPENROUTER_STORY_MODEL,
  type AIModel,
  type AIProvider,
  type OpenRouterStoryModel,
} from '@/types/story';

type AgeGroup = '3-5' | '6-8' | '9-12' | '13+' | null;
type Length = 'short' | 'medium' | 'long' | null;


type Step3State = {
  ageGroup: AgeGroup;
  length: Length;
  aiModel: AIModel;
  aiProvider?: AIProvider;
  openRouterModel?: OpenRouterStoryModel;
};

interface Props {
  state: Step3State;
  updateState: (updates: Partial<Step3State>) => void;
  showModelSelection?: boolean;
}

const ageGroups = [
  { id: '3-5', icon: Baby, tone: '#c5828c' },
  { id: '6-8', icon: Users, tone: 'var(--talea-text-tertiary)' },
  { id: '9-12', icon: GraduationCap, tone: '#7a78ab' },
  { id: '13+', icon: UserCheck, tone: 'var(--talea-text-tertiary)' },
] as const;

const lengths = [
  { id: 'short', tone: 'var(--talea-text-tertiary)' },
  { id: 'medium', tone: '#be8f55' },
  { id: 'long', tone: '#c5828c' },
] as const;

type ModelConfig = { id: AIModel; title: string; subtitleKey: string; cost: string; tone: string; recommended?: boolean };
type OpenRouterModelConfig = { id: OpenRouterStoryModel; title: string; provider: string; cost: string };

const MODEL_CONFIGS: ModelConfig[] = [
  { id: 'claude-sonnet-4-6', title: 'Claude Sonnet 4.6', subtitleKey: 'claude_sonnet', cost: '$3 in / $15 out', tone: '#b06f4f' },
  { id: 'gemini-3-pro-preview', title: 'Gemini 3 Pro Preview', subtitleKey: 'gemini3_pro', cost: 'Preview', tone: '#9b8b79' },
  { id: 'gemini-3.1-pro-preview', title: 'Gemini 3.1 Pro', subtitleKey: 'gemini31_pro', cost: 'Preview', tone: '#8d7f6c', recommended: true },
  { id: 'gemini-3-flash-preview', title: 'Gemini 3 Flash', subtitleKey: 'gemini3_flash', cost: 'FREE', tone: 'var(--talea-text-tertiary)' },
  { id: 'gpt-5.4', title: 'GPT-5.4', subtitleKey: 'gpt54', cost: '$1.25 / 1M', tone: '#c5828c' },
  { id: 'gpt-5.4-mini', title: 'GPT-5.4 Mini', subtitleKey: 'gpt54_mini', cost: '$0.75 in / $4.50 out', tone: '#8e7daf' },
  { id: 'minimax-m2.7', title: 'MiniMax M2.7', subtitleKey: 'minimax_m27', cost: 'Runware', tone: '#e09145' },
];

const OPENROUTER_MODEL_CONFIGS: OpenRouterModelConfig[] = [
  { id: 'moonshotai/kimi-k2.6', title: 'Kimi K2.6', provider: 'Moonshot AI', cost: '$0.15 in / $0.45 out' },
  { id: '~moonshotai/kimi-latest', title: 'Kimi Latest', provider: 'Moonshot AI', cost: '$0.75 in / $3.50 out' },
  { id: 'moonshotai/kimi-k2.5', title: 'Kimi K2.5', provider: 'Moonshot AI', cost: '$0.44 in / $2.00 out' },
  { id: 'minimax/minimax-m2.7', title: 'MiniMax M2.7', provider: 'MiniMax', cost: '$0.30 in / $1.20 out' },
  { id: 'x-ai/grok-4.3', title: 'Grok 4.3', provider: 'xAI', cost: '$1.25 in / $2.50 out' },
  { id: 'openrouter/owl-alpha', title: 'Owl Alpha', provider: 'OpenRouter', cost: 'FREE' },
  { id: '~google/gemini-pro-latest', title: 'Gemini Pro Latest', provider: 'Google', cost: '$2 in / $12 out' },
  { id: '~google/gemini-flash-latest', title: 'Gemini Flash Latest', provider: 'Google', cost: '$0.50 in / $3 out' },
  { id: '~anthropic/claude-sonnet-latest', title: 'Claude Sonnet Latest', provider: 'Anthropic', cost: '$3 in / $15 out' },
  { id: '~openai/gpt-mini-latest', title: 'GPT Mini Latest', provider: 'OpenAI', cost: '$0.75 in / $4.50 out' },
  { id: 'deepseek/deepseek-v4-pro', title: 'DeepSeek V4 Pro', provider: 'DeepSeek', cost: '$0.44 in / $0.87 out' },
  { id: 'qwen/qwen3.6-max-preview', title: 'Qwen 3.6 Max', provider: 'Qwen', cost: '$1.04 in / $6.24 out' },
];

function SelectionBadge() {
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
      className="absolute right-2 top-2 rounded-full bg-[var(--talea-text-tertiary)] px-2 py-0.5 text-[11px] font-bold text-white"
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
  const activeProvider = state.aiProvider ?? 'native';
  const activeOpenRouterModel = state.openRouterModel || DEFAULT_OPENROUTER_STORY_MODEL;

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
            {t('wizard.aiModel.title')}
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">{t('wizard.aiModel.subtitle')}</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {MODEL_CONFIGS.map((model) => {
              const selected = activeProvider === 'native' && state.aiModel === model.id;
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => updateState({ aiProvider: 'native', aiModel: model.id })}
                  className={cn(
                    'relative rounded-2xl border p-3 text-left transition-colors',
                    selected ? 'bg-accent/55' : 'bg-card/70 hover:bg-accent/35'
                  )}
                  style={{ borderColor: selected ? `${model.tone}60` : 'var(--color-border)' }}
                >
                  {model.recommended && (
                    <span className="mb-2 inline-flex rounded-full bg-[var(--talea-text-tertiary)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      {t('wizard.aiModel.recommended')}
                    </span>
                  )}
                  <p className="text-sm font-semibold text-foreground">{model.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t(`wizard.aiModel.models.${model.subtitleKey}`)}</p>
                  <p className="mt-1 text-xs font-semibold" style={{ color: model.tone }}>
                    {model.cost}
                  </p>
                  <AnimatePresence>{selected && <SelectionBadge />}</AnimatePresence>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() =>
                updateState({
                  aiProvider: 'openrouter',
                  openRouterModel: activeOpenRouterModel,
                })
              }
              className={cn(
                'relative rounded-2xl border p-3 text-left transition-colors',
                activeProvider === 'openrouter' ? 'bg-accent/55' : 'bg-card/70 hover:bg-accent/35'
              )}
              style={{ borderColor: activeProvider === 'openrouter' ? '#4f9a9a60' : 'var(--color-border)' }}
            >
              <span className="mb-2 inline-flex rounded-full bg-[var(--talea-text-tertiary)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Test
              </span>
              <p className="text-sm font-semibold text-foreground">OpenRouter</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('wizard.aiModel.models.openrouter')}</p>
              <p className="mt-1 text-xs font-semibold text-[var(--talea-text-tertiary)]">
                Multi-Model
              </p>
              <AnimatePresence>{activeProvider === 'openrouter' && <SelectionBadge />}</AnimatePresence>
            </button>
          </div>

          {activeProvider === 'openrouter' && (
            <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-card/70 p-3">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="openrouter-model">
                {t('wizard.aiModel.openrouterModelLabel')}
              </label>
              <select
                id="openrouter-model"
                value={activeOpenRouterModel}
                onChange={(event) => updateState({ openRouterModel: event.target.value as OpenRouterStoryModel })}
                className="w-full rounded-xl border border-[var(--color-border)] bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-[var(--talea-text-tertiary)]"
              >
                {OPENROUTER_MODEL_CONFIGS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.title} - {model.provider} - {model.cost}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-muted-foreground">
                {t('wizard.aiModel.openrouterHint')}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
