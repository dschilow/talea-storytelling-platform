import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ChevronUp,
  FastForward,
  ListMusic,
  Loader2,
  Pause,
  Play,
  Rewind,
  SkipBack,
  SkipForward,
  Volume2,
  X,
} from 'lucide-react';

import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { useTheme } from '../../contexts/ThemeContext';
import { PlaylistDrawer } from './PlaylistDrawer';
import { WaveformEqualizer } from './WaveformEqualizer';
import { cn } from '@/lib/utils';

const formatTime = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const getTrackLabel = (type?: string) => {
  if (type === 'story-chapter') return 'Story';
  if (type === 'doku') return 'Doku';
  if (type === 'audio-doku') return 'Audio';
  return 'Player';
};

const iconButtonClass =
  'inline-flex items-center justify-center rounded-full border border-[var(--talea-border-soft)] bg-[var(--talea-surface-primary)] text-[var(--talea-text-secondary)] transition-colors hover:text-[var(--talea-text-primary)] disabled:opacity-35 disabled:hover:text-[var(--talea-text-secondary)]';

/**
 * Desktop-Player: schlanke Mini-Bar am unteren Rand. Das Detail-Panel
 * (großes Cover, Beschreibung, "Als Nächstes") klappt über dem Balken auf und
 * wird über denselben Chevron wieder eingeklappt — der Chevron liegt nie
 * unter anderen Elementen.
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
    playPrevious,
    playFromPlaylist,
    isReady,
  } = useAudioPlayer();

  const [expanded, setExpanded] = useState(false);

  const isVisible = Boolean(track) || waitingForConversion;
  const isDark = resolvedTheme === 'dark';
  const currentItem =
    currentIndex >= 0 && currentIndex < playlist.length ? playlist[currentIndex] : null;
  const upcomingItems = useMemo(
    () =>
      playlist
        .map((item, globalIndex) => ({ item, globalIndex }))
        .slice(currentIndex >= 0 ? currentIndex + 1 : 1)
        .filter(({ item }) => item.conversionStatus !== 'error'),
    [currentIndex, playlist],
  );
  const previewItems = upcomingItems.slice(0, 3);
  const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const queuePosition =
    currentIndex >= 0 && playlist.length > 0 ? `${currentIndex + 1}/${playlist.length}` : null;
  const title =
    waitingForConversion && !track ? 'Audio wird vorbereitet' : currentItem?.title || track?.title;
  const subtitle =
    currentItem?.parentStoryTitle ||
    currentItem?.parentDokuTitle ||
    track?.description ||
    'Talea Audio';
  const coverUrl = currentItem?.coverImageUrl || track?.coverImageUrl;
  const showNavigation = isPlaylistActive && playlist.length > 1;
  const hasPrev = showNavigation && currentIndex > 0;
  const hasNext = showNavigation && currentIndex < playlist.length - 1;
  const playDisabled = waitingForConversion && !track;

  const controlMotion = reduceMotion
    ? {}
    : { whileHover: { y: -1, scale: 1.04 }, whileTap: { scale: 0.94 } };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          className="fixed bottom-4 left-1/2 z-[1200] hidden -translate-x-1/2 md:block"
          style={{ width: 'min(880px, calc(100vw - 7.5rem))' }}
        >
          <AnimatePresence>
            {isPlaylistDrawerOpen ? <PlaylistDrawer variant="desktop" /> : null}
          </AnimatePresence>

          <motion.div
            layout
            className="relative overflow-hidden rounded-[1.7rem] border shadow-[var(--talea-shadow-strong)] backdrop-blur-2xl"
            style={{
              borderColor: 'var(--talea-border-light)',
              background:
                'linear-gradient(180deg, color-mix(in srgb, var(--talea-glass-bg-alt) 96%, white) 0%, color-mix(in srgb, var(--talea-glass-bg) 96%, transparent) 100%)',
            }}
          >
            {/* Expanded detail panel */}
            <AnimatePresence initial={false}>
              {expanded ? (
                <motion.div
                  key="player-detail"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden border-b"
                  style={{ borderColor: 'var(--talea-border-light)' }}
                >
                  <div className="flex gap-5 p-5">
                    <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-[1.2rem] border border-white/15 bg-[var(--talea-surface-inset)] shadow-[0_16px_34px_rgba(15,23,35,0.14)]">
                      {coverUrl ? (
                        <img src={coverUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Volume2 className="h-8 w-8 text-[var(--talea-text-tertiary)]" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
                          style={{
                            color: 'var(--primary)',
                            background: 'color-mix(in srgb, var(--primary) 14%, transparent)',
                          }}
                        >
                          {getTrackLabel(currentItem?.type)}
                        </span>
                        {queuePosition ? (
                          <span className="inline-flex items-center rounded-full bg-[var(--talea-surface-inset)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--talea-text-secondary)]">
                            Titel {queuePosition}
                          </span>
                        ) : null}
                      </div>
                      <h3
                        className="mt-2.5 line-clamp-2 text-[1.5rem] font-semibold leading-tight text-[var(--talea-text-primary)]"
                        style={{ fontFamily: '"Fraunces", "Cormorant Garamond", serif' }}
                      >
                        {title || 'Talea Player'}
                      </h3>
                      <p className="mt-1 truncate text-sm font-medium text-[var(--talea-text-secondary)]">
                        {subtitle}
                      </p>
                      {currentItem?.description ? (
                        <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-[var(--talea-text-secondary)]">
                          {currentItem.description}
                        </p>
                      ) : null}
                    </div>

                    {/* Up next */}
                    <div className="hidden w-72 shrink-0 flex-col lg:flex">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--talea-text-tertiary)]">
                          Als Nächstes
                        </p>
                        {playlist.length > 0 ? (
                          <button
                            type="button"
                            onClick={togglePlaylistDrawer}
                            className="text-[11px] font-semibold text-[var(--primary)] hover:underline"
                          >
                            Playlist öffnen
                          </button>
                        ) : null}
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {previewItems.length > 0 ? (
                          previewItems.map(({ item, globalIndex }) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() =>
                                item.conversionStatus === 'ready' && playFromPlaylist(globalIndex)
                              }
                              className="flex w-full items-center gap-2.5 rounded-[0.9rem] border px-2.5 py-2 text-left transition-colors hover:border-[var(--talea-border-accent)]"
                              style={{
                                borderColor: 'var(--talea-border-light)',
                                background: 'var(--talea-surface-primary)',
                              }}
                            >
                              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-[0.7rem] bg-[var(--talea-surface-inset)]">
                                {item.coverImageUrl ? (
                                  <img src={item.coverImageUrl} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center">
                                    <Volume2 className="h-3.5 w-3.5 text-[var(--talea-text-tertiary)]" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold text-[var(--talea-text-primary)]">
                                  {item.title}
                                </p>
                                <p className="truncate text-[10px] font-medium text-[var(--talea-text-tertiary)]">
                                  {item.parentStoryTitle || item.parentDokuTitle || 'Talea Audio'}
                                </p>
                              </div>
                              {item.conversionStatus !== 'ready' ? (
                                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--talea-text-tertiary)]" />
                              ) : null}
                            </button>
                          ))
                        ) : (
                          <p className="rounded-[0.9rem] border border-dashed px-3 py-4 text-center text-xs font-medium text-[var(--talea-text-tertiary)]" style={{ borderColor: 'var(--talea-border-light)' }}>
                            Keine weiteren Titel — füge Stories oder Dokus zur Playlist hinzu.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Mini bar */}
            <div className="relative flex items-center gap-3 px-3 py-2.5">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[0.9rem] border border-white/15 bg-[var(--talea-surface-inset)]">
                {waitingForConversion && !track ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" />
                  </div>
                ) : coverUrl ? (
                  <img src={coverUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,var(--talea-gradient-secondary)_0%,var(--talea-gradient-lavender)_100%)]">
                    <Volume2 className="h-4 w-4 text-[var(--talea-text-secondary)]" />
                  </div>
                )}
                {isPlaying ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/28">
                    <WaveformEqualizer isPlaying isWaiting={false} isDark={isDark} size="sm" />
                  </div>
                ) : null}
              </div>

              <div className="w-44 min-w-0 shrink-0 xl:w-52">
                <p className="truncate text-sm font-semibold text-[var(--talea-text-primary)]">
                  {title || 'Talea Player'}
                </p>
                <p className="truncate text-[11px] font-medium text-[var(--talea-text-secondary)]">
                  {subtitle}
                </p>
              </div>

              {/* Transport */}
              <div className="flex shrink-0 items-center gap-1.5">
                {showNavigation ? (
                  <motion.button
                    {...controlMotion}
                    type="button"
                    onClick={playPrevious}
                    disabled={!hasPrev}
                    title="Vorheriger Titel"
                    className={cn(iconButtonClass, 'h-8 w-8')}
                  >
                    <SkipBack size={14} />
                  </motion.button>
                ) : null}
                <motion.button
                  {...controlMotion}
                  type="button"
                  onClick={() => seek((currentTime || 0) - 15)}
                  title="15 Sekunden zurück"
                  className={cn(iconButtonClass, 'h-9 w-9')}
                >
                  <Rewind size={15} />
                </motion.button>
                <motion.button
                  {...controlMotion}
                  type="button"
                  onClick={togglePlay}
                  disabled={playDisabled}
                  title={waitingForConversion ? 'Wird vorbereitet' : isPlaying ? 'Pause' : 'Play'}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg disabled:opacity-60"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--talea-accent-sky) 74%, white) 100%)',
                  }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={waitingForConversion ? 'loading' : isPlaying ? 'pause' : 'play'}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      transition={{ duration: 0.14 }}
                      className="block"
                    >
                      {waitingForConversion ? (
                        <Loader2 size={19} className="animate-spin" />
                      ) : isPlaying ? (
                        <Pause size={19} />
                      ) : (
                        <Play size={19} className="ml-[2px]" />
                      )}
                    </motion.span>
                  </AnimatePresence>
                </motion.button>
                <motion.button
                  {...controlMotion}
                  type="button"
                  onClick={() => seek((currentTime || 0) + 15)}
                  title="15 Sekunden vor"
                  className={cn(iconButtonClass, 'h-9 w-9')}
                >
                  <FastForward size={15} />
                </motion.button>
                {showNavigation ? (
                  <motion.button
                    {...controlMotion}
                    type="button"
                    onClick={playNext}
                    disabled={!hasNext}
                    title="Nächster Titel"
                    className={cn(iconButtonClass, 'h-8 w-8')}
                  >
                    <SkipForward size={14} />
                  </motion.button>
                ) : null}
              </div>

              {/* Seek */}
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <span className="min-w-[38px] text-right text-[11px] font-medium tabular-nums text-[var(--talea-text-secondary)]">
                  {formatTime(currentTime)}
                </span>
                <div className="group relative flex h-6 flex-1 items-center">
                  <div className="absolute inset-x-0 h-1.5 rounded-full" style={{ background: 'var(--talea-progress-track)' }} />
                  <div
                    className="absolute left-0 h-1.5 rounded-full"
                    style={{
                      width: `${progressRatio * 100}%`,
                      background:
                        'linear-gradient(90deg, var(--primary) 0%, var(--talea-accent-sky) 55%, var(--talea-accent-peach) 100%)',
                    }}
                  />
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
                  <div
                    className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 shadow-md transition-opacity opacity-0 group-hover:opacity-100"
                    style={{
                      left: duration ? `calc(${progressRatio * 100}% - 7px)` : '0%',
                      borderColor: 'var(--primary)',
                      background: 'var(--talea-slider-thumb)',
                    }}
                  />
                </div>
                <span className="min-w-[38px] text-[11px] font-medium tabular-nums text-[var(--talea-text-secondary)]">
                  {formatTime(duration || 0)}
                </span>
              </div>

              {/* Secondary actions */}
              <div className="flex shrink-0 items-center gap-1.5">
                {playlist.length > 0 ? (
                  <motion.button
                    {...controlMotion}
                    type="button"
                    onClick={togglePlaylistDrawer}
                    title="Playlist"
                    aria-expanded={isPlaylistDrawerOpen}
                    className={cn(iconButtonClass, 'relative h-9 w-9')}
                  >
                    <ListMusic size={15} />
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[9px] font-bold text-white">
                      {playlist.length}
                    </span>
                  </motion.button>
                ) : null}
                <motion.button
                  {...controlMotion}
                  type="button"
                  onClick={() => setExpanded((value) => !value)}
                  title={expanded ? 'Details einklappen' : 'Details anzeigen'}
                  aria-expanded={expanded}
                  className={cn(iconButtonClass, 'h-9 w-9')}
                >
                  <motion.span
                    animate={{ rotate: expanded ? 180 : 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="flex"
                  >
                    <ChevronUp size={16} />
                  </motion.span>
                </motion.button>
                <motion.button
                  {...controlMotion}
                  type="button"
                  onClick={close}
                  title="Player schließen"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors"
                  style={{
                    borderColor: 'var(--talea-danger-border)',
                    background: 'var(--talea-danger-soft)',
                    color: 'var(--talea-danger)',
                  }}
                >
                  <X size={15} />
                </motion.button>
              </div>
            </div>

            {/* Progress hairline */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px]" style={{ background: 'var(--talea-progress-track)' }}>
              <div
                className="h-full"
                style={{
                  width: `${progressRatio * 100}%`,
                  background:
                    'linear-gradient(90deg, var(--primary) 0%, var(--talea-accent-sky) 55%, var(--talea-accent-peach) 100%)',
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
