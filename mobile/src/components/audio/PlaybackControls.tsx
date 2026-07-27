import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gauge, ListMusic, Pause, Play, RotateCcw, RotateCw, SkipBack, SkipForward, X } from 'lucide-react-native';

import { useAudioPlayer } from '@/providers/AudioPlayerProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { Scrubber } from './Scrubber';

interface PlaybackControlsProps {
  showNavigation?: boolean;
  showClose?: boolean;
  onQueuePress?: () => void;
  compact?: boolean;
}

const RATES = [0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

/** Full transport: scrubber, skip, previous/next, playback speed, queue. */
export function PlaybackControls({ showNavigation, showClose, onQueuePress, compact }: PlaybackControlsProps) {
  const { colors, spacing, radius } = useTheme();
  const { isPlaying, togglePlay, currentTime, duration, seek, skipBy, playNext, playPrevious, close, playbackRate, setPlaybackRate } =
    useAudioPlayer();

  const [scrubbing, setScrubbing] = useState<number | null>(null);
  const displayTime = scrubbing ?? currentTime;

  const cycleRate = () => {
    const index = RATES.indexOf(playbackRate);
    setPlaybackRate(RATES[(index + 1) % RATES.length] ?? 1);
  };

  return (
    <View style={{ gap: compact ? spacing.sm : spacing.md }}>
      <View style={{ gap: 6 }}>
        <Scrubber
          progress={duration > 0 ? displayTime / duration : 0}
          onScrub={(ratio) => setScrubbing(ratio * duration)}
          onScrubEnd={(ratio) => {
            seek(ratio * duration);
            setScrubbing(null);
          }}
        />
        <View style={styles.timeRow}>
          <Text variant="mono" tone="tertiary">
            {formatTime(displayTime)}
          </Text>
          <Text variant="mono" tone="tertiary">
            {formatTime(duration)}
          </Text>
        </View>
      </View>

      <View style={[styles.controls, { gap: compact ? spacing.md : spacing.lg }]}>
        <Touchable onPress={cycleRate} style={styles.sideButton} accessibilityLabel={`Geschwindigkeit ${playbackRate}x`}>
          <Gauge size={16} color={colors.text.tertiary} />
          <Text variant="caption" tone="tertiary">
            {playbackRate}x
          </Text>
        </Touchable>

        {showNavigation ? (
          <Touchable onPress={playPrevious} style={styles.iconButton} accessibilityLabel="Vorheriger Abschnitt">
            <SkipBack size={20} color={colors.text.secondary} fill={colors.text.secondary} />
          </Touchable>
        ) : null}

        <Touchable onPress={() => skipBy(-15)} style={styles.iconButton} accessibilityLabel="15 Sekunden zurück">
          <RotateCcw size={20} color={colors.text.secondary} />
        </Touchable>

        <Touchable
          onPress={togglePlay}
          hapticIntent="medium"
          style={[styles.mainButton, { backgroundColor: colors.primary, borderRadius: radius.pill }]}
          accessibilityLabel={isPlaying ? 'Pause' : 'Abspielen'}
        >
          {isPlaying ? (
            <Pause size={24} color={colors.primaryForeground} fill={colors.primaryForeground} />
          ) : (
            <Play size={24} color={colors.primaryForeground} fill={colors.primaryForeground} style={{ marginLeft: 2 }} />
          )}
        </Touchable>

        <Touchable onPress={() => skipBy(15)} style={styles.iconButton} accessibilityLabel="15 Sekunden vor">
          <RotateCw size={20} color={colors.text.secondary} />
        </Touchable>

        {showNavigation ? (
          <Touchable onPress={playNext} style={styles.iconButton} accessibilityLabel="Nächster Abschnitt">
            <SkipForward size={20} color={colors.text.secondary} fill={colors.text.secondary} />
          </Touchable>
        ) : null}

        {onQueuePress ? (
          <Touchable onPress={onQueuePress} style={styles.sideButton} accessibilityLabel="Warteschlange öffnen">
            <ListMusic size={18} color={colors.text.tertiary} />
          </Touchable>
        ) : showClose ? (
          <Touchable onPress={close} style={styles.sideButton} accessibilityLabel="Player schließen">
            <X size={18} color={colors.text.tertiary} />
          </Touchable>
        ) : (
          <View style={styles.sideButton} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  mainButton: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  sideButton: { minWidth: 40, height: 40, alignItems: 'center', justifyContent: 'center', gap: 1 },
});
