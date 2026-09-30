import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Clock3, GraduationCap, Heart, Sparkles, Users2 } from 'lucide-react';
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
    learningMode?: {
      enabled: boolean;
      subjects: string[];
      difficulty: string;
      learningObjectives: string[];
    };
    broughtArtifact?: {
      name: string;
      avatarName: string;
      emoji?: string;
      imageUrl?: string;
      journeysUntilNextLevel?: number;
      nextLevel?: number;
    } | null;
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
  { key: 'avatars', icon: Users2, tone: 'var(--talea-text-tertiary)' },
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
    avatars: `${state.selectedAvatars.length} ${state.selectedAvatars.length === 1 ? t('wizard.common.avatarSingular') : t('wizard.summary.avatars')} ${t('wizard.common.selected')}`,
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

  // Unknown "remaining" (older billing payloads) is derived instead of rendering an empty slot.
  const remainingCredits =
    storyCredits?.remaining === null
      ? t('wizard.credits.unlimited')
      : storyCredits?.remaining ??
        (storyCredits?.limit != null ? Math.max(0, storyCredits.limit - storyCredits.used) : null);

  const rowClass = 'flex items-center gap-3 px-4 py-3';
  const iconClass = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg';
  const labelClass = 'w-24 shrink-0 text-[15px] text-[var(--talea-text-secondary)] sm:w-40';
  const valueClass = 'min-w-0 flex-1 text-right text-[15px] font-medium text-[var(--talea-text-primary)]';

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h2 className="mb-1 text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--talea-font-display)' }}>
          {t('wizard.titles.summary')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('wizard.subtitles.summary')}</p>
      </motion.div>

      {/* iOS grouped list: one card, rows divided by hairlines */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="divide-y divide-[var(--talea-border-light)] overflow-hidden rounded-[1.375rem] border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)]"
      >
        {summaryRows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.key} className={rowClass}>
              <span className={iconClass} style={{ background: `color-mix(in srgb, ${row.tone} 14%, transparent)` }}>
                <Icon className="h-4 w-4" style={{ color: row.tone }} />
              </span>
              <p className={labelClass}>{labels[row.key]}</p>
              <p className={valueClass}>{values[row.key]}</p>
            </div>
          );
        })}

        {state.broughtArtifact && (
          <div className={rowClass}>
            {state.broughtArtifact.imageUrl ? (
              <img src={state.broughtArtifact.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className={`${iconClass} bg-amber-500/15 text-base`}>{state.broughtArtifact.emoji || '\u{1F381}'}</span>
            )}
            <p className={labelClass}>Schatz</p>
            <p className={valueClass}>
              {state.broughtArtifact.name}
              <span className="block text-[13px] font-normal text-[var(--talea-text-tertiary)]">
                reist mit {state.broughtArtifact.avatarName}
                {state.broughtArtifact.journeysUntilNextLevel
                  ? ` · noch ${state.broughtArtifact.journeysUntilNextLevel} ${state.broughtArtifact.journeysUntilNextLevel === 1 ? 'Reise' : 'Reisen'} bis Stufe ${state.broughtArtifact.nextLevel}`
                  : ''}
              </span>
            </p>
          </div>
        )}

        {state.learningMode?.enabled && state.learningMode.subjects.length > 0 && (
          <div className={rowClass}>
            <span className={iconClass} style={{ background: 'color-mix(in srgb, var(--primary) 14%, transparent)' }}>
              <GraduationCap className="h-4 w-4 text-[var(--primary)]" />
            </span>
            <p className={labelClass}>{t('wizard.steps.learning')}</p>
            <p className={valueClass}>
              {state.learningMode.subjects.map((subject) => t(`wizard.learning.subjects.${subject}`)).join(', ')}
              <span className="block text-[13px] font-normal text-[var(--talea-text-tertiary)]">
                {t(`wizard.learning.difficulties.${state.learningMode.difficulty}.title`)}
                {state.learningMode.learningObjectives.length > 0 ? ` · ${state.learningMode.learningObjectives.join(' · ')}` : ''}
              </span>
            </p>
          </div>
        )}

        {(activeWishes.length > 0 || state.customWish) && (
          <div className={rowClass}>
            <span className={iconClass} style={{ background: 'color-mix(in srgb, #b98552 14%, transparent)' }}>
              <Sparkles className="h-4 w-4" style={{ color: '#b98552' }} />
            </span>
            <p className={labelClass}>{t('wizard.steps.wishes')}</p>
            <p className={valueClass}>
              {activeWishes.join(', ')}
              {state.customWish ? (
                <span className="block text-[13px] font-normal italic text-[var(--talea-text-tertiary)]">
                  &bdquo;{state.customWish}&ldquo;
                </span>
              ) : null}
            </p>
          </div>
        )}
      </motion.div>

      {storyCredits && (
        <p className="text-center text-[13px] text-[var(--talea-text-secondary)]">
          {t('wizard.credits.costPerGen', { count: storyCredits.costPerGeneration ?? 1 })}
          {remainingCredits !== null ? <> · {remainingCredits} {t('wizard.credits.remaining')}</> : null}
        </p>
      )}

      <button
        type="button"
        onClick={onGenerate}
        disabled={generateDisabled}
        className="flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-6 text-[17px] font-semibold text-[var(--primary-foreground)] transition-[filter,transform] hover:brightness-[1.06] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Sparkles className="h-5 w-5" />
        {generateDisabled ? t('wizard.credits.notAvailable') : `${t('wizard.buttons.generate')} (1 ${t('wizard.credits.coin')})`}
      </button>

      {generateDisabledMessage && <p className="text-center text-[13px] text-[var(--talea-danger)]">{generateDisabledMessage}</p>}
    </div>
  );
}
