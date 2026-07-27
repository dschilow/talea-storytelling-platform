import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Loader2, Share2, Sparkles } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { CoverImage } from '@/components/ui/CoverImage';
import { Chip } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { getTopTraits, overallAvatarLevel } from '@/lib/personality';
import type { Avatar } from '@/types/avatar';

interface AvatarCardProps {
  avatar: Avatar;
  onPress: () => void;
  onLongPress?: () => void;
  variant?: 'grid' | 'row';
  /** Renders a selection ring — used by the story wizard. */
  selected?: boolean;
}

/**
 * Avatar tile.
 *
 * Surfaces the two things that make an avatar feel alive: its level and its
 * strongest trait. That is the payoff of the personality system, so it belongs
 * on the card rather than only in the detail screen.
 */
export function AvatarCard({ avatar, onPress, onLongPress, variant = 'grid', selected }: AvatarCardProps) {
  const { colors, spacing, radius, shadows } = useTheme();

  const level = overallAvatarLevel(avatar);
  const topTraits = getTopTraits(avatar, 1);
  const topTrait = topTraits[0];
  const isGenerating = avatar.status === 'generating';
  const isChild = avatar.avatarRole === 'child';

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
            borderColor: selected ? colors.border.accent : colors.border.light,
            borderWidth: selected ? 1.6 : StyleSheet.hairlineWidth,
            padding: spacing.sm,
            gap: spacing.md,
          },
        ]}
        accessibilityLabel={avatar.name}
        accessibilityState={{ selected }}
      >
        <CoverImage uri={avatar.imageUrl} style={styles.rowAvatar} radius={radius.md} fallbackGradient="lavender" />
        <View style={{ flex: 1, gap: 3 }}>
          <View style={[styles.nameRow, { gap: spacing.xs }]}>
            <Text variant="title" numberOfLines={1} style={{ flex: 1 }}>
              {avatar.name}
            </Text>
            {avatar.isShared ? <Share2 size={13} color={colors.text.tertiary} /> : null}
          </View>
          <Text variant="caption" tone="tertiary">
            {isChild ? 'Kind-Avatar' : 'Begleiter'} · Level {level}
          </Text>
          {topTrait ? (
            <View style={{ gap: 3, marginTop: 2 }}>
              <Text variant="caption" tone="secondary">
                {topTrait.emoji} {topTrait.label} {topTrait.value}
              </Text>
              <ProgressBar progress={Math.min(1, topTrait.value / 100)} height={4} />
            </View>
          ) : null}
        </View>
      </Touchable>
    );
  }

  return (
    <Touchable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.card,
        shadows.soft,
        {
          borderRadius: radius.lg,
          backgroundColor: colors.surface.primary,
          borderColor: selected ? colors.border.accent : colors.border.light,
          borderWidth: selected ? 1.6 : StyleSheet.hairlineWidth,
        },
      ]}
      accessibilityLabel={avatar.name}
      accessibilityState={{ selected }}
    >
      <CoverImage uri={avatar.imageUrl} style={styles.cardAvatar} radius={0} fallbackGradient="lavender">
        <View style={[styles.levelBadge, { borderRadius: radius.pill, backgroundColor: colors.media.chromeBg }]}>
          <Sparkles size={10} color={colors.media.foreground} />
          <Text variant="caption" style={{ color: colors.media.foreground, fontSize: 10 }}>
            Lv {level}
          </Text>
        </View>
      </CoverImage>

      <View style={{ padding: spacing.md, gap: 4 }}>
        <Text variant="title" numberOfLines={1}>
          {avatar.name}
        </Text>
        {topTrait ? (
          <>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {topTrait.emoji} {topTrait.label} · {topTrait.value}
            </Text>
            <ProgressBar progress={Math.min(1, topTrait.value / 100)} height={4} style={{ marginTop: 2 }} />
          </>
        ) : (
          <Text variant="caption" tone="tertiary">
            Noch keine Erlebnisse
          </Text>
        )}
        {isChild ? <Chip label="Kind-Avatar" size="sm" tone="accent" style={{ marginTop: 4 }} /> : null}
      </View>

      {isGenerating ? (
        <View style={[styles.stateStrip, { backgroundColor: colors.successSoft, paddingHorizontal: spacing.md }]}>
          <Loader2 size={12} color={colors.primary} />
          <Text variant="caption" tone="accent">
            Bild wird gemalt …
          </Text>
        </View>
      ) : null}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  cardAvatar: { height: 148 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowAvatar: { width: 66, height: 66 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  levelBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  stateStrip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
});
