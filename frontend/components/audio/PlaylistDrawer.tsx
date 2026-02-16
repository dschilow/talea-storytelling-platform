import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Headphones,
  Loader2,
  Music,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';

import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { useTheme } from '../../contexts/ThemeContext';
import type { PlaylistItem } from '../../types/playlist';

interface PlaylistDrawerProps {
  variant: 'desktop' | 'mobile';
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
            surface: 'rgba(33,42,58,0.6)',
            accentStart: '#86a7db',
            accentEnd: '#b084c7',
            hoverBg: 'rgba(134,167,219,0.08)',
            activeBorder: 'linear-gradient(180deg, #86a7db, #b084c7)',
          }
        : {
            bg: 'rgba(255,250,244,0.97)',
            border: '#e4d8c9',
            text: '#203047',
            sub: '#64758a',
            muted: '#a0a8b4',
            surface: 'rgba(255,255,255,0.6)',
            accentStart: '#d5bdaf',
            accentEnd: '#b183c4',
            hoverBg: 'rgba(213,189,175,0.1)',
            activeBorder: 'linear-gradient(180deg, #d5bdaf, #b183c4)',
          },
    [isDark],
  );

  // Group items by story
  const { storyGroups, dokuItems } = useMemo(() => {
    const stories = new Map<string, { title: string; coverImageUrl?: string; items: Array<{ item: PlaylistItem; globalIndex: number }> }>();
    const dokus: Array<{ item: PlaylistItem; globalIndex: number }> = [];

    playlist.forEach((item, idx) => {
      if (item.type === 'story-chapter' && item.parentStoryId) {
        let group = stories.get(item.parentStoryId);
        if (!group) {
          group = { title: item.parentStoryTitle || item.description || 'Geschichte', coverImageUrl: item.coverImageUrl, items: [] };
          stories.set(item.parentStoryId, group);
        }
        group.items.push({ item, globalIndex: idx });
      } else {
        dokus.push({ item, globalIndex: idx });
      }
    });

    return { storyGroups: Array.from(stories.entries()), dokuItems: dokus };
  }, [playlist]);

  const [activeTab, setActiveTab] = useState<'stories' | 'dokus'>(storyGroups.length > 0 ? 'stories' : 'dokus');
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

  const StatusIcon: React.FC<{ status: PlaylistItem['conversionStatus']; itemId: string }> = ({ status, itemId }) => {
    switch (status) {
      case 'ready':
        return <Check size={14} className="text-emerald-400" />;
      case 'converting':
        return <Loader2 size={14} className="animate-spin text-blue-400" />;
      case 'error':
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const item = playlist.find((i) => i.id === itemId);
              if (item?.sourceText) {
                // retry via context if needed
              }
            }}
            title="Erneut versuchen"
          >
            <AlertCircle size={14} className="text-red-400" />
          </button>
        );
      case 'pending':
      default:
        return <Circle size={10} style={{ color: colors.muted }} />;
    }
  };

  const renderItem = (item: PlaylistItem, globalIndex: number, indent = false) => {
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
          marginLeft: indent ? 20 : 0,
          borderLeft: isCurrent ? '3px solid' : '3px solid transparent',
          borderImage: isCurrent ? colors.activeBorder + ' 1' : undefined,
        }}
      >
        {/* Cover thumbnail */}
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-slate-200/20 dark:bg-slate-700/20">
          {item.coverImageUrl ? (
            <img src={item.coverImageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Music size={14} style={{ color: colors.muted }} />
          )}
        </div>

        {/* Title */}
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[12px] font-medium leading-tight"
            style={{ color: isCurrent ? colors.text : colors.sub }}
          >
            {item.title}
          </p>
          {item.description && !indent && (
            <p className="truncate text-[10px]" style={{ color: colors.muted }}>
              {item.description}
            </p>
          )}
        </div>

        {/* Status */}
        <div className="flex-shrink-0">
          <StatusIcon status={item.conversionStatus} itemId={item.id} />
        </div>

        {/* Remove */}
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

  const renderStoryGroup = (storyId: string, group: { title: string; coverImageUrl?: string; items: Array<{ item: PlaylistItem; globalIndex: number }> }) => {
    const isExpanded = expandedStories.has(storyId);
    const readyCount = group.items.filter((i) => i.item.conversionStatus === 'ready').length;
    const totalCount = group.items.length;
    const hasConverting = group.items.some((i) => i.item.conversionStatus === 'converting');

    return (
      <div key={storyId}>
        <button
          onClick={() => toggleExpanded(storyId)}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-white/5"
        >
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-slate-200/20 dark:bg-slate-700/20">
            {group.coverImageUrl ? (
              <img src={group.coverImageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Headphones size={14} style={{ color: colors.muted }} />
            )}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-[12px] font-semibold" style={{ color: colors.text }}>
              {group.title}
            </p>
            <p className="text-[10px]" style={{ color: colors.muted }}>
              {readyCount}/{totalCount} bereit
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
              {group.items.map(({ item, globalIndex }) => renderItem(item, globalIndex, true))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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
          <span className="text-[11px] font-medium" style={{ color: colors.muted }}>
            {currentIndex + 1} / {playlist.length}
          </span>
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
            Geschichten
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
            Audio Dokus
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
            {storyGroups.map(([storyId, group]) => renderStoryGroup(storyId, group))}
            {storyGroups.length === 0 && (
              <p className="py-4 text-center text-[12px]" style={{ color: colors.muted }}>
                Keine Geschichten in der Warteschlange
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {dokuItems.map(({ item, globalIndex }) => renderItem(item, globalIndex))}
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
