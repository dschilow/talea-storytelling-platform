import React, { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type BottomSheet from '@gorhom/bottom-sheet';
import { AlertCircle, Loader2, Play, Trash2, Volume2 } from 'lucide-react-native';

import { useAudioPlayer } from '@/providers/AudioPlayerProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { CoverImage } from '@/components/ui/CoverImage';
import { EmptyState } from '@/components/ui/EmptyState';
import { WaveformEqualizer } from './WaveformEqualizer';
import { Button } from '@/components/ui/Button';

/**
 * The playback queue.
 *
 * Chunks are grouped visually by their parent story/doku so a 40-chunk story
 * reads as one item with parts, not as 40 unrelated rows.
 */
export const PlaylistSheet = forwardRef<BottomSheet>(function PlaylistSheet(_props, ref) {
  const { colors, spacing, radius } = useTheme();
  const {
    playlist,
    currentIndex,
    isPlaying,
    playFromPlaylist,
    removeFromPlaylist,
    clearPlaylist,
    conversionProgress,
  } = useAudioPlayer();

  const readyLabel =
    conversionProgress.total > 0 && conversionProgress.ready < conversionProgress.total
      ? `${conversionProgress.ready}/${conversionProgress.total} bereit`
      : `${playlist.length} Abschnitte`;

  return (
    <Sheet ref={ref} snapPoints={['55%', '88%']} title="Warteschlange" subtitle={readyLabel}>
      {playlist.length === 0 ? (
        <EmptyState
          icon={<Volume2 size={26} color={colors.text.tertiary} />}
          title="Noch nichts in der Warteschlange"
          description="Starte eine Geschichte oder ein Doku als Hörfassung, um sie hier zu sehen."
          compact
        />
      ) : (
        <View style={{ gap: spacing.xs }}>
          {playlist.map((item, index) => {
            const isCurrent = index === currentIndex;
            const partLabel =
              item.type === 'story-chapter'
                ? item.chapterTitle
                : item.dokuTotalChunks
                  ? `Teil ${(item.dokuChunkOrder ?? 0) + 1} von ${item.dokuTotalChunks}`
                  : item.title;

            return (
              <Touchable
                key={item.id}
                onPress={() => playFromPlaylist(index)}
                disabled={item.conversionStatus === 'error'}
                style={[
                  styles.row,
                  {
                    borderRadius: radius.md,
                    padding: spacing.sm,
                    gap: spacing.md,
                    backgroundColor: isCurrent ? colors.surface.item : 'transparent',
                    borderColor: isCurrent ? colors.border.accent : 'transparent',
                  },
                ]}
                accessibilityLabel={`${item.title} abspielen`}
              >
                <View>
                  <CoverImage uri={item.coverImageUrl} style={styles.artwork} radius={radius.xs} />
                  {isCurrent ? (
                    <View style={[styles.artworkOverlay, { borderRadius: radius.xs }]}>
                      <WaveformEqualizer playing={isPlaying} size="sm" />
                    </View>
                  ) : null}
                </View>

                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label" numberOfLines={1} tone={isCurrent ? 'accent' : 'primary'}>
                    {partLabel || item.title}
                  </Text>
                  <Text variant="caption" tone="tertiary" numberOfLines={1}>
                    {item.parentStoryTitle ?? item.parentDokuTitle ?? item.description ?? ''}
                  </Text>
                </View>

                <StatusBadge status={item.conversionStatus} />

                <Touchable
                  onPress={() => removeFromPlaylist(item.id)}
                  style={{ padding: spacing.xs }}
                  hapticIntent="light"
                  accessibilityLabel="Aus Warteschlange entfernen"
                >
                  <Trash2 size={15} color={colors.text.tertiary} />
                </Touchable>
              </Touchable>
            );
          })}

          <Button
            label="Warteschlange leeren"
            onPress={clearPlaylist}
            variant="ghost"
            size="sm"
            style={{ marginTop: spacing.md }}
          />
        </View>
      )}
    </Sheet>
  );
});

function StatusBadge({ status }: { status: 'pending' | 'converting' | 'ready' | 'error' }) {
  const { colors } = useTheme();

  if (status === 'ready') return <Play size={14} color={colors.text.tertiary} />;
  if (status === 'error') return <AlertCircle size={14} color={colors.danger} />;
  if (status === 'converting') return <Loader2 size={14} color={colors.primary} />;
  return <Loader2 size={14} color={colors.text.muted} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  artwork: { width: 42, height: 42 },
  artworkOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
});
