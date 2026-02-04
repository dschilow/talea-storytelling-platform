import React from 'react';
import { Volume2 } from 'lucide-react';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { colors } from '../../utils/constants/colors';
import { spacing, radii, shadows } from '../../utils/constants/spacing';
import { typography } from '../../utils/constants/typography';
import { AudioPlaybackControls } from './AudioPlaybackControls';

export const GlobalAudioPlayer: React.FC = () => {
  const { track } = useAudioPlayer();

  if (!track) return null;

  return (
    <div className="fixed left-1/2 bottom-24 md:bottom-6 -translate-x-1/2 z-[1200] w-[min(920px,92vw)]">
      <div
        style={{
          background: colors.glass.backgroundAlt,
          border: `1px solid ${colors.border.light}`,
          borderRadius: radii.xl,
          boxShadow: shadows.xl,
          padding: `${spacing.md}px ${spacing.lg}px`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: radii.lg,
              overflow: 'hidden',
              border: `1px solid ${colors.border.light}`,
              background: colors.gradients.lavender,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            {track.coverImageUrl ? (
              <img src={track.coverImageUrl} alt={track.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Volume2 size={22} style={{ color: colors.text.inverse }} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                ...typography.textStyles.headingSm,
                color: colors.text.primary,
                marginBottom: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {track.title}
            </div>
            {track.description && (
              <div
                style={{
                  ...typography.textStyles.caption,
                  color: colors.text.secondary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {track.description}
              </div>
            )}
          </div>
        </div>

        <AudioPlaybackControls variant="compact" showClose />
      </div>
    </div>
  );
};
