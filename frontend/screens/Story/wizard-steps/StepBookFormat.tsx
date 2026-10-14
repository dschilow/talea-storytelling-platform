import React from 'react';
import { motion } from 'framer-motion';
import { Compass, Moon, Search, Smile } from 'lucide-react';

import { cn } from '@/lib/utils';

export type ExperienceForm = 'mystery' | 'journey' | 'funny' | 'cozy';

interface Props {
  state: { experienceForm: ExperienceForm | null; bookChapters: number; bookImagesPerChapter: number; ageGroup: string | null };
  updateState: (updates: any) => void;
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

/** Rough cost per volume from the first measurements (Sol plans and writes, Luna checks, FLUX draws). */
function estimateCents(chapters: number, images: number, ageGroup: string | null): [number, number] {
  const wordsPerChapter = ageGroup === '9-12' || ageGroup === '13+' ? 900 : ageGroup === '3-5' ? 360 : 620;
  const text = 11 + chapters * wordsPerChapter * 0.0045;
  const pictures = chapters * images * 0.35 + 0.5;
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

      <p className="rounded-2xl border border-border bg-card/65 px-4 py-3 text-xs text-muted-foreground">
        Admin-Test · geschätzte Kosten pro Band: {low}–{high} ¢ · die ersten Kapitel sind nach etwa 5–10 Minuten lesbar, der Rest entsteht, während ihr lest.
      </p>
    </div>
  );
}
