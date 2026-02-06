import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { AudioPlaybackControls } from './AudioPlaybackControls';

export const GlobalAudioPlayer: React.FC = () => {
  const { track } = useAudioPlayer();

  return (
    <AnimatePresence>
      {track && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-6 z-[1200] w-[min(920px,92vw)]"
        >
          <div className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-2xl shadow-2xl shadow-purple-500/10 px-5 py-4">
            {/* Track info */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/40 dark:border-white/10 bg-gradient-to-br from-[#A989F2]/20 to-[#FF6B9D]/20 flex-shrink-0 flex items-center justify-center shadow-sm">
                {track.coverImageUrl ? (
                  <img src={track.coverImageUrl} alt={track.title} className="w-full h-full object-cover" />
                ) : (
                  <Volume2 size={20} className="text-[#A989F2]" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white truncate" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
                  {track.title}
                </h4>
                {track.description && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {track.description}
                  </p>
                )}
              </div>

              {/* Animated equalizer bars */}
              <div className="flex items-end gap-0.5 h-5 flex-shrink-0">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1 rounded-full bg-gradient-to-t from-[#A989F2] to-[#FF6B9D]"
                    animate={{ height: ['8px', '18px', '8px'] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
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
