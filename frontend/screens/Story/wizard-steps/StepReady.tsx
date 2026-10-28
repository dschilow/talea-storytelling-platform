import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { useBackend } from '../../../hooks/useBackend';
import { useOptionalChildProfiles } from '../../../contexts/ChildProfilesContext';
import { StoryWizardIcon, type StoryWizardIconName } from './StoryWizardIcon';
import type { LearningModeValue } from './LearningModeSection';
import { BOOK_FORMS, type ExperienceForm } from './StepBookFormat';
import {
  CATEGORY_CHOICES,
  FEELING_CHOICES,
  LENGTH_CHOICES,
  TONE,
  WizardStepHeading,
  categoryKey,
  choiceFor,
  idleTileClass,
  selectedTileClass,
  type WizardCategory,
  type WizardFeeling,
  type WizardLength,
} from './wizardChoices';

export type ReadyEditTarget = 'avatars' | 'category' | 'book' | 'shape' | 'extras';
type AgeGroup = '3-5' | '6-8' | '9-12' | '13+';

const AGE_GROUPS: AgeGroup[] = ['3-5', '6-8', '9-12', '13+'];

interface Props {
  state: {
    selectedAvatars: string[];
    mainCategory: WizardCategory | null;
    ageGroup: AgeGroup | null;
    length: WizardLength | null;
    feelings: WizardFeeling[];
    rhymes: boolean;
    moral: boolean;
    avatarIsHero: boolean;
    famousCharacters: boolean;
    happyEnd: boolean;
    surpriseEnd: boolean;
    customWish: string;
    learningMode: LearningModeValue;
    chapterBookMode: boolean;
    experienceForm: ExperienceForm | null;
    bookChapters: number;
    broughtArtifact: { name: string; avatarName: string } | null;
  };
  updateState: (updates: { ageGroup: AgeGroup }) => void;
  onEdit: (target: ReadyEditTarget) => void;
  onGenerate: () => void;
  storyCredits?: { limit: number | null; used: number; remaining: number | null; costPerGeneration: 1 } | null;
  generateDisabled?: boolean;
  generateDisabledMessage?: string;
  /** A Figurenserie: the figure and the episode the next story will be ("Kapitän Blubbert · Folge 5"). */
  series?: { label: string; imageUrl?: string | null };
}

interface AvatarPreview {
  id: string;
  name: string;
  imageUrl?: string;
}

function IconSquare({ icon, tone }: { icon: StoryWizardIconName; tone: string }) {
  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.85rem]"
      style={{ background: `color-mix(in srgb, ${tone} 15%, transparent)`, color: tone }}
    >
      <StoryWizardIcon name={icon} className="h-8 w-8" />
    </span>
  );
}

/**
 * The last page reads like the choices themselves: every row shows the picture
 * the child tapped and leads back to that step. Below it the age (filled in from
 * the child profile) and one big button.
 */
export default function StepReady({
  state,
  updateState,
  onEdit,
  onGenerate,
  storyCredits,
  generateDisabled = false,
  generateDisabledMessage,
  series,
}: Props) {
  const { t, i18n } = useTranslation();
  const backend = useBackend();
  const activeProfileId = useOptionalChildProfiles()?.activeProfileId;
  const [avatars, setAvatars] = useState<AvatarPreview[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await backend.avatar.list({ profileId: activeProfileId || undefined });
        if (!active) return;
        setAvatars(
          (response.avatars || []).map((avatar: any) => ({ id: avatar.id, name: avatar.name, imageUrl: avatar.imageUrl }))
        );
      } catch (error) {
        console.warn('[StepReady] Loading avatars for the summary failed:', error);
      }
    })();
    return () => {
      active = false;
    };
  }, [backend, activeProfileId]);

  const listFormat = useMemo(() => {
    try {
      return new Intl.ListFormat(i18n.language || 'de', { type: 'conjunction' });
    } catch {
      return null;
    }
  }, [i18n.language]);
  const joinList = (items: string[]) => (listFormat ? listFormat.format(items) : items.join(', '));

  const chosenAvatars = state.selectedAvatars
    .map((id) => avatars.find((avatar) => avatar.id === id))
    .filter((avatar): avatar is AvatarPreview => Boolean(avatar));
  const avatarValue =
    chosenAvatars.length > 0
      ? joinList(chosenAvatars.map((avatar) => avatar.name))
      : `${state.selectedAvatars.length} ${state.selectedAvatars.length === 1 ? t('wizard.common.avatarSingular') : t('wizard.summary.avatars')}`;

  const category = choiceFor(CATEGORY_CHOICES, state.mainCategory);
  const length = choiceFor(LENGTH_CHOICES, state.length);
  const feelings = state.feelings
    .map((id) => choiceFor(FEELING_CHOICES, id))
    .filter((choice): choice is NonNullable<typeof choice> => Boolean(choice));
  const bookForm = BOOK_FORMS.find((form) => form.id === state.experienceForm);

  // Hauptrolle and Happy End start switched on; only a change from that is news. In a series the figure leads and the
  // cast is planned, so those two wishes are not offered there.
  const extras = [
    state.rhymes && t('wizard.wishes.rhymes.title'),
    state.moral && t('wizard.wishes.moral.title'),
    !series && state.famousCharacters && t('wizard.wishes.famousCharacters.title'),
    state.surpriseEnd && t('wizard.wishes.surpriseEnd.title'),
    !series && !state.avatarIsHero && t('wizard.ready.withoutHero'),
    !state.happyEnd && t('wizard.ready.withoutHappyEnd'),
    state.broughtArtifact && t('wizard.ready.treasure', { name: state.broughtArtifact.name }),
    state.learningMode.enabled &&
      state.learningMode.subjects.length > 0 &&
      `${t('wizard.steps.learning')}: ${joinList(state.learningMode.subjects.map((subject) => t(`wizard.learning.subjects.${subject}`)))}`,
  ].filter(Boolean) as string[];

  const remainingCredits =
    storyCredits?.remaining === null
      ? t('wizard.credits.unlimited')
      : storyCredits?.remaining ?? (storyCredits?.limit != null ? Math.max(0, storyCredits.limit - storyCredits.used) : null);

  const rowClass =
    'flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-[var(--talea-surface-inset)]/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--primary)]';
  const captionClass = 'block text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--talea-text-tertiary)]';
  const valueClass = 'block truncate text-[16px] font-semibold text-[var(--talea-text-primary)]';
  const chevron = <ChevronRight className="h-5 w-5 shrink-0 text-[var(--talea-text-tertiary)]" aria-hidden />;
  const ageMissing = state.ageGroup === null;

  return (
    <div className="space-y-6">
      <WizardStepHeading title={t('wizard.titles.summary')} subtitle={t('wizard.subtitles.summary')} />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="divide-y divide-[var(--talea-border-light)] overflow-hidden rounded-[1.375rem] border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)]"
      >
        <button type="button" className={rowClass} onClick={() => onEdit('avatars')}>
          {chosenAvatars.length > 0 ? (
            <span className="flex shrink-0 -space-x-3">
              {chosenAvatars.slice(0, 3).map((avatar) => (
                <span
                  key={avatar.id}
                  className="h-11 w-11 overflow-hidden rounded-full bg-[var(--talea-surface-inset)] ring-2 ring-[var(--talea-surface-primary)]"
                >
                  {avatar.imageUrl ? <img src={avatar.imageUrl} alt="" className="h-full w-full object-cover" /> : null}
                </span>
              ))}
            </span>
          ) : (
            <IconSquare icon="people" tone={TONE.mint} />
          )}
          <span className="min-w-0 flex-1">
            <span className={captionClass}>{t('wizard.ready.who')}</span>
            <span className={valueClass}>{avatarValue}</span>
          </span>
          {chevron}
        </button>

        {category && !series && (
          <button type="button" className={rowClass} onClick={() => onEdit('category')}>
            <IconSquare icon={category.icon} tone={category.tone} />
            <span className="min-w-0 flex-1">
              <span className={captionClass}>{t('wizard.ready.world')}</span>
              <span className={valueClass}>{t(`wizard.categories.${categoryKey(category.id)}.title`)}</span>
            </span>
            {chevron}
          </button>
        )}

        {series && (
          <button type="button" className={rowClass} onClick={() => onEdit('category')}>
            {series.imageUrl ? (
              <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-white ring-2 ring-[var(--talea-surface-primary)]">
                <img src={series.imageUrl} alt="" className="h-full w-full object-cover" />
              </span>
            ) : (
              <IconSquare icon="books3" tone={TONE.mint} />
            )}
            <span className="min-w-0 flex-1">
              <span className={captionClass}>Figurenabenteuer</span>
              <span className={valueClass}>{series.label}</span>
            </span>
            {chevron}
          </button>
        )}

        {state.chapterBookMode && bookForm && (
          <button type="button" className={rowClass} onClick={() => onEdit('book')}>
            <IconSquare icon={bookForm.icon} tone={bookForm.tone} />
            <span className="min-w-0 flex-1">
              <span className={captionClass}>Buch</span>
              <span className={valueClass}>
                {bookForm.title} · {state.bookChapters} Kapitel
              </span>
            </span>
            {chevron}
          </button>
        )}

        {!state.chapterBookMode && length && (
          <button type="button" className={rowClass} onClick={() => onEdit('shape')}>
            <IconSquare icon={length.icon} tone={length.tone} />
            <span className="min-w-0 flex-1">
              <span className={captionClass}>{t('wizard.ready.length')}</span>
              <span className={valueClass}>
                {t(`wizard.lengths.${length.id}.title`)} · {t(`wizard.lengths.${length.id}.chapters`)}
              </span>
            </span>
            {chevron}
          </button>
        )}

        {feelings.length > 0 && (
          <button type="button" className={rowClass} onClick={() => onEdit('shape')}>
            <span className="flex shrink-0 -space-x-2">
              {feelings.map((feeling) => (
                <span
                  key={feeling.id}
                  className="flex h-11 w-11 items-center justify-center rounded-full ring-2 ring-[var(--talea-surface-primary)]"
                  style={{ background: `color-mix(in srgb, ${feeling.tone} 18%, var(--talea-surface-primary))`, color: feeling.tone }}
                >
                  <StoryWizardIcon name={feeling.icon} className="h-8 w-8" />
                </span>
              ))}
            </span>
            <span className="min-w-0 flex-1">
              <span className={captionClass}>{t('wizard.ready.feeling')}</span>
              <span className={valueClass}>{joinList(feelings.map((feeling) => t(`wizard.feelings.${feeling.id}.title`)))}</span>
            </span>
            {chevron}
          </button>
        )}

        <button type="button" className={rowClass} onClick={() => onEdit('extras')}>
          <IconSquare icon="shootingStar" tone={TONE.gold} />
          <span className="min-w-0 flex-1">
            <span className={captionClass}>{t('wizard.ready.extras')}</span>
            <span className={cn(valueClass, 'whitespace-normal', extras.length === 0 && !state.customWish && 'font-medium text-[var(--talea-text-secondary)]')}>
              {extras.length > 0 ? extras.join(' · ') : state.customWish ? t('wizard.extras.ownWishTitle') : t('wizard.ready.noExtras')}
            </span>
            {state.customWish ? (
              <span className="mt-0.5 block truncate text-[13px] italic text-[var(--talea-text-secondary)]">&bdquo;{state.customWish}&ldquo;</span>
            ) : null}
          </span>
          {chevron}
        </button>
      </motion.div>

      <section aria-labelledby="wizard-age-title" className="space-y-2.5">
        <p id="wizard-age-title" className="px-1 text-[15px] font-semibold text-[var(--talea-text-primary)]">
          {t('wizard.ready.ageTitle')}
        </p>
        <div className="grid grid-cols-4 gap-2" role="group" aria-labelledby="wizard-age-title">
          {AGE_GROUPS.map((age) => {
            const selected = state.ageGroup === age;
            return (
              <button
                key={age}
                type="button"
                aria-pressed={selected}
                onClick={() => updateState({ ageGroup: age })}
                className={cn(
                  'rounded-2xl border px-1 py-2 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]',
                  selected ? selectedTileClass : idleTileClass
                )}
              >
                <span className="block text-[17px] font-bold tabular-nums text-[var(--talea-text-primary)]">{age.replace('-', '–')}</span>
                <span className="block text-[12px] text-[var(--talea-text-secondary)]">{t('wizard.ready.ageYears')}</span>
              </button>
            );
          })}
        </div>
        {/* A gentle nudge, not an error colour: nothing went wrong, one tap is missing. */}
        {ageMissing && <p className="px-1 text-[13px] font-semibold text-[var(--primary)]">{t('wizard.ready.ageMissing')}</p>}
      </section>

      <div className="space-y-2.5">
        <motion.button
          type="button"
          onClick={onGenerate}
          disabled={generateDisabled || ageMissing}
          whileTap={generateDisabled || ageMissing ? undefined : { scale: 0.98 }}
          className="flex min-h-[3.75rem] w-full items-center justify-center gap-2.5 rounded-[1.25rem] [background:var(--talea-gradient-brand)] px-6 text-[18px] font-bold text-[var(--primary-foreground)] shadow-[var(--talea-shadow-soft)] transition-[filter] hover:brightness-[1.05] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <StoryWizardIcon name="sparkles" className="h-7 w-7" strokeWidth={2.8} tint={0.35} />
          {generateDisabled ? t('wizard.credits.notAvailable') : t('wizard.buttons.generate')}
        </motion.button>

        {storyCredits && !generateDisabled && (
          <p className="text-center text-[13px] text-[var(--talea-text-secondary)]">
            {t('wizard.credits.costPerGen', { count: storyCredits.costPerGeneration ?? 1 })}
            {remainingCredits !== null ? <> · {remainingCredits} {t('wizard.credits.remaining')}</> : null}
          </p>
        )}
        {generateDisabledMessage && <p className="text-center text-[13px] text-[var(--talea-danger)]">{generateDisabledMessage}</p>}
      </div>
    </div>
  );
}
