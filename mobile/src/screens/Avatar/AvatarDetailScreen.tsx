import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { BookOpen, ChevronDown, Gem, Pencil, Share2, Wand2 } from 'lucide-react-native';

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
import { CoverImage } from '@/components/ui/CoverImage';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ListRow, ListSection } from '@/components/ui/List';
import type { AvatarMemory } from '@/types/avatar';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type DetailRoute = RouteProp<RootStackParamList, 'AvatarDetail'>;
type Tab = 'traits' | 'memories' | 'profile';

const PORTRAIT = 132;

/**
 * Avatar profile, laid out like a contact card: portrait, name, a row of
 * actions, a summary, then the details.
 *
 * The traits list is the heart of it: nine base traits, always all nine even at
 * zero, each expandable to reveal the subcategories the AI has created (and
 * only those — a subcategory that was never awarded does not exist), each with
 * the reason it was awarded.
 */
export function AvatarDetailScreen() {
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<DetailRoute>();

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
    <Screen padded={false}>
      <ScreenHeader />

      <Animated.View entering={FadeIn.duration(300)} style={[styles.hero, { paddingHorizontal: spacing.lg, gap: spacing.xs }]}>
        <ProgressRing progress={levelProgress} size={PORTRAIT + 14} strokeWidth={3} delay={200}>
          <CoverImage uri={avatar.imageUrl} style={styles.portrait} radius={PORTRAIT / 2} fallbackGradient="lavender" />
        </ProgressRing>
        <Text variant="displayLg" center numberOfLines={2} style={{ marginTop: spacing.md }}>
          {avatar.name}
        </Text>
        <Text variant="bodySm" tone="secondary" center>
          {avatar.avatarRole === 'child' ? 'Kind-Avatar' : 'Begleiter'}
          {avatar.isShared ? ' · Geteilt' : ''} · seit {formatDate(avatar.createdAt)}
        </Text>
        {avatar.description ? (
          <Text variant="bodySm" tone="secondary" center style={{ maxWidth: 320, marginTop: spacing.xs }}>
            {avatar.description}
          </Text>
        ) : null}
      </Animated.View>

      <View style={[styles.actions, { paddingHorizontal: spacing.lg, gap: spacing.sm, marginTop: spacing.lg }]}>
        <ActionTile label="Geschichte" Icon={Wand2} onPress={() => navigation.navigate('StoryWizard', { mapAvatarId: avatarId })} />
        <ActionTile label="Schätze" Icon={Gem} onPress={() => navigation.navigate('Treasury', { avatarId })} />
        <ActionTile label="Teilen" Icon={Share2} onPress={() => navigation.navigate('AvatarExchange', { avatarId })} />
        <ActionTile label="Bearbeiten" Icon={Pencil} onPress={() => navigation.navigate('AvatarEdit', { avatarId })} />
      </View>

      <View style={[styles.summary, { marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.surface.primary }]}>
        <Summary label="Level" value={String(level)} />
        <View style={[styles.summaryDivider, { backgroundColor: colors.border.light }]} />
        <Summary label="Erfahrung" value={`${totalPoints}`} unit="XP" />
        <View style={[styles.summaryDivider, { backgroundColor: colors.border.light }]} />
        <Summary label="Erinnerungen" value={String(memories.length)} />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
        <SegmentedControl<Tab>
          segments={[
            { id: 'traits', label: 'Eigenschaften' },
            { id: 'memories', label: 'Erinnerungen' },
            { id: 'profile', label: 'Steckbrief' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.base }}>
        {tab === 'traits' ? (
          <ListSection
            separatorInset={68}
            footer="Alle Avatare starten bei 0. Unterkategorien entstehen erst, wenn Talea sie in einer Geschichte vergibt."
          >
            {traits.map((trait) => (
              <TraitRow key={trait.id} trait={trait} expanded={expandedTrait === trait.id} onToggle={() => toggleTrait(trait.id)} />
            ))}
          </ListSection>
        ) : tab === 'memories' ? (
          memoriesQuery.isLoading ? (
            <SkeletonText lines={6} />
          ) : memories.length === 0 ? (
            <EmptyState
              icon={<BookOpen size={30} color={colors.text.tertiary} />}
              title="Noch keine Erinnerungen"
              description="Nach der ersten gelesenen Geschichte sammelt dieser Avatar Erinnerungen."
              compact
            />
          ) : (
            <ListSection>
              {memories.map((memory, index) => (
                <MemoryRow key={memory.id ?? index} memory={memory} />
              ))}
            </ListSection>
          )
        ) : (
          <ProfileTab avatar={avatar} />
        )}
      </View>
    </Screen>
  );
}

function ActionTile({ label, Icon, onPress }: { label: string; Icon: typeof Wand2; onPress: () => void }) {
  const { colors, radius } = useTheme();
  return (
    <Touchable
      onPress={onPress}
      pressScale={0.95}
      style={[styles.actionTile, { borderRadius: radius.md, backgroundColor: colors.surface.primary }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon size={21} color={colors.primary} strokeWidth={2} />
      <Text variant="caption" weight="semibold" tone="accent" numberOfLines={1}>
        {label}
      </Text>
    </Touchable>
  );
}

function Summary({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <View style={styles.summaryValue}>
        <Text variant="stat">{value}</Text>
        {unit ? (
          <Text variant="labelSm" tone="secondary" style={{ marginBottom: 4 }}>
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function TraitRow({ trait, expanded, onToggle }: { trait: TraitView; expanded: boolean; onToggle: () => void }) {
  const { colors, spacing } = useTheme();
  const max = traitMaxValue(trait.id);
  const hasSubcategories = trait.subcategories.length > 0;
  const hue = traitHue(trait.id);
  const rotation = useSharedValue(expanded ? 180 : 0);

  useEffect(() => {
    rotation.value = withSpring(expanded ? 180 : 0, { damping: 18, stiffness: 240 });
  }, [expanded, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <View>
      <Touchable
        onPress={onToggle}
        disabled={!hasSubcategories}
        disabledOpacity={1}
        hapticIntent={hasSubcategories ? 'selection' : null}
        pressScale={1}
        pressOpacity={hasSubcategories ? 0.6 : 1}
        style={[styles.traitRow, { paddingHorizontal: spacing.base, gap: spacing.md }]}
        accessibilityRole={hasSubcategories ? 'button' : 'text'}
        accessibilityLabel={`${trait.label}: ${trait.value} von ${max}`}
        accessibilityState={{ expanded: hasSubcategories ? expanded : undefined }}
      >
        <View style={[styles.traitIcon, { backgroundColor: withAlpha(hue, 0.14) }]}>
          <Text style={{ fontSize: 19, lineHeight: 24 }}>{trait.emoji}</Text>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={styles.traitTitleRow}>
            <Text variant="bodyLg" style={{ flex: 1 }}>
              {trait.label}
            </Text>
            <Text variant="bodyLg" tone={trait.value > 0 ? 'primary' : 'muted'} style={{ fontVariant: ['tabular-nums'] }}>
              {trait.value}
            </Text>
            {hasSubcategories ? (
              <Animated.View style={chevronStyle}>
                <ChevronDown size={18} color={colors.text.muted} strokeWidth={2.4} />
              </Animated.View>
            ) : null}
          </View>
          <ProgressBar progress={max > 0 ? Math.min(1, trait.value / max) : 0} height={4} color={hue} />
          {hasSubcategories && !expanded ? (
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {trait.subcategories.map((sub) => sub.label).join(', ')}
            </Text>
          ) : null}
        </View>
      </Touchable>

      {expanded && hasSubcategories ? (
        <Animated.View entering={FadeIn.duration(200)} style={{ paddingLeft: 68, paddingRight: spacing.base, paddingBottom: spacing.md, gap: spacing.md }}>
          {trait.subcategories.map((subcategory) => (
            <View key={subcategory.key} style={{ gap: 4 }}>
              <View style={styles.traitTitleRow}>
                <Text variant="label" style={{ flex: 1 }}>
                  {subcategory.label}
                </Text>
                <Text variant="label" style={{ color: hue }}>
                  +{subcategory.value}
                </Text>
              </View>
              {subcategory.description ? (
                <Text variant="caption" tone="secondary">
                  {subcategory.description}
                </Text>
              ) : null}
            </View>
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

function MemoryRow({ memory }: { memory: AvatarMemory }) {
  const { colors, spacing } = useTheme();
  const changes = (memory.personalityChanges ?? []).map((change) => `${change.trait} ${change.change > 0 ? '+' : ''}${change.change}`).join(' · ');

  return (
    <View style={{ padding: spacing.base, gap: 4 }}>
      <View style={styles.traitTitleRow}>
        <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
          {formatDate(memory.createdAt ?? memory.timestamp)}
        </Text>
        {memory.memoryTier === 'core' ? (
          <Text variant="caption" weight="semibold" style={{ color: colors.system.orange }}>
            Kernerinnerung
          </Text>
        ) : null}
      </View>
      <Text variant="title" numberOfLines={2}>
        {memory.storyTitle}
      </Text>
      <Text variant="bodySm" tone="secondary">
        {memory.summary ?? memory.experience}
      </Text>
      {changes ? (
        <Text variant="caption" weight="semibold" style={{ color: colors.success, marginTop: 2 }}>
          {changes}
        </Text>
      ) : null}
    </View>
  );
}

function ProfileTab({ avatar }: { avatar: NonNullable<ReturnType<typeof useAvatar>['data']> }) {
  const narrative = avatar.narrativeProfile;
  const config = avatar.config;

  const entries: { label: string; value?: string }[] = [
    { label: 'Charakterzüge', value: narrative?.traits?.join(', ') },
    { label: 'Dominante Persönlichkeit', value: narrative?.dominantPersonality },
    { label: 'Eigenheit', value: narrative?.quirk },
    { label: 'Lieblingsspruch', value: narrative?.catchphrase ? `„${narrative.catchphrase}“` : undefined },
    { label: 'Hintergrund', value: narrative?.backstory },
    { label: 'Alter', value: config?.age },
    { label: 'Aussehen', value: config?.appearance },
    { label: 'Hobbys', value: config?.hobbies },
  ].filter((entry) => Boolean(entry.value));

  if (entries.length === 0) {
    return <EmptyState title="Kein Steckbrief" description="Für diesen Avatar wurden keine Profildaten hinterlegt." compact />;
  }

  return (
    <ListSection>
      {entries.map((entry) => (
        <ListRow key={entry.label} title={entry.value ?? ''} subtitle={entry.label} trailing={null} />
      ))}
    </ListSection>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center' },
  portrait: { width: PORTRAIT, height: PORTRAIT },
  actions: { flexDirection: 'row' },
  actionTile: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, height: 64 },
  summary: { flexDirection: 'row', borderRadius: 22, paddingVertical: 14 },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryValue: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  summaryDivider: { width: StyleSheet.hairlineWidth, marginVertical: 4 },
  traitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  traitIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  traitTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
