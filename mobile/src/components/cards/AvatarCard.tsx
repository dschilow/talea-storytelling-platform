import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Check, Share2, Star } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { avatarLevelProgress, getTopTraits, overallAvatarLevel } from '@/lib/personality';
import { CoverImage } from '@/components/ui/CoverImage';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import type { Avatar } from '@/types/avatar';

interface AvatarCardProps {
  avatar: Avatar;
  onPress: () => void;
  onLongPress?: () => void;
  variant?: 'grid' | 'row' | 'bubble';
  /** Selection state — used by the story wizard. */
  selected?: boolean;
}

/**
 * Avatar tile, in the manner of People in Photos / Contacts: the portrait does
 * the work, the name and one quiet line of progress sit beneath it.
 */
export function AvatarCard({ avatar, onPress, onLongPress, variant = 'grid', selected }: AvatarCardProps) {
  const { colors, spacing, radius } = useTheme();

  const level = overallAvatarLevel(avatar);
  const levelProgress = avatarLevelProgress(avatar);
  const topTrait = getTopTraits(avatar, 1)[0];
  const isGenerating = avatar.status === 'generating';
  const isChild = avatar.avatarRole === 'child';
  const subtitle = isGenerating
    ? 'Bild wird gemalt …'
    : topTrait
      ? `Level ${level} · ${topTrait.emoji} ${topTrait.label} ${topTrait.value}`
      : `Level ${level} · Bereit für das erste Abenteuer`;

  if (variant === 'bubble') {
    return (
      <Touchable onPress={onPress} onLongPress={onLongPress} pressScale={0.93} style={styles.bubble} accessibilityLabel={`${avatar.name}, Level ${level}`}>
        <ProgressRing progress={levelProgress} size={82} strokeWidth={3}>
          <CoverImage uri={avatar.imageUrl} style={styles.bubbleImage} radius={36} fallbackGradient="lavender" />
        </ProgressRing>
        <Text variant="labelSm" numberOfLines={1} center style={{ marginTop: 8, maxWidth: 88 }}>
          {avatar.name}
        </Text>
        <Text variant="caption" tone="secondary" center>
          Level {level}
        </Text>
      </Touchable>
    );
  }

  if (variant === 'row') {
    return (
      <Touchable
        onPress={onPress}
        onLongPress={onLongPress}
        pressScale={0.98}
        style={[styles.row, { borderRadius: radius.lg, backgroundColor: colors.surface.primary, padding: spacing.md, gap: spacing.md }]}
        accessibilityLabel={avatar.name}
        accessibilityState={{ selected }}
      >
        <CoverImage uri={avatar.imageUrl} style={styles.rowAvatar} radius={28} fallbackGradient="lavender" />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={[styles.nameRow, { gap: spacing.xs }]}>
            <Text variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>
              {avatar.name}
            </Text>
            {avatar.isShared ? <Share2 size={13} color={colors.text.tertiary} /> : null}
          </View>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {isChild ? 'Kind-Avatar' : 'Begleiter'} · {subtitle}
          </Text>
        </View>
        <View
          style={[
            styles.check,
            selected ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.border.strong },
          ]}
        >
          {selected ? <Check size={15} color={colors.primaryForeground} strokeWidth={3} /> : null}
        </View>
      </Touchable>
    );
  }

  return (
    <Touchable onPress={onPress} onLongPress={onLongPress} pressScale={0.97} style={{ gap: spacing.sm }} accessibilityLabel={`${avatar.name}, Level ${level}`} accessibilityState={{ selected }}>
      <View style={[styles.portraitFrame, { borderRadius: radius.xl, borderColor: selected ? colors.primary : 'transparent' }]}>
        <CoverImage uri={avatar.imageUrl} style={styles.portrait} radius={radius.xl - 3} fallbackGradient="lavender" />
        {avatar.isShared ? (
          <View style={[styles.sharedBadge, { backgroundColor: colors.media.chromeBg }]}>
            <Share2 size={11} color="#FFFFFF" />
          </View>
        ) : null}
      </View>
      <View style={{ gap: 1, paddingHorizontal: 2 }}>
        <Text variant="title" numberOfLines={1}>
          {avatar.name}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </Touchable>
  );
}

/** Level capsule: a neutral system fill with a small star. */
export function LevelBadge({ level, compact }: { level: number; compact?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.levelBadge, compact ? styles.levelBadgeCompact : null, { backgroundColor: colors.surface.inset }]}>
      <Star size={compact ? 10 : 12} color={colors.system.orange} fill={colors.system.orange} />
      <Text variant="caption" weight="semibold" style={{ color: colors.text.primary }}>
        {compact ? level : `Level ${level}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  portraitFrame: { borderWidth: 3 },
  portrait: { aspectRatio: 1 },
  sharedBadge: { position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowAvatar: { width: 56, height: 56 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  bubble: { alignItems: 'center', width: 92 },
  bubbleImage: { width: 72, height: 72 },
  levelBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 10, borderRadius: 999 },
  levelBadgeCompact: { height: 20, paddingHorizontal: 7, gap: 3 },
});
