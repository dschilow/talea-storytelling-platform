import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Headphones,
  Loader2,
  Music,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import type { PlaylistItem } from '../../types/playlist';

interface PlaylistDrawerProps {
  variant: 'desktop' | 'mobile';
}

interface ChapterGroup {
  order: number;
  title: string;
  chunks: Array<{ item: PlaylistItem; globalIndex: number }>;
}

interface StoryGroup {
  storyId: string;
  title: string;
  coverImageUrl?: string;
  chapters: ChapterGroup[];
}

interface DokuGroup {
  dokuId: string;
  title: string;
  coverImageUrl?: string;
  chunks: Array<{ item: PlaylistItem; globalIndex: number }>;
}

const getStatusIcon = (
  state: 'ready' | 'converting' | 'error' | 'partial',
  size = 15,
) => {
  if (state === 'ready') return <Check size={size} className="text-emerald-500" />;
  if (state === 'error') return <AlertCircle size={size} className="text-red-500" />;
  if (state === 'converting') return <Loader2 size={size} className="animate-spin text-[var(--primary)]" />;
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--talea-text-tertiary)]">
      Mix
    </span>
  );
};

export const PlaylistDrawer: React.FC<PlaylistDrawerProps> = ({ variant }) => {
  const reduceMotion = useReducedMotion();
  const {
    playlist,
    currentIndex,
    isPlaylistDrawerOpen,
    togglePlaylistDrawer,
    removeFromPlaylist,
    removeStoryFromPlaylist,
    removeDokuFromPlaylist,
    clearPlaylist,
    playFromPlaylist,
  } = useAudioPlayer();

  const { storyGroups, dokuGroups, audioDokuItems } = useMemo(() => {
    const storiesMap = new Map<
      string,
      { title: string; coverImageUrl?: string; chaptersMap: Map<number, ChapterGroup> }
    >();
    const dokuMap = new Map<
      string,
      { title: string; coverImageUrl?: string; chunks: Array<{ item: PlaylistItem; globalIndex: number }> }
    >();
    const audioDokus: Array<{ item: PlaylistItem; globalIndex: number }> = [];

    playlist.forEach((item, idx) => {
      if (item.type === 'story-chapter' && item.parentStoryId) {
        let story = storiesMap.get(item.parentStoryId);
        if (!story) {
          story = {
            title: item.parentStoryTitle || item.description || 'Geschichte',
            coverImageUrl: item.coverImageUrl,
            chaptersMap: new Map(),
          };
          storiesMap.set(item.parentStoryId, story);
        }
        const chapterOrder = item.chapterOrder ?? 0;
        let chapter = story.chaptersMap.get(chapterOrder);
        if (!chapter) {
          chapter = {
            order: chapterOrder,
            title: item.chapterTitle || item.title,
            chunks: [],
          };
          story.chaptersMap.set(chapterOrder, chapter);
        }
        chapter.chunks.push({ item, globalIndex: idx });
      } else if (item.type === 'doku' && item.parentDokuId) {
        let doku = dokuMap.get(item.parentDokuId);
        if (!doku) {
          doku = {
            title: item.parentDokuTitle || item.title || 'Doku',
            coverImageUrl: item.coverImageUrl,
            chunks: [],
          };
          dokuMap.set(item.parentDokuId, doku);
        }
        doku.chunks.push({ item, globalIndex: idx });
      } else if (item.type === 'audio-doku') {
        audioDokus.push({ item, globalIndex: idx });
      }
    });

    return {
      storyGroups: Array.from(storiesMap.entries()).map(([storyId, story]) => ({
        storyId,
        title: story.title,
        coverImageUrl: story.coverImageUrl,
        chapters: Array.from(story.chaptersMap.values()).sort((a, b) => a.order - b.order),
      })),
      dokuGroups: Array.from(dokuMap.entries()).map(([dokuId, doku]) => ({
        dokuId,
        title: doku.title,
        coverImageUrl: doku.coverImageUrl,
        chunks: [...doku.chunks].sort(
          (a, b) =>
            (a.item.dokuChunkOrder ?? Number.MAX_SAFE_INTEGER) -
            (b.item.dokuChunkOrder ?? Number.MAX_SAFE_INTEGER),
        ),
      })),
      audioDokuItems: audioDokus,
    };
  }, [playlist]);

  const [activeTab, setActiveTab] = useState<'stories' | 'dokus' | 'audio-dokus'>(
    storyGroups.length > 0 ? 'stories' : dokuGroups.length > 0 ? 'dokus' : 'audio-dokus',
  );
  const [expandedStories, setExpandedStories] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (activeTab === 'stories' && storyGroups.length === 0) {
      if (dokuGroups.length > 0) {
        setActiveTab('dokus');
        return;
      }
      if (audioDokuItems.length > 0) {
        setActiveTab('audio-dokus');
      }
      return;
    }
    if (activeTab === 'dokus' && dokuGroups.length === 0) {
      if (storyGroups.length > 0) {
        setActiveTab('stories');
        return;
      }
      if (audioDokuItems.length > 0) {
        setActiveTab('audio-dokus');
      }
      return;
    }
    if (activeTab === 'audio-dokus' && audioDokuItems.length === 0) {
      if (storyGroups.length > 0) {
        setActiveTab('stories');
        return;
      }
      if (dokuGroups.length > 0) {
        setActiveTab('dokus');
      }
    }
  }, [activeTab, storyGroups.length, dokuGroups.length, audioDokuItems.length]);

  const currentItem =
    currentIndex >= 0 && currentIndex < playlist.length ? playlist[currentIndex] : null;
  const currentChapterKey = useMemo(() => {
    if (!currentItem) return null;
    if (currentItem.parentStoryId && currentItem.chapterOrder != null) {
      return `${currentItem.parentStoryId}-ch${currentItem.chapterOrder}`;
    }
    return currentItem.id;
  }, [currentItem]);

  useEffect(() => {
    if (!currentItem?.parentStoryId) return;
    setExpandedStories((prev) => {
      if (prev.has(currentItem.parentStoryId!)) return prev;
      const next = new Set(prev);
      next.add(currentItem.parentStoryId!);
      return next;
    });
  }, [currentItem?.parentStoryId]);

  if (!isPlaylistDrawerOpen) return null;

  const isDesktop = variant === 'desktop';
  const readyCount = playlist.filter((item) => item.conversionStatus === 'ready').length;
  const convertingCount = playlist.filter(
    (item) => item.conversionStatus === 'pending' || item.conversionStatus === 'converting',
  ).length;
  const errorCount = playlist.filter((item) => item.conversionStatus === 'error').length;
  const nextItem =
    playlist
      .slice(currentIndex >= 0 ? currentIndex + 1 : 0)
      .find((item) => item.conversionStatus !== 'error') || null;
  const summaryTitle =
    currentItem?.parentStoryTitle ||
    currentItem?.parentDokuTitle ||
    currentItem?.title ||
    'Warteschlange';
  const summaryDetail = currentItem?.description || 'Waehle einen Titel oder starte direkt die naechste Folge.';

  const surfaceStyle = {
    borderColor: 'var(--talea-border-light)',
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--talea-glass-bg-alt) 96%, white) 0%, color-mix(in srgb, var(--talea-glass-bg) 94%, transparent) 100%)',
  };

  const toggleExpanded = (storyId: string) => {
    setExpandedStories((prev) => {
      const next = new Set(prev);
      if (next.has(storyId)) next.delete(storyId);
      else next.add(storyId);
      return next;
    });
  };

  const renderChapter = (chapter: ChapterGroup, storyId: string) => {
    const readyParts = chapter.chunks.filter((chunk) => chunk.item.conversionStatus === 'ready').length;
    const totalParts = chapter.chunks.length;
    const hasError = chapter.chunks.some((chunk) => chunk.item.conversionStatus === 'error');
    const hasConverting = chapter.chunks.some(
      (chunk) =>
        chunk.item.conversionStatus === 'pending' ||
        chunk.item.conversionStatus === 'converting',
    );
    const state = hasError
      ? 'error'
      : readyParts === totalParts
        ? 'ready'
        : hasConverting
          ? 'converting'
          : 'partial';
    const chapterKey = `${storyId}-ch${chapter.order}`;
    const isCurrent = chapterKey === currentChapterKey;
    const firstReady = chapter.chunks.find((chunk) => chunk.item.conversionStatus === 'ready');

    return (
      <motion.button
        key={chapterKey}
        whileHover={
          reduceMotion ? undefined : { x: 2, transition: { duration: 0.18, ease: 'easeOut' } }
        }
        type="button"
        onClick={() => firstReady && playFromPlaylist(firstReady.globalIndex)}
        disabled={!firstReady}
        className="flex w-full items-center gap-3 rounded-[1.1rem] border px-3 py-3 text-left disabled:cursor-default disabled:opacity-70"
        style={{
          borderColor: isCurrent ? 'var(--talea-border-accent)' : 'var(--talea-border-light)',
          background: isCurrent
            ? 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 16%, transparent) 0%, color-mix(in srgb, var(--talea-accent-sky) 14%, transparent) 100%)'
            : 'var(--talea-surface-primary)',
        }}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border"
          style={{
            borderColor: 'var(--talea-border-light)',
            background: 'var(--talea-surface-inset)',
            color: 'var(--talea-text-secondary)',
          }}
        >
          <span className="text-xs font-semibold">{chapter.order}</span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--talea-text-primary)]">
            Kapitel {chapter.order}: {chapter.title}
          </p>
          <p className="mt-1 text-[11px] font-medium text-[var(--talea-text-secondary)]">
            {readyParts}/{totalParts} Teile bereit
          </p>
          {totalParts > 1 ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--talea-progress-track)]">
              <motion.div
                className="h-full rounded-full"
                style={{
                  width: `${(readyParts / totalParts) * 100}%`,
                  background:
                    'linear-gradient(90deg, var(--primary) 0%, var(--talea-accent-sky) 100%)',
                }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
              />
            </div>
          ) : null}
        </div>

        <div className="shrink-0">{getStatusIcon(state)}</div>
      </motion.button>
    );
  };

  const renderStoryGroup = (story: StoryGroup) => {
    const isExpanded = expandedStories.has(story.storyId);
    const allChunks = story.chapters.flatMap((chapter) => chapter.chunks);
    const readyChapters = story.chapters.filter((chapter) =>
      chapter.chunks.every((chunk) => chunk.item.conversionStatus === 'ready'),
    ).length;
    const isCurrentStory = story.chapters.some(
      (chapter) => `${story.storyId}-ch${chapter.order}` === currentChapterKey,
    );

    return (
      <div key={story.storyId} className="space-y-2">
        <div
          className="rounded-[1.35rem] border p-2"
          style={{
            borderColor: isCurrentStory ? 'var(--talea-border-accent)' : 'var(--talea-border-light)',
            background: isCurrentStory
              ? 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 14%, transparent) 0%, color-mix(in srgb, var(--talea-accent-sky) 14%, transparent) 100%)'
              : 'var(--talea-surface-primary)',
          }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleExpanded(story.storyId)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-[1.1rem] px-2 py-1.5 text-left"
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[1rem] border border-white/10 bg-[var(--talea-surface-inset)]">
                {story.coverImageUrl ? (
                  <img src={story.coverImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Headphones className="h-4 w-4 text-[var(--talea-text-tertiary)]" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--talea-text-primary)]">
                  {story.title}
                </p>
                <p className="mt-1 text-[11px] font-medium text-[var(--talea-text-secondary)]">
                  {readyChapters}/{story.chapters.length} Kapitel bereit
                </p>
              </div>

              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-[var(--talea-text-tertiary)]" />
              ) : (
                <ChevronRight className="h-4 w-4 text-[var(--talea-text-tertiary)]" />
              )}
            </button>

            <motion.button
              whileHover={reduceMotion ? undefined : { scale: 1.08 }}
              whileTap={reduceMotion ? undefined : { scale: 0.94 }}
              type="button"
              onClick={() => removeStoryFromPlaylist(story.storyId)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full"
              style={{ color: 'var(--talea-text-tertiary)' }}
              aria-label="Geschichte entfernen"
            >
              <Trash2 className="h-4 w-4" />
            </motion.button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isExpanded ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="space-y-2 border-l pl-4" style={{ borderColor: 'var(--talea-border-light)' }}>
                {story.chapters.map((chapter) => renderChapter(chapter, story.storyId))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  };

  const renderDokuGroup = (doku: DokuGroup) => {
    const readyParts = doku.chunks.filter((chunk) => chunk.item.conversionStatus === 'ready').length;
    const totalParts = doku.chunks.length;
    const hasError = doku.chunks.some((chunk) => chunk.item.conversionStatus === 'error');
    const hasConverting = doku.chunks.some(
      (chunk) =>
        chunk.item.conversionStatus === 'pending' ||
        chunk.item.conversionStatus === 'converting',
    );
    const state = hasError
      ? 'error'
      : readyParts === totalParts
        ? 'ready'
        : hasConverting
          ? 'converting'
          : 'partial';
    const isCurrent = doku.chunks.some(({ globalIndex }) => globalIndex === currentIndex);
    const firstReady = doku.chunks.find((chunk) => chunk.item.conversionStatus === 'ready');

    return (
      <motion.div
        key={doku.dokuId}
        whileHover={
          reduceMotion ? undefined : { x: 2, transition: { duration: 0.18, ease: 'easeOut' } }
        }
        className="rounded-[1.35rem] border p-2"
        style={{
          borderColor: isCurrent ? 'var(--talea-border-accent)' : 'var(--talea-border-light)',
          background: isCurrent
            ? 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 14%, transparent) 0%, color-mix(in srgb, var(--talea-accent-sky) 14%, transparent) 100%)'
            : 'var(--talea-surface-primary)',
        }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => firstReady && playFromPlaylist(firstReady.globalIndex)}
            disabled={!firstReady}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-[1.1rem] px-2 py-1.5 text-left disabled:cursor-default"
          >
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[1rem] border border-white/10 bg-[var(--talea-surface-inset)]">
              {doku.coverImageUrl ? (
                <img src={doku.coverImageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <BookOpen className="h-4 w-4 text-[var(--talea-text-tertiary)]" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--talea-text-primary)]">
                {doku.title}
              </p>
              <p className="mt-1 text-[11px] font-medium text-[var(--talea-text-secondary)]">
                {readyParts}/{totalParts} Teile bereit
              </p>
            </div>
          </button>

          <div className="shrink-0">{getStatusIcon(state)}</div>

          <motion.button
            whileHover={reduceMotion ? undefined : { scale: 1.08 }}
            whileTap={reduceMotion ? undefined : { scale: 0.94 }}
            type="button"
            onClick={() => removeDokuFromPlaylist(doku.dokuId)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full"
            style={{ color: 'var(--talea-text-tertiary)' }}
            aria-label="Doku entfernen"
          >
            <Trash2 className="h-4 w-4" />
          </motion.button>
        </div>
      </motion.div>
    );
  };

  const renderAudioDokuItem = (item: PlaylistItem, globalIndex: number) => {
    const isCurrent = globalIndex === currentIndex;
    const state =
      item.conversionStatus === 'error'
        ? 'error'
        : item.conversionStatus === 'ready'
          ? 'ready'
          : item.conversionStatus === 'converting' || item.conversionStatus === 'pending'
            ? 'converting'
            : 'partial';

    return (
      <motion.div
        key={item.id}
        whileHover={
          reduceMotion ? undefined : { x: 2, transition: { duration: 0.18, ease: 'easeOut' } }
        }
        className="rounded-[1.35rem] border p-2"
        style={{
          borderColor: isCurrent ? 'var(--talea-border-accent)' : 'var(--talea-border-light)',
          background: isCurrent
            ? 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 14%, transparent) 0%, color-mix(in srgb, var(--talea-accent-sky) 14%, transparent) 100%)'
            : 'var(--talea-surface-primary)',
        }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => item.conversionStatus === 'ready' && playFromPlaylist(globalIndex)}
            disabled={item.conversionStatus !== 'ready'}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-[1.1rem] px-2 py-1.5 text-left disabled:cursor-default"
          >
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[1rem] border border-white/10 bg-[var(--talea-surface-inset)]">
              {item.coverImageUrl ? (
                <img src={item.coverImageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Music className="h-4 w-4 text-[var(--talea-text-tertiary)]" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--talea-text-primary)]">
                {item.title}
              </p>
              <p className="mt-1 truncate text-[11px] font-medium text-[var(--talea-text-secondary)]">
                {item.description || 'Audio Titel'}
              </p>
            </div>
          </button>

          <div className="shrink-0">{getStatusIcon(state)}</div>

          <motion.button
            whileHover={reduceMotion ? undefined : { scale: 1.08 }}
            whileTap={reduceMotion ? undefined : { scale: 0.94 }}
            type="button"
            onClick={() => removeFromPlaylist(item.id)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full"
            style={{ color: 'var(--talea-text-tertiary)' }}
            aria-label="Titel entfernen"
          >
            <Trash2 className="h-4 w-4" />
          </motion.button>
        </div>
      </motion.div>
    );
  };

  const content = (
    <div className={isDesktop ? 'grid max-h-[72vh] min-h-0 xl:grid-cols-[18rem_minmax(0,1fr)]' : 'flex min-h-0 flex-1 flex-col'}>
      <div
        className="border-b p-4 sm:p-5 xl:border-b-0 xl:border-r"
        style={{ borderColor: 'var(--talea-border-light)' }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--talea-text-secondary)]">
              Warteschlange
            </p>
            <h3
              className="mt-2 text-[1.6rem] font-semibold text-[var(--talea-text-primary)]"
              style={{ fontFamily: '"Fraunces", "Cormorant Garamond", serif' }}
            >
              {playlist.length} Titel
            </h3>
          </div>

          <motion.button
            whileHover={reduceMotion ? undefined : { scale: 1.08 }}
            whileTap={reduceMotion ? undefined : { scale: 0.94 }}
            type="button"
            onClick={togglePlaylistDrawer}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border"
            style={{
              borderColor: 'var(--talea-border-soft)',
              background: 'var(--talea-surface-primary)',
              color: 'var(--talea-text-secondary)',
            }}
            aria-label="Warteschlange schliessen"
          >
            <X className="h-4 w-4" />
          </motion.button>
        </div>

        <div
          className="mt-5 rounded-[1.5rem] border p-3"
          style={{
            borderColor: 'var(--talea-border-light)',
            background: 'var(--talea-surface-primary)',
          }}
        >
          <div className="flex items-start gap-3">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[1.1rem] border border-white/10 bg-[var(--talea-surface-inset)]">
              {currentItem?.coverImageUrl ? (
                <img src={currentItem.coverImageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Music className="h-5 w-5 text-[var(--talea-text-tertiary)]" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--talea-text-tertiary)]">
                Jetzt dran
              </p>
              <p className="mt-2 line-clamp-2 text-sm font-semibold text-[var(--talea-text-primary)]">
                {summaryTitle}
              </p>
              <p className="mt-1 line-clamp-2 text-[11px] font-medium text-[var(--talea-text-secondary)]">
                {summaryDetail}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: 'Bereit', value: readyCount },
              { label: 'Laden', value: convertingCount },
              { label: 'Fehler', value: errorCount },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[1rem] px-3 py-2"
                style={{ background: 'var(--talea-surface-inset)' }}
              >
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--talea-text-tertiary)]">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--talea-text-primary)]">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-[1rem] border px-3 py-2.5" style={{ borderColor: 'var(--talea-border-light)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--talea-text-tertiary)]">
              Als naechstes
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--talea-text-primary)]">
              {nextItem?.title || 'Noch nichts geplant'}
            </p>
          </div>
        </div>

        {playlist.length > 0 ? (
          <div className="mt-4 flex gap-2">
            <motion.button
              whileHover={reduceMotion ? undefined : { scale: 1.02 }}
              whileTap={reduceMotion ? undefined : { scale: 0.96 }}
              type="button"
              onClick={clearPlaylist}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-[1rem] border px-3 py-2.5 text-sm font-semibold"
              style={{
                borderColor: 'var(--talea-border-soft)',
                background: 'var(--talea-surface-primary)',
                color: 'var(--talea-text-secondary)',
              }}
            >
              <Trash2 className="h-4 w-4" />
              Leeren
            </motion.button>
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className="border-b px-4 py-3 sm:px-5"
          style={{ borderColor: 'var(--talea-border-light)' }}
        >
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'stories', label: `Stories (${storyGroups.length})`, visible: storyGroups.length > 0 },
              { id: 'dokus', label: `Dokus (${dokuGroups.length})`, visible: dokuGroups.length > 0 },
              { id: 'audio-dokus', label: `Audio (${audioDokuItems.length})`, visible: audioDokuItems.length > 0 },
            ]
              .filter((item) => item.visible)
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id as typeof activeTab)}
                  className="relative rounded-full px-4 py-2 text-sm font-semibold"
                  style={{
                    color:
                      activeTab === item.id
                        ? 'var(--talea-text-primary)'
                        : 'var(--talea-text-secondary)',
                  }}
                >
                  {activeTab === item.id ? (
                    <motion.span
                      layoutId={`playlist-tab-${variant}`}
                      className="absolute inset-0 rounded-full"
                      style={{
                        background:
                          'linear-gradient(135deg, color-mix(in srgb, var(--primary) 16%, transparent) 0%, color-mix(in srgb, var(--talea-accent-sky) 14%, transparent) 100%)',
                        border: '1px solid var(--talea-border-accent)',
                      }}
                    />
                  ) : null}
                  <span className="relative z-10">{item.label}</span>
                </button>
              ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {playlist.length === 0 ? (
            <div
              className="flex min-h-[16rem] flex-col items-center justify-center rounded-[1.5rem] border px-6 py-10 text-center"
              style={{
                borderColor: 'var(--talea-border-light)',
                background: 'var(--talea-surface-primary)',
              }}
            >
              <Sparkles className="h-8 w-8 text-[var(--primary)]" />
              <p className="mt-4 text-lg font-semibold text-[var(--talea-text-primary)]">
                Noch keine Titel in der Queue
              </p>
              <p className="mt-2 text-sm font-medium text-[var(--talea-text-secondary)]">
                Fuege Stories oder Dokus hinzu, damit sie hier direkt weiterlaufen koennen.
              </p>
            </div>
          ) : activeTab === 'stories' ? (
            <div className="space-y-3">
              {storyGroups.map((story) => renderStoryGroup(story))}
            </div>
          ) : activeTab === 'dokus' ? (
            <div className="space-y-3">
              {dokuGroups.map((doku) => renderDokuGroup(doku))}
            </div>
          ) : (
            <div className="space-y-3">
              {audioDokuItems.map(({ item, globalIndex }) => renderAudioDokuItem(item, globalIndex))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <motion.div
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        className="absolute bottom-full left-0 right-0 mb-4 overflow-hidden rounded-[2rem] border shadow-[var(--talea-shadow-strong)] backdrop-blur-2xl"
        style={surfaceStyle}
      >
        {content}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1300] flex items-end p-3 sm:p-4"
    >
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        type="button"
        onClick={togglePlaylistDrawer}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
        aria-label="Warteschlange schliessen"
      />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="relative flex max-h-full w-full flex-col overflow-hidden rounded-[2rem] border shadow-[var(--talea-shadow-strong)] backdrop-blur-2xl"
        style={surfaceStyle}
      >
        <div className="mx-auto mt-3 h-1.5 w-16 rounded-full bg-[var(--talea-border-strong)]" />
        {content}
      </motion.div>
    </motion.div>
  );
};
