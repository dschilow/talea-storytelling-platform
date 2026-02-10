import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, CheckCircle2, Clock3, Heart, Sparkles, Users2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  state: {
    selectedAvatars: string[];
    mainCategory: string | null;
    ageGroup: string | null;
    length: string | null;
    feelings: string[];
    rhymes: boolean;
    moral: boolean;
    avatarIsHero: boolean;
    famousCharacters: boolean;
    happyEnd: boolean;
    surpriseEnd: boolean;
    customWish: string;
  };
  onGenerate: () => void;
  storyCredits?: {
    limit: number | null;
    used: number;
    remaining: number | null;
    costPerGeneration: 1;
  } | null;
  generateDisabled?: boolean;
  generateDisabledMessage?: string;
}

const summaryRows = [
  { key: 'avatars', icon: Users2, tone: '#a88f80' },
  { key: 'category', icon: BookOpen, tone: '#8e7daf' },
  { key: 'ageLength', icon: Clock3, tone: '#be8f55' },
  { key: 'feelings', icon: Heart, tone: '#c5828c' },
] as const;

export default function Step6Summary({
  state,
  onGenerate,
  storyCredits,
  generateDisabled = false,
  generateDisabledMessage,
}: Props) {
  const { t } = useTranslation();

  const categoryLabel = state.mainCategory
    ? t(`wizard.categories.${state.mainCategory.replace('-', '_')}.title`)
    : t('wizard.common.notSelected');
  const ageLabel = state.ageGroup ? t(`wizard.ageGroups.${state.ageGroup}.title`) : t('wizard.common.notSelected');
  const lengthLabel = state.length ? t(`wizard.lengths.${state.length}.title`) : t('wizard.common.notSelected');
  const feelingsLabel =
    state.feelings.length > 0
      ? state.feelings.map((item) => t(`wizard.feelings.${item}.title`)).join(', ')
      : t('wizard.common.notSelected');

  const activeWishes = [
    state.rhymes && t('wizard.wishes.rhymes.title'),
    state.moral && t('wizard.wishes.moral.title'),
    state.avatarIsHero && t('wizard.wishes.avatarIsHero.title'),
    state.famousCharacters && t('wizard.wishes.famousCharacters.title'),
    state.happyEnd && t('wizard.wishes.happyEnd.title'),
    state.surpriseEnd && t('wizard.wishes.surpriseEnd.title'),
  ].filter(Boolean) as string[];

  const values: Record<(typeof summaryRows)[number]['key'], string> = {
    avatars: `${state.selectedAvatars.length} ${t('wizard.summary.avatars')} ${t('wizard.common.selected')}`,
    category: categoryLabel,
    ageLength: `${ageLabel} - ${lengthLabel}`,
    feelings: feelingsLabel,
  };

  const labels: Record<(typeof summaryRows)[number]['key'], string> = {
    avatars: t('wizard.summary.avatars'),
    category: t('wizard.summary.category'),
    ageLength: `${t('wizard.summary.age')} & ${t('wizard.summary.length')}`,
    feelings: t('wizard.summary.feelings'),
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h2 className="mb-1 text-2xl font-bold text-foreground" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
          {t('wizard.titles.summary')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('wizard.subtitles.summary')}</p>
      </motion.div>

      <div className="space-y-3">
        {summaryRows.map((row, index) => {
          const Icon = row.icon;
          return (
            <motion.div
              key={row.key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-start gap-3 rounded-2xl border border-border bg-card/70 p-4"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${row.tone}1f` }}>
                <Icon className="h-4 w-4" style={{ color: row.tone }} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labels[row.key]}</p>
                <p className="mt-0.5 text-sm text-foreground">{values[row.key]}</p>
              </div>
              <CheckCircle2 className="mt-1 h-4 w-4 text-[#b79f8e]" />
            </motion.div>
          );
        })}

        {(activeWishes.length > 0 || state.customWish) && (
          <div className="rounded-2xl border border-border bg-card/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('wizard.titles.wishes')}</p>
            {activeWishes.length > 0 && (
              <p className="mt-1 text-sm text-foreground">{activeWishes.join(', ')}</p>
            )}
            {state.customWish && (
              <p className="mt-1 text-sm italic text-muted-foreground">"{state.customWish}"</p>
            )}
          </div>
        )}
      </div>

      {storyCredits && (
        <div className="rounded-2xl border border-[#d5bdaf45] bg-[#d5bdaf14] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground/85">StoryCredits</p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div>
              <p className="text-2xl font-bold text-foreground">
                {storyCredits.remaining === null ? 'unbegrenzt' : storyCredits.remaining}
              </p>
              <p className="text-xs text-muted-foreground">verbleibend</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-foreground">
                {storyCredits.used} / {storyCredits.limit === null ? 'unbegrenzt' : storyCredits.limit}
              </p>
              <p className="text-xs text-muted-foreground">verbraucht / limit</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Kosten pro Generierung: {storyCredits.costPerGeneration} StoryCredit
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onGenerate}
        disabled={generateDisabled}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border px-6 py-4 text-base font-bold text-[#233347] shadow-[0_12px_24px_rgba(43,57,77,0.16)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55"
        style={{ borderColor: '#d4c5b5', background: 'linear-gradient(135deg,#f2d9d6 0%,#e8d8e9 42%,#d6e3cf 100%)' }}
      >
        <Sparkles className="h-5 w-5" />
        {generateDisabled ? 'Nicht verfuegbar' : `${t('wizard.buttons.generate')} (1 StoryCredit)`}
      </button>

      {generateDisabledMessage && <p className="text-center text-xs text-rose-500">{generateDisabledMessage}</p>}
    </div>
  );
}

