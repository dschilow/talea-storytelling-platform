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
    () =>
      isDark
        ? {
            bg: 'rgba(23,31,43,0.94)',
            border: '#33465f',
            text: '#e7eef9',
            sub: '#9fb0c7',
            progressBase: 'rgba(131,152,184,0.26)',
          }
        : {
            bg: 'rgba(255,250,244,0.95)',
            border: '#e4d8c9',
            text: '#203047',
            sub: '#64758a',
            progressBase: 'rgba(131,118,106,0.24)',
          },
    [isDark],
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
              boxShadow: isDark
                ? '0 24px 50px rgba(9,14,24,0.45)'
                : '0 20px 44px rgba(44,57,75,0.16)',
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
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-slate-200/30 dark:bg-slate-700/25">
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
                    background: isDark
                      ? 'linear-gradient(135deg, rgba(134,167,219,0.3), rgba(176,132,199,0.3))'
                      : 'linear-gradient(135deg, rgba(213,189,175,0.5), rgba(177,131,196,0.4))',
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
                  style={{ color: '#b16464' }}
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
                  background: 'linear-gradient(90deg, #d5bdaf 0%, #b087c8 55%, #7699d6 100%)',
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
