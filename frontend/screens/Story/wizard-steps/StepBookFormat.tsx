import React from 'react';

import { cn } from '@/lib/utils';
import type { StoryWizardIconName } from './StoryWizardIcon';
import {
  ChoiceTile,
  TONE,
  WizardSectionTitle,
  WizardStepHeading,
  idleTileClass,
  selectedTileClass,
} from './wizardChoices';

export type ExperienceForm = 'mystery' | 'journey' | 'funny' | 'cozy';

interface Props {
  state: { experienceForm: ExperienceForm | null; bookChapters: number; bookImagesPerChapter: number; ageGroup: string | null; heroRelation: string | null; selectedAvatars: string[] };
  updateState: (updates: any) => void;
}

/**
 * How the heroes belong together. The app knows nothing about families: without this the
 * book never names a relation — and a child without Talea knowledge asks why they are together
 * ("Sieben Zimmer und ein Nieser", 2026-10-15).
 */
const RELATIONS: Array<{ value: string | null; label: string }> = [
  { value: 'Geschwister', label: 'Geschwister' },
  { value: 'Freunde', label: 'Freunde' },
  { value: 'Cousins und Cousinen', label: 'Cousins & Cousinen' },
  { value: 'Nachbarskinder', label: 'Nachbarskinder' },
  { value: null, label: 'Nicht festlegen' },
];
const RELATION_KEY = 'talea.book.heroRelation';

/** The last choice, so a family sets it once. Never throws (private mode, blocked storage). */
export function readStoredHeroRelation(): string | null {
  try {
    const value = window.localStorage.getItem(RELATION_KEY);
    return value && RELATIONS.some((option) => option.value === value) ? value : null;
  } catch {
    return null;
  }
}

function storeHeroRelation(value: string | null): void {
  try {
    if (value) window.localStorage.setItem(RELATION_KEY, value);
    else window.localStorage.removeItem(RELATION_KEY);
  } catch {
    // Remembering is a convenience only.
  }
}

export const BOOK_FORMS: Array<{ id: ExperienceForm; title: string; description: string; icon: StoryWizardIconName; tone: string }> = [
  { id: 'mystery', title: 'Geheimnis', description: 'Ein Rätsel, Hinweis für Hinweis', icon: 'magnifier', tone: TONE.terracotta },
  { id: 'journey', title: 'Reise', description: 'Weit weg und wieder heim', icon: 'compass', tone: TONE.gold },
  { id: 'funny', title: 'Zum Lachen', description: 'Eine Idee, die immer größer wird', icon: 'laugh', tone: TONE.peach },
  { id: 'cozy', title: 'Gemütlich', description: 'Ohne Bösewicht, warm und witzig', icon: 'moon', tone: TONE.mint },
];

export const BOOK_SIZES: Array<{ chapters: number; evenings: number; icon: StoryWizardIconName }> = [
  { chapters: 8, evenings: 4, icon: 'books1' },
  { chapters: 12, evenings: 6, icon: 'books2' },
  { chapters: 15, evenings: 8, icon: 'books3' },
];

/** Rough cost per volume (measured 2026-10-15: Luna plans for ~1 ¢, Sol writes, Luna checks, FLUX draws). */
function estimateCents(chapters: number, images: number, ageGroup: string | null): [number, number] {
  const wordsPerChapter = ageGroup === '9-12' || ageGroup === '13+' ? 900 : ageGroup === '3-5' ? 360 : 620;
  const text = 2 + chapters * wordsPerChapter * 0.0026;
  const pictures = chapters * images * 0.25 + 0.5;
  const base = text + pictures;
  return [Math.round(base * 0.85), Math.round(base * 1.2)];
}

export default function StepBookFormat({ state, updateState }: Props) {
  const [low, high] = estimateCents(state.bookChapters, state.bookImagesPerChapter, state.ageGroup);
  const segment = (selected: boolean) =>
    cn(
      'rounded-2xl border px-3 py-2.5 text-[15px] font-semibold text-[var(--talea-text-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]',
      selected ? selectedTileClass : idleTileClass
    );

  return (
    <div className="space-y-7">
      <WizardStepHeading
        title="Was für ein Buch soll es werden?"
        subtitle="Ein Kapitelbuch liest man über mehrere Abende – die App merkt sich, wo ihr aufgehört habt."
      />

      <section aria-labelledby="book-form-title">
        <WizardSectionTitle id="book-form-title" icon="openBook" tone={TONE.terracotta} title="Was erlebt ihr?" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          {BOOK_FORMS.map((form) => (
            <ChoiceTile
              key={form.id}
              icon={form.icon}
              tone={form.tone}
              title={form.title}
              description={form.description}
              selected={state.experienceForm === form.id}
              onClick={() => updateState({ experienceForm: form.id })}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="book-size-title">
        <WizardSectionTitle id="book-size-title" icon="moon" tone={TONE.sky} title="Wie viele Abende?" />
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {BOOK_SIZES.map((size) => (
            <ChoiceTile
              key={size.chapters}
              icon={size.icon}
              tone={TONE.sky}
              title={`${size.evenings} Abende`}
              description={`${size.chapters} Kapitel`}
              selected={state.bookChapters === size.chapters}
              onClick={() => updateState({ bookChapters: size.chapters })}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="book-images-title">
        <WizardSectionTitle id="book-images-title" icon="picture" tone={TONE.rose} title="Bilder pro Kapitel" />
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {[1, 2, 3].map((count) => (
            <button key={count} type="button" aria-pressed={state.bookImagesPerChapter === count} onClick={() => updateState({ bookImagesPerChapter: count })} className={segment(state.bookImagesPerChapter === count)}>
              {count} {count === 1 ? 'Bild' : 'Bilder'}
            </button>
          ))}
        </div>
      </section>

      {state.selectedAvatars.length > 1 && (
        <section aria-labelledby="book-relation-title">
          <WizardSectionTitle id="book-relation-title" icon="friends" tone={TONE.peach} title="Wie gehören die Helden zusammen?" />
          <p className="-mt-1.5 mb-3 text-[13px] text-[var(--talea-text-secondary)]">Das Buch sagt es gleich am Anfang – so versteht jedes Kind, warum sie zusammen sind.</p>
          <div className="flex flex-wrap gap-2">
            {RELATIONS.map((option) => {
              const selected = state.heroRelation === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    storeHeroRelation(option.value);
                    updateState({ heroRelation: option.value });
                  }}
                  className={cn(segment(selected), 'px-3.5 py-2 text-sm font-medium')}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <p className="rounded-2xl border border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)]/50 px-4 py-3 text-xs text-[var(--talea-text-secondary)]">
        Admin-Test · geschätzte Kosten pro Band: {low}–{high} ¢ · die ersten Kapitel sind nach etwa 5–10 Minuten lesbar, der Rest entsteht, während ihr lest.
      </p>
    </div>
  );
}
