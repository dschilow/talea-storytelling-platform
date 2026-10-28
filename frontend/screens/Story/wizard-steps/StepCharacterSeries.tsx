import React from 'react';
import { BookOpen, Check, RotateCcw, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';
import { pickSurpriseSeries } from '../library/storyShelves';
import { idleTileClass, selectedTileClass, WizardStepHeading } from './wizardChoices';

/** The choices come from the server, including this profile's own progress. */
export interface CharacterSeriesChoice {
  id: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  genres?: string[];
  /** Episodes that count for the continuation (after an admin reset only the newer ones). */
  episodeCount: number;
  characterId?: string;
  characterName?: string;
  lastStoryId?: string;
}

/** null: no figure chosen yet; otherwise a series ID ('auto' only from older links: the server picks one). */
export type CharacterSeriesSelection = string | null;

interface Props {
  selection: CharacterSeriesSelection;
  onSelect: (seriesId: string) => void;
  series: CharacterSeriesChoice[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  isAdmin?: boolean;
  episodeOverride?: number | null;
  onEpisodeOverrideChange?: (episode: number | null) => void;
  /** Admin test tool: resets this profile's counter of one series and resolves with the number of episodes reset. */
  onResetProgress?: (seriesId: string) => Promise<number>;
}

const folgen = (count: number) => `${count} ${count === 1 ? 'Folge' : 'Folgen'}`;

export default function StepCharacterSeries({ selection, onSelect, series, loading, error, onRetry, isAdmin, episodeOverride, onEpisodeOverrideChange, onResetProgress }: Props) {
  const [reset, setReset] = React.useState<{ busy: boolean; message: string | null; error: string | null }>({ busy: false, message: null, error: null });
  const [surprised, setSurprised] = React.useState<string | null>(null);
  React.useEffect(() => { setReset({ busy: false, message: null, error: null }); }, [selection]);
  const selectedSeries = selection && selection !== 'auto' ? series.find((item) => item.id === selection) : undefined;
  const handleReset = async () => {
    if (!selectedSeries || !onResetProgress) return;
    const confirmed = window.confirm(`Folgen-Zähler von „${selectedSeries.title}“ für dieses Profil auf 0 setzen?\n\nDie bisherigen ${folgen(selectedSeries.episodeCount)} bleiben in der Bibliothek, zählen aber nicht mehr. Die nächste Geschichte beginnt wieder mit Folge 1.`);
    if (!confirmed) return;
    setReset({ busy: true, message: null, error: null });
    try {
      const count = await onResetProgress(selectedSeries.id);
      setReset({ busy: false, message: `${folgen(count)} zurückgesetzt. Die nächste Geschichte ist wieder Folge 1.`, error: null });
    } catch (resetError) {
      setReset({ busy: false, message: null, error: resetError instanceof Error && resetError.message ? resetError.message : 'Der Zähler konnte nicht zurückgesetzt werden.' });
    }
  };
  const surprise = () => {
    const pick = pickSurpriseSeries(series);
    if (!pick) return;
    setSurprised(pick.id);
    onSelect(pick.id);
  };
  // Figures you already know first: their next episode is waiting.
  const sorted = [...series].sort((a, b) => Number(b.episodeCount > 0) - Number(a.episodeCount > 0));
  const buttonClass = (selected: boolean) => cn(
    'flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]',
    selected ? selectedTileClass : idleTileClass,
  );
  const surprisedSeries = surprised && surprised === selection ? series.find((item) => item.id === surprised) : undefined;

  return (
    <div className="space-y-5">
      <WizardStepHeading
        title="Wen möchtet ihr treffen?"
        subtitle="Beim ersten Besuch lernt ihr die Figur und ihre Welt kennen. Danach geht eure Serie Folge für Folge weiter."
      />

      <section aria-labelledby="character-series-heading">
        <h3 id="character-series-heading" className="sr-only">Figuren</h3>
        {loading && <p role="status" className="py-3 text-sm text-[var(--talea-text-secondary)]">Figurenwelten werden geladen …</p>}
        {error && <div role="alert" className="rounded-2xl border border-[var(--talea-border-light)] p-4 text-sm text-[var(--talea-text-secondary)]"><p>{error}</p><button type="button" onClick={onRetry} className="mt-2 min-h-11 font-semibold text-[var(--primary)] underline focus-visible:outline-2 focus-visible:outline-[var(--primary)]">Erneut versuchen</button></div>}
        {!loading && !error && series.length === 0 && <p className="py-3 text-sm text-[var(--talea-text-secondary)]">Gerade sind keine Figurenwelten verfügbar.</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {sorted.map((item) => {
            const selected = selection === item.id;
            return (
              <button key={item.id} type="button" aria-pressed={selected} onClick={() => { setSurprised(null); onSelect(item.id); }} className={cn(buttonClass(selected), 'items-start')}>
                {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-full bg-white object-cover shadow-[0_4px_12px_rgba(40,20,10,0.12)]" /> : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--talea-surface-inset)] text-[var(--primary)]"><BookOpen aria-hidden className="h-6 w-6" /></span>}
                <span className="min-w-0 flex-1"><span className="block font-semibold text-[var(--talea-text-primary)]">{item.title}</span><span className="mt-0.5 block text-sm leading-snug text-[var(--talea-text-secondary)]">{item.description}</span><span className="mt-1.5 block text-xs font-semibold text-[var(--primary)]">{item.episodeCount > 0 ? `${folgen(item.episodeCount)} erlebt · Folge ${item.episodeCount + 1} wartet` : 'Erstes Abenteuer · Folge 1'}</span></span>
                {selected && <Check aria-hidden className="h-5 w-5 shrink-0 text-[var(--primary)]" />}
              </button>
            );
          })}
        </div>
        {series.length > 1 ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <button type="button" onClick={surprise} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--talea-surface-inset)] px-4 text-[15px] font-semibold text-[var(--primary)] transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]">
              <Sparkles aria-hidden className="h-4 w-4" /> Überrasch mich
            </button>
            <p role="status" aria-live="polite" className="text-[14px] text-[var(--talea-text-secondary)] empty:hidden">
              {surprisedSeries ? `Talea hat ${surprisedSeries.characterName || surprisedSeries.title} für euch ausgesucht.` : ''}
            </p>
          </div>
        ) : null}
      </section>

      {isAdmin && selection !== null && onEpisodeOverrideChange && (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3.5 text-sm">
          <label htmlFor="admin-series-episode-override" className="block font-semibold text-[var(--talea-text-primary)]">
            Admin-Test: Folgen-Zähler wählen (Folge 1–20)
          </label>
          <p className="mt-0.5 text-xs text-[var(--talea-text-secondary)]">
            Testet gezielt den vorgeplanten Episoden-Blueprint (inkl. gestaffelter Gast-Auftritte ab Folge 2, 4 und 7).
          </p>
          <select
            id="admin-series-episode-override"
            value={episodeOverride ?? ''}
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : null;
              onEpisodeOverrideChange(v && Number.isInteger(v) ? v : null);
            }}
            className="mt-2 w-full rounded-xl border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] px-3 py-2 text-sm font-medium text-[var(--talea-text-primary)]"
          >
            <option value="">Automatisch (Nächste reguläre Folge)</option>
            {Array.from({ length: 20 }, (_, i) => i + 1).map((ep) => (
              <option key={ep} value={ep}>
                Folge {ep} {ep === 1 ? '(Ursprung / Erste Begegnung)' : ep === 2 ? '(Gast 1 Debüt)' : ep === 4 ? '(Gast 2 Debüt)' : ep === 7 ? '(Gast 3 Debüt)' : ep === 10 ? '(Staffel-1-Finale)' : ep === 20 ? '(Großes Finale)' : `(Staffel ${ep <= 10 ? 1 : 2})`}
              </option>
            ))}
          </select>
          {selectedSeries && onResetProgress && (
            <div className="mt-3 border-t border-amber-400/30 pt-3">
              <p className="font-semibold text-[var(--talea-text-primary)]">Admin-Test: Folgen-Zähler zurücksetzen</p>
              <p className="mt-0.5 text-xs text-[var(--talea-text-secondary)]">
                {selectedSeries.episodeCount > 0
                  ? `${selectedSeries.title}: ${folgen(selectedSeries.episodeCount)} für dieses Profil gezählt. Danach beginnt die Serie wieder mit Folge 1; die Geschichten bleiben in der Bibliothek.`
                  : `${selectedSeries.title}: Der Zähler steht auf 0, die nächste Geschichte ist Folge 1.`}
              </p>
              <button
                type="button"
                onClick={handleReset}
                disabled={reset.busy || selectedSeries.episodeCount === 0}
                className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-500/50 px-3 py-2 text-sm font-semibold text-[var(--talea-text-primary)] transition-colors hover:bg-amber-400/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw aria-hidden className={cn('h-4 w-4', reset.busy && 'animate-spin')} />
                {reset.busy ? 'Wird zurückgesetzt …' : 'Zähler auf 0 setzen'}
              </button>
            </div>
          )}
          <p role="status" aria-live="polite" className="mt-1.5 text-xs font-medium text-[var(--talea-text-primary)] empty:hidden">{reset.message}</p>
          {reset.error && <p role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{reset.error}</p>}
        </div>
      )}
    </div>
  );
}
