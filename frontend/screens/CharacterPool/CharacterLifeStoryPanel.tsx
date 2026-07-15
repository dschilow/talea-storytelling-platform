import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Eye, Image as ImageIcon, RefreshCcw, Save, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import Button from '../../components/common/Button';
import { useBackend } from '../../hooks/useBackend';

interface LifeStoryChapter {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  imagePrompt?: string;
  order: number;
}

interface LifeStory {
  id: string;
  characterId: string;
  title: string;
  description: string;
  coverImageUrl?: string;
  status: 'generating' | 'draft' | 'published' | 'error';
  ageGroup: '3-5' | '6-8' | '9-12' | '13+';
  targetWords: number;
  wordCount: number;
  version: number;
  lastError?: string;
  chapters: LifeStoryChapter[];
}

interface Props {
  characterId: string;
  characterName: string;
  characterImageUrl?: string;
}

const statusCopy: Record<LifeStory['status'], { label: string; className: string }> = {
  generating: { label: 'Wird generiert', className: 'border-sky-300/60 bg-sky-100/80 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200' },
  draft: { label: 'Entwurf', className: 'border-amber-300/60 bg-amber-100/80 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200' },
  published: { label: 'Veröffentlicht', className: 'border-emerald-300/60 bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200' },
  error: { label: 'Fehler', className: 'border-rose-300/60 bg-rose-100/80 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200' },
};

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Die Aktion konnte nicht abgeschlossen werden.';
}

const CharacterLifeStoryPanel: React.FC<Props> = ({ characterId, characterName, characterImageUrl }) => {
  const backend = useBackend();
  const navigate = useNavigate();
  const [story, setStory] = useState<LifeStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadStory = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const response = await backend.story.getCharacterLifeStory({ characterId });
      setStory((response.story as LifeStory | undefined) || null);
    } catch (error) {
      console.error('[CharacterLifeStory] load failed', error);
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [backend, characterId]);

  useEffect(() => {
    void loadStory();
  }, [loadStory]);

  const illustratedChapters = useMemo(
    () => story?.chapters.filter((chapter) => Boolean(chapter.imageUrl)).length || 0,
    [story],
  );
  const readyToPublish = Boolean(
    story?.coverImageUrl && story.chapters.length > 0 && illustratedChapters === story.chapters.length,
  );

  const handleGenerate = async () => {
    if (story && !window.confirm(`Die bestehende Lebensgeschichte von „${characterName}“ wird durch einen neuen Entwurf ersetzt. Fortfahren?`)) {
      return;
    }
    try {
      setGenerating(true);
      const generated = await backend.story.generateCharacterLifeStory({
        characterId,
        ageGroup: story?.ageGroup || '6-8',
        aiModel: 'gpt-5.4',
        aiProvider: 'native',
      });
      setStory(generated as LifeStory);
      toast.success('Lebensgeschichte und Illustrationen wurden als Entwurf erstellt.');
    } catch (error) {
      console.error('[CharacterLifeStory] generation failed', error);
      toast.error(errorMessage(error));
      await loadStory();
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!story) return;
    try {
      setSaving(true);
      const updated = await backend.story.updateCharacterLifeStory({
        characterId,
        title: story.title,
        description: story.description,
        chapters: story.chapters.map((chapter) => ({
          id: chapter.id,
          title: chapter.title,
          content: chapter.content,
        })),
      });
      setStory(updated as LifeStory);
      toast.success('Redaktionelle Änderungen gespeichert.');
    } catch (error) {
      console.error('[CharacterLifeStory] save failed', error);
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async () => {
    if (!story) return;
    const nextStatus = story.status === 'published' ? 'draft' : 'published';
    if (nextStatus === 'published' && !readyToPublish) {
      toast.error('Vor der Veröffentlichung werden ein Cover und ein Bild pro Kapitel benötigt.');
      return;
    }
    try {
      setPublishing(true);
      const updated = await backend.story.setCharacterLifeStoryStatus({ characterId, status: nextStatus });
      setStory(updated as LifeStory);
      toast.success(nextStatus === 'published' ? 'Lebensgeschichte veröffentlicht.' : 'Lebensgeschichte ist wieder ein Entwurf.');
    } catch (error) {
      console.error('[CharacterLifeStory] status change failed', error);
      toast.error(errorMessage(error));
    } finally {
      setPublishing(false);
    }
  };

  const updateChapter = (id: string, patch: Partial<Pick<LifeStoryChapter, 'title' | 'content'>>) => {
    setStory((current) => current ? {
      ...current,
      chapters: current.chapters.map((chapter) => chapter.id === id ? { ...chapter, ...patch } : chapter),
    } : current);
  };

  return (
    <section className="mb-6 overflow-hidden rounded-3xl border border-violet-200/70 bg-gradient-to-br from-white/95 via-violet-50/80 to-amber-50/70 shadow-[0_22px_70px_rgba(76,45,120,0.12)] dark:border-white/10 dark:from-[#17172a]/95 dark:via-[#1e1831]/95 dark:to-[#292033]/95">
      <div className="flex flex-col gap-5 border-b border-violet-200/60 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
        <div className="flex min-w-0 items-center gap-4">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/70 bg-violet-100 shadow-md dark:border-white/10 dark:bg-white/10">
            {characterImageUrl ? (
              <img src={characterImageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <BookOpen className="absolute inset-0 m-auto h-7 w-7 text-violet-500" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">Talea Origins</span>
              {story && (
                <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusCopy[story.status].className}`}>
                  {statusCopy[story.status].label}
                </span>
              )}
            </div>
            <h3 className="truncate text-xl font-black text-slate-900 dark:text-white">Lebensgeschichte von {characterName}</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Kanonische Geschichte mit fünf Kapiteln, Cover und Kapitelillustrationen.</p>
            <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">Profiländerungen bitte zuerst mit „Speichern“ sichern.</p>
          </div>
        </div>

        <Button
          title={generating ? 'Pipeline läuft …' : story ? 'Neu generieren' : 'Lebensgeschichte generieren'}
          onPress={handleGenerate}
          icon={generating ? <RefreshCcw className="animate-spin" size={17} /> : <Sparkles size={17} />}
          variant="fun"
          disabled={generating || loading}
        />
      </div>

      {loading && (
        <div className="flex items-center gap-3 p-6 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <RefreshCcw className="h-4 w-4 animate-spin" /> Lebensgeschichte wird geladen …
        </div>
      )}

      {!loading && loadError && (
        <div className="m-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
          {loadError}
        </div>
      )}

      {!loading && !loadError && !story && (
        <div className="p-6">
          <div className="rounded-2xl border border-dashed border-violet-300 bg-white/60 p-6 text-center dark:border-violet-500/40 dark:bg-white/5">
            <BookOpen className="mx-auto mb-3 h-8 w-8 text-violet-500" />
            <p className="font-bold text-slate-800 dark:text-white">Noch keine Lebensgeschichte vorhanden</p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Die Premium-Pipeline nutzt Vorgeschichte, Persönlichkeit, Stimme und das kanonische Charakterbild. Das Ergebnis bleibt zunächst unveröffentlicht.
            </p>
          </div>
        </div>
      )}

      {!loading && story && (
        <div className="space-y-5 p-5">
          {story.lastError && story.status === 'error' && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
              <strong>Letzter Pipeline-Fehler:</strong> {story.lastError}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Wörter" value={`${story.wordCount.toLocaleString('de-DE')} / 1.400–1.500`} good={story.wordCount >= 1200 && story.wordCount <= 1700} />
            <Metric label="Kapitel" value={`${story.chapters.length} / 5`} good={story.chapters.length === 5} />
            <Metric label="Illustrationen" value={`${illustratedChapters + (story.coverImageUrl ? 1 : 0)} / ${story.chapters.length + 1}`} good={readyToPublish} />
            <Metric label="Version" value={`v${story.version}`} good />
          </div>

          {story.coverImageUrl && (
            <div className="overflow-hidden rounded-2xl border border-white/70 bg-black/5 dark:border-white/10">
              <img src={story.coverImageUrl} alt={`Cover: ${story.title}`} className="h-56 w-full object-cover sm:h-72" />
            </div>
          )}

          <div className="grid gap-4">
            <label className="grid gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              Titel
              <input
                value={story.title}
                onChange={(event) => setStory({ ...story, title: event.target.value })}
                className="min-h-12 rounded-2xl border border-violet-200 bg-white/90 px-4 text-base text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-200/50 dark:border-white/10 dark:bg-black/20 dark:text-white"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              Kurzbeschreibung
              <textarea
                value={story.description}
                onChange={(event) => setStory({ ...story, description: event.target.value })}
                rows={3}
                className="rounded-2xl border border-violet-200 bg-white/90 p-4 text-sm leading-6 text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-200/50 dark:border-white/10 dark:bg-black/20 dark:text-white"
              />
            </label>
          </div>

          <div className="space-y-4">
            {story.chapters.map((chapter) => (
              <article key={chapter.id} className="overflow-hidden rounded-2xl border border-violet-200/70 bg-white/75 dark:border-white/10 dark:bg-black/15">
                <div className="grid gap-4 p-4 sm:grid-cols-[150px_1fr]">
                  <div className="h-36 overflow-hidden rounded-xl bg-violet-100 dark:bg-white/10">
                    {chapter.imageUrl ? (
                      <img src={chapter.imageUrl} alt={`Illustration zu Kapitel ${chapter.order}`} className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="m-auto h-full w-7 text-violet-400" aria-label="Illustration fehlt" />
                    )}
                  </div>
                  <div className="min-w-0 space-y-3">
                    <label className="grid gap-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-violet-600 dark:text-violet-300">
                      Kapitel {chapter.order}
                      <input
                        value={chapter.title}
                        onChange={(event) => updateChapter(chapter.id, { title: event.target.value })}
                        className="min-h-11 rounded-xl border border-violet-200 bg-white px-3 text-base font-bold normal-case tracking-normal text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200/50 dark:border-white/10 dark:bg-black/20 dark:text-white"
                      />
                    </label>
                    <textarea
                      aria-label={`Text von Kapitel ${chapter.order}`}
                      value={chapter.content}
                      onChange={(event) => updateChapter(chapter.id, { content: event.target.value })}
                      rows={10}
                      className="w-full rounded-xl border border-violet-200 bg-white p-3 text-sm leading-6 text-slate-800 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200/50 dark:border-white/10 dark:bg-black/20 dark:text-slate-100"
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-violet-200/60 pt-5 dark:border-white/10">
            <Button title={saving ? 'Speichert …' : 'Änderungen speichern'} onPress={handleSave} icon={<Save size={16} />} disabled={saving || generating} />
            <Button title="Vorschau lesen" onPress={() => navigate(`/character-life-story/${story.id}`)} icon={<Eye size={16} />} variant="secondary" disabled={!story.chapters.length} />
            <Button
              title={publishing ? 'Aktualisiert …' : story.status === 'published' ? 'Veröffentlichung zurücknehmen' : 'Veröffentlichen'}
              onPress={handleStatusChange}
              icon={<CheckCircle2 size={16} />}
              variant={story.status === 'published' ? 'outline' : 'fun'}
              disabled={publishing || generating || (story.status !== 'published' && !readyToPublish)}
            />
            {!readyToPublish && story.status !== 'published' && (
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Veröffentlichung erst möglich, wenn Cover und alle Kapitelbilder vorhanden sind.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

const Metric: React.FC<{ label: string; value: string; good: boolean }> = ({ label, value, good }) => (
  <div className="rounded-2xl border border-white/70 bg-white/70 p-3 shadow-sm dark:border-white/10 dark:bg-white/5">
    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</p>
    <p className={`mt-1 text-sm font-black ${good ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>{value}</p>
  </div>
);

export default CharacterLifeStoryPanel;