import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Headphones,
  Loader2,
  Music,
  Trash2,
  X,
} from 'lucide-react';

import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { useTheme } from '../../contexts/ThemeContext';
import type { PlaylistItem } from '../../types/playlist';

interface PlaylistDrawerProps {
  variant: 'desktop' | 'mobile';
}

/** A chapter is a group of chunks that belong to the same story chapter */
interface ChapterGroup {
  order: number;
  title: string;
  chunks: Array<{ item: PlaylistItem; globalIndex: number }>;
}

/** A story is a group of chapters */
interface StoryGroup {
  storyId: string;
  title: string;
  coverImageUrl?: string;
  chapters: ChapterGroup[];
}

export const PlaylistDrawer: React.FC<PlaylistDrawerProps> = ({ variant }) => {
  const {
    playlist,
    currentIndex,
    isPlaylistDrawerOpen,
    togglePlaylistDrawer,
    removeFromPlaylist,
    clearPlaylist,
    playFromPlaylist,
  } = useAudioPlayer();
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

  const colors = useMemo(
    () =>
      isDark
        ? {
            bg: 'rgba(23,31,43,0.96)',
            border: '#33465f',
            text: '#e7eef9',
            sub: '#9fb0c7',
            muted: '#5a6d84',
            accentStart: '#86a7db',
            accentEnd: '#b084c7',
            hoverBg: 'rgba(134,167,219,0.08)',
            activeBorder: 'linear-gradient(180deg, #86a7db, #b084c7)',
            progressBg: 'rgba(134,167,219,0.15)',
            progressFill: '#86a7db',
          }
        : {
            bg: 'rgba(255,250,244,0.97)',
            border: '#e4d8c9',
            text: '#203047',
            sub: '#64758a',
            muted: '#a0a8b4',
            accentStart: '#d5bdaf',
            accentEnd: '#b183c4',
            hoverBg: 'rgba(213,189,175,0.1)',
            activeBorder: 'linear-gradient(180deg, #d5bdaf, #b183c4)',
            progressBg: 'rgba(213,189,175,0.2)',
            progressFill: '#d5bdaf',
          },
    [isDark],
  );

  // ── Group playlist items: Stories → Chapters → Chunks (hidden) ──
  const { storyGroups, dokuItems, totalChapters } = useMemo(() => {
    const storiesMap = new Map<
      string,
      { title: string; coverImageUrl?: string; chaptersMap: Map<number, ChapterGroup> }
    >();
    const dokus: Array<{ item: PlaylistItem; globalIndex: number }> = [];
    let chapterCount = 0;

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
        const chOrder = item.chapterOrder ?? 0;
        let chapter = story.chaptersMap.get(chOrder);
        if (!chapter) {
          chapter = { order: chOrder, title: item.chapterTitle || item.title, chunks: [] };
          story.chaptersMap.set(chOrder, chapter);
          chapterCount++;
        }
        chapter.chunks.push({ item, globalIndex: idx });
      } else {
        dokus.push({ item, globalIndex: idx });
      }
    });

    const groups: StoryGroup[] = Array.from(storiesMap.entries()).map(([storyId, s]) => ({
      storyId,
      title: s.title,
      coverImageUrl: s.coverImageUrl,
      chapters: Array.from(s.chaptersMap.values()).sort((a, b) => a.order - b.order),
    }));

    return { storyGroups: groups, dokuItems: dokus, totalChapters: chapterCount + dokus.length };
  }, [playlist]);

  const [activeTab, setActiveTab] = useState<'stories' | 'dokus'>(
    storyGroups.length > 0 ? 'stories' : 'dokus',
  );
  const [expandedStories, setExpandedStories] = useState<Set<string>>(new Set());

  const toggleExpanded = (storyId: string) => {
    setExpandedStories((prev) => {
      const next = new Set(prev);
      if (next.has(storyId)) next.delete(storyId);
      else next.add(storyId);
      return next;
    });
  };

  if (!isPlaylistDrawerOpen) return null;

  const isDesktop = variant === 'desktop';

  // ── Determine which chapter is currently playing ──
  const currentChapterKey = useMemo(() => {
    if (currentIndex < 0 || currentIndex >= playlist.length) return null;
    const cur = playlist[currentIndex];
    if (cur.parentStoryId && cur.chapterOrder != null) {
      return `${cur.parentStoryId}-ch${cur.chapterOrder}`;
    }
    return cur.id;
  }, [currentIndex, playlist]);

  // ── Render a chapter row (aggregates all chunks) ──
  const renderChapter = (chapter: ChapterGroup, storyId: string) => {
    const readyCount = chapter.chunks.filter((c) => c.item.conversionStatus === 'ready').length;
    const totalCount = chapter.chunks.length;
    const hasError = chapter.chunks.some((c) => c.item.conversionStatus === 'error');
    const hasConverting = chapter.chunks.some((c) => c.item.conversionStatus === 'converting');
    const allReady = readyCount === totalCount;
    const chapterKey = `${storyId}-ch${chapter.order}`;
    const isCurrent = chapterKey === currentChapterKey;

    // Find the first ready chunk to play when clicked
    const firstReadyChunk = chapter.chunks.find((c) => c.item.conversionStatus === 'ready');
    // Or the first chunk overall (to start from beginning)
    const firstChunk = chapter.chunks[0];
    const canPlay = !!firstReadyChunk;

    return (
      <motion.div
        key={chapterKey}
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.15 }}
        onClick={() => canPlay && playFromPlaylist(firstReadyChunk!.globalIndex)}
        className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors"
        style={{
          cursor: canPlay ? 'pointer' : 'default',
          background: isCurrent ? colors.hoverBg : 'transparent',
          marginLeft: 20,
          borderLeft: isCurrent ? '3px solid' : '3px solid transparent',
          borderImage: isCurrent ? colors.activeBorder + ' 1' : undefined,
        }}
      >
        {/* Chapter icon */}
        <div
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded"
          style={{ background: colors.progressBg }}
        >
          <BookOpen size={12} style={{ color: isCurrent ? colors.text : colors.muted }} />
        </div>

        {/* Title + progress */}
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[12px] font-medium leading-tight"
            style={{ color: isCurrent ? colors.text : colors.sub }}
          >
            Kapitel {chapter.order}: {chapter.title}
          </p>

          {/* Progress bar (only show if multiple chunks and not all ready) */}
          {totalCount > 1 && !allReady && (
            <div
              className="mt-1 h-[3px] w-full overflow-hidden rounded-full"
              style={{ background: colors.progressBg }}
            >
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(readyCount / totalCount) * 100}%` }}
                transition={{ duration: 0.3 }}
                style={{
                  background: `linear-gradient(90deg, ${colors.accentStart}, ${colors.accentEnd})`,
                }}
              />
            </div>
          )}
        </div>

        {/* Status icon */}
        <div className="flex-shrink-0">
          {allReady ? (
            <Check size={14} className="text-emerald-400" />
          ) : hasError ? (
            <AlertCircle size={14} className="text-red-400" />
          ) : hasConverting ? (
            <Loader2 size={14} className="animate-spin text-blue-400" />
          ) : (
            <span className="text-[10px]" style={{ color: colors.muted }}>
              {readyCount}/{totalCount}
            </span>
          )}
        </div>
      </motion.div>
    );
  };

  // ── Render a story group (with expandable chapters) ──
  const renderStoryGroup = (story: StoryGroup) => {
    const isExpanded = expandedStories.has(story.storyId);
    const allChunks = story.chapters.flatMap((ch) => ch.chunks);
    const readyChapters = story.chapters.filter((ch) =>
      ch.chunks.every((c) => c.item.conversionStatus === 'ready'),
    ).length;
    const hasConverting = allChunks.some((c) => c.item.conversionStatus === 'converting');

    return (
      <div key={story.storyId}>
        <button
          onClick={() => toggleExpanded(story.storyId)}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-white/5"
        >
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-slate-200/20 dark:bg-slate-700/20">
            {story.coverImageUrl ? (
              <img src={story.coverImageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Headphones size={15} style={{ color: colors.muted }} />
            )}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-[12px] font-semibold" style={{ color: colors.text }}>
              {story.title}
            </p>
            <p className="text-[10px]" style={{ color: colors.muted }}>
              {readyChapters}/{story.chapters.length} Kapitel bereit
              {hasConverting && ' — wird konvertiert...'}
            </p>
          </div>
          {hasConverting && <Loader2 size={13} className="animate-spin flex-shrink-0 text-blue-400" />}
          {isExpanded ? (
            <ChevronDown size={14} style={{ color: colors.muted }} />
          ) : (
            <ChevronRight size={14} style={{ color: colors.muted }} />
          )}
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {story.chapters.map((chapter) => renderChapter(chapter, story.storyId))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // ── Render a doku item ──
  const renderDokuItem = (item: PlaylistItem, globalIndex: number) => {
    const isCurrent = globalIndex === currentIndex;
    const isReady = item.conversionStatus === 'ready';

    return (
      <motion.div
        key={item.id}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 8 }}
        transition={{ duration: 0.2 }}
        onClick={() => isReady && playFromPlaylist(globalIndex)}
        className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors"
        style={{
          cursor: isReady ? 'pointer' : 'default',
          background: isCurrent ? colors.hoverBg : 'transparent',
          borderLeft: isCurrent ? '3px solid' : '3px solid transparent',
          borderImage: isCurrent ? colors.activeBorder + ' 1' : undefined,
        }}
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-slate-200/20 dark:bg-slate-700/20">
          {item.coverImageUrl ? (
            <img src={item.coverImageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Music size={14} style={{ color: colors.muted }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[12px] font-medium leading-tight"
            style={{ color: isCurrent ? colors.text : colors.sub }}
          >
            {item.title}
          </p>
          {item.description && (
            <p className="truncate text-[10px]" style={{ color: colors.muted }}>
              {item.description}
            </p>
          )}
        </div>
        <div className="flex-shrink-0">
          {item.conversionStatus === 'ready' ? (
            <Check size={14} className="text-emerald-400" />
          ) : item.conversionStatus === 'converting' ? (
            <Loader2 size={14} className="animate-spin text-blue-400" />
          ) : item.conversionStatus === 'error' ? (
            <AlertCircle size={14} className="text-red-400" />
          ) : null}
        </div>
        <motion.button
          initial={{ opacity: 0 }}
          whileHover={{ scale: 1.1 }}
          className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            removeFromPlaylist(item.id);
          }}
          title="Entfernen"
        >
          <Trash2 size={13} style={{ color: colors.muted }} />
        </motion.button>
      </motion.div>
    );
  };

  const content = (
    <div className="flex max-h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: colors.border }}>
        <h3 className="text-sm font-semibold" style={{ color: colors.text, fontFamily: '"Sora", sans-serif' }}>
          Wiedergabeliste
        </h3>
        <div className="flex items-center gap-2">
          {playlist.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={clearPlaylist}
              title="Alle entfernen"
              className="rounded-full p-1"
              style={{ color: colors.muted }}
            >
              <Trash2 size={14} />
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={togglePlaylistDrawer}
            className="rounded-full p-1"
            style={{ color: colors.muted }}
          >
            <X size={16} />
          </motion.button>
        </div>
      </div>

      {/* Tabs */}
      {(storyGroups.length > 0 || dokuItems.length > 0) && (
        <div className="flex border-b px-4" style={{ borderColor: colors.border }}>
          <button
            onClick={() => setActiveTab('stories')}
            className="relative px-3 py-2 text-[12px] font-medium transition-colors"
            style={{ color: activeTab === 'stories' ? colors.text : colors.muted }}
          >
            Geschichten ({storyGroups.length})
            {activeTab === 'stories' && (
              <motion.div
                layoutId="playlist-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                style={{ background: `linear-gradient(90deg, ${colors.accentStart}, ${colors.accentEnd})` }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab('dokus')}
            className="relative px-3 py-2 text-[12px] font-medium transition-colors"
            style={{ color: activeTab === 'dokus' ? colors.text : colors.muted }}
          >
            Audio Dokus ({dokuItems.length})
            {activeTab === 'dokus' && (
              <motion.div
                layoutId="playlist-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                style={{ background: `linear-gradient(90deg, ${colors.accentStart}, ${colors.accentEnd})` }}
              />
            )}
          </button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-2" style={{ maxHeight: isDesktop ? '50vh' : undefined }}>
        {playlist.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8" style={{ color: colors.muted }}>
            <Music size={32} className="mb-2 opacity-40" />
            <p className="text-[12px]">Noch keine Titel in der Warteschlange</p>
          </div>
        ) : activeTab === 'stories' ? (
          <div className="space-y-1">
            {storyGroups.map((story) => renderStoryGroup(story))}
            {storyGroups.length === 0 && (
              <p className="py-4 text-center text-[12px]" style={{ color: colors.muted }}>
                Keine Geschichten in der Warteschlange
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {dokuItems.map(({ item, globalIndex }) => renderDokuItem(item, globalIndex))}
            {dokuItems.length === 0 && (
              <p className="py-4 text-center text-[12px]" style={{ color: colors.muted }}>
                Keine Audio Dokus in der Warteschlange
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <motion.div
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-2xl"
        style={{
          borderColor: colors.border,
          background: colors.bg,
          boxShadow: isDark ? '0 -16px 40px rgba(9,14,24,0.5)' : '0 -12px 36px rgba(44,57,75,0.14)',
          maxHeight: '60vh',
        }}
      >
        {content}
      </motion.div>
    );
  }

  // Mobile: full-screen overlay
  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 350, damping: 32 }}
      className="fixed inset-0 z-[1300] flex flex-col overflow-hidden"
      style={{
        background: colors.bg,
      }}
    >
      {content}
    </motion.div>
  );
};
