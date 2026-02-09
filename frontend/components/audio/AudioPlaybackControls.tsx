import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FastForward, Pause, Play, Rewind, X } from 'lucide-react';

import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { useTheme } from '../../contexts/ThemeContext';

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
  const { resolvedTheme } = useTheme();

  if (!track) return null;

  const isCompact = variant === 'compact';
  const iconSize = isCompact ? 16 : 20;
  const isDark = resolvedTheme === 'dark';

  const colors = isDark
    ? {
        surface: 'rgba(33,42,58,0.75)',
        border: '#34455d',
        text: '#d9e5f8',
        sub: '#95a7bf',
        accentStart: '#86a7db',
        accentEnd: '#b084c7',
      }
    : {
        surface: 'rgba(255,255,255,0.72)',
        border: '#decfbf',
        text: '#2a3b52',
        sub: '#687a91',
        accentStart: '#7e9cd1',
        accentEnd: '#b183c4',
      };

  const handleSeekChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(event.target.value));
  };

  const handleSkip = (delta: number) => {
    seek((currentTime || 0) + delta);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => handleSkip(-15)}
          title="15 Sekunden zurueck"
          className={`${isCompact ? 'h-8 w-8' : 'h-10 w-10'} rounded-full border shadow-sm`}
          style={{ borderColor: colors.border, background: colors.surface, color: colors.sub }}
        >
          <Rewind size={iconSize} className="mx-auto" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={togglePlay}
          title={isPlaying ? 'Pause' : 'Play'}
          className={`${isCompact ? 'h-10 w-10' : 'h-12 w-12'} rounded-full text-white shadow-lg`}
          style={{ background: `linear-gradient(135deg, ${colors.accentStart}, ${colors.accentEnd})` }}
        >
          <AnimatePresence mode="wait">
            {isPlaying ? (
              <motion.div key="pause" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Pause size={iconSize} className="mx-auto" />
              </motion.div>
            ) : (
              <motion.div key="play" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Play size={iconSize} className="mx-auto ml-[2px]" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => handleSkip(15)}
          title="15 Sekunden vor"
          className={`${isCompact ? 'h-8 w-8' : 'h-10 w-10'} rounded-full border shadow-sm`}
          style={{ borderColor: colors.border, background: colors.surface, color: colors.sub }}
        >
          <FastForward size={iconSize} className="mx-auto" />
        </motion.button>

        {showClose && (
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={close}
            title="Schliessen"
            className={`${isCompact ? 'h-8 w-8' : 'h-10 w-10'} ml-auto rounded-full border shadow-sm`}
            style={{ borderColor: '#cd9a9a', background: 'rgba(205,123,123,0.16)', color: '#b16464' }}
          >
            <X size={iconSize} className="mx-auto" />
          </motion.button>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        <span className="min-w-[38px] text-[11px] font-medium tabular-nums" style={{ color: colors.sub }}>
          {formatTime(currentTime)}
        </span>

        <div className="group relative flex h-6 flex-1 items-center">
          <div className="absolute inset-x-0 h-1.5 rounded-full" style={{ background: isDark ? 'rgba(137,156,184,0.26)' : 'rgba(147,155,168,0.25)' }} />

          <motion.div
            className="absolute left-0 h-1.5 rounded-full"
            style={{
              width: duration ? `${(currentTime / duration) * 100}%` : '0%',
              background: `linear-gradient(90deg, ${colors.accentStart}, ${colors.accentEnd})`,
            }}
          />

          <input
            type="range"
            min={0}
            max={duration || 0}
            step={1}
            value={currentTime}
            onChange={handleSeekChange}
            disabled={!isReady}
            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          />

          <motion.div
            className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 opacity-0 shadow-md transition-opacity group-hover:opacity-100"
            style={{
              left: duration ? `calc(${(currentTime / duration) * 100}% - 7px)` : '0%',
              borderColor: colors.accentStart,
              background: isDark ? '#d7e4f9' : '#ffffff',
            }}
          />
        </div>

        <span className="min-w-[38px] text-right text-[11px] font-medium tabular-nums" style={{ color: colors.sub }}>
          {formatTime(duration || 0)}
        </span>
      </div>
    </div>
  );
};
