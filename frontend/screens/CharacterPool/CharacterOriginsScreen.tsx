import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, BookOpen, ImageOff, RefreshCcw, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useBackend } from '../../hooks/useBackend';

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
    <section className="min-h-full rounded-[2rem] bg-[linear-gradient(145deg,rgba(248,245,240,0.92),rgba(236,241,244,0.78))] p-4 text-slate-800 dark:bg-[linear-gradient(145deg,rgba(20,31,45,0.94),rgba(27,42,57,0.92))] dark:text-slate-100 sm:p-6">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/75 bg-[linear-gradient(135deg,#f2dfdc_0%,#e8eee8_48%,#e0e9f5_100%)] p-5 shadow-[0_18px_44px_rgba(76,71,65,0.12)] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(229,176,183,0.16),rgba(154,199,182,0.15),rgba(176,200,231,0.16))] sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-20 h-48 w-48 rounded-full bg-white/35 blur-3xl dark:bg-white/10" />
        <div className="relative max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/65 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
            <Sparkles className="h-3.5 w-3.5 text-violet-500" aria-hidden="true" />
            Talea Origins
          </div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">Die Geschichten hinter den Figuren</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-200 sm:text-base">
            Lerne die wiederkehrenden Charaktere kennen: mit ihren Wurzeln, Entscheidungen und den Erlebnissen, die sie zu den Figuren gemacht haben, die später in Talea-Geschichten auftauchen.
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-3 py-16 text-sm font-semibold text-slate-600 dark:text-slate-300" role="status" aria-live="polite">
          <RefreshCcw className="h-5 w-5 animate-spin" aria-hidden="true" />
          Charaktergeschichten werden geladen …
        </div>
      )}

      {!loading && error && (
        <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200" role="alert">
          <p className="font-bold">{error}</p>
          <button type="button" onClick={() => void handleRetry()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 font-bold text-white transition hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-300">
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Erneut versuchen
          </button>
        </div>
      )}

      {!loading && !error && stories.length === 0 && (
        <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-dashed border-violet-300 bg-white/65 p-8 text-center dark:border-violet-500/40 dark:bg-white/5">
          <BookOpen className="mx-auto mb-4 h-9 w-9 text-violet-500" aria-hidden="true" />
          <h3 className="text-lg font-black text-slate-900 dark:text-white">Noch keine Origins veröffentlicht</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Sobald die Redaktion eine Charaktergeschichte veröffentlicht, erscheint sie hier.</p>
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
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => navigate(`/character-life-story/${story.id}`)}
              className="group overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/80 text-left shadow-[0_14px_34px_rgba(76,71,65,0.1)] transition-shadow hover:shadow-[0_20px_42px_rgba(76,71,65,0.16)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-300 dark:border-white/10 dark:bg-white/5 dark:hover:shadow-[0_20px_42px_rgba(0,0,0,0.24)]"
            >
              <div className="relative h-48 overflow-hidden bg-gradient-to-br from-violet-100 to-sky-100 dark:from-violet-950/50 dark:to-sky-950/40">
                {story.coverImageUrl ? (
                  <img src={story.coverImageUrl} alt={`Cover von ${story.title}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                ) : story.characterImageUrl ? (
                  <img src={story.characterImageUrl} alt={story.characterName} className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center"><ImageOff className="h-8 w-8 text-violet-400" aria-hidden="true" /></div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-4 pt-12">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-white/80">{story.characterRole}</p>
                  <p className="mt-1 text-xl font-black text-white">{story.characterName}</p>
                </div>
              </div>
              <div className="p-5">
                <h3 className="line-clamp-2 text-lg font-black text-slate-900 dark:text-white">{story.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{story.description}</p>
                <div className="mt-5 flex items-center justify-between gap-3 text-xs font-bold text-slate-500 dark:text-slate-400">
                  <span>{story.chapterCount} Kapitel · {story.wordCount.toLocaleString('de-DE')} Wörter</span>
                  <span className="inline-flex items-center gap-1.5 text-violet-700 transition group-hover:gap-2.5 dark:text-violet-300">Lesen <ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
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