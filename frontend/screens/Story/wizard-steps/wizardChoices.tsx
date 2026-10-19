import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import { TaleaSelectedBadge } from '@/components/talea/TaleaPastelPrimitives';
import { StoryWizardIcon, type StoryWizardIconName } from './StoryWizardIcon';

/** Brand accents; each has its own dark-mode value in brand-tokens.css. */
export const TONE = {
  rose: 'var(--talea-accent-rose)',
  terracotta: 'var(--talea-accent-terracotta)',
  gold: 'var(--talea-accent-gold)',
  mint: 'var(--talea-accent-mint)',
  sky: 'var(--talea-accent-sky)',
  peach: 'var(--talea-accent-peach)',
} as const;

interface ChoiceMeta<T extends string> {
  id: T;
  icon: StoryWizardIconName;
  tone: string;
}

export type WizardCategory = 'fairy-tales' | 'adventure' | 'magic' | 'animals' | 'scifi' | 'modern';
export type WizardLength = 'short' | 'medium' | 'long';
export type WizardFeeling = 'funny' | 'warm' | 'exciting' | 'crazy' | 'meaningful';
export type WizardWish = 'rhymes' | 'moral' | 'avatarIsHero' | 'famousCharacters' | 'happyEnd' | 'surpriseEnd';

export const CATEGORY_CHOICES: ChoiceMeta<WizardCategory>[] = [
  { id: 'fairy-tales', icon: 'castle', tone: TONE.rose },
  { id: 'adventure', icon: 'mountain', tone: TONE.terracotta },
  { id: 'magic', icon: 'wand', tone: TONE.gold },
  { id: 'animals', icon: 'fox', tone: TONE.mint },
  { id: 'scifi', icon: 'rocket', tone: TONE.sky },
  { id: 'modern', icon: 'house', tone: TONE.peach },
];

// One colour for the whole scale: the growing pile carries the meaning.
export const LENGTH_CHOICES: ChoiceMeta<WizardLength>[] = [
  { id: 'short', icon: 'books1', tone: TONE.sky },
  { id: 'medium', icon: 'books2', tone: TONE.sky },
  { id: 'long', icon: 'books3', tone: TONE.sky },
];

export const FEELING_CHOICES: ChoiceMeta<WizardFeeling>[] = [
  { id: 'funny', icon: 'laugh', tone: TONE.gold },
  { id: 'warm', icon: 'heartFace', tone: TONE.rose },
  { id: 'exciting', icon: 'wow', tone: TONE.terracotta },
  { id: 'crazy', icon: 'zany', tone: TONE.peach },
  { id: 'meaningful', icon: 'think', tone: TONE.sky },
];

export const WISH_CHOICES: ChoiceMeta<WizardWish>[] = [
  { id: 'rhymes', icon: 'notes', tone: TONE.sky },
  { id: 'moral', icon: 'owl', tone: TONE.gold },
  { id: 'avatarIsHero', icon: 'medal', tone: TONE.peach },
  { id: 'famousCharacters', icon: 'frogKing', tone: TONE.mint },
  { id: 'happyEnd', icon: 'rainbow', tone: TONE.rose },
  { id: 'surpriseEnd', icon: 'gift', tone: TONE.terracotta },
];

export const SUBJECT_CHOICES: ChoiceMeta<string>[] = [
  { id: 'math', icon: 'calculator', tone: TONE.sky },
  { id: 'science', icon: 'flask', tone: TONE.mint },
  { id: 'language', icon: 'speech', tone: TONE.rose },
  { id: 'history', icon: 'pyramid', tone: TONE.gold },
  { id: 'geography', icon: 'map', tone: TONE.terracotta },
  { id: 'social', icon: 'friends', tone: TONE.peach },
];

export function choiceFor<T extends string>(choices: ChoiceMeta<T>[], id: T | null | undefined): ChoiceMeta<T> | undefined {
  return choices.find((choice) => choice.id === id);
}

/** Translation keys use underscores ("fairy_tales"); the state uses the id ("fairy-tales"). */
export const categoryKey = (id: string) => id.replace('-', '_');

export const selectedTileClass =
  'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_9%,var(--talea-surface-primary))] ring-1 ring-[var(--primary)]';
export const idleTileClass =
  'border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] hover:bg-[var(--talea-surface-inset)]/60';

interface ChoiceTileProps {
  icon: StoryWizardIconName;
  tone: string;
  title: string;
  description?: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  /** Smaller picture for dense grids (wishes, subjects). */
  compact?: boolean;
  className?: string;
}

/** Picture first, one word below: a child who cannot read yet still chooses. */
export function ChoiceTile({
  icon,
  tone,
  title,
  description,
  selected,
  disabled = false,
  onClick,
  compact = false,
  className,
}: ChoiceTileProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      whileTap={reduceMotion || disabled ? undefined : { scale: 0.97 }}
      className={cn(
        'relative flex min-w-0 flex-col items-center rounded-[1.25rem] border px-2 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]',
        compact ? 'gap-1.5 pb-2.5 pt-3' : 'gap-2 pb-3 pt-3.5',
        selected ? selectedTileClass : idleTileClass,
        disabled && 'cursor-not-allowed opacity-45',
        className
      )}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-[1.1rem] transition-[background-color] duration-200',
          compact ? 'h-14 w-14' : 'h-[4.5rem] w-[4.5rem]'
        )}
        // Mixed onto the card colour, not transparency: on a selected (tinted) tile a see-through square turned grey.
        style={{ background: `color-mix(in srgb, ${tone} ${selected ? 22 : 14}%, var(--talea-surface-primary))`, color: tone }}
      >
        <StoryWizardIcon name={icon} className={compact ? 'h-10 w-10' : 'h-[3.25rem] w-[3.25rem]'} tint={selected ? 0.34 : 0.22} />
      </span>
      <span className="block w-full hyphens-auto break-words text-[15px] font-semibold leading-tight text-[var(--talea-text-primary)]">
        {title}
      </span>
      {description ? (
        <span className="line-clamp-2 block w-full text-[12px] leading-snug text-[var(--talea-text-secondary)]">{description}</span>
      ) : null}
      <AnimatePresence>{selected && <TaleaSelectedBadge label={title} />}</AnimatePresence>
    </motion.button>
  );
}

export function WizardStepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center"
    >
      <h2 className="text-[1.6rem] font-bold leading-tight text-[var(--talea-text-primary)]" style={{ fontFamily: 'var(--talea-font-display)' }}>
        {title}
      </h2>
      {subtitle ? <p className="mt-1 text-[15px] text-[var(--talea-text-secondary)]">{subtitle}</p> : null}
    </motion.div>
  );
}

/** Section title that leads with the same picture family. */
export function WizardSectionTitle({
  icon,
  tone = 'var(--primary)',
  title,
  hint,
  id,
}: {
  icon: StoryWizardIconName;
  tone?: string;
  title: string;
  hint?: string;
  id?: string;
}) {
  return (
    <h3 id={id} className="mb-3 flex items-center gap-2 text-[16px] font-semibold text-[var(--talea-text-primary)]">
      <StoryWizardIcon name={icon} className="h-7 w-7" style={{ color: tone }} />
      <span>{title}</span>
      {hint ? <span className="text-[13px] font-medium text-[var(--talea-text-tertiary)]">· {hint}</span> : null}
    </h3>
  );
}

export interface WizardStepBarItem {
  id: string;
  label: string;
  icon: StoryWizardIconName;
}

/**
 * Progress as a row of pictures. Finished steps carry a check and can be tapped
 * to go back; the active one is filled. Replaces "Schritt 2 von 7 · Kategorie",
 * which a child who cannot read yet could not follow.
 */
export function WizardStepBar({
  steps,
  activeIndex,
  onSelect,
}: {
  steps: WizardStepBarItem[];
  activeIndex: number;
  onSelect?: (index: number) => void;
}) {
  return (
    <nav aria-label="Schritte">
      <ol className="flex items-start">
        {steps.map((step, index) => {
          const status = index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'todo';
          const canJump = status === 'done' && Boolean(onSelect);
          return (
            <li key={step.id} className="relative flex min-w-0 flex-1 flex-col items-center">
              {index > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    'absolute right-1/2 top-5 h-[3px] w-full -translate-y-1/2 rounded-full transition-colors duration-300',
                    index <= activeIndex ? 'bg-[var(--primary)]' : 'bg-[var(--talea-progress-track)]'
                  )}
                />
              ) : null}
              <button
                type="button"
                disabled={!canJump}
                onClick={() => canJump && onSelect?.(index)}
                aria-current={status === 'active' ? 'step' : undefined}
                aria-label={status === 'done' ? `${step.label} (fertig, zurück zu diesem Schritt)` : step.label}
                className="relative z-10 flex min-w-0 max-w-full flex-col items-center gap-1 rounded-xl px-0.5 disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              >
                <span
                  className={cn(
                    'relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors duration-300',
                    status === 'active' && 'border-[var(--primary)] bg-[var(--talea-accent-terracotta-soft)] text-[var(--primary)]',
                    status === 'done' && 'border-[var(--primary)] bg-[var(--talea-surface-primary)] text-[var(--primary)]',
                    status === 'todo' && 'border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] text-[var(--talea-text-tertiary)]'
                  )}
                >
                  <StoryWizardIcon name={step.icon} className="h-6 w-6" strokeWidth={3} tint={status === 'active' ? 0.35 : 0.18} />
                  {status === 'done' ? (
                    <span className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] ring-2 ring-[var(--talea-page-solid)]">
                      <Check className="h-2.5 w-2.5" strokeWidth={4} aria-hidden />
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    'max-w-full truncate text-[12px] leading-tight',
                    status === 'active' ? 'font-semibold text-[var(--talea-text-primary)]' : 'text-[var(--talea-text-secondary)]'
                  )}
                >
                  {step.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
