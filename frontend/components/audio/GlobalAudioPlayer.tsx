import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ListMusic, Loader2, Pause, Play, RotateCw, SkipForward, Volume2, X } from 'lucide-react';

import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { useTheme } from '../../contexts/ThemeContext';
import { PlaylistDrawer } from './PlaylistDrawer';
import { WaveformEqualizer } from './WaveformEqualizer';
import { NowPlayingSheet, formatPlaybackTime } from './NowPlayingSheet';
import { cn } from '@/lib/utils';

/**
 * All audio UI in one place, iOS-style:
 * - a floating glass mini player (phones: just above the tab bar; desktop:
 *   bottom centre) with artwork, title, play/pause and a hairline progress;
 * - tapping it opens NowPlayingSheet (big artwork, scrubber, transport, up next);
 * - the queue (PlaylistDrawer) opens from the sheet or the desktop bar.
 */
export const GlobalAudioPlayer: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const { resolvedTheme } = useTheme();
  const {
    track,
    isPlaying,
    isPlaylistActive,
    playlist,
    currentIndex,
    togglePlay,
    togglePlaylistDrawer,
    isPlaylistDrawerOpen,
    waitingForConversion,
    currentTime,
    duration,
    seek,
    close,
    playNext,
  } = useAudioPlayer();

  const [sheetOpen, setSheetOpen] = useState(false);
  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const isVisible = Boolean(track) || waitingForConversion;
  const isDark = resolvedTheme === 'dark';
  const currentItem = currentIndex >= 0 && currentIndex < playlist.length ? playlist[currentIndex] : null;
  const title = waitingForConversion && !track ? 'Audio wird vorbereitet' : currentItem?.title || track?.title || 'Talea';
  const subtitle = currentItem?.parentStoryTitle || currentItem?.parentDokuTitle || track?.description || 'Talea Audio';
  const coverUrl = currentItem?.coverImageUrl || track?.coverImageUrl;
  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const hasNext = isPlaylistActive && playlist.length > 1 && currentIndex < playlist.length - 1;
  const playDisabled = waitingForConversion && !track;

  // Pages reserve room at the bottom for the floating player (see AppLayout).
  useEffect(() => {
    document.documentElement.style.setProperty('--talea-player-offset', isVisible ? '4.75rem' : '0px');
    return () => {
      document.documentElement.style.setProperty('--talea-player-offset', '0px');
    };
  }, [isVisible]);

  const artwork = (size: string) => (
    <span className={cn('relative shrink-0 overflow-hidden rounded-[10px] bg-[var(--talea-surface-inset)] shadow-sm', size)}>
      {playDisabled ? (
        <span className="flex h-full w-full items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" />
        </span>
      ) : coverUrl ? (
        <img src={coverUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center">
          <Volume2 className="h-4 w-4 text-[var(--talea-text-tertiary)]" />
        </span>
      )}
      {isPlaying ? (
        <span className="absolute inset-0 flex items-center justify-center bg-black/30">
          <WaveformEqualizer isPlaying isWaiting={false} isDark={isDark} size="sm" />
        </span>
      ) : null}
    </span>
  );

  const playButton = (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        togglePlay();
      }}
      disabled={playDisabled}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--talea-text-primary)] transition-colors hover:bg-[var(--talea-surface-inset)] disabled:opacity-40"
      aria-label={isPlaying ? 'Pause' : 'Abspielen'}
    >
      {playDisabled ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : isPlaying ? (
        <Pause className="h-6 w-6" fill="currentColor" />
      ) : (
        <Play className="ml-0.5 h-6 w-6" fill="currentColor" />
      )}
    </button>
  );

  const secondaryButton = hasNext ? (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        playNext();
      }}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--talea-text-primary)] transition-colors hover:bg-[var(--talea-surface-inset)]"
      aria-label="Nächster Titel"
    >
      <SkipForward className="h-5 w-5" fill="currentColor" />
    </button>
  ) : (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        seek((currentTime || 0) + 15);
      }}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--talea-text-primary)] transition-colors hover:bg-[var(--talea-surface-inset)]"
      aria-label="15 Sekunden vor"
    >
      <RotateCw className="h-5 w-5" />
    </button>
  );

  const hairline = (
    <span className="pointer-events-none absolute inset-x-5 bottom-0 h-[2px] overflow-hidden rounded-full bg-[var(--talea-progress-track)]" aria-hidden>
      <span className="block h-full bg-[var(--primary)]" style={{ width: `${progress * 100}%` }} />
    </span>
  );

  const enter = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { y: 24, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: 24, opacity: 0 } };

  return (
    <>
      <AnimatePresence>
        {isVisible ? (
          <>
            {/* Phone: floats just above the tab bar (62px + its bottom inset + 8px gap) */}
            <motion.div
              key="mini-mobile"
              {...enter}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="fixed inset-x-3 z-[75] md:hidden"
              style={{ bottom: 'calc(max(env(safe-area-inset-bottom), 0.75rem) + 70px)' }}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={openSheet}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openSheet();
                  }
                }}
                aria-label={`${title} – Wiedergabe öffnen`}
                className="talea-glass relative flex h-14 cursor-pointer items-center gap-3 rounded-full pl-2 pr-1.5"
              >
                {artwork('h-10 w-10 rounded-full')}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-[var(--talea-text-primary)]">{title}</span>
                  <span className="block truncate text-[12px] text-[var(--talea-text-secondary)]">{subtitle}</span>
                </span>
                {playButton}
                {secondaryButton}
                {hairline}
              </div>
            </motion.div>

            {/* Desktop: slim glass bar, bottom centre */}
            <motion.div
              key="mini-desktop"
              {...enter}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="fixed bottom-4 left-1/2 z-[1200] hidden w-[min(40rem,calc(100vw-8rem))] -translate-x-1/2 md:block"
            >
              <AnimatePresence>{isPlaylistDrawerOpen ? <PlaylistDrawer variant="desktop" /> : null}</AnimatePresence>
              <div className="talea-glass relative flex h-16 items-center gap-3 rounded-2xl px-2.5">
                <button type="button" onClick={openSheet} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left" aria-label={`${title} – Wiedergabe öffnen`}>
                  {artwork('h-11 w-11')}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-[var(--talea-text-primary)]">{title}</span>
                    <span className="block truncate text-[12px] text-[var(--talea-text-secondary)]">
                      {subtitle} · {formatPlaybackTime(currentTime)} / {formatPlaybackTime(duration || 0)}
                    </span>
                  </span>
                </button>
                {playButton}
                {secondaryButton}
                {playlist.length > 0 ? (
                  <button
                    type="button"
                    onClick={togglePlaylistDrawer}
                    aria-expanded={isPlaylistDrawerOpen}
                    className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--talea-text-secondary)] transition-colors hover:bg-[var(--talea-surface-inset)]"
                    aria-label="Warteschlange"
                  >
                    <ListMusic className="h-5 w-5" />
                    <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[9px] font-bold text-[var(--primary-foreground)]">
                      {playlist.length}
                    </span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--talea-text-tertiary)] transition-colors hover:bg-[var(--talea-surface-inset)] hover:text-[var(--talea-text-primary)]"
                  aria-label="Wiedergabe beenden"
                >
                  <X className="h-5 w-5" />
                </button>
                {hairline}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      {/* Phone queue: full-screen overlay (the desktop one is anchored to the bar above). */}
      <div className="md:hidden">
        <AnimatePresence>{isPlaylistDrawerOpen ? <PlaylistDrawer variant="mobile" /> : null}</AnimatePresence>
      </div>

      <NowPlayingSheet open={sheetOpen} onClose={closeSheet} />
    </>
  );
};
