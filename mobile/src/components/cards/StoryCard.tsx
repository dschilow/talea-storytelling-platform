import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { AlertTriangle, ArrowRight, Clock3 } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { genreMeta } from '@/lib/genres';
import { CoverImage } from '@/components/ui/CoverImage';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Story } from '@/types/story';

interface StoryCardProps {
  story: Story;
  onPress: () => void;
  onLongPress?: () => void;
  /** `hero` is the tall card of the "continue reading" rail. */
  variant?: 'grid' | 'row' | 'hero';
}

function formatDate(value: string | Date, locale = 'de-DE'): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
}

function participantImages(story: Story): string[] {
  const avatars = story.avatarParticipants ?? story.config?.avatars ?? [];
  return avatars.map((avatar) => avatar.imageUrl).filter((url): url is string => Boolean(url)).slice(0, 3);
}

/**
 * Story tile.
 *
 * Covers carry the title in the storybook serif, set right on the art like a
 * book jacket. Generation and error states are first-class: a story that is
 * still being written shimmers instead of showing as a broken empty card.
 */
export function StoryCard({ story, onPress, onLongPress, variant = 'grid' }: StoryCardProps) {
  const { colors, spacing, radius, shadows, brand } = useTheme();

  const isGenerating = story.status === 'generating';
  const hasError = story.status === 'error';
  const genre = genreMeta(story.config?.genre);
  const faces = participantImages(story);

  if (variant === 'row') {
    return (
      <Touchable
        onPress={onPress}
        onLongPress={onLongPress}
        style={[
          styles.row,
          shadows.soft,
          { borderRadius: radius.lg, backgroundColor: colors.surface.primary, borderColor: colors.border.light, padding: spacing.sm, gap: spacing.md },
        ]}
        accessibilityLabel={story.title}
      >
        <CoverImage uri={story.coverImageUrl} style={styles.rowCover} radius={radius.md} fallbackGradient="sunset" />
        <View style={{ flex: 1, gap: 3, paddingRight: spacing.xs }}>
          {genre ? <GenreTag label={genre.label} hue={genre.hue} /> : null}
          <Text variant="title" numberOfLines={2}>
            {story.title}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {story.summary}
          </Text>
        </View>
      </Touchable>
    );
  }

  if (variant === 'hero') {
    return (
      <Touchable
        onPress={onPress}
        onLongPress={onLongPress}
        pressScale={0.98}
        style={[styles.hero, shadows.medium, { borderRadius: radius.xl, backgroundColor: colors.media.skeleton }]}
        accessibilityLabel={story.title}
      >
        <CoverImage uri={story.coverImageUrl} style={StyleSheet.absoluteFill} radius={radius.xl} overlay="strong" fallbackGradient="sunset">
          {isGenerating ? <Skeleton style={[StyleSheet.absoluteFill, { opacity: 0.55 }]} radius={radius.xl} /> : null}
        </CoverImage>

        <View style={[styles.heroTop, { padding: spacing.md }]}>
          {genre ? <MediaChip label={genre.label} hue={genre.hue} /> : <View />}
          {faces.length ? <Faces urls={faces} size={28} /> : null}
        </View>

        <View style={[styles.heroBottom, { padding: spacing.lg, gap: 6 }]}>
          <Text variant="displaySm" tone="media" numberOfLines={3} style={styles.heroTitle}>
            {story.title}
          </Text>
          {story.summary ? (
            <Text variant="bodySm" numberOfLines={2} style={{ color: 'rgba(255,255,255,0.82)' }}>
              {story.summary}
            </Text>
          ) : null}
          <View style={[styles.metaRow, { marginTop: spacing.xs }]}>
            <StatusLine story={story} onMedia />
            <View style={styles.readButton}>
              <ArrowRight size={18} color={brand.violet} strokeWidth={2.6} />
            </View>
          </View>
        </View>
      </Touchable>
    );
  }

  return (
    <Touchable
      onPress={onPress}
      onLongPress={onLongPress}
      pressScale={0.97}
      style={[styles.card, shadows.soft, { borderRadius: radius.lg, backgroundColor: colors.surface.primary, borderColor: colors.border.light }]}
      accessibilityLabel={story.title}
    >
      <CoverImage uri={story.coverImageUrl} style={{ height: 210 }} radius={0} overlay="strong" fallbackGradient="sunset">
        {isGenerating ? <Skeleton style={[StyleSheet.absoluteFill, { opacity: 0.6 }]} radius={0} /> : null}
        <View style={[styles.coverTop, { padding: spacing.sm }]}>
          {genre ? <MediaChip label={genre.label} hue={genre.hue} small /> : <View />}
          {faces.length ? <Faces urls={faces} size={22} /> : null}
        </View>
        <View style={[styles.coverBottom, { padding: spacing.md }]}>
          <Text variant="displaySm" tone="media" numberOfLines={3} style={styles.gridTitle}>
            {story.title}
          </Text>
        </View>
      </CoverImage>

      <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 }}>
        <StatusLine story={story} />
      </View>
    </Touchable>
  );
}

function StatusLine({ story, onMedia }: { story: Story; onMedia?: boolean }) {
  const { colors, brand } = useTheme();
  const tint = onMedia ? 'rgba(255,255,255,0.8)' : colors.text.tertiary;

  if (story.status === 'generating') {
    return (
      <View style={styles.metaItem}>
        <View style={[styles.liveDot, { backgroundColor: onMedia ? brand.goldLight : colors.primary }]} />
        <Text variant="caption" weight="bold" style={{ color: onMedia ? '#FFFFFF' : colors.primary }}>
          Wird geschrieben …
        </Text>
      </View>
    );
  }

  if (story.status === 'error') {
    return (
      <View style={styles.metaItem}>
        <AlertTriangle size={12} color={colors.danger} />
        <Text variant="caption" tone="danger" weight="bold">
          Erstellung fehlgeschlagen
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.metaItem, { flex: 1 }]}>
      {story.estimatedReadingTime ? (
        <>
          <Clock3 size={12} color={tint} />
          <Text variant="caption" style={{ color: tint }}>
            {story.estimatedReadingTime} Min
          </Text>
          <Text variant="caption" style={{ color: tint }}>
            ·
          </Text>
        </>
      ) : null}
      <Text variant="caption" style={{ color: tint }}>
        {formatDate(story.createdAt)}
      </Text>
    </View>
  );
}

/** Frosted genre label for use on top of cover art. */
export function MediaChip({ label, hue, small }: { label: string; hue: string; small?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.mediaChip,
        {
          height: small ? 24 : 28,
          paddingHorizontal: small ? 8 : 11,
          backgroundColor: colors.media.chromeBg,
          borderColor: colors.media.chromeBorder,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: hue, boxShadow: `0px 0px 6px ${hue}` }]} />
      <Text variant="caption" weight="bold" tone="media" style={{ fontSize: small ? 11 : 12 }}>
        {label}
      </Text>
    </View>
  );
}

/** Small coloured genre label on light surfaces. */
export function GenreTag({ label, hue }: { label: string; hue: string }) {
  return (
    <View style={styles.genreTag}>
      <View style={[styles.dot, { backgroundColor: hue }]} />
      <Text variant="caption" weight="bold" style={{ color: hue, fontSize: 11, letterSpacing: 0.3 }}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

/** Overlapping avatar faces of the story's cast. */
export function Faces({ urls, size }: { urls: string[]; size: number }) {
  return (
    <View style={styles.faces}>
      {urls.map((url, index) => (
        <Image
          key={url + index}
          source={{ uri: url }}
          style={[
            styles.face,
            { width: size, height: size, borderRadius: size / 2, marginLeft: index === 0 ? 0 : -size * 0.32, zIndex: urls.length - index },
          ]}
          contentFit="cover"
          cachePolicy="disk"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', borderWidth: 1 },
  hero: { height: 340, overflow: 'hidden' },
  heroTop: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroBottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  heroTitle: { textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
  readButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  rowCover: { width: 78, height: 78 },
  coverTop: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  coverBottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  gridTitle: {
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  mediaChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  dot: { width: 7, height: 7, borderRadius: 4 },
  genreTag: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  faces: { flexDirection: 'row' },
  face: { borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: '#EEE7DE' },
});
