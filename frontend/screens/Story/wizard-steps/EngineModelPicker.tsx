import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import {
  DEFAULT_OPENROUTER_STORY_MODEL,
  type AIModel,
  type AIProvider,
  type OpenRouterStoryModel,
} from '@/types/story';
import { TaleaSelectedBadge } from '@/components/talea/TaleaPastelPrimitives';
import { idleTileClass, selectedTileClass } from './wizardChoices';

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

// Ordered best-story-quality-first. Ranking basis: EQ-Bench Creative Writing
// (the relevant benchmark for children's stories — NOT coding scores).
// Kimi K2.6 = 1753 (top open-weight), GLM-5.2 = 1657. Newer MiniMax/Qwen/
// DeepSeek releases lead on coding/agentic/reasoning, not creative prose.
// Prices verified against the live OpenRouter /api/v1/models catalog on
// 2026-07-09 — several had drifted from OpenRouter's real current pricing
// (e.g. kimi-k2.6 was shown at $0.45/1M out, actual is $3.41/1M).
const OPENROUTER_MODEL_CONFIGS: OpenRouterModelConfig[] = [
  // Released 2026-09-22; list price verified against the OpenRouter catalog on 2026-09-25.
  { id: 'openai/gpt-6.1-sol', title: '⭐ GPT-6.1 Sol — Standard im Bilderbuch-Modus (schreibt in einem Durchgang)', provider: 'OpenAI', cost: '$2 in / $10 out' },
  { id: 'openai/gpt-6-sol', title: 'GPT-6 Sol — Vorgänger, etwas gleichförmiger', provider: 'OpenAI', cost: '$2 in / $10 out' },
  { id: 'openai/gpt-6-luna', title: 'GPT-6 Luna — sehr günstig, schwächere Geschichten', provider: 'OpenAI', cost: '$0.10 in / $0.50 out' },
  // EQ-Bench Creative Writing v3 (2026-09-25): Kimi K3 2082 vs Kimi K2.6 1725.
  { id: 'moonshotai/kimi-k3', title: 'Kimi K3 — stärkster Geschichten-Autor (EQ-Bench), teuer', provider: 'Moonshot AI', cost: '$3 in / $15 out' },
  { id: 'moonshotai/kimi-k2.6', title: 'Kimi K2.6 (Vorgänger von K3)', provider: 'Moonshot AI', cost: '$0.65 in / $3.41 out' },
  { id: 'z-ai/glm-5.3', title: 'GLM-5.3 (neu, Aug 2026)', provider: 'Z.ai', cost: '$1.40 in / $4.40 out' },
  { id: 'z-ai/glm-5.3-flash', title: 'GLM-5.3 Flash — sehr günstig (Luna-Preisklasse)', provider: 'Z.ai', cost: '$0.15 in / $0.50 out' },
  { id: 'aion-labs/aion-3.5-mini', title: 'Aion 3.5 Mini - Story/Roleplay Test', provider: 'AionLabs', cost: '$0.70 in / $1.40 out' },
  { id: '~anthropic/claude-sonnet-latest', title: 'Claude Sonnet Latest — Top-Qualität, teuer', provider: 'Anthropic', cost: '$2 in / $10 out' },
  { id: 'aion-labs/aion-3.5', title: 'Aion 3.5 - Premium Story/Roleplay (EQ-Bench 1929)', provider: 'AionLabs', cost: '$3 in / $6 out' },
  { id: '~moonshotai/kimi-latest', title: 'Kimi Latest', provider: 'Moonshot AI', cost: '$0.65 in / $3.41 out' },
  { id: 'moonshotai/kimi-k2.5', title: 'Kimi K2.5 (alt)', provider: 'Moonshot AI', cost: '$0.45 in / $2.25 out' },
  { id: 'minimax/minimax-m3', title: 'MiniMax M3 (neu, eher Agent/Multimodal)', provider: 'MiniMax', cost: '$0.30 in / $1.20 out' },
  { id: 'minimax/minimax-m2.7', title: 'MiniMax M2.7 — günstig', provider: 'MiniMax', cost: '$0.30 in / $1.20 out' },
  { id: 'qwen/qwen3.8-max-0902', title: 'Qwen 3.8 Max (neu, Sep 2026)', provider: 'Qwen', cost: '$2 in / $6 out' },
  { id: 'qwen/qwen3.8-flash', title: 'Qwen 3.8 Flash — sehr günstig (Luna-Preisklasse)', provider: 'Qwen', cost: '$0.15 in / $0.47 out' },
  { id: 'qwen/qwen3.7-plus', title: 'Qwen 3.7 Plus (neu)', provider: 'Qwen', cost: '$0.32 in / $1.28 out' },
  { id: 'deepseek/deepseek-v4-pro', title: 'DeepSeek V4 Pro (eher Coding/Algorithmik)', provider: 'DeepSeek', cost: '$0.96 in / $1.91 out' },
  { id: 'xiaomi/mimo-v2.6-pro', title: 'Xiaomi MiMo V2.6 Pro (neu, Sep 2026)', provider: 'Xiaomi', cost: '$0.43 in / $0.87 out' },
  { id: 'x-ai/grok-4.5', title: 'Grok 4.5 - Test (Frontier, teuer)', provider: 'xAI', cost: '$2 in / $6 out' },
  { id: 'deepseek/deepseek-v4.1-flash', title: 'DeepSeek V4.1 Flash (neu, extrem günstig)', provider: 'DeepSeek', cost: '$0.02 in / $0.60 out' },
  { id: 'google/gemini-3.6-flash', title: 'Gemini 3.6 Flash - Test', provider: 'Google', cost: '$1.50 in / $7.50 out' },
  { id: 'x-ai/grok-4.3', title: 'Grok 4.3', provider: 'xAI', cost: '$1.25 in / $2.50 out' },
  { id: 'google/gemini-3.5-flash', title: 'Gemini 3.5 Flash', provider: 'Google', cost: '$1.50 in / $9 out' },
  { id: '~google/gemini-pro-latest', title: 'Gemini Pro Latest', provider: 'Google', cost: '$2 in / $12 out' },
  { id: '~google/gemini-flash-latest', title: 'Gemini Flash Latest', provider: 'Google', cost: '$1.50 in / $9 out' },
  { id: 'openrouter/owl-alpha', title: 'Owl Alpha (gratis)', provider: 'OpenRouter', cost: 'FREE' },
  { id: '~openai/gpt-mini-latest', title: 'GPT Mini Latest ⚠ schwächere Story-Qualität', provider: 'OpenAI', cost: '$0.75 in / $4.50 out' },
  { id: 'openai/gpt-5.6-luna', title: 'GPT-5.6 Luna (Vorgänger — nur zum Vergleich)', provider: 'OpenAI', cost: '$0.20 in / $1.20 out' },
  { id: 'openai/gpt-5.6-terra', title: 'GPT-5.6 Terra 🧪 Test', provider: 'OpenAI', cost: 'unbekannt' },
];

interface Props {
  state: { aiModel: AIModel; aiProvider?: AIProvider; openRouterModel?: OpenRouterStoryModel };
  updateState: (updates: { aiModel?: AIModel; aiProvider?: AIProvider; openRouterModel?: OpenRouterStoryModel }) => void;
}

/**
 * Admin-only writer choice. It used to sit under "Wie lang?" in the child's
 * step; it belongs with the other engine controls in the mode step.
 */
export default function EngineModelPicker({ state, updateState }: Props) {
  const { t } = useTranslation();
  const activeProvider = state.aiProvider ?? 'native';
  const activeOpenRouterModel = state.openRouterModel || DEFAULT_OPENROUTER_STORY_MODEL;
  const tile = (selected: boolean) =>
    cn('relative rounded-2xl border p-3 text-left transition-colors', selected ? selectedTileClass : idleTileClass);

  return (
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
              className={tile(selected)}
              aria-pressed={selected}
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
              <AnimatePresence>{selected && <TaleaSelectedBadge />}</AnimatePresence>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => updateState({ aiProvider: 'openrouter', openRouterModel: activeOpenRouterModel })}
          className={tile(activeProvider === 'openrouter')}
          aria-pressed={activeProvider === 'openrouter'}
        >
          <span className="mb-2 inline-flex rounded-full bg-[var(--talea-text-tertiary)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Test
          </span>
          <p className="text-sm font-semibold text-foreground">OpenRouter</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('wizard.aiModel.models.openrouter')}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--talea-text-tertiary)]">Multi-Model</p>
          <AnimatePresence>{activeProvider === 'openrouter' && <TaleaSelectedBadge />}</AnimatePresence>
        </button>
      </div>

      {activeProvider === 'openrouter' && (
        <div className="mt-4 rounded-2xl border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] p-3">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="openrouter-model">
            {t('wizard.aiModel.openrouterModelLabel')}
          </label>
          <select
            id="openrouter-model"
            value={activeOpenRouterModel}
            onChange={(event) => updateState({ openRouterModel: event.target.value as OpenRouterStoryModel })}
            className="w-full rounded-xl border border-[var(--talea-border-light)] bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-[var(--talea-text-tertiary)]"
          >
            {OPENROUTER_MODEL_CONFIGS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.title} - {model.provider} - {model.cost}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-muted-foreground">{t('wizard.aiModel.openrouterHint')}</p>
        </div>
      )}
    </section>
  );
}
