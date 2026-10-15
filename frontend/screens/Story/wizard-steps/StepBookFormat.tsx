import React from 'react';
import { motion } from 'framer-motion';
import { Compass, Moon, Search, Smile } from 'lucide-react';

import { cn } from '@/lib/utils';

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

const FORMS: Array<{ id: ExperienceForm; title: string; description: string; icon: React.ComponentType<any> }> = [
  { id: 'mystery', title: 'Lustiges Geheimnis', description: 'Ein Rätsel mit Hinweisen, die man über viele Abende sammelt.', icon: Search },
  { id: 'journey', title: 'Abenteuerreise', description: 'Aufbruch von zu Hause, neue Orte, Heimkehr am Ende.', icon: Compass },
  { id: 'funny', title: 'Zum Lachen', description: 'Eine verrückte Idee, die von Kapitel zu Kapitel größer wird.', icon: Smile },
  { id: 'cozy', title: 'Gemütlich', description: 'Kein Bösewicht, keine Gefahr — warm, witzig, mit rotem Faden.', icon: Moon },
];

const CHAPTERS = [
  { value: 8, label: '8 Kapitel', hint: 'ca. 4 Abende' },
  { value: 12, label: '12 Kapitel', hint: 'ca. 6 Abende' },
  { value: 15, label: '15 Kapitel', hint: 'ca. 8 Abende' },
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
  const chip = (selected: boolean) =>
    cn(
      'rounded-2xl border px-4 py-3 text-left transition-colors',
      selected
        ? 'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_9%,var(--talea-surface-primary))] ring-1 ring-[var(--primary)]'
        : 'border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] hover:bg-[var(--talea-surface-inset)]/60'
    );

  return (
    <div className="space-y-7">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h2 className="mb-1 text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--talea-font-display)' }}>
          Was für ein Buch soll es werden?
        </h2>
        <p className="text-sm text-muted-foreground">
          Ein Kapitelbuch liest man über mehrere Abende — die App merkt sich, wo ihr aufgehört habt.
        </p>
      </motion.div>

      <section aria-labelledby="book-form-title" className="space-y-3">
        <h3 id="book-form-title" className="text-sm font-semibold text-foreground">Erlebnis</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FORMS.map(({ id, title, description, icon: Icon }) => (
            <button key={id} type="button" aria-pressed={state.experienceForm === id} onClick={() => updateState({ experienceForm: id })} className={chip(state.experienceForm === id)}>
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-[var(--primary)]" aria-hidden />
                <span className="text-sm font-semibold text-foreground">{title}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="book-size-title" className="space-y-3">
        <h3 id="book-size-title" className="text-sm font-semibold text-foreground">Umfang</h3>
        <div className="grid grid-cols-3 gap-3">
          {CHAPTERS.map((option) => (
            <button key={option.value} type="button" aria-pressed={state.bookChapters === option.value} onClick={() => updateState({ bookChapters: option.value })} className={chip(state.bookChapters === option.value)}>
              <span className="block text-sm font-semibold text-foreground">{option.label}</span>
              <span className="block text-xs text-muted-foreground">{option.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="book-images-title" className="space-y-3">
        <h3 id="book-images-title" className="text-sm font-semibold text-foreground">Bilder pro Kapitel</h3>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((count) => (
            <button key={count} type="button" aria-pressed={state.bookImagesPerChapter === count} onClick={() => updateState({ bookImagesPerChapter: count })} className={chip(state.bookImagesPerChapter === count)}>
              <span className="block text-sm font-semibold text-foreground">{count} {count === 1 ? 'Bild' : 'Bilder'}</span>
            </button>
          ))}
        </div>
      </section>

      {state.selectedAvatars.length > 1 && (
        <section aria-labelledby="book-relation-title" className="space-y-3">
          <div>
            <h3 id="book-relation-title" className="text-sm font-semibold text-foreground">Wie gehören die Helden zusammen?</h3>
            <p className="text-xs text-muted-foreground">Das Buch sagt es gleich am Anfang — so versteht jedes Kind, warum sie zusammen sind.</p>
          </div>
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
                  className={cn(chip(selected), 'px-3 py-2 text-sm font-medium text-foreground')}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <p className="rounded-2xl border border-border bg-card/65 px-4 py-3 text-xs text-muted-foreground">
        Admin-Test · geschätzte Kosten pro Band: {low}–{high} ¢ · die ersten Kapitel sind nach etwa 5–10 Minuten lesbar, der Rest entsteht, während ihr lest.
      </p>
    </div>
  );
}
