import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Share2, Star } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { traitHue, withAlpha } from '@/theme/tokens';
import { avatarLevelProgress, getTopTraits, overallAvatarLevel, traitMaxValue } from '@/lib/personality';
import { CoverImage } from '@/components/ui/CoverImage';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import type { Avatar } from '@/types/avatar';

interface AvatarCardProps {
  avatar: Avatar;
  onPress: () => void;
  onLongPress?: () => void;
  variant?: 'grid' | 'row' | 'bubble';
  /** Renders a selection ring — used by the story wizard. */
  selected?: boolean;
}

/**
 * Avatar tile, styled like a collectible character card.
 *
 * It surfaces the two things that make an avatar feel alive — its level and its
 * strongest trait — because growth is the payoff of the personality system.
 */
export function AvatarCard({ avatar, onPress, onLongPress, variant = 'grid', selected }: AvatarCardProps) {
  const { colors, spacing, radius, shadows, brand } = useTheme();

  const level = overallAvatarLevel(avatar);
  const levelProgress = avatarLevelProgress(avatar);
  const topTrait = getTopTraits(avatar, 1)[0];
  const isGenerating = avatar.status === 'generating';
  const isChild = avatar.avatarRole === 'child';
  const hue = topTrait ? traitHue(topTrait.id) : brand.violet;

  if (variant === 'bubble') {
    return (
      <Touchable onPress={onPress} onLongPress={onLongPress} pressScale={0.93} style={styles.bubble} accessibilityLabel={`${avatar.name}, Level ${level}`}>
        <ProgressRing progress={levelProgress} size={84} strokeWidth={3.5}>
          <CoverImage uri={avatar.imageUrl} style={styles.bubbleImage} radius={36} fallbackGradient="lavender" />
        </ProgressRing>
        <View style={styles.bubbleLevel}>
          <LevelBadge level={level} compact />
        </View>
        <Text variant="labelSm" numberOfLines={1} center style={{ marginTop: 10, maxWidth: 88 }}>
          {avatar.name}
        </Text>
      </Touchable>
    );
  }

  if (variant === 'row') {
    return (
      <Touchable
        onPress={onPress}
        onLongPress={onLongPress}
        style={[
          styles.row,
          selected ? shadows.glow : shadows.soft,
          {
            borderRadius: radius.lg,
            backgroundColor: selected ? colors.surface.item : colors.surface.primary,
            borderColor: selected ? colors.primary : colors.border.light,
            borderWidth: selected ? 2 : 1,
            padding: spacing.md,
            gap: spacing.md,
          },
        ]}
        accessibilityLabel={avatar.name}
        accessibilityState={{ selected }}
      >
        <ProgressRing progress={levelProgress} size={66} strokeWidth={3}>
          <CoverImage uri={avatar.imageUrl} style={styles.rowAvatar} radius={28} fallbackGradient="lavender" />
        </ProgressRing>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={[styles.nameRow, { gap: spacing.xs }]}>
            <Text variant="displaySm" numberOfLines={1} style={{ flexShrink: 1, fontSize: 19, lineHeight: 23 }}>
              {avatar.name}
            </Text>
            {avatar.isShared ? <Share2 size={13} color={colors.text.tertiary} /> : null}
          </View>
          <View style={[styles.nameRow, { gap: 6 }]}>
            <LevelBadge level={level} compact />
            <Text variant="caption" tone="tertiary">
              {isChild ? 'Kind-Avatar' : 'Begleiter'}
            </Text>
          </View>
          {topTrait ? (
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {topTrait.emoji} {topTrait.label} · <Text variant="caption" weight="bold" style={{ color: hue }}>{topTrait.value}</Text>
            </Text>
          ) : null}
        </View>
        <View
          style={[
            styles.check,
            {
              borderColor: selected ? colors.primary : colors.border.strong,
              backgroundColor: selected ? colors.primary : 'transparent',
            },
          ]}
        >
          {selected ? <Check size={14} color={colors.primaryForeground} strokeWidth={3} /> : null}
        </View>
      </Touchable>
    );
  }

  return (
    <Touchable
      onPress={onPress}
      onLongPress={onLongPress}
      pressScale={0.97}
      style={[
        styles.card,
        selected ? shadows.glow : shadows.soft,
        {
          borderRadius: radius.lg,
          backgroundColor: colors.surface.primary,
          borderColor: selected ? colors.primary : colors.border.light,
          borderWidth: selected ? 2 : 1,
        },
      ]}
      accessibilityLabel={`${avatar.name}, Level ${level}`}
      accessibilityState={{ selected }}
    >
      <View style={styles.portrait}>
        <LinearGradient colors={[withAlpha(hue, 0.16), withAlpha(hue, 0.04)]} style={StyleSheet.absoluteFill} />
        <CoverImage uri={avatar.imageUrl} style={StyleSheet.absoluteFill} radius={0} fallbackGradient="lavender" />
        {isGenerating ? <Skeleton style={[StyleSheet.absoluteFill, { opacity: 0.6 }]} radius={0} /> : null}
        <View style={styles.levelAnchor}>
          <LevelBadge level={level} />
        </View>
        {avatar.isShared ? (
          <View style={[styles.sharedBadge, { backgroundColor: colors.media.chromeBg }]}>
            <Share2 size={11} color="#FFFFFF" />
          </View>
        ) : null}
      </View>

      <View style={{ padding: spacing.md, paddingTop: spacing.md + 2, gap: 6 }}>
        <Text variant="displaySm" numberOfLines={1} style={{ fontSize: 19, lineHeight: 23 }}>
          {avatar.name}
        </Text>
        {isGenerating ? (
          <Text variant="caption" tone="accent" weight="bold">
            Bild wird gemalt …
          </Text>
        ) : topTrait ? (
          <View style={{ gap: 5 }}>
            <View style={styles.traitLine}>
              <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
                {topTrait.emoji} {topTrait.label}
              </Text>
              <Text variant="caption" weight="extrabold" style={{ color: hue }}>
                {topTrait.value}
              </Text>
            </View>
            <ProgressBar progress={topTrait.value / traitMaxValue(topTrait.id)} height={5} color={hue} />
          </View>
        ) : (
          <Text variant="caption" tone="tertiary">
            Bereit für das erste Abenteuer
          </Text>
        )}
      </View>
    </Touchable>
  );
}

/** Gold level pill — the reward colour, used wherever a level is shown. */
export function LevelBadge({ level, compact }: { level: number; compact?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.levelBadge, compact ? styles.levelBadgeCompact : null, { boxShadow: '0px 3px 10px rgba(233, 161, 38, 0.35)' }]}>
      <LinearGradient colors={colors.gradient.gold.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 999 }]} />
      <Star size={compact ? 9 : 11} color="#5A3A00" fill="#5A3A00" />
      <Text variant="caption" weight="extrabold" style={{ color: '#4A2F00', fontSize: compact ? 10.5 : 12, lineHeight: compact ? 13 : 15 }}>
        {compact ? level : `Level ${level}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  portrait: { height: 168, zIndex: 1 },
  levelAnchor: { position: 'absolute', left: 10, bottom: -12, zIndex: 2 },
  sharedBadge: { position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  traitLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowAvatar: { width: 56, height: 56 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  bubble: { alignItems: 'center', width: 92 },
  bubbleImage: { width: 72, height: 72 },
  bubbleLevel: { position: 'absolute', top: 70 },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 24,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  levelBadgeCompact: { height: 19, paddingHorizontal: 6, gap: 3 },
});
