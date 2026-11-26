import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, ImageOff, RefreshCcw, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useBackend } from '../../hooks/useBackend';
import RevealImage from '@/components/common/RevealImage';
import { NavIcon } from '@/components/navigation/NavIcon';
import { TaleaActionButton, TaleaSkeletonBlock, taleaDisplayFont } from '@/components/talea/TaleaPastelPrimitives';

interface PublishedCharacterStory {
  id: string;
  characterId: string;
  characterName: string;
  characterRole: string;
  characterArchetype: string;
  characterImageUrl?: string;
  title: string;
  description: string;
  coverImageUrl?: string;
  wordCount: number;
  chapterCount: number;
}

function readableError(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Die Charaktergeschichten konnten nicht geladen werden.';
}

const CharacterOriginsScreen: React.FC = () => {
  const backend = useBackend();
  const navigate = useNavigate();
  const [stories, setStories] = useState<PublishedCharacterStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await backend.story.listPublishedCharacterLifeStories();
      setStories((response.stories || []) as PublishedCharacterStory[]);
    } catch (loadError) {
      console.error('[CharacterOrigins] load failed', loadError);
      setError(readableError(loadError));
    } finally {
      setLoading(false);
    }
  }, [backend]);

  useEffect(() => {
    void loadStories();
  }, [loadStories]);

  const handleRetry = async () => {
    await loadStories();
    if (error) toast.success('Charaktergeschichten wurden erneut geladen.');
  };

  return (
    <section className="min-h-full text-[var(--talea-text-primary)]">
      {/* Same language as the rest of the library: a calm intro card, then cover-first cards. */}
      <div className="relative overflow-hidden rounded-[1.75rem] border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] p-5 shadow-[var(--talea-shadow-soft)] sm:p-8">
        <div className="relative max-w-2xl">
          <p className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--primary)]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Talea Origins
          </p>
          <h2 className="mt-1.5 text-[1.75rem] font-bold leading-tight text-[var(--talea-text-primary)] [text-wrap:balance] sm:text-[2.1rem]" style={{ fontFamily: taleaDisplayFont }}>
            Die Geschichten hinter den Figuren
          </h2>
          <p className="mt-2.5 max-w-xl text-[15px] leading-relaxed text-[var(--talea-text-secondary)]">
            Lerne die wiederkehrenden Charaktere kennen: mit ihren Wurzeln, Entscheidungen und den Erlebnissen, die sie zu den Figuren gemacht haben, die später in Talea-Geschichten auftauchen.
          </p>
        </div>
      </div>

      {loading && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-live="polite">
          <span className="sr-only">Charaktergeschichten werden geladen</span>
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} aria-hidden className="overflow-hidden rounded-[1.375rem] border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)]">
              <TaleaSkeletonBlock className="h-48 rounded-none" />
              <div className="p-5">
                <TaleaSkeletonBlock className="h-5 w-3/4" />
                <TaleaSkeletonBlock className="mt-3 h-3.5 w-full" />
                <TaleaSkeletonBlock className="mt-2 h-3.5 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="mx-auto mt-6 max-w-xl rounded-[1.375rem] border border-[var(--talea-danger-border)] bg-[var(--talea-danger-soft)] p-5 text-center text-[15px] text-[var(--talea-danger)]" role="alert">
          <p className="font-semibold">{error}</p>
          <TaleaActionButton className="mt-4" variant="secondary" onClick={() => void handleRetry()} icon={<RefreshCcw className="h-4 w-4" aria-hidden="true" />}>
            Erneut versuchen
          </TaleaActionButton>
        </div>
      )}

      {!loading && !error && stories.length === 0 && (
        <div className="mx-auto mt-6 flex max-w-xl flex-col items-center rounded-[1.375rem] bg-[var(--talea-surface-inset)] px-6 py-10 text-center">
          <span aria-hidden className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--talea-accent-terracotta-soft)] text-[var(--primary)]">
            <NavIcon name="figures" active className="h-8 w-8" />
          </span>
          <h3 className="text-[17px] font-semibold text-[var(--talea-text-primary)]" style={{ fontFamily: taleaDisplayFont }}>Noch keine Origins veröffentlicht</h3>
          <p className="mt-1.5 max-w-sm text-[14.5px] leading-relaxed text-[var(--talea-text-secondary)]">Sobald die Redaktion eine Charaktergeschichte veröffentlicht, erscheint sie hier.</p>
        </div>
      )}

      {!loading && !error && stories.length > 0 && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {stories.map((story, index) => (
            <motion.button
              key={story.id}
              type="button"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.24) }}
              whileTap={{ scale: 0.99 }}
              onClick={() => navigate(`/character-life-story/${story.id}`)}
              className="group overflow-hidden rounded-[1.375rem] border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] text-left shadow-[var(--talea-shadow-soft)] transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-[var(--talea-shadow-medium)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] motion-reduce:hover:translate-y-0"
            >
              <div className="relative h-48 overflow-hidden bg-[var(--talea-media-skeleton)]">
                {story.coverImageUrl ? (
                  <RevealImage src={story.coverImageUrl} alt={`Cover von ${story.title}`} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                ) : story.characterImageUrl ? (
                  <RevealImage src={story.characterImageUrl} alt={story.characterName} loading="lazy" className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]" />
                ) : (
                  <div className="flex h-full items-center justify-center"><ImageOff className="h-8 w-8 text-[var(--talea-text-tertiary)]" aria-hidden="true" /></div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-[var(--talea-media-overlay-strong)] p-4 pt-14">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">{story.characterRole}</p>
                  <p className="mt-0.5 text-xl font-bold text-white" style={{ fontFamily: taleaDisplayFont }}>{story.characterName}</p>
                </div>
              </div>
              <div className="p-5">
                <h3 className="line-clamp-2 text-[17px] font-semibold leading-snug text-[var(--talea-text-primary)]" style={{ fontFamily: taleaDisplayFont }}>{story.title}</h3>
                <p className="mt-1.5 line-clamp-3 text-[14.5px] leading-relaxed text-[var(--talea-text-secondary)]">{story.description}</p>
                <div className="mt-4 flex items-center justify-between gap-3 text-[13px] text-[var(--talea-text-tertiary)]">
                  <span className="tabular-nums">{story.chapterCount} Kapitel · {story.wordCount.toLocaleString('de-DE')} Wörter</span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--primary)] transition-[gap] group-hover:gap-2.5">Lesen <ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </section>
  );
};

export default CharacterOriginsScreen;