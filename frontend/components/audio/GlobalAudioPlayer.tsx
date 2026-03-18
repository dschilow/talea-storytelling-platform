import React, { useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ListMusic, Loader2, Pause, Play, Sparkles, Volume2 } from 'lucide-react';

import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { useTheme } from '../../contexts/ThemeContext';
import { AudioPlaybackControls } from './AudioPlaybackControls';
import { PlaylistDrawer } from './PlaylistDrawer';
import { WaveformEqualizer } from './WaveformEqualizer';

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
  } = useAudioPlayer();

  const isVisible = Boolean(track) || waitingForConversion;
  const isDark = resolvedTheme === 'dark';
  const currentItem =
    currentIndex >= 0 && currentIndex < playlist.length ? playlist[currentIndex] : null;
  const readyCount = playlist.filter((item) => item.conversionStatus === 'ready').length;
  const convertingCount = playlist.filter(
    (item) => item.conversionStatus === 'pending' || item.conversionStatus === 'converting',
  ).length;
  const upcomingItems = useMemo(
    () =>
      playlist
        .slice(currentIndex >= 0 ? currentIndex + 1 : 1)
        .filter((item) => item.conversionStatus !== 'error'),
    [currentIndex, playlist],
  );
  const previewItems = upcomingItems.slice(0, 3);
  const nextItem = previewItems[0] || null;
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const queuePosition =
    currentIndex >= 0 && playlist.length > 0 ? `${currentIndex + 1}/${playlist.length}` : null;
  const title = waitingForConversion && !track ? 'Audio wird vorbereitet' : currentItem?.title || track?.title;
  const subtitle = currentItem?.parentStoryTitle ||
    currentItem?.parentDokuTitle ||
    track?.description ||
    'Talea Audio';
  const detail = waitingForConversion && !track
    ? 'Die naechste Aufnahme wird in die Warteschlange gelegt.'
    : currentItem?.description || 'Jetzt abspielen, pausieren oder direkt zur naechsten Folge springen.';
  const showQueuePreview = isPlaylistActive && playlist.length > 1;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          className="fixed bottom-5 left-1/2 z-[1200] hidden -translate-x-1/2 md:block"
          style={{ width: 'min(1220px, calc(100vw - 2.5rem))' }}
        >
          <AnimatePresence>
            {isPlaylistDrawerOpen ? <PlaylistDrawer variant="desktop" /> : null}
          </AnimatePresence>

          <motion.div
            layout
            className="relative overflow-hidden rounded-[2rem] border p-2 shadow-[var(--talea-shadow-strong)] backdrop-blur-2xl"
            style={{
              borderColor: 'var(--talea-border-light)',
              background:
                'linear-gradient(180deg, color-mix(in srgb, var(--talea-glass-bg-alt) 94%, white) 0%, color-mix(in srgb, var(--talea-glass-bg) 96%, transparent) 100%)',
            }}
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-[-5%] top-[-28%] h-52 w-52 rounded-full bg-[var(--talea-accent-lavender)]/12 blur-3xl" />
              <div className="absolute bottom-[-32%] right-[8%] h-60 w-60 rounded-full bg-[var(--talea-accent-sky)]/14 blur-3xl" />
              <div className="absolute inset-x-0 top-0 h-px bg-white/60 dark:bg-white/10" />
            </div>

            <div className="relative grid gap-3 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.05fr)_19rem]">
              <motion.div
                layout
                whileHover={
                  reduceMotion
                    ? undefined
                    : { y: -2, transition: { duration: 0.2, ease: 'easeOut' } }
                }
                className="overflow-hidden rounded-[1.7rem] border p-4 sm:p-5"
                style={{
                  borderColor: 'var(--talea-border-light)',
                  background:
                    'linear-gradient(135deg, color-mix(in srgb, var(--talea-surface-primary) 88%, white) 0%, color-mix(in srgb, var(--talea-surface-inset) 92%, transparent) 100%)',
                }}
              >
                <div className="flex items-start gap-4">
                  <div className="relative h-[5.6rem] w-[5.6rem] shrink-0 overflow-hidden rounded-[1.5rem] border border-white/15 bg-[var(--talea-surface-inset)] shadow-[0_16px_34px_rgba(15,23,35,0.14)]">
                    {waitingForConversion && !track ? (
                      <div className="flex h-full w-full items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
                      </div>
                    ) : currentItem?.coverImageUrl || track?.coverImageUrl ? (
                      <img
                        src={currentItem?.coverImageUrl || track?.coverImageUrl}
                        alt={title || 'Talea Audio'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,var(--talea-gradient-secondary)_0%,var(--talea-gradient-lavender)_100%)]">
                        <Volume2 className="h-6 w-6 text-[var(--talea-text-secondary)]" />
                      </div>
                    )}

                    <div className="absolute inset-x-2 bottom-2 flex items-center justify-between rounded-full border border-white/20 bg-[var(--talea-media-control-bg)]/90 px-2 py-1 text-white backdrop-blur-md">
                      <WaveformEqualizer
                        isPlaying={isPlaying}
                        isWaiting={waitingForConversion}
                        isDark={isDark}
                        size="sm"
                      />
                      <button
                        type="button"
                        onClick={togglePlay}
                        disabled={waitingForConversion && !track}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/18 transition-transform active:scale-95 disabled:opacity-50"
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                      >
                        {waitingForConversion && !track ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : isPlaying ? (
                          <Pause className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="ml-[1px] h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                        style={{
                          color: 'var(--primary)',
                          background: 'color-mix(in srgb, var(--primary) 14%, transparent)',
                        }}
                      >
                        {getTrackLabel(currentItem?.type)}
                      </span>
                      {queuePosition ? (
                        <span
                          className="inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                          style={{
                            color: 'var(--talea-text-secondary)',
                            background: 'var(--talea-surface-inset)',
                          }}
                        >
                          Queue {queuePosition}
                        </span>
                      ) : null}
                    </div>

                    <h3
                      className="mt-3 line-clamp-2 text-[1.45rem] font-semibold leading-tight text-[var(--talea-text-primary)]"
                      style={{ fontFamily: '"Fraunces", "Cormorant Garamond", serif' }}
                    >
                      {title || 'Talea Player'}
                    </h3>
                    <p className="mt-1 truncate text-sm font-semibold text-[var(--talea-text-secondary)]">
                      {subtitle}
                    </p>
                    <p className="mt-3 line-clamp-2 text-sm font-medium leading-6 text-[var(--talea-text-secondary)]">
                      {detail}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-2.5">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold"
                        style={{
                          color: waitingForConversion ? 'var(--talea-warning)' : 'var(--talea-success)',
                          background: waitingForConversion
                            ? 'var(--talea-warning-soft)'
                            : 'var(--talea-success-soft)',
                        }}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {waitingForConversion ? 'Wird aufgebaut' : 'Jetzt bereit'}
                      </span>
                      <span className="text-[11px] font-medium text-[var(--talea-text-tertiary)]">
                        {formatTime(currentTime)} / {formatTime(duration || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                layout
                className="overflow-hidden rounded-[1.7rem] border p-4 sm:p-5"
                style={{
                  borderColor: 'var(--talea-border-light)',
                  background:
                    'linear-gradient(180deg, color-mix(in srgb, var(--talea-surface-primary) 92%, white) 0%, color-mix(in srgb, var(--talea-surface-inset) 90%, transparent) 100%)',
                }}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--talea-text-secondary)]">
                      Now Playing
                    </p>
                    <p className="mt-1 text-sm font-medium text-[var(--talea-text-tertiary)]">
                      Eine Kinder-Streamingsteuerung mit Fokus auf Hoeren und Weiterlesen.
                    </p>
                  </div>
                  {showQueuePreview ? (
                    <button
                      type="button"
                      onClick={togglePlaylistDrawer}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border transition hover:-translate-y-0.5"
                      style={{
                        borderColor: 'var(--talea-border-soft)',
                        background: 'var(--talea-surface-primary)',
                        color: 'var(--talea-text-secondary)',
                      }}
                      aria-label="Warteschlange oeffnen"
                    >
                      <ListMusic className="h-4.5 w-4.5" />
                    </button>
                  ) : null}
                </div>

                <div className="mt-5">
                  <AudioPlaybackControls
                    variant="streaming"
                    showClose
                    showNavigation={isPlaylistActive && playlist.length > 1}
                    onQueueClick={showQueuePreview ? togglePlaylistDrawer : undefined}
                  />
                </div>

                {showQueuePreview ? (
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {[
                      { label: 'Bereit', value: readyCount },
                      { label: 'In Queue', value: Math.max(playlist.length - readyCount, 0) },
                      { label: 'Up Next', value: upcomingItems.length },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-[1.25rem] border px-4 py-3"
                        style={{
                          borderColor: 'var(--talea-border-light)',
                          background: 'var(--talea-surface-inset)',
                        }}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--talea-text-tertiary)]">
                          {item.label}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-[var(--talea-text-primary)]">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </motion.div>

              {showQueuePreview ? (
                <motion.button
                  layout
                  whileHover={
                    reduceMotion
                      ? undefined
                      : { y: -2, transition: { duration: 0.2, ease: 'easeOut' } }
                  }
                  type="button"
                  onClick={togglePlaylistDrawer}
                  className="hidden overflow-hidden rounded-[1.7rem] border p-4 text-left xl:block"
                  style={{
                    borderColor: 'var(--talea-border-light)',
                    background:
                      'linear-gradient(180deg, color-mix(in srgb, var(--talea-surface-primary) 94%, white) 0%, color-mix(in srgb, var(--talea-surface-inset) 90%, transparent) 100%)',
                  }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--talea-text-secondary)]">
                    Als naechstes
                  </p>

                  {nextItem ? (
                    <>
                      <div className="mt-4 flex items-start gap-3">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[1rem] border border-white/10 bg-[var(--talea-surface-inset)]">
                          {nextItem.coverImageUrl ? (
                            <img
                              src={nextItem.coverImageUrl}
                              alt={nextItem.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Volume2 className="h-4 w-4 text-[var(--talea-text-tertiary)]" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[var(--talea-text-primary)]">
                            {nextItem.title}
                          </p>
                          <p className="mt-1 truncate text-xs font-medium text-[var(--talea-text-secondary)]">
                            {nextItem.parentStoryTitle || nextItem.parentDokuTitle || nextItem.description || 'Talea Audio'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        {previewItems.map((item, index) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 rounded-[1rem] border px-3 py-2.5"
                            style={{
                              borderColor: 'var(--talea-border-light)',
                              background:
                                index === 0
                                  ? 'color-mix(in srgb, var(--primary) 12%, transparent)'
                                  : 'var(--talea-surface-inset)',
                            }}
                          >
                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--talea-text-tertiary)]">
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-[var(--talea-text-primary)]">
                                {item.title}
                              </p>
                              <p className="truncate text-[11px] font-medium text-[var(--talea-text-secondary)]">
                                {item.parentStoryTitle || item.parentDokuTitle || item.description || 'Talea Audio'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div
                      className="mt-4 rounded-[1.2rem] border px-4 py-5"
                      style={{
                        borderColor: 'var(--talea-border-light)',
                        background: 'var(--talea-surface-inset)',
                      }}
                    >
                      <p className="text-sm font-semibold text-[var(--talea-text-primary)]">
                        Keine weiteren Titel
                      </p>
                      <p className="mt-2 text-sm font-medium text-[var(--talea-text-secondary)]">
                        Fuege weitere Stories oder Dokus zur Queue hinzu.
                      </p>
                    </div>
                  )}
                </motion.button>
              ) : null}
            </div>

            {showQueuePreview ? (
              <button
                type="button"
                onClick={togglePlaylistDrawer}
                className="mt-3 flex w-full items-center justify-between rounded-[1.5rem] border px-4 py-3 text-left xl:hidden"
                style={{
                  borderColor: 'var(--talea-border-light)',
                  background: 'var(--talea-surface-primary)',
                }}
              >
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--talea-text-tertiary)]">
                    Up Next
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--talea-text-primary)]">
                    {nextItem ? nextItem.title : 'Queue ansehen'}
                  </p>
                </div>
                <span className="text-sm font-medium text-[var(--talea-text-secondary)]">
                  {convertingCount > 0 ? `${convertingCount} werden vorbereitet` : `${upcomingItems.length} weitere Titel`}
                </span>
              </button>
            ) : null}

            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[4px]"
              style={{ background: 'var(--talea-progress-track)' }}
            >
              <motion.div
                className="h-full"
                style={{
                  width: `${progress}%`,
                  background:
                    'linear-gradient(90deg, var(--primary) 0%, var(--talea-accent-sky) 55%, var(--talea-accent-peach) 100%)',
                }}
                transition={{ ease: 'easeOut', duration: 0.2 }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
