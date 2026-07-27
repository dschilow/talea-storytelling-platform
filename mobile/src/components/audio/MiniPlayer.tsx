import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { ChevronUp, ListMusic, Pause, Play } from 'lucide-react-native';

import { useAudioPlayer } from '@/providers/AudioPlayerProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { CoverImage } from '@/components/ui/CoverImage';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { PlaybackControls } from './PlaybackControls';
import { WaveformEqualizer } from './WaveformEqualizer';
import { Gradient } from '@/components/ui/Gradient';

/**
 * Collapsible mini player docked above the tab bar.
 *
 * Mirrors the web's BottomNav player: a compact row that expands in place to
 * reveal the full transport, plus an "up next" affordance that opens the queue.
 */
export function MiniPlayer({ onOpenQueue }: { onOpenQueue: () => void }) {
  const { colors, spacing, radius } = useTheme();
  const {
    track,
    isPlaying,
    togglePlay,
    currentTime,
    duration,
    isPlaylistActive,
    playlist,
    currentIndex,
    waitingForConversion,
  } = useAudioPlayer();

  const [expanded, setExpanded] = useState(false);

  const isVisible = Boolean(track) || waitingForConversion;
  const currentItem = currentIndex >= 0 && currentIndex < playlist.length ? playlist[currentIndex] : null;

  const nextItem = useMemo(
    () => playlist.slice(currentIndex >= 0 ? currentIndex + 1 : 0).find((item) => item.conversionStatus !== 'error') ?? null,
    [currentIndex, playlist]
  );

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const queueLabel = currentIndex >= 0 && playlist.length > 0 ? `${currentIndex + 1}/${playlist.length}` : null;
  const subtitle = currentItem?.parentStoryTitle ?? currentItem?.parentDokuTitle ?? track?.description ?? 'Talea Audio';
  const isPreparing = waitingForConversion && !track?.audioUrl;

  useEffect(() => {
    if (!isVisible) setExpanded(false);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(160)}
      layout={LinearTransition.springify().damping(24)}
      style={[
        styles.container,
        {
          marginHorizontal: spacing.sm,
          marginBottom: spacing.xs,
          borderRadius: radius.xl,
          borderColor: colors.border.light,
          backgroundColor: colors.surface.panel,
        },
      ]}
    >
      <Touchable
        onPress={() => setExpanded((value) => !value)}
        hapticIntent="light"
        pressScale={1}
        style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Player einklappen' : 'Player ausklappen'}
        accessibilityState={{ expanded }}
      >
        <View style={[styles.row, { gap: spacing.md }]}>
          <View style={styles.artwork}>
            {isPreparing ? (
              <View style={[styles.artworkInner, { backgroundColor: colors.surface.inset, borderRadius: radius.sm }]}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (
              <CoverImage
                uri={currentItem?.coverImageUrl ?? track?.coverImageUrl}
                style={styles.artworkInner}
                radius={radius.sm}
                fallbackGradient="lavender"
              />
            )}
            {isPlaying ? (
              <View style={[styles.artworkOverlay, { borderRadius: radius.sm }]}>
                <WaveformEqualizer playing size="sm" />
              </View>
            ) : null}
          </View>

          <View style={styles.meta}>
            <Text variant="label" numberOfLines={1}>
              {isPreparing ? 'Audio wird vorbereitet' : (currentItem?.title ?? track?.title ?? '')}
            </Text>
            <View style={[styles.row, { gap: 6, marginTop: 2 }]}>
              {queueLabel ? (
                <View
                  style={{
                    backgroundColor: colors.surface.inset,
                    borderRadius: radius.pill,
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                  }}
                >
                  <Text variant="caption" tone="tertiary" style={{ fontSize: 9.5 }}>
                    {queueLabel}
                  </Text>
                </View>
              ) : null}
              <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
                {subtitle}
              </Text>
            </View>
          </View>

          <Touchable
            onPress={togglePlay}
            disabled={isPreparing}
            hapticIntent="medium"
            style={[styles.playButton, { borderRadius: radius.pill }]}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause' : 'Abspielen'}
          >
            <Gradient token={colors.gradient.action} style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]} />
            {isPreparing ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : isPlaying ? (
              <Pause size={17} color={colors.primaryForeground} fill={colors.primaryForeground} />
            ) : (
              <Play size={17} color={colors.primaryForeground} fill={colors.primaryForeground} style={{ marginLeft: 1 }} />
            )}
          </Touchable>

          <View
            style={[
              styles.chevron,
              { borderRadius: radius.pill, borderColor: colors.border.soft, backgroundColor: colors.surface.primary },
            ]}
          >
            <ChevronUp
              size={16}
              color={colors.text.secondary}
              style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
            />
          </View>
        </View>
      </Touchable>

      <ProgressBar progress={progress} height={3} style={{ borderRadius: 0 }} />

      {expanded ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(140)}
          style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.light }}
        >
          <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.base, gap: spacing.base }}>
            <PlaybackControls
              showNavigation={isPlaylistActive && playlist.length > 1}
              onQueuePress={playlist.length > 0 ? onOpenQueue : undefined}
            />

            {nextItem ? (
              <Touchable
                onPress={onOpenQueue}
                style={[
                  styles.nextUp,
                  {
                    borderRadius: radius.md,
                    borderColor: colors.border.light,
                    backgroundColor: colors.surface.primary,
                    padding: spacing.sm,
                    gap: spacing.md,
                  },
                ]}
              >
                <CoverImage uri={nextItem.coverImageUrl} style={styles.nextArtwork} radius={radius.xs} />
                <View style={{ flex: 1 }}>
                  <Text variant="overline" tone="tertiary">
                    Als Nächstes
                  </Text>
                  <Text variant="label" numberOfLines={1} style={{ marginTop: 2 }}>
                    {nextItem.title}
                  </Text>
                </View>
                <ListMusic size={16} color={colors.text.tertiary} />
              </Touchable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  artwork: { width: 44, height: 44 },
  artworkInner: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  artworkOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  meta: { flex: 1, minWidth: 0 },
  playButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  chevron: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  nextUp: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  nextArtwork: { width: 40, height: 40 },
});
