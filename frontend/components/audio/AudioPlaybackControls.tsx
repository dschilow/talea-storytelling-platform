import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FastForward, Pause, Play, Rewind, X } from 'lucide-react';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';

interface AudioPlaybackControlsProps {
  variant?: 'compact' | 'full';
  showClose?: boolean;
}

const formatTime = (value: number) => {
  if (!Number.isFinite(value)) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const AudioPlaybackControls: React.FC<AudioPlaybackControlsProps> = ({
  variant = 'full',
  showClose = false,
}) => {
  const {
    track,
    isPlaying,
    currentTime,
    duration,
    isReady,
    togglePlay,
    seek,
    close,
  } = useAudioPlayer();

  if (!track) return null;

  const isCompact = variant === 'compact';
  const iconSize = isCompact ? 16 : 20;

  const handleSeekChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(event.target.value));
  };

  const handleSkip = (delta: number) => {
    seek((currentTime || 0) + delta);
  };

  return (
    <div className="space-y-2">
      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Rewind */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => handleSkip(-15)}
          title="15 Sekunden zurück"
          className={`${isCompact ? 'w-8 h-8' : 'w-10 h-10'} rounded-full flex items-center justify-center bg-white/[0.06] border border-white/[0.08] text-white/70 hover:bg-white/[0.12] transition-colors shadow-sm`}
        >
          <Rewind size={iconSize} />
        </motion.button>

        {/* Play/Pause */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={togglePlay}
          title={isPlaying ? 'Pause' : 'Play'}
          className={`${isCompact ? 'w-10 h-10' : 'w-12 h-12'} rounded-full flex items-center justify-center bg-gradient-to-br from-[#A989F2] to-[#7C5CE0] text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-shadow`}
        >
          <AnimatePresence mode="wait">
            {isPlaying ? (
              <motion.div key="pause" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Pause size={iconSize} />
              </motion.div>
            ) : (
              <motion.div key="play" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Play size={iconSize} className="ml-0.5" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Forward */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => handleSkip(15)}
          title="15 Sekunden vor"
          className={`${isCompact ? 'w-8 h-8' : 'w-10 h-10'} rounded-full flex items-center justify-center bg-white/[0.06] border border-white/[0.08] text-white/70 hover:bg-white/[0.12] transition-colors shadow-sm`}
        >
          <FastForward size={iconSize} />
        </motion.button>

        {/* Close */}
        {showClose && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={close}
            title="Schließen"
            className={`${isCompact ? 'w-8 h-8' : 'w-10 h-10'} rounded-full flex items-center justify-center ml-auto bg-red-500/10 border border-red-400/20 text-red-400 hover:bg-red-500/20 transition-colors shadow-sm`}
          >
            <X size={iconSize} />
          </motion.button>
        )}
      </div>

      {/* Seek bar */}
      <div className="flex items-center gap-2.5">
        <span className="text-[11px] font-medium text-white/40 min-w-[38px] tabular-nums">
          {formatTime(currentTime)}
        </span>

        <div className="relative flex-1 h-6 flex items-center group">
          {/* Track background */}
          <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/10" />

          {/* Progress fill */}
          <motion.div
            className="absolute left-0 h-1.5 rounded-full bg-gradient-to-r from-[#A989F2] to-[#FF6B9D]"
            style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
          />

          {/* Input range (invisible, on top) */}
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={1}
            value={currentTime}
            onChange={handleSeekChange}
            disabled={!isReady}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
          />

          {/* Thumb indicator */}
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-[#A989F2] shadow-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: duration ? `calc(${(currentTime / duration) * 100}% - 7px)` : '0%' }}
          />
        </div>

        <span className="text-[11px] font-medium text-white/40 min-w-[38px] tabular-nums text-right">
          {formatTime(duration || 0)}
        </span>
      </div>
    </div>
  );
};
