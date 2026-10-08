import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { BookOpen, ChevronDown, Gem, Pencil, Share2, Sparkles, Wand2 } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { traitHue, withAlpha } from '@/theme/tokens';
import { useAvatar, useAvatarMemories } from '@/hooks/queries';
import {
  avatarLevelProgress,
  overallAvatarLevel,
  readTraits,
  totalTraitPoints,
  traitMaxValue,
  type TraitView,
} from '@/lib/personality';
import { formatDate } from '@/lib/content';
import { haptic } from '@/lib/haptics';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { CoverImage } from '@/components/ui/CoverImage';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { Button } from '@/components/ui/Button';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { HeaderAction, ScreenHeader } from '@/components/ui/ScreenHeader';
import { Glow } from '@/components/fx/Glow';
import { SparkleField } from '@/components/fx/Sparkles';
import { useAmbientMotion } from '@/components/fx/useAmbientMotion';
import { LevelBadge } from '@/components/cards/AvatarCard';
import type { AvatarMemory } from '@/types/avatar';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type DetailRoute = RouteProp<RootStackParamList, 'AvatarDetail'>;
type Tab = 'traits' | 'memories' | 'profile';

const PORTRAIT = 176;

/**
 * Avatar profile.
 *
 * The traits tab is the heart of it: nine base traits, always all nine even at
 * zero, each in its own colour and expandable to reveal the subcategories the
 * AI has created (and only those — a subcategory that was never awarded does
 * not exist), each with the reason it was awarded.
 */
export function AvatarDetailScreen() {
  const { colors, spacing, isDark } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<DetailRoute>();
  const ambient = useAmbientMotion();

  const { avatarId } = route.params;
  const avatarQuery = useAvatar(avatarId);
  const memoriesQuery = useAvatarMemories(avatarId);

  const [tab, setTab] = useState<Tab>('traits');
  const [expandedTrait, setExpandedTrait] = useState<string | null>(null);

  const avatar = avatarQuery.data;
  const traits = useMemo(() => readTraits(avatar), [avatar]);
  const level = overallAvatarLevel(avatar);
  const levelProgress = avatarLevelProgress(avatar);
  const totalPoints = totalTraitPoints(avatar);
  const memories = (memoriesQuery.data ?? []) as AvatarMemory[];
  const topTrait = useMemo(() => [...traits].sort((a, b) => b.value - a.value)[0], [traits]);
  const heroHue = topTrait && topTrait.value > 0 ? traitHue(topTrait.id) : colors.primary;

  const toggleTrait = useCallback((traitId: string) => {
    haptic('selection');
    setExpandedTrait((current) => (current === traitId ? null : traitId));
  }, []);

  if (avatarQuery.isLoading) {
    return (
      <Screen>
        <ScreenHeader />
        <View style={{ alignItems: 'center', gap: spacing.lg, paddingTop: spacing.lg }}>
          <Skeleton width={PORTRAIT} height={PORTRAIT} radius={PORTRAIT / 2} />
          <Skeleton width={180} height={28} radius={10} />
          <SkeletonText lines={4} />
        </View>
      </Screen>
    );
  }

  if (!avatar) {
    return (
      <Screen>
        <ScreenHeader title="Avatar" />
        <EmptyState
          illustration="tavi"
          title="Avatar nicht gefunden"
          description="Dieser Avatar existiert nicht mehr oder gehört zu einem anderen Profil."
          actionLabel="Zurück"
          onAction={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false} ambient>
      <ScreenHeader
        actions={
          <>
            <HeaderAction onPress={() => navigation.navigate('Treasury', { avatarId })} accessibilityLabel="Schatzkammer">
              <Gem size={18} color={colors.gold} />
            </HeaderAction>
            <HeaderAction onPress={() => navigation.navigate('AvatarExchange', { avatarId })} accessibilityLabel="Avatar kopieren oder teilen">
              <Share2 size={17} color={colors.text.primary} />
            </HeaderAction>
            <HeaderAction onPress={() => navigation.navigate('AvatarEdit', { avatarId })} accessibilityLabel="Bearbeiten">
              <Pencil size={17} color={colors.text.primary} />
            </HeaderAction>
          </>
        }
      />

      {/* Hero */}
      <Animated.View entering={FadeIn.duration(420)} style={[styles.hero, { paddingHorizontal: spacing.lg }]}>
        <View style={styles.portraitStage}>
          <Glow color={withAlpha(heroHue, isDark ? 0.5 : 0.34)} size={PORTRAIT * 2} style={{ top: -PORTRAIT / 2 + 10, left: -PORTRAIT / 2 + 10 }} />
          <SparkleField width={PORTRAIT + 20} height={PORTRAIT + 20} count={7} color={colors.gold} seed={13} active={ambient} />
          <ProgressRing progress={levelProgress} size={PORTRAIT + 20} strokeWidth={5} delay={250}>
            <View style={[styles.portrait, { borderColor: colors.surface.primary, backgroundColor: colors.surface.primary }]}>
              <CoverImage uri={avatar.imageUrl} style={StyleSheet.absoluteFill} radius={PORTRAIT / 2} fallbackGradient="lavender" />
            </View>
          </ProgressRing>
          <View style={styles.levelAnchor}>
            <LevelBadge level={level} />
          </View>
        </View>

        <View style={{ alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg }}>
          <Text variant="displayXl" center numberOfLines={2}>
            {avatar.name}
          </Text>
          <View style={styles.chips}>
            <Chip label={avatar.avatarRole === 'child' ? 'Kind-Avatar' : 'Begleiter'} size="sm" tone="accent" />
            {avatar.isShared ? <Chip label="Geteilt" size="sm" tone="neutral" /> : null}
            <Chip label={`seit ${formatDate(avatar.createdAt)}`} size="sm" tone="neutral" />
          </View>
          {avatar.description ? (
            <Text variant="bodySm" tone="secondary" center style={{ maxWidth: 330 }}>
              {avatar.description}
            </Text>
          ) : null}
        </View>
      </Animated.View>

      {/* Stats */}
      <Animated.View entering={FadeInDown.delay(120).springify().damping(18)} style={[styles.stats, { paddingHorizontal: spacing.lg, gap: spacing.sm, marginTop: spacing.lg }]}>
        <Stat label="Level" value={String(level)} hue={colors.gold} />
        <Stat label="Erfahrung" value={String(totalPoints)} suffix="XP" hue={colors.primary} />
        <Stat label="Erinnerungen" value={String(memories.length)} hue={colors.accent.rose} />
      </Animated.View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.lg }}>
        <Button
          label={`Abenteuer mit ${avatar.name}`}
          onPress={() => navigation.navigate('StoryWizard', { mapAvatarId: avatarId })}
          icon={<Wand2 size={18} color={colors.primaryForeground} />}
          size="lg"
          fullWidth
        />

        <SegmentedControl<Tab>
          segments={[
            { id: 'traits', label: 'Eigenschaften' },
            { id: 'memories', label: memories.length ? `Erinnerungen · ${memories.length}` : 'Erinnerungen' },
            { id: 'profile', label: 'Steckbrief' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.base, gap: spacing.sm }}>
        {tab === 'traits' ? (
          <>
            <Text variant="caption" tone="tertiary" style={{ marginBottom: spacing.xs }}>
              Alle Avatare starten bei 0. Unterkategorien entstehen erst, wenn Talea sie in einer Geschichte vergibt.
            </Text>
            {traits.map((trait, index) => (
              <TraitRow key={trait.id} trait={trait} index={index} expanded={expandedTrait === trait.id} onToggle={() => toggleTrait(trait.id)} />
            ))}
          </>
        ) : tab === 'memories' ? (
          memoriesQuery.isLoading ? (
            <SkeletonText lines={6} />
          ) : memories.length === 0 ? (
            <EmptyState
              icon={<BookOpen size={26} color={colors.primary} />}
              title="Noch keine Erinnerungen"
              description="Nach der ersten gelesenen Geschichte sammelt dieser Avatar Erinnerungen."
              compact
            />
          ) : (
            <View style={{ gap: spacing.sm }}>
              {memories.map((memory, index) => (
                <MemoryRow key={memory.id ?? index} memory={memory} index={index} last={index === memories.length - 1} />
              ))}
            </View>
          )
        ) : (
          <ProfileTab avatar={avatar} />
        )}
      </View>
    </Screen>
  );
}

function Stat({ label, value, suffix, hue }: { label: string; value: string; suffix?: string; hue: string }) {
  const { colors, radius, shadows } = useTheme();
  return (
    <View style={[styles.stat, shadows.soft, { borderRadius: radius.lg, backgroundColor: colors.surface.primary, borderColor: colors.border.light }]}>
      <View style={styles.statValueRow}>
        <Text variant="stat" style={{ color: hue }}>
          {value}
        </Text>
        {suffix ? (
          <Text variant="caption" weight="extrabold" style={{ color: hue, marginBottom: 3 }}>
            {suffix}
          </Text>
        ) : null}
      </View>
      <Text variant="caption" tone="tertiary">
        {label}
      </Text>
    </View>
  );
}

function TraitRow({ trait, index, expanded, onToggle }: { trait: TraitView; index: number; expanded: boolean; onToggle: () => void }) {
  const { colors, spacing, radius, shadows } = useTheme();
  const max = traitMaxValue(trait.id);
  const hasSubcategories = trait.subcategories.length > 0;
  const hue = traitHue(trait.id);
  const active = trait.value > 0;
  const rotation = useSharedValue(expanded ? 180 : 0);

  React.useEffect(() => {
    rotation.value = withSpring(expanded ? 180 : 0, { damping: 16, stiffness: 220 });
  }, [expanded, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <Animated.View entering={FadeInDown.delay(index * 45).duration(360)}>
      <View style={[shadows.soft, { borderRadius: radius.lg, backgroundColor: colors.surface.primary, borderWidth: 1, borderColor: expanded ? withAlpha(hue, 0.4) : colors.border.light, overflow: 'hidden' }]}>
        <Touchable
          onPress={onToggle}
          disabled={!hasSubcategories}
          disabledOpacity={1}
          hapticIntent={hasSubcategories ? 'selection' : null}
          pressScale={hasSubcategories ? 0.985 : 1}
          style={{ padding: spacing.md, gap: spacing.sm + 2 }}
          accessibilityRole={hasSubcategories ? 'button' : 'text'}
          accessibilityLabel={`${trait.label}: ${trait.value} von ${max}`}
          accessibilityState={{ expanded: hasSubcategories ? expanded : undefined }}
        >
          <View style={styles.traitHeader}>
            <View style={[styles.traitIcon, { backgroundColor: withAlpha(hue, active ? 0.14 : 0.07) }]}>
              <Text style={{ fontSize: 20, lineHeight: 26, opacity: active ? 1 : 0.55 }}>{trait.emoji}</Text>
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text variant="title">{trait.label}</Text>
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {trait.description}
              </Text>
            </View>
            <View style={styles.traitValue}>
              <Text variant="stat" style={{ color: active ? hue : colors.text.muted, fontSize: 21, lineHeight: 24 }}>
                {trait.value}
              </Text>
              <Text variant="caption" tone="muted" style={{ fontSize: 10.5 }}>
                / {max}
              </Text>
            </View>
            {hasSubcategories ? (
              <Animated.View style={chevronStyle}>
                <ChevronDown size={18} color={colors.text.tertiary} />
              </Animated.View>
            ) : null}
          </View>

          <ProgressBar progress={max > 0 ? Math.min(1, trait.value / max) : 0} height={7} color={hue} delay={index * 60} />

          {hasSubcategories && !expanded ? (
            <View style={styles.subPreview}>
              <Sparkles size={11} color={hue} />
              <Text variant="caption" style={{ color: hue }} weight="bold" numberOfLines={1}>
                {trait.subcategories.map((sub) => sub.label).join(' · ')}
              </Text>
            </View>
          ) : null}
        </Touchable>

        {expanded && hasSubcategories ? (
          <Animated.View
            entering={FadeIn.duration(220)}
            style={[styles.subList, { borderTopColor: colors.border.light, backgroundColor: withAlpha(hue, 0.04), padding: spacing.md, gap: spacing.md }]}
          >
            {trait.subcategories.map((subcategory) => (
              <View key={subcategory.key} style={{ gap: 5 }}>
                <View style={styles.subHeader}>
                  <View style={[styles.subDot, { backgroundColor: hue }]} />
                  <Text variant="labelSm" style={{ flex: 1 }}>
                    {subcategory.label}
                  </Text>
                  <Text variant="labelSm" weight="extrabold" style={{ color: hue }}>
                    +{subcategory.value}
                  </Text>
                </View>
                <ProgressBar progress={Math.min(1, subcategory.value / 1000)} height={4} color={hue} />
                {subcategory.description ? (
                  <Text variant="caption" tone="secondary" style={{ fontStyle: 'italic' }}>
                    „{subcategory.description}“
                  </Text>
                ) : null}
              </View>
            ))}
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );
}

function MemoryRow({ memory, index, last }: { memory: AvatarMemory; index: number; last: boolean }) {
  const { colors, spacing } = useTheme();

  const impactColor =
    memory.emotionalImpact === 'positive' ? colors.success : memory.emotionalImpact === 'negative' ? colors.danger : colors.text.tertiary;
  const tierLabel = memory.memoryTier === 'core' ? 'Kernerinnerung' : memory.memoryTier === 'working' ? 'Frisch' : 'Erlebnis';

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(360)} style={styles.memoryRow}>
      <View style={styles.timeline}>
        <View style={[styles.timelineDot, { backgroundColor: impactColor, boxShadow: `0px 0px 0px 4px ${withAlpha(impactColor, 0.16)}` }]} />
        {!last ? <View style={[styles.timelineLine, { backgroundColor: colors.border.soft }]} /> : null}
      </View>
      <Card style={{ flex: 1, marginBottom: spacing.xs }}>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>
              {formatDate(memory.createdAt ?? memory.timestamp)}
            </Text>
            <Chip label={tierLabel} size="sm" tone={memory.memoryTier === 'core' ? 'gold' : 'neutral'} />
          </View>
          <Text variant="title" numberOfLines={2}>
            {memory.storyTitle}
          </Text>
          <Text variant="bodySm" tone="secondary">
            {memory.summary ?? memory.experience}
          </Text>
          {memory.personalityChanges?.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 2 }}>
              {memory.personalityChanges.map((change, changeIndex) => (
                <Chip
                  key={`${change.trait}-${changeIndex}`}
                  label={`${change.trait} ${change.change > 0 ? '+' : ''}${change.change}`}
                  size="sm"
                  tone={change.change > 0 ? 'success' : 'danger'}
                />
              ))}
            </View>
          ) : null}
        </View>
      </Card>
    </Animated.View>
  );
}

function ProfileTab({ avatar }: { avatar: NonNullable<ReturnType<typeof useAvatar>['data']> }) {
  const { spacing } = useTheme();
  const narrative = avatar.narrativeProfile;
  const config = avatar.config;

  const entries: { label: string; value?: string }[] = [
    { label: 'Dominante Persönlichkeit', value: narrative?.dominantPersonality },
    { label: 'Eigenheit', value: narrative?.quirk },
    { label: 'Lieblingsspruch', value: narrative?.catchphrase },
    { label: 'Hintergrund', value: narrative?.backstory },
    { label: 'Alter', value: config?.age },
    { label: 'Aussehen', value: config?.appearance },
    { label: 'Hobbys', value: config?.hobbies },
  ].filter((entry) => Boolean(entry.value));

  if (entries.length === 0 && !narrative?.traits?.length) {
    return <EmptyState title="Kein Steckbrief" description="Für diesen Avatar wurden keine Profildaten hinterlegt." compact />;
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {narrative?.traits?.length ? (
        <Card variant="tinted" tint="primary">
          <Text variant="overline" tone="accent" style={{ marginBottom: spacing.sm }}>
            Charakterzüge
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {narrative.traits.map((trait) => (
              <Chip key={trait} label={trait} size="sm" />
            ))}
          </View>
        </Card>
      ) : null}

      {entries.map((entry, index) => (
        <Animated.View key={entry.label} entering={FadeInDown.delay(index * 50).duration(320)}>
          <Card>
            <Text variant="overline" tone="tertiary">
              {entry.label}
            </Text>
            <Text variant={entry.label === 'Lieblingsspruch' ? 'displayItalic' : 'body'} style={{ marginTop: 6 }}>
              {entry.label === 'Lieblingsspruch' ? `„${entry.value}“` : entry.value}
            </Text>
          </Card>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: 4 },
  portraitStage: { width: PORTRAIT + 20, height: PORTRAIT + 20, alignItems: 'center', justifyContent: 'center' },
  portrait: { width: PORTRAIT, height: PORTRAIT, borderRadius: PORTRAIT / 2, borderWidth: 4, overflow: 'hidden' },
  levelAnchor: { position: 'absolute', bottom: -10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 12, borderWidth: 1, gap: 1 },
  statValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  traitHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  traitIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  traitValue: { alignItems: 'flex-end', minWidth: 44 },
  subPreview: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -2 },
  subList: { borderTopWidth: StyleSheet.hairlineWidth },
  subHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subDot: { width: 6, height: 6, borderRadius: 3 },
  memoryRow: { flexDirection: 'row', gap: 12 },
  timeline: { width: 14, alignItems: 'center', paddingTop: 20 },
  timelineDot: { width: 12, height: 12, borderRadius: 6 },
  timelineLine: { flex: 1, width: 2, marginTop: 6, borderRadius: 1 },
});
