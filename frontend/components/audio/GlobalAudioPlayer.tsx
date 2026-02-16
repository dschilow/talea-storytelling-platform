import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Volume2 } from 'lucide-react';

import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { useTheme } from '../../contexts/ThemeContext';
import { AudioPlaybackControls } from './AudioPlaybackControls';
import { PlaylistDrawer } from './PlaylistDrawer';

export const GlobalAudioPlayer: React.FC = () => {
  const {
    track,
    isPlaying,
    isPlaylistActive,
    playlist,
    currentIndex,
    togglePlaylistDrawer,
    isPlaylistDrawerOpen,
    waitingForConversion,
  } = useAudioPlayer();
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';
  const isVisible = track || waitingForConversion;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="fixed bottom-5 left-1/2 z-[1200] hidden w-[min(920px,86vw)] -translate-x-1/2 md:block"
        >
          {/* Playlist drawer above player */}
          <AnimatePresence>
            {isPlaylistDrawerOpen && <PlaylistDrawer variant="desktop" />}
          </AnimatePresence>

          <div
            className="rounded-2xl border px-5 py-4 shadow-2xl backdrop-blur-2xl"
            style={{
              borderColor: isDark ? '#33465f' : '#e4d8c9',
              background: isDark ? 'rgba(23,31,43,0.94)' : 'rgba(255,250,244,0.95)',
              boxShadow: isDark
                ? '0 24px 50px rgba(9,14,24,0.45)'
                : '0 20px 44px rgba(44,57,75,0.16)',
            }}
          >
            <div className="mb-3 flex items-center gap-3">
              {/* Cover image */}
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-slate-200/40 dark:bg-slate-700/30">
                {waitingForConversion && !track ? (
                  <Loader2 size={20} className="animate-spin text-[#7f8fa8]" />
                ) : track?.coverImageUrl ? (
                  <img src={track.coverImageUrl} alt={track.title} className="h-full w-full object-cover" />
                ) : (
                  <Volume2 size={20} className="text-[#7f8fa8]" />
                )}
              </div>

              {/* Track info */}
              <div className="min-w-0 flex-1">
                <h4
                  className="truncate text-sm font-semibold"
                  style={{ color: isDark ? '#e7eef9' : '#203047', fontFamily: '"Sora", sans-serif' }}
                >
                  {waitingForConversion && !track ? 'Wird konvertiert...' : track?.title}
                </h4>
                <p className="truncate text-[11px]" style={{ color: isDark ? '#9fb0c7' : '#64758a' }}>
                  {waitingForConversion && !track
                    ? 'Audio wird vorbereitet'
                    : track?.description || ''}
                </p>
              </div>

              {/* Track counter + Equalizer */}
              <div className="flex flex-shrink-0 items-center gap-2.5">
                {isPlaylistActive && playlist.length > 1 && (
                  <span
                    className="text-[11px] font-semibold tabular-nums"
                    style={{ color: isDark ? '#7f8fa8' : '#8a9ab0' }}
                  >
                    {currentIndex + 1} / {playlist.length}
                  </span>
                )}

                <div className="flex h-5 items-end gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1 rounded-full bg-gradient-to-t from-[#7699d6] to-[#b087c8]"
                      animate={
                        waitingForConversion
                          ? { height: ['5px', '10px', '5px'], opacity: [0.4, 0.8, 0.4] }
                          : isPlaying
                            ? { height: ['7px', '16px', '7px'] }
                            : { height: '7px' }
                      }
                      transition={{
                        duration: waitingForConversion ? 1.2 : 0.8,
                        repeat: isPlaying || waitingForConversion ? Infinity : 0,
                        delay: i * 0.15,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

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
  );
};
