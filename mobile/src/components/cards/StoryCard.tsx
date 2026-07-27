import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AlertTriangle, BookOpen, Clock3, Loader2, Users } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { CoverImage } from '@/components/ui/CoverImage';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import type { Story } from '@/types/story';

interface StoryCardProps {
  story: Story;
  onPress: () => void;
  onLongPress?: () => void;
  /** Wide hero card for the "continue reading" rail. */
  variant?: 'grid' | 'row' | 'hero';
}

function formatDate(value: string | Date, locale = 'de-DE'): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
}

/**
 * Story tile.
 *
 * Generation and error states are first-class: a story that is still being
 * written shows as clearly in-progress rather than as a broken empty card, which
 * matters because generation legitimately takes minutes.
 */
export function StoryCard({ story, onPress, onLongPress, variant = 'grid' }: StoryCardProps) {
  const { colors, spacing, radius, shadows } = useTheme();

  const isGenerating = story.status === 'generating';
  const hasError = story.status === 'error';
  const participantCount = story.avatarParticipants?.length ?? story.config?.avatars?.length ?? 0;
  const chapterCount = story.chapters?.length ?? story.pages?.length ?? 0;

  if (variant === 'row') {
    return (
      <Touchable
        onPress={onPress}
        onLongPress={onLongPress}
        style={[
          styles.row,
          shadows.soft,
          {
            borderRadius: radius.lg,
            backgroundColor: colors.surface.primary,
            borderColor: colors.border.light,
            padding: spacing.sm,
            gap: spacing.md,
          },
        ]}
        accessibilityLabel={story.title}
      >
        <CoverImage uri={story.coverImageUrl} style={styles.rowCover} radius={radius.md} fallbackGradient="sunset" />
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="title" numberOfLines={2}>
            {story.title}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {story.summary}
          </Text>
          <View style={[styles.metaRow, { gap: spacing.sm, marginTop: 2 }]}>
            <StatusPill story={story} />
            {chapterCount > 0 ? (
              <View style={styles.metaItem}>
                <BookOpen size={11} color={colors.text.tertiary} />
                <Text variant="caption" tone="tertiary">
                  {chapterCount}
                </Text>
              </View>
            ) : null}
            {story.estimatedReadingTime ? (
              <View style={styles.metaItem}>
                <Clock3 size={11} color={colors.text.tertiary} />
                <Text variant="caption" tone="tertiary">
                  {story.estimatedReadingTime} Min
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Touchable>
    );
  }

  const coverHeight = variant === 'hero' ? 200 : 150;

  return (
    <Touchable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.card,
        shadows.soft,
        { borderRadius: radius.lg, backgroundColor: colors.surface.primary, borderColor: colors.border.light },
      ]}
      accessibilityLabel={story.title}
    >
      <CoverImage
        uri={story.coverImageUrl}
        style={{ height: coverHeight }}
        radius={0}
        overlay={story.coverImageUrl ? 'soft' : 'none'}
        fallbackGradient="sunset"
      >
        <View style={[styles.coverBadges, { padding: spacing.sm, gap: spacing.xs }]}>
          <StatusPill story={story} />
        </View>

        {participantCount > 0 ? (
          <View
            style={[
              styles.participantBadge,
              { borderRadius: radius.pill, backgroundColor: colors.media.chromeBg, borderColor: colors.media.chromeBorder },
            ]}
          >
            <Users size={11} color={colors.media.foreground} />
            <Text variant="caption" style={{ color: colors.media.foreground, fontSize: 10 }}>
              {participantCount}
            </Text>
          </View>
        ) : null}
      </CoverImage>

      <View style={{ padding: spacing.md, gap: 4 }}>
        <Text variant="title" numberOfLines={2}>
          {story.title}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={variant === 'hero' ? 3 : 2}>
          {story.summary}
        </Text>
        <View style={[styles.metaRow, { gap: spacing.md, marginTop: spacing.xs }]}>
          {story.estimatedReadingTime ? (
            <View style={styles.metaItem}>
              <Clock3 size={11} color={colors.text.tertiary} />
              <Text variant="caption" tone="tertiary">
                {story.estimatedReadingTime} Min
              </Text>
            </View>
          ) : null}
          <Text variant="caption" tone="muted">
            {formatDate(story.createdAt)}
          </Text>
        </View>
      </View>

      {isGenerating || hasError ? (
        <View
          style={[
            styles.stateStrip,
            { backgroundColor: hasError ? colors.dangerSoft : colors.successSoft, paddingHorizontal: spacing.md },
          ]}
        >
          {hasError ? (
            <AlertTriangle size={12} color={colors.danger} />
          ) : (
            <Loader2 size={12} color={colors.primary} />
          )}
          <Text variant="caption" tone={hasError ? 'danger' : 'accent'}>
            {hasError ? 'Erstellung fehlgeschlagen' : 'Wird geschrieben …'}
          </Text>
        </View>
      ) : null}
    </Touchable>
  );
}

function StatusPill({ story }: { story: Story }) {
  const genre = story.config?.genre;
  if (!genre) return null;

  const label: Record<string, string> = {
    fairy_tales: 'Märchen',
    adventure: 'Abenteuer',
    magic: 'Magie',
    animals: 'Tiere',
    scifi: 'Sci-Fi',
    modern: 'Alltag',
  };

  return <Chip label={label[genre] ?? genre} size="sm" tone="neutral" />;
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  rowCover: { width: 78, height: 78 },
  coverBadges: { position: 'absolute', top: 0, left: 0, flexDirection: 'row' },
  participantBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  stateStrip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
});
