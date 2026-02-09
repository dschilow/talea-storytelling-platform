import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BookOpen,
  Clock3,
  Download,
  Grid3X3,
  LayoutList,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';

import { useBackend } from '../../hooks/useBackend';
import { exportStoryAsPDF, isPDFExportSupported } from '../../utils/pdfExport';
import type { Story } from '../../types/story';

const palette = {
  page: '#f5f2ec',
  text: '#17212d',
  muted: '#5d6772',
  border: '#ddd5c8',
  surface: '#ffffff',
  accent: '#0f766e',
  accentSoft: '#d7ece8',
  warning: '#8a5a24',
  danger: '#9d3f3f',
};

const headingFont = '"Fraunces", "Times New Roman", serif';
const bodyFont = '"Manrope", "Segoe UI", sans-serif';

const StoriesAtmosphere: React.FC = () => (
  <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
    <div
      className="absolute inset-0"
      style={{
        background: `radial-gradient(1200px 520px at 100% 0%, #e8ddd0 0%, transparent 55%),
                     radial-gradient(900px 420px at 0% 15%, #d9e9e6 0%, transparent 60%),
                     ${palette.page}`,
      }}
    />
  </div>
);

const StoryParticipants: React.FC<{ story: Story }> = ({ story }) => {
  const participants = [
    ...((story.config?.avatars || []).map((p) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.name)}`,
    })) || []),
    ...((story.config?.characters || []).map((p) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.imageUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(p.name)}`,
    })) || []),
  ];

  if (participants.length === 0) return null;

  const visible = participants.slice(0, 5);
  const hiddenCount = participants.length - visible.length;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {visible.map((p) => (
        <div
          key={`${story.id}-${p.id}`}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs"
          style={{ borderColor: palette.border, color: palette.text, background: '#faf8f4' }}
        >
          <img src={p.imageUrl} alt={p.name} className="h-5 w-5 rounded-full object-cover" />
          <span className="max-w-[96px] truncate">{p.name}</span>
        </div>
      ))}
      {hiddenCount > 0 && (
        <span
          className="inline-flex h-7 items-center rounded-full border px-2 text-xs font-semibold"
          style={{ borderColor: palette.border, color: palette.muted, background: '#faf8f4' }}
        >
          +{hiddenCount}
        </span>
      )}
    </div>
  );
};

const StatusBadge: React.FC<{ status: Story['status'] }> = ({ status }) => {
  if (status === 'complete') {
    return (
      <span
        className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
        style={{ background: '#ddf0ea', color: palette.accent }}
      >
        Fertig
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span
        className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
        style={{ background: '#f7dfdf', color: palette.danger }}
      >
        Fehler
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
      style={{ background: '#f5e8d7', color: palette.warning }}
    >
      In Arbeit
    </span>
  );
};

const StoryGridCard: React.FC<{
  story: Story;
  index: number;
  onRead: () => void;
  onDelete: () => void;
}> = ({ story, index, onRead, onDelete }) => {
  const backend = useBackend();
  const [exporting, setExporting] = useState(false);
  const reduceMotion = useReducedMotion();

  const handleDownloadPdf = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!isPDFExportSupported() || story.status !== 'complete') return;

    try {
      setExporting(true);
      const fullStory = await backend.story.get({ id: story.id });
      if (!fullStory.chapters || fullStory.chapters.length === 0) return;
      await exportStoryAsPDF(fullStory as any);
    } catch (error) {
      console.error('PDF export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
      whileHover={reduceMotion ? undefined : { y: -4 }}
      whileTap={reduceMotion ? undefined : { scale: 0.995 }}
      onClick={onRead}
      className="group cursor-pointer overflow-hidden rounded-2xl border shadow-sm"
      style={{ borderColor: palette.border, background: palette.surface }}
    >
      <div className="relative h-52 overflow-hidden">
        {story.coverImageUrl ? (
          <img src={story.coverImageUrl} alt={story.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{ background: '#ece6dc', color: '#7d7568' }}>
            <BookOpen className="h-11 w-11" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />

        <div className="absolute left-3 top-3">
          <StatusBadge status={story.status} />
        </div>

        <div className="absolute right-3 top-3 flex items-center gap-2">
          {story.status === 'complete' && (
            <button
              onClick={handleDownloadPdf}
              className="rounded-lg border p-1.5 text-white transition-colors hover:bg-black/70"
              style={{ borderColor: 'rgba(255,255,255,0.35)', background: 'rgba(23,33,45,0.45)' }}
              aria-label="PDF herunterladen"
            >
              {exporting ? <Clock3 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </button>
          )}
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="rounded-lg border p-1.5 text-white transition-colors hover:bg-red-700"
            style={{ borderColor: 'rgba(255,255,255,0.35)', background: 'rgba(23,33,45,0.45)' }}
            aria-label="Story loeschen"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-4">
        <h3 className="line-clamp-2 text-xl font-semibold leading-tight" style={{ color: palette.text, fontFamily: headingFont }}>
          {story.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed" style={{ color: palette.muted }}>
          {story.summary || story.description || 'Noch keine Zusammenfassung verfuegbar.'}
        </p>

        <StoryParticipants story={story} />

        <div className="mt-4 flex items-center justify-between text-xs" style={{ color: palette.muted }}>
          <span>{new Date(story.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          <span className="font-semibold" style={{ color: palette.accent }}>
            Oeffnen
          </span>
        </div>
      </div>
    </motion.article>
  );
};

const StoryListRow: React.FC<{
  story: Story;
  index: number;
  onRead: () => void;
  onDelete: () => void;
}> = ({ story, index, onRead, onDelete }) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, x: -14 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      whileHover={reduceMotion ? undefined : { x: 2 }}
      onClick={onRead}
      className="group cursor-pointer overflow-hidden rounded-2xl border shadow-sm"
      style={{ borderColor: palette.border, background: palette.surface }}
    >
    <div className="flex flex-col md:flex-row">
      <div className="relative h-40 w-full md:h-auto md:w-56">
        {story.coverImageUrl ? (
          <img src={story.coverImageUrl} alt={story.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{ background: '#ece6dc', color: '#7d7568' }}>
            <BookOpen className="h-9 w-9" />
          </div>
        )}
      </div>

      <div className="flex-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-1 text-lg font-semibold" style={{ color: palette.text, fontFamily: headingFont }}>
            {story.title}
          </h3>
          <div className="flex items-center gap-2">
            <StatusBadge status={story.status} />
            <button
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              className="rounded-lg border p-1.5 transition-colors hover:bg-black/5"
              style={{ borderColor: palette.border, color: palette.danger }}
              aria-label="Story loeschen"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <p className="mt-2 line-clamp-2 text-sm leading-relaxed" style={{ color: palette.muted }}>
          {story.summary || story.description || 'Noch keine Zusammenfassung verfuegbar.'}
        </p>

        <StoryParticipants story={story} />

        <div className="mt-4 text-xs" style={{ color: palette.muted }}>
          {new Date(story.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      </div>
    </div>
    </motion.article>
  );
};

const EmptyState: React.FC<{ onCreateNew: () => void }> = ({ onCreateNew }) => (
  <div
    className="rounded-3xl border px-8 py-14 text-center shadow-sm"
    style={{ borderColor: palette.border, background: palette.surface }}
  >
    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: palette.accentSoft, color: palette.accent }}>
      <BookOpen className="h-7 w-7" />
    </div>
    <h2 className="text-3xl font-semibold" style={{ color: palette.text, fontFamily: headingFont }}>
      Noch keine Geschichten
    </h2>
    <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed" style={{ color: palette.muted }}>
      Starte mit deiner ersten Story. Teilnehmer bleiben in jeder Story-Karte sichtbar und helfen dir bei der Orientierung.
    </p>
    <button
      onClick={onCreateNew}
      className="mt-7 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      style={{ background: palette.accent }}
    >
      <Plus className="h-4 w-4" />
      Erste Story erstellen
    </button>
  </div>
);

const LoadingState: React.FC = () => (
  <div className="space-y-4">
    {Array.from({ length: 6 }).map((_, index) => (
      <div
        key={index}
        className="h-64 animate-pulse rounded-2xl border"
        style={{ borderColor: palette.border, background: '#ece6dc' }}
      />
    ))}
  </div>
);

const TaleaStoriesScreen: React.FC = () => {
  const backend = useBackend();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const reduceMotion = useReducedMotion();
  const observerTarget = useRef<HTMLDivElement>(null);

  const loadStories = async () => {
    try {
      setLoading(true);
      const response = await backend.story.list({ limit: 12, offset: 0 });
      setStories((response.stories as Story[]) || []);
      setTotal(response.total || 0);
      setHasMore(response.hasMore || false);
    } catch (error) {
      console.error('Error loading stories:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreStories = useCallback(async () => {
    if (!hasMore || loadingMore) return;

    try {
      setLoadingMore(true);
      const response = await backend.story.list({ limit: 12, offset: stories.length });
      setStories((prev) => [...prev, ...((response.stories as Story[]) || [])]);
      setHasMore(response.hasMore || false);
    } catch (error) {
      console.error('Error loading more stories:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [backend, hasMore, loadingMore, stories.length]);

  useEffect(() => {
    loadStories();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore && !loading) {
          loadMoreStories();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadingMore, loading, loadMoreStories]);

  const handleDeleteStory = async (storyId: string, storyTitle: string) => {
    if (!window.confirm(`${t('common.delete', 'Loeschen')} "${storyTitle}"?`)) return;

    try {
      await backend.story.deleteStory({ id: storyId });
      setStories((prev) => prev.filter((story) => story.id !== storyId));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error deleting story:', error);
    }
  };

  const filteredStories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return stories;
    return stories.filter((story) => {
      const title = story.title?.toLowerCase() || '';
      const summary = story.summary?.toLowerCase() || '';
      const description = story.description?.toLowerCase() || '';
      return title.includes(query) || summary.includes(query) || description.includes(query);
    });
  }, [stories, searchQuery]);

  return (
    <div className="relative min-h-screen pb-28" style={{ fontFamily: bodyFont }}>
      <StoriesAtmosphere />

      <SignedOut>
        <div className="flex min-h-[70vh] items-center justify-center px-6">
          <div
            className="max-w-xl rounded-3xl border px-8 py-10 text-center shadow-sm"
            style={{ borderColor: palette.border, background: palette.surface }}
          >
            <h2 className="text-3xl font-semibold" style={{ color: palette.text, fontFamily: headingFont }}>
              Zugriff erforderlich
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: palette.muted }}>
              Melde dich an, um deine Story-Bibliothek zu sehen.
            </p>
            <button
              onClick={() => navigate('/auth')}
              className="mt-6 rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ background: palette.accent }}
            >
              Anmelden
            </button>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="pt-6">
          <motion.header
            initial={reduceMotion ? false : { opacity: 0, y: -14 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            className="rounded-3xl border px-5 py-5 shadow-sm md:px-6"
            style={{ borderColor: palette.border, background: palette.surface }}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-4xl font-semibold tracking-tight" style={{ color: palette.text, fontFamily: headingFont }}>
                  Story-Bibliothek
                </h1>
                <p className="mt-1 text-sm" style={{ color: palette.muted }}>
                  {total} gespeicherte Geschichten
                </p>
              </div>
              <button
                onClick={() => navigate('/story')}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: palette.accent }}
              >
                <Plus className="h-4 w-4" />
                Neue Story
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-3 md:flex-row">
              <label className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: palette.muted }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Nach Titel oder Inhalt suchen..."
                  className="w-full rounded-xl border py-2 pl-10 pr-3 text-sm outline-none transition-colors focus:ring-2"
                  style={{ borderColor: palette.border, color: palette.text, background: '#faf8f4' }}
                />
              </label>
              <div className="inline-flex rounded-xl border p-1" style={{ borderColor: palette.border, background: '#faf8f4' }}>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`rounded-lg p-2 ${viewMode === 'grid' ? 'text-white' : ''}`}
                  style={viewMode === 'grid' ? { background: palette.accent } : { color: palette.muted }}
                  aria-label="Rasteransicht"
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`rounded-lg p-2 ${viewMode === 'list' ? 'text-white' : ''}`}
                  style={viewMode === 'list' ? { background: palette.accent } : { color: palette.muted }}
                  aria-label="Listenansicht"
                >
                  <LayoutList className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.header>

          <div className="mt-6">
            {loading ? (
              <LoadingState />
            ) : filteredStories.length === 0 ? (
              <EmptyState onCreateNew={() => navigate('/story')} />
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredStories.map((story, index) => (
                  <StoryGridCard
                    key={story.id}
                    story={story}
                    index={index}
                    onRead={() => navigate(`/story-reader/${story.id}`)}
                    onDelete={() => handleDeleteStory(story.id, story.title)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredStories.map((story, index) => (
                  <StoryListRow
                    key={story.id}
                    story={story}
                    index={index}
                    onRead={() => navigate(`/story-reader/${story.id}`)}
                    onDelete={() => handleDeleteStory(story.id, story.title)}
                  />
                ))}
              </div>
            )}

            {hasMore && (
              <div ref={observerTarget} className="mt-6 flex justify-center">
                {loadingMore && (
                  <div
                    className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold"
                    style={{ borderColor: palette.border, background: palette.surface, color: palette.muted }}
                  >
                    <Clock3 className="h-3.5 w-3.5 animate-spin" />
                    Weitere Stories werden geladen...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </SignedIn>
    </div>
  );
};

export default TaleaStoriesScreen;
