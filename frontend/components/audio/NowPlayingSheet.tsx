import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from 'framer-motion';
import { ChevronDown, ListMusic, Loader2, Pause, Play, RotateCcw, RotateCw, SkipBack, SkipForward, Square, Volume2 } from 'lucide-react';

import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { cn } from '@/lib/utils';

export const formatPlaybackTime = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/** "15" inside a circular arrow, like the skip buttons in Apple Podcasts. */
const SkipGlyph: React.FC<{ direction: 'back' | 'forward' }> = ({ direction }) => {
  const Icon = direction === 'back' ? RotateCcw : RotateCw;
  return (
    <span className="relative inline-flex h-9 w-9 items-center justify-center">
      <Icon className="h-9 w-9" strokeWidth={1.6} aria-hidden />
      <span className="absolute pt-0.5 text-[10px] font-bold" aria-hidden>
        15
      </span>
    </span>
  );
};

/**
 * Full "now playing" view, modelled on Apple Music: big artwork on its own
 * blurred colours, scrubber, large transport, and what comes next. A bottom
 * sheet on phones (swipe down to close), a centred card on desktop.
 */
export const NowPlayingSheet: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const reduceMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  // Swipe-to-close starts only on the top bar, so the scrubber and the list stay usable.
  const dragControls = useDragControls();
  const {
    track,
    isPlaying,
    togglePlay,
    currentTime,
    duration,
    seek,
    isReady,
    close,
    playNext,
    playPrevious,
    playlist,
    currentIndex,
    isPlaylistActive,
    playFromPlaylist,
    togglePlaylistDrawer,
    waitingForConversion,
  } = useAudioPlayer();

  const currentItem = currentIndex >= 0 && currentIndex < playlist.length ? playlist[currentIndex] : null;
  const coverUrl = currentItem?.coverImageUrl || track?.coverImageUrl;
  const title = waitingForConversion && !track ? 'Audio wird vorbereitet' : currentItem?.title || track?.title || 'Talea';
  const subtitle = currentItem?.parentStoryTitle || currentItem?.parentDokuTitle || track?.description || 'Talea Audio';
  const showNavigation = isPlaylistActive && playlist.length > 1;
  const hasPrev = showNavigation && currentIndex > 0;
  const hasNext = showNavigation && currentIndex < playlist.length - 1;
  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const upNext = useMemo(
    () =>
      playlist
        .map((item, globalIndex) => ({ item, globalIndex }))
        .slice(currentIndex >= 0 ? currentIndex + 1 : 1)
        .filter(({ item }) => item.conversionStatus !== 'error')
        .slice(0, 3),
    [currentIndex, playlist],
  );

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Nothing left to show (player closed elsewhere) → close the sheet too.
  useEffect(() => {
    if (open && !track && !waitingForConversion) onClose();
  }, [open, track, waitingForConversion, onClose]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  const glyphButton = 'inline-flex items-center justify-center rounded-full text-white transition-opacity hover:opacity-80 disabled:opacity-30';

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[1250] flex items-end justify-center md:items-center md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label="Wiedergabe"
        >
          <button type="button" className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} aria-label="Wiedergabe schließen" />

          <motion.div
            className="relative flex h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] w-full flex-col overflow-hidden rounded-t-[2rem] text-white shadow-2xl md:h-auto md:max-h-[88vh] md:w-[26rem] md:rounded-[2rem]"
            initial={reduceMotion ? { opacity: 0 } : { y: '100%' }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            drag={reduceMotion ? false : 'y'}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={handleDragEnd}
          >
            {/* Artwork colours as the background */}
            <div className="absolute inset-0 -z-10 bg-[#1b1714]" aria-hidden>
              {coverUrl ? (
                <img src={coverUrl} alt="" className="h-full w-full scale-150 object-cover opacity-80 blur-3xl saturate-150" />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/35 to-black/60" />
            </div>

            <div className="flex touch-none items-center justify-between px-4 pt-2" onPointerDown={(event) => dragControls.start(event)}>
              <button ref={closeRef} type="button" onClick={onClose} className={cn(glyphButton, 'h-10 w-10')} aria-label="Einklappen">
                <ChevronDown className="h-6 w-6" />
              </button>
              <span className="mx-auto h-1.5 w-10 rounded-full bg-white/40 md:hidden" aria-hidden />
              <button
                type="button"
                onClick={() => {
                  onClose();
                  togglePlaylistDrawer();
                }}
                className={cn(glyphButton, 'h-10 w-10')}
                aria-label="Warteschlange"
              >
                <ListMusic className="h-5 w-5" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-7 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-4">
              <div className="flex flex-1 items-center justify-center py-2">
                <motion.div
                  className="aspect-square w-full max-w-[20rem] overflow-hidden rounded-2xl bg-white/10 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)]"
                  animate={{ scale: isPlaying || reduceMotion ? 1 : 0.88 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                >
                  {coverUrl ? (
                    <img src={coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Volume2 className="h-14 w-14 text-white/60" />
                    </div>
                  )}
                </motion.div>
              </div>

              <div className="mt-6">
                <h2 className="line-clamp-2 text-[1.375rem] font-bold leading-tight">{title}</h2>
                <p className="mt-0.5 truncate text-[17px] text-white/70">{subtitle}</p>
              </div>

              {/* Scrubber */}
              <div className="mt-5">
                <div className="group relative flex h-6 items-center">
                  <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/25" />
                  <div className="absolute left-0 h-1.5 rounded-full bg-white" style={{ width: `${progress * 100}%` }} />
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={1}
                    value={currentTime}
                    onChange={(event) => seek(parseFloat(event.target.value))}
                    disabled={!isReady}
                    aria-label="Wiedergabeposition"
                    className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="flex justify-between text-[12px] font-medium tabular-nums text-white/60">
                  <span>{formatPlaybackTime(currentTime)}</span>
                  <span>-{formatPlaybackTime(Math.max(0, (duration || 0) - currentTime))}</span>
                </div>
              </div>

              {/* Transport */}
              <div className="mt-4 flex items-center justify-between">
                <button type="button" onClick={playPrevious} disabled={!hasPrev} className={cn(glyphButton, 'h-12 w-12', !showNavigation && 'invisible')} aria-label="Vorheriger Titel">
                  <SkipBack className="h-6 w-6" fill="currentColor" />
                </button>
                <button type="button" onClick={() => seek((currentTime || 0) - 15)} className={cn(glyphButton, 'h-14 w-14')} aria-label="15 Sekunden zurück">
                  <SkipGlyph direction="back" />
                </button>
                <button
                  type="button"
                  onClick={togglePlay}
                  disabled={waitingForConversion && !track}
                  className="inline-flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-white text-[#1b1714] shadow-lg transition-transform active:scale-95 disabled:opacity-50"
                  aria-label={isPlaying ? 'Pause' : 'Abspielen'}
                >
                  {waitingForConversion && !track ? (
                    <Loader2 className="h-7 w-7 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="h-8 w-8" fill="currentColor" />
                  ) : (
                    <Play className="ml-1 h-8 w-8" fill="currentColor" />
                  )}
                </button>
                <button type="button" onClick={() => seek((currentTime || 0) + 15)} className={cn(glyphButton, 'h-14 w-14')} aria-label="15 Sekunden vor">
                  <SkipGlyph direction="forward" />
                </button>
                <button type="button" onClick={playNext} disabled={!hasNext} className={cn(glyphButton, 'h-12 w-12', !showNavigation && 'invisible')} aria-label="Nächster Titel">
                  <SkipForward className="h-6 w-6" fill="currentColor" />
                </button>
              </div>

              {upNext.length > 0 ? (
                <div className="mt-7">
                  <p className="text-[13px] font-semibold text-white/60">Als Nächstes</p>
                  <div className="mt-2 divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/10">
                    {upNext.map(({ item, globalIndex }) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => item.conversionStatus === 'ready' && playFromPlaylist(globalIndex)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/10"
                      >
                        <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white/10">
                          {item.coverImageUrl ? <img src={item.coverImageUrl} alt="" className="h-full w-full object-cover" /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-medium">{item.title}</span>
                          <span className="block truncate text-[13px] text-white/60">{item.parentStoryTitle || item.parentDokuTitle || 'Talea Audio'}</span>
                        </span>
                        {item.conversionStatus !== 'ready' ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-white/60" /> : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  onClose();
                  close();
                }}
                className="mx-auto mt-7 inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-[14px] font-semibold text-white/85 transition-colors hover:bg-white/20"
              >
                <Square className="h-3.5 w-3.5" fill="currentColor" />
                Wiedergabe beenden
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
};
