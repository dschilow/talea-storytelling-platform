import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { AlertCircle } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { genreMeta } from '@/lib/genres';
import { CoverImage } from '@/components/ui/CoverImage';
import { Glass } from '@/components/ui/Glass';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import type { Story } from '@/types/story';

interface StoryCardProps {
  story: Story;
  onPress: () => void;
  onLongPress?: () => void;
  /** `hero` is the large featured card (App Store "Today" style). */
  variant?: 'grid' | 'row' | 'hero';
}

function formatDate(value: string | Date, locale = 'de-DE'): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function participantImages(story: Story): string[] {
  const avatars = story.avatarParticipants ?? story.config?.avatars ?? [];
  return avatars.map((avatar) => avatar.imageUrl).filter((url): url is string => Boolean(url)).slice(0, 3);
}

/** "Abenteuer · 6 Min" — the quiet metadata line under a cover. */
function metaLine(story: Story): string {
  const parts = [genreMeta(story.config?.genre)?.label, story.estimatedReadingTime ? `${story.estimatedReadingTime} Min` : null];
  const line = parts.filter(Boolean).join(' · ');
  return line || formatDate(story.createdAt);
}

/**
 * Story tile, after Apple Books: the cover is the hero, with the title and a
 * metadata line set beneath it. Stories still being written show a progress
 * capsule on the cover instead of looking broken.
 */
export function StoryCard({ story, onPress, onLongPress, variant = 'grid' }: StoryCardProps) {
  const { colors, spacing, radius, shadows } = useTheme();

  const isGenerating = story.status === 'generating';
  const hasError = story.status === 'error';

  if (variant === 'row') {
    return (
      <Touchable
        onPress={onPress}
        onLongPress={onLongPress}
        pressScale={0.98}
        style={[styles.row, { borderRadius: radius.lg, backgroundColor: colors.surface.primary, padding: spacing.sm + 2, gap: spacing.md }]}
        accessibilityLabel={story.title}
      >
        <CoverImage uri={story.coverImageUrl} style={styles.rowCover} radius={10} fallbackGradient="sunset" />
        <View style={{ flex: 1, gap: 2, paddingRight: spacing.xs }}>
          <Text variant="label" numberOfLines={2}>
            {story.title}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {story.summary}
          </Text>
          <Text variant="caption" tone="tertiary" style={{ marginTop: 2 }}>
            {metaLine(story)}
          </Text>
        </View>
      </Touchable>
    );
  }

  if (variant === 'hero') {
    const genre = genreMeta(story.config?.genre);
    const faces = participantImages(story);
    return (
      <Touchable
        onPress={onPress}
        onLongPress={onLongPress}
        pressScale={0.98}
        style={[styles.hero, shadows.medium, { borderRadius: radius.xl, backgroundColor: colors.media.skeleton }]}
        accessibilityLabel={story.title}
      >
        <CoverImage uri={story.coverImageUrl} style={StyleSheet.absoluteFill} radius={radius.xl} overlay="strong" fallbackGradient="sunset" />

        {genre ? (
          <Text variant="overline" style={[styles.heroEyebrow, { color: 'rgba(255,255,255,0.78)', left: spacing.lg, top: spacing.lg }]}>
            {genre.label}
          </Text>
        ) : null}

        <View style={[styles.heroBottom, { padding: spacing.lg, gap: 6 }]}>
          <Text variant="displayMd" tone="media" numberOfLines={3}>
            {story.title}
          </Text>
          {story.summary ? (
            <Text variant="bodySm" numberOfLines={2} style={{ color: 'rgba(255,255,255,0.82)' }}>
              {story.summary}
            </Text>
          ) : null}
          <View style={[styles.heroFooter, { marginTop: spacing.sm }]}>
            <Glass tone="dark" borderRadius={18} style={styles.heroButton}>
              <Text variant="labelSm" tone="media">
                {isGenerating ? 'Wird geschrieben …' : 'Lesen'}
              </Text>
            </Glass>
            {story.estimatedReadingTime ? (
              <Text variant="caption" style={{ color: 'rgba(255,255,255,0.75)', flex: 1 }}>
                {story.estimatedReadingTime} Min
              </Text>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            {faces.length ? <Faces urls={faces} size={26} /> : null}
          </View>
        </View>
      </Touchable>
    );
  }

  return (
    <Touchable onPress={onPress} onLongPress={onLongPress} pressScale={0.97} style={{ gap: spacing.sm }} accessibilityLabel={story.title}>
      <View style={[shadows.soft, { borderRadius: radius.md }]}>
        <CoverImage uri={story.coverImageUrl} style={styles.gridCover} radius={radius.md} fallbackGradient="sunset">
          {isGenerating ? (
            <View style={styles.coverStatus}>
              <Glass tone="dark" borderRadius={14} style={styles.statusCapsule}>
                <ActivityIndicator size="small" color="#FFFFFF" style={{ transform: [{ scale: 0.75 }] }} />
                <Text variant="caption" tone="media" weight="semibold">
                  Wird geschrieben
                </Text>
              </Glass>
            </View>
          ) : null}
        </CoverImage>
      </View>
      <View style={{ gap: 2, paddingHorizontal: 2 }}>
        <Text variant="label" numberOfLines={2}>
          {story.title}
        </Text>
        {hasError ? (
          <View style={styles.errorLine}>
            <AlertCircle size={12} color={colors.danger} />
            <Text variant="caption" tone="danger">
              Erstellung fehlgeschlagen
            </Text>
          </View>
        ) : (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {metaLine(story)}
          </Text>
        )}
      </View>
    </Touchable>
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
            { width: size, height: size, borderRadius: size / 2, marginLeft: index === 0 ? 0 : -size * 0.3, zIndex: urls.length - index },
          ]}
          contentFit="cover"
          cachePolicy="disk"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  gridCover: { aspectRatio: 3 / 4 },
  coverStatus: { position: 'absolute', left: 0, right: 0, bottom: 10, alignItems: 'center' },
  statusCapsule: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 28, paddingLeft: 4, paddingRight: 10 },
  errorLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hero: { height: 380, overflow: 'hidden' },
  heroEyebrow: { position: 'absolute' },
  heroBottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  heroFooter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroButton: { height: 36, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowCover: { width: 60, height: 80 },
  faces: { flexDirection: 'row' },
  face: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', backgroundColor: '#E5E5EA' },
});
