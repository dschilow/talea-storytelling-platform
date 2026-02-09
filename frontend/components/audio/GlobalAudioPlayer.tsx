import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Volume2 } from 'lucide-react';

import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { useTheme } from '../../contexts/ThemeContext';
import { AudioPlaybackControls } from './AudioPlaybackControls';

export const GlobalAudioPlayer: React.FC = () => {
  const { track, isPlaying } = useAudioPlayer();
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

  return (
    <AnimatePresence>
      {track && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="fixed bottom-5 left-1/2 z-[1200] hidden w-[min(920px,86vw)] -translate-x-1/2 md:block"
        >
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
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-slate-200/40 dark:bg-slate-700/30">
                {track.coverImageUrl ? (
                  <img src={track.coverImageUrl} alt={track.title} className="h-full w-full object-cover" />
                ) : (
                  <Volume2 size={20} className="text-[#7f8fa8]" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h4
                  className="truncate text-sm font-semibold"
                  style={{ color: isDark ? '#e7eef9' : '#203047', fontFamily: '"Sora", sans-serif' }}
                >
                  {track.title}
                </h4>
                {track.description && (
                  <p className="truncate text-[11px]" style={{ color: isDark ? '#9fb0c7' : '#64758a' }}>
                    {track.description}
                  </p>
                )}
              </div>

              <div className="flex h-5 flex-shrink-0 items-end gap-0.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1 rounded-full bg-gradient-to-t from-[#7699d6] to-[#b087c8]"
                    animate={isPlaying ? { height: ['7px', '16px', '7px'] } : { height: '7px' }}
                    transition={{ duration: 0.8, repeat: isPlaying ? Infinity : 0, delay: i * 0.15, ease: 'easeInOut' }}
                  />
                ))}
              </div>
            </div>

            <AudioPlaybackControls variant="compact" showClose />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
