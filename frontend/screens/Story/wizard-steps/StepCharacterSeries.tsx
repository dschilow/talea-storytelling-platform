import React from 'react';
import { BookOpen, Check, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';
import { idleTileClass, selectedTileClass, WizardStepHeading } from './wizardChoices';

/** The choices come from the server, including this profile's own progress. */
export interface CharacterSeriesChoice {
  id: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  genres?: string[];
  episodeCount: number;
}

/** null: ordinary story; 'auto': let Talea choose; otherwise a series ID. */
export type CharacterSeriesSelection = string | null;

interface Props {
  selection: CharacterSeriesSelection;
  onSelect: (selection: CharacterSeriesSelection) => void;
  series: CharacterSeriesChoice[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  genre: string | null;
}

export default function StepCharacterSeries({ selection, onSelect, series, loading, error, onRetry, genre }: Props) {
  const apiGenre = genre === 'fairy-tales' ? 'fairy_tales' : genre;
  const matches = (item: CharacterSeriesChoice) => Boolean(apiGenre && item.genres?.includes(apiGenre));
  const hasGenreMatch = series.some(matches);
  const sorted = [...series].sort((a, b) => Number(matches(b)) - Number(matches(a)));
  const buttonClass = (selected: boolean) => cn(
    'flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]',
    selected ? selectedTileClass : idleTileClass,
  );

  return (
    <div className="space-y-5">
      <WizardStepHeading
        title="Wen möchtet ihr treffen?"
        subtitle="Entdeckt eine Figurenwelt oder setzt ein gemeinsames Abenteuer fort."
      />

      <div className="space-y-2" aria-label="Geschichtenart auswählen">
        <button type="button" aria-pressed={selection === null} className={buttonClass(selection === null)} onClick={() => onSelect(null)}>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--talea-surface-inset)] text-[var(--primary)]"><BookOpen aria-hidden className="h-6 w-6" /></span>
          <span className="min-w-0 flex-1"><span className="block font-semibold text-[var(--talea-text-primary)]">Eine neue Geschichte</span><span className="block text-sm text-[var(--talea-text-secondary)]">Ein eigenes Abenteuer für eure Avatare.</span></span>
          {selection === null && <Check aria-hidden className="h-5 w-5 shrink-0 text-[var(--primary)]" />}
        </button>

        <button type="button" aria-pressed={selection === 'auto'} disabled={loading || Boolean(error) || !hasGenreMatch} className={cn(buttonClass(selection === 'auto'), 'disabled:cursor-not-allowed disabled:opacity-50')} onClick={() => onSelect('auto')}>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--talea-surface-inset)] text-[var(--primary)]"><Sparkles aria-hidden className="h-6 w-6" /></span>
          <span className="min-w-0 flex-1"><span className="block font-semibold text-[var(--talea-text-primary)]">Überrasch mich</span><span className="block text-sm text-[var(--talea-text-secondary)]">Talea findet eine passende Figurenwelt für euch.</span></span>
          {selection === 'auto' && <Check aria-hidden className="h-5 w-5 shrink-0 text-[var(--primary)]" />}
        </button>
        {!loading && !error && apiGenre && series.length > 0 && !hasGenreMatch && <p className="px-1 text-sm text-[var(--talea-text-secondary)]">Für diese Welt gibt es noch keinen passenden Vorschlag. Ihr könnt eine Figur selbst auswählen.</p>}
      </div>

      <section aria-labelledby="character-series-heading">
        <h3 id="character-series-heading" className="mb-2 text-sm font-semibold text-[var(--talea-text-secondary)]">Oder wählt eine Figur</h3>
        {loading && <p role="status" className="py-3 text-sm text-[var(--talea-text-secondary)]">Figurenwelten werden geladen …</p>}
        {error && <div role="alert" className="rounded-2xl border border-[var(--talea-border-light)] p-4 text-sm text-[var(--talea-text-secondary)]"><p>{error}</p><button type="button" onClick={onRetry} className="mt-2 min-h-11 font-semibold text-[var(--primary)] underline focus-visible:outline-2 focus-visible:outline-[var(--primary)]">Erneut versuchen</button></div>}
        {!loading && !error && series.length === 0 && <p className="py-3 text-sm text-[var(--talea-text-secondary)]">Gerade sind keine Figurenwelten verfügbar.</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {sorted.map((item) => {
            const selected = selection === item.id;
            return (
              <button key={item.id} type="button" aria-pressed={selected} onClick={() => onSelect(item.id)} className={cn(buttonClass(selected), 'items-start')}>
                {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" /> : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--talea-surface-inset)] text-[var(--primary)]"><BookOpen aria-hidden className="h-6 w-6" /></span>}
                <span className="min-w-0 flex-1"><span className="block font-semibold text-[var(--talea-text-primary)]">{item.title}</span><span className="mt-0.5 block text-sm leading-snug text-[var(--talea-text-secondary)]">{item.description}</span><span className="mt-1.5 block text-xs font-medium text-[var(--primary)]">{matches(item) ? 'Passt zu deiner Welt · ' : ''}{item.episodeCount > 0 ? `${item.episodeCount} ${item.episodeCount === 1 ? 'Folge erlebt' : 'Folgen erlebt'} · Weitererzählen` : 'Erstes Abenteuer'}</span></span>
                {selected && <Check aria-hidden className="h-5 w-5 shrink-0 text-[var(--primary)]" />}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
