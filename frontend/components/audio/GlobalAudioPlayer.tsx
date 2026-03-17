import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Headphones, Loader2, Pause, Play, Volume2, X } from 'lucide-react';

import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { useTheme } from '../../contexts/ThemeContext';
import { AudioPlaybackControls } from './AudioPlaybackControls';
import { PlaylistDrawer } from './PlaylistDrawer';
import { WaveformEqualizer } from './WaveformEqualizer';

export const GlobalAudioPlayer: React.FC = () => {
  const {
    track,
    isPlaying,
    isPlaylistActive,
    playlist,
    currentIndex,
    togglePlay,
    close,
    togglePlaylistDrawer,
    isPlaylistDrawerOpen,
    waitingForConversion,
    currentTime,
    duration,
  } = useAudioPlayer();
  const { resolvedTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  const isDark = resolvedTheme === 'dark';
  const isVisible = track || waitingForConversion;
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const colors = useMemo(
    () => ({
      bg: 'var(--talea-glass-bg-alt)',
      border: 'var(--talea-border-soft)',
      text: 'var(--talea-text-primary)',
      sub: 'var(--talea-text-secondary)',
      progressBase: 'var(--talea-progress-track)',
    }),
    [],
  );

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="fixed bottom-5 left-1/2 z-[1200] hidden -translate-x-1/2 md:block"
          style={{ width: 'min(920px, 86vw)' }}
        >
          {/* Playlist drawer above player */}
          <AnimatePresence>
            {isPlaylistDrawerOpen && <PlaylistDrawer variant="desktop" />}
          </AnimatePresence>

          <div
            className="overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-2xl"
            style={{
              borderColor: colors.border,
              background: colors.bg,
              boxShadow: 'var(--talea-shadow-strong)',
            }}
          >
            {/* Collapsed strip */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setCollapsed((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setCollapsed((v) => !v);
                }
              }}
              className="flex cursor-pointer items-center gap-3 px-4 py-2.5"
              aria-label={collapsed ? 'Player ausklappen' : 'Player einklappen'}
            >
              {/* Cover */}
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border"
                style={{ borderColor: 'var(--talea-border-light)', background: 'var(--talea-surface-inset)' }}
              >
                {waitingForConversion && !track ? (
                  <Loader2 size={18} className="animate-spin" style={{ color: colors.sub }} />
                ) : track?.coverImageUrl ? (
                  <img src={track.coverImageUrl} alt={track.title} className="h-full w-full object-cover" />
                ) : (
                  <Volume2 size={18} style={{ color: colors.sub }} />
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <h4
                  className="truncate text-[13px] font-semibold leading-tight"
                  style={{ color: colors.text, fontFamily: '"Sora", sans-serif' }}
                >
                  {waitingForConversion && !track ? 'Wird konvertiert...' : track?.title}
                </h4>
                <p className="truncate text-[10px] leading-tight" style={{ color: colors.sub }}>
                  {waitingForConversion && !track
                    ? 'Audio wird vorbereitet'
                    : track?.description || ''}
                  {/* chunk counter removed — details visible in playlist drawer */}
                </p>
              </div>

              {/* Waveform equalizer */}
              <WaveformEqualizer
                isPlaying={isPlaying}
                isWaiting={waitingForConversion}
                isDark={isDark}
                size="md"
              />

              {/* Quick controls in collapsed mode */}
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={togglePlay}
                  disabled={waitingForConversion && !track}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-50"
                  style={{
                    background:
                      'linear-gradient(135deg, color-mix(in srgb, var(--talea-accent-sky) 28%, transparent), color-mix(in srgb, var(--talea-accent-lavender) 26%, transparent))',
                  }}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {waitingForConversion && !track ? (
                    <Loader2 size={15} className="animate-spin" style={{ color: colors.text }} />
                  ) : isPlaying ? (
                    <Pause size={15} style={{ color: colors.text }} />
                  ) : (
                    <Play size={15} style={{ color: colors.text }} />
                  )}
                </button>

                <button
                  type="button"
                  onClick={close}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full"
                  style={{ color: 'var(--talea-danger)' }}
                  aria-label="Schliessen"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Expand/collapse indicator */}
              <div style={{ color: colors.sub }}>
                {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </div>

            {/* Progress bar (always visible) */}
            <div className="h-[3px] w-full" style={{ background: colors.progressBase }}>
              <motion.div
                className="h-full"
                style={{
                  background: 'linear-gradient(90deg, var(--primary) 0%, var(--talea-accent-sky) 55%, var(--talea-accent-peach) 100%)',
                  width: `${progress}%`,
                }}
                transition={{ ease: 'easeOut', duration: 0.2 }}
              />
            </div>

            {/* Expanded controls */}
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-4 pt-3">
                    <AudioPlaybackControls
                      variant="compact"
                      showClose
                      showNavigation={isPlaylistActive && playlist.length > 1}
                      onQueueClick={isPlaylistActive ? togglePlaylistDrawer : undefined}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
