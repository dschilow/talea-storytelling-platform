import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  FastForward,
  ListMusic,
  Loader2,
  Pause,
  Play,
  Rewind,
  SkipBack,
  SkipForward,
  X,
} from 'lucide-react';

import { useAudioPlayer } from '../../contexts/AudioPlayerContext';

interface AudioPlaybackControlsProps {
  variant?: 'compact' | 'full' | 'streaming';
  showClose?: boolean;
  showNavigation?: boolean;
  onQueueClick?: () => void;
}

const formatTime = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const AudioPlaybackControls: React.FC<AudioPlaybackControlsProps> = ({
  variant = 'full',
  showClose = false,
  showNavigation = false,
  onQueueClick,
}) => {
  const reduceMotion = useReducedMotion();
  const {
    track,
    isPlaying,
    currentTime,
    duration,
    isReady,
    togglePlay,
    seek,
    close,
    playNext,
    playPrevious,
    currentIndex,
    playlist,
    waitingForConversion,
  } = useAudioPlayer();

  if (!track && !waitingForConversion) return null;

  const isCompact = variant === 'compact';
  const isStreaming = variant === 'streaming';
  const isFull = variant === 'full';
  const playDisabled = waitingForConversion && !track;
  const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const statusText = waitingForConversion
    ? 'Audio wird vorbereitet'
    : isPlaying
      ? 'Laeuft gerade'
      : 'Bereit zum Starten';
  const hasPrev = showNavigation && currentIndex > 0;
  const hasNext = showNavigation && currentIndex < playlist.length - 1;

  const secondaryButtonClass = `${
    isStreaming ? 'h-11 w-11' : isCompact ? 'h-8 w-8' : 'h-10 w-10'
  } rounded-full border shadow-sm`;
  const playButtonClass = `${
    isStreaming ? 'h-14 w-14' : isCompact ? 'h-10 w-10' : 'h-12 w-12'
  } rounded-full text-white shadow-lg disabled:opacity-60`;
  const cueActionsInline = isCompact;

  const controlMotion = reduceMotion
    ? {}
    : {
        whileHover: { y: -1, scale: 1.03 },
        whileTap: { scale: 0.96 },
      };

  const handleSeekChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(event.target.value));
  };

  const handleSkip = (delta: number) => {
    seek((currentTime || 0) + delta);
  };

  const renderQueueButton = () =>
    onQueueClick ? (
      <motion.button
        {...controlMotion}
        type="button"
        onClick={onQueueClick}
        title="Warteschlange"
        className={secondaryButtonClass}
        style={{
          borderColor: 'var(--talea-border-soft)',
          background: 'var(--talea-surface-primary)',
          color: 'var(--talea-text-secondary)',
        }}
      >
        <ListMusic size={isStreaming ? 18 : isCompact ? 15 : 17} className="mx-auto" />
      </motion.button>
    ) : null;

  const renderCloseButton = () =>
    showClose ? (
      <motion.button
        {...controlMotion}
        type="button"
        onClick={close}
        title="Schliessen"
        className={secondaryButtonClass}
        style={{
          borderColor: 'var(--talea-danger-border)',
          background: 'var(--talea-danger-soft)',
          color: 'var(--talea-danger)',
        }}
      >
        <X size={isStreaming ? 18 : isCompact ? 15 : 17} className="mx-auto" />
      </motion.button>
    ) : null;

  return (
    <div className={isStreaming ? 'space-y-4' : isFull ? 'space-y-3.5' : 'space-y-2.5'}>
      <div className={isStreaming ? 'flex items-center justify-center gap-2.5 sm:gap-3' : 'flex items-center gap-1.5'}>
        {showNavigation ? (
          <motion.button
            {...controlMotion}
            type="button"
            onClick={playPrevious}
            disabled={!hasPrev}
            title="Vorheriger Track"
            className={`${isCompact ? 'h-7 w-7' : 'h-8 w-8'} rounded-full border shadow-sm disabled:opacity-30`}
            style={{
              borderColor: 'var(--talea-border-soft)',
              background: 'var(--talea-surface-primary)',
              color: 'var(--talea-text-secondary)',
            }}
          >
            <SkipBack size={isCompact ? 13 : 15} className="mx-auto" />
          </motion.button>
        ) : null}

        <motion.button
          {...controlMotion}
          type="button"
          onClick={() => handleSkip(-15)}
          title="15 Sekunden zurueck"
          className={secondaryButtonClass}
          style={{
            borderColor: 'var(--talea-border-soft)',
            background: 'var(--talea-surface-primary)',
            color: 'var(--talea-text-secondary)',
          }}
        >
          <Rewind size={isStreaming ? 19 : isCompact ? 16 : 18} className="mx-auto" />
        </motion.button>

        <motion.button
          {...controlMotion}
          type="button"
          onClick={togglePlay}
          disabled={playDisabled}
          title={waitingForConversion ? 'Wird vorbereitet' : isPlaying ? 'Pause' : 'Play'}
          className={playButtonClass}
          style={{
            background:
              'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--talea-accent-sky) 74%, white) 100%)',
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {waitingForConversion ? (
              <motion.span
                key="loading"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                className="block"
              >
                <Loader2 size={isStreaming ? 22 : isCompact ? 18 : 20} className="mx-auto animate-spin" />
              </motion.span>
            ) : isPlaying ? (
              <motion.span
                key="pause"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                className="block"
              >
                <Pause size={isStreaming ? 22 : isCompact ? 18 : 20} className="mx-auto" />
              </motion.span>
            ) : (
              <motion.span
                key="play"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                className="block"
              >
                <Play size={isStreaming ? 22 : isCompact ? 18 : 20} className="mx-auto ml-[2px]" />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        <motion.button
          {...controlMotion}
          type="button"
          onClick={() => handleSkip(15)}
          title="15 Sekunden vor"
          className={secondaryButtonClass}
          style={{
            borderColor: 'var(--talea-border-soft)',
            background: 'var(--talea-surface-primary)',
            color: 'var(--talea-text-secondary)',
          }}
        >
          <FastForward size={isStreaming ? 19 : isCompact ? 16 : 18} className="mx-auto" />
        </motion.button>

        {showNavigation ? (
          <motion.button
            {...controlMotion}
            type="button"
            onClick={playNext}
            disabled={!hasNext}
            title="Naechster Track"
            className={`${isCompact ? 'h-7 w-7' : 'h-8 w-8'} rounded-full border shadow-sm disabled:opacity-30`}
            style={{
              borderColor: 'var(--talea-border-soft)',
              background: 'var(--talea-surface-primary)',
              color: 'var(--talea-text-secondary)',
            }}
          >
            <SkipForward size={isCompact ? 13 : 15} className="mx-auto" />
          </motion.button>
        ) : null}

        {cueActionsInline ? (
          <>
            <div className="flex-1" />
            {renderQueueButton()}
            {renderCloseButton()}
          </>
        ) : null}
      </div>

      <div className={isStreaming ? 'space-y-3' : 'space-y-2'}>
        <div className="flex items-center gap-2.5">
          <span
            className={`${isStreaming ? 'min-w-[44px] text-xs' : 'min-w-[38px] text-[11px]'} font-medium tabular-nums`}
            style={{ color: 'var(--talea-text-secondary)' }}
          >
            {formatTime(currentTime)}
          </span>

          <div className="group relative flex h-6 flex-1 items-center">
            <div
              className={`absolute inset-x-0 ${isStreaming ? 'h-2' : isCompact ? 'h-1.5' : 'h-1.5'} rounded-full`}
              style={{ background: 'var(--talea-progress-track)' }}
            />

            <motion.div
              className={`absolute left-0 ${isStreaming ? 'h-2' : isCompact ? 'h-1.5' : 'h-1.5'} rounded-full`}
              style={{
                width: `${progressRatio * 100}%`,
                background:
                  'linear-gradient(90deg, var(--primary) 0%, var(--talea-accent-sky) 55%, var(--talea-accent-peach) 100%)',
              }}
              transition={{ ease: 'easeOut', duration: 0.2 }}
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
              className={`pointer-events-none absolute top-1/2 ${isStreaming ? 'h-4 w-4' : 'h-3.5 w-3.5'} -translate-y-1/2 rounded-full border-2 shadow-md`}
              style={{
                left: duration ? `calc(${progressRatio * 100}% - ${isStreaming ? '8px' : '7px'})` : '0%',
                borderColor: 'var(--primary)',
                background: 'var(--talea-slider-thumb)',
                opacity: isStreaming || !isCompact ? 1 : 0,
              }}
              animate={
                reduceMotion || isStreaming || !isCompact
                  ? undefined
                  : { opacity: 0.9 }
              }
            />
          </div>

          <span
            className={`${isStreaming ? 'min-w-[44px] text-right text-xs' : 'min-w-[38px] text-right text-[11px]'} font-medium tabular-nums`}
            style={{ color: 'var(--talea-text-secondary)' }}
          >
            {formatTime(duration || 0)}
          </span>
        </div>

        {!cueActionsInline && (isFull || isStreaming || onQueueClick || showClose) ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p
              className={`${isStreaming ? 'text-xs' : 'text-[11px]'} font-medium`}
              style={{ color: 'var(--talea-text-secondary)' }}
            >
              {track?.description || statusText}
            </p>

            <div className="flex items-center gap-2">
              <span
                className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{
                  color: waitingForConversion ? 'var(--talea-warning)' : 'var(--primary)',
                  background: waitingForConversion
                    ? 'var(--talea-warning-soft)'
                    : 'color-mix(in srgb, var(--primary) 14%, transparent)',
                }}
              >
                {statusText}
              </span>
              {renderQueueButton()}
              {renderCloseButton()}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
