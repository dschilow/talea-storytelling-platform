import React from 'react';
import { FastForward, Pause, Play, Rewind, X } from 'lucide-react';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { colors } from '../../utils/constants/colors';
import { spacing, radii, shadows } from '../../utils/constants/spacing';
import { typography } from '../../utils/constants/typography';

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
  const buttonSize = isCompact ? 34 : 42;
  const textStyle = isCompact ? typography.textStyles.caption : typography.textStyles.bodySm;

  const handleSeekChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = parseFloat(event.target.value);
    seek(next);
  };

  const handleSkip = (delta: number) => {
    const next = (currentTime || 0) + delta;
    seek(next);
  };

  return (
    <div style={{ display: 'grid', gap: spacing.sm }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
        <button
          onClick={() => handleSkip(-15)}
          style={{
            width: buttonSize,
            height: buttonSize,
            borderRadius: radii.pill,
            border: `1px solid ${colors.border.light}`,
            background: colors.glass.background,
            display: 'grid',
            placeItems: 'center',
            boxShadow: shadows.sm,
            cursor: 'pointer',
          }}
          title="15 Sekunden zurück"
        >
          <Rewind size={iconSize} />
        </button>

        <button
          onClick={togglePlay}
          style={{
            width: buttonSize + (isCompact ? 6 : 10),
            height: buttonSize + (isCompact ? 6 : 10),
            borderRadius: radii.pill,
            border: `2px solid ${colors.primary[300]}`,
            background: colors.gradients.primary,
            color: colors.text.inverse,
            display: 'grid',
            placeItems: 'center',
            boxShadow: shadows.md,
            cursor: 'pointer',
          }}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={iconSize} /> : <Play size={iconSize} />}
        </button>

        <button
          onClick={() => handleSkip(15)}
          style={{
            width: buttonSize,
            height: buttonSize,
            borderRadius: radii.pill,
            border: `1px solid ${colors.border.light}`,
            background: colors.glass.background,
            display: 'grid',
            placeItems: 'center',
            boxShadow: shadows.sm,
            cursor: 'pointer',
          }}
          title="15 Sekunden vor"
        >
          <FastForward size={iconSize} />
        </button>

        {showClose && (
          <button
            onClick={close}
            style={{
              width: buttonSize,
              height: buttonSize,
              borderRadius: radii.pill,
              border: `1px solid ${colors.border.light}`,
              background: 'rgba(248, 113, 113, 0.15)',
              color: colors.semantic.error,
              display: 'grid',
              placeItems: 'center',
              boxShadow: shadows.sm,
              marginLeft: 'auto',
              cursor: 'pointer',
            }}
            title="Schließen"
          >
            <X size={iconSize} />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
        <span style={{ ...textStyle, color: colors.text.secondary, minWidth: 44 }}>
          {formatTime(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={1}
          value={currentTime}
          onChange={handleSeekChange}
          disabled={!isReady}
          style={{
            flex: 1,
            accentColor: colors.primary[400],
            height: 6,
            borderRadius: 999,
            cursor: isReady ? 'pointer' : 'not-allowed',
          }}
        />
        <span style={{ ...textStyle, color: colors.text.secondary, minWidth: 44 }}>
          {formatTime(duration || 0)}
        </span>
      </div>
    </div>
  );
};
