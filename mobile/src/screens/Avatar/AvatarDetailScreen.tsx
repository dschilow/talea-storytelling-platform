import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { BookOpen, ChevronDown, Gem, Pencil, Wand2 } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useAvatar, useAvatarMemories } from '@/hooks/queries';
import {
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
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { Button } from '@/components/ui/Button';
import { SkeletonCard, SkeletonText } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { HeaderAction, ScreenHeader } from '@/components/ui/ScreenHeader';
import type { AvatarMemory } from '@/types/avatar';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type DetailRoute = RouteProp<RootStackParamList, 'AvatarDetail'>;
type Tab = 'traits' | 'memories' | 'profile';

/**
 * Avatar profile.
 *
 * The traits tab is the heart of it: nine base traits, always all nine even at
 * zero, each expandable to reveal the subcategories the AI has created (and
 * only those — a subcategory that was never awarded does not exist).
 */
export function AvatarDetailScreen() {
  const { colors, spacing, radius } = useTheme();
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
  const totalPoints = totalTraitPoints(avatar);
  const memories = (memoriesQuery.data ?? []) as AvatarMemory[];

  const toggleTrait = useCallback((traitId: string) => {
    haptic('selection');
    setExpandedTrait((current) => (current === traitId ? null : traitId));
  }, []);

  if (avatarQuery.isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Avatar" />
        <View style={{ gap: spacing.lg }}>
          <SkeletonCard height={200} />
          <SkeletonText lines={6} />
        </View>
      </Screen>
    );
  }

  if (!avatar) {
    return (
      <Screen>
        <ScreenHeader title="Avatar" />
        <EmptyState
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
      <ScreenHeader
        title={avatar.name}
        actions={
          <>
            <HeaderAction
              onPress={() => navigation.navigate('Treasury', { avatarId })}
              accessibilityLabel="Schatzkammer"
            >
              <Gem size={18} color={colors.text.primary} />
            </HeaderAction>
            <HeaderAction onPress={() => navigation.navigate('AvatarEdit', { avatarId })} accessibilityLabel="Bearbeiten">
              <Pencil size={17} color={colors.text.primary} />
            </HeaderAction>
          </>
        }
      />

      <View style={{ paddingHorizontal: spacing.base, gap: spacing.base }}>
        {/* Hero */}
        <Animated.View entering={FadeIn.duration(340)}>
          <Card variant="elevated" padded={false}>
            <View style={{ flexDirection: 'row', padding: spacing.base, gap: spacing.base, alignItems: 'center' }}>
              <CoverImage uri={avatar.imageUrl} style={styles.hero} radius={radius.lg} fallbackGradient="lavender" />
              <View style={{ flex: 1, gap: 6 }}>
                <Text variant="headingMd" numberOfLines={1}>
                  {avatar.name}
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
                  <Chip label={`Level ${level}`} tone="accent" size="sm" />
                  <Chip label={avatar.avatarRole === 'child' ? 'Kind-Avatar' : 'Begleiter'} size="sm" />
                  {avatar.isShared ? <Chip label="Geteilt" size="sm" /> : null}
                </View>
                <Text variant="caption" tone="tertiary">
                  {totalPoints} Erfahrungspunkte · seit {formatDate(avatar.createdAt)}
                </Text>
              </View>
            </View>

            {avatar.description ? (
              <View
                style={{
                  paddingHorizontal: spacing.base,
                  paddingBottom: spacing.base,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.border.light,
                  paddingTop: spacing.md,
                }}
              >
                <Text variant="bodySm" tone="secondary">
                  {avatar.description}
                </Text>
              </View>
            ) : null}
          </Card>
        </Animated.View>

        <Button
          label="Geschichte mit diesem Avatar"
          onPress={() => navigation.navigate('StoryWizard', { mapAvatarId: avatarId })}
          icon={<Wand2 size={16} color={colors.primaryForeground} />}
          fullWidth
        />

        {/* Tabs */}
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <Chip label="Eigenschaften" selected={tab === 'traits'} onPress={() => setTab('traits')} />
          <Chip label={`Erinnerungen${memories.length ? ` (${memories.length})` : ''}`} selected={tab === 'memories'} onPress={() => setTab('memories')} />
          <Chip label="Steckbrief" selected={tab === 'profile'} onPress={() => setTab('profile')} />
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.base, gap: spacing.sm }}>
        {tab === 'traits' ? (
          <>
            <Text variant="caption" tone="tertiary">
              Alle Avatare starten bei 0. Unterkategorien entstehen erst, wenn Talea sie in einer Geschichte vergibt.
            </Text>
            {traits.map((trait, index) => (
              <TraitRow
                key={trait.id}
                trait={trait}
                index={index}
                expanded={expandedTrait === trait.id}
                onToggle={() => toggleTrait(trait.id)}
              />
            ))}
          </>
        ) : tab === 'memories' ? (
          memoriesQuery.isLoading ? (
            <SkeletonText lines={6} />
          ) : memories.length === 0 ? (
            <EmptyState
              icon={<BookOpen size={22} color={colors.text.tertiary} />}
              title="Noch keine Erinnerungen"
              description="Nach der ersten gelesenen Geschichte sammelt dieser Avatar Erinnerungen."
              compact
            />
          ) : (
            memories.map((memory, index) => <MemoryRow key={memory.id ?? index} memory={memory} />)
          )
        ) : (
          <ProfileTab avatar={avatar} />
        )}
      </View>
    </Screen>
  );
}

function TraitRow({
  trait,
  index,
  expanded,
  onToggle,
}: {
  trait: TraitView;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { colors, spacing } = useTheme();
  const max = traitMaxValue(trait.id);
  const hasSubcategories = trait.subcategories.length > 0;

  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(320)}>
      <Card padded={false}>
        <Touchable
          onPress={onToggle}
          disabled={!hasSubcategories}
          hapticIntent={hasSubcategories ? 'selection' : null}
          pressScale={hasSubcategories ? 0.99 : 1}
          style={{ padding: spacing.md, gap: spacing.sm }}
          accessibilityRole={hasSubcategories ? 'button' : 'text'}
          accessibilityLabel={`${trait.label}: ${trait.value} von ${max}`}
          accessibilityState={{ expanded: hasSubcategories ? expanded : undefined }}
        >
          <View style={styles.traitHeader}>
            <Text variant="headingSm">{trait.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text variant="label">{trait.label}</Text>
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {trait.description}
              </Text>
            </View>
            <Text variant="label" tone={trait.value > 0 ? 'accent' : 'muted'}>
              {trait.value}
            </Text>
            {hasSubcategories ? (
              <ChevronDown
                size={15}
                color={colors.text.tertiary}
                style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
              />
            ) : null}
          </View>

          <ProgressBar progress={max > 0 ? Math.min(1, trait.value / max) : 0} height={5} />
        </Touchable>

        {expanded && hasSubcategories ? (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={{
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.border.light,
              padding: spacing.md,
              gap: spacing.sm,
            }}
          >
            {trait.subcategories.map((subcategory) => (
              <View key={subcategory.key} style={{ gap: 4 }}>
                <View style={styles.subHeader}>
                  <Text variant="labelSm" tone="secondary" style={{ flex: 1 }}>
                    {subcategory.label}
                  </Text>
                  <Text variant="labelSm" tone="accent">
                    {subcategory.value}
                  </Text>
                </View>
                <ProgressBar progress={Math.min(1, subcategory.value / 1000)} height={4} />
                {subcategory.description ? (
                  <Text variant="caption" tone="tertiary">
                    {subcategory.description}
                  </Text>
                ) : null}
              </View>
            ))}
          </Animated.View>
        ) : null}
      </Card>
    </Animated.View>
  );
}

function MemoryRow({ memory }: { memory: AvatarMemory }) {
  const { spacing } = useTheme();

  const impactTone =
    memory.emotionalImpact === 'positive' ? 'success' : memory.emotionalImpact === 'negative' ? 'danger' : 'neutral';

  return (
    <Card>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="labelSm" style={{ flex: 1 }} numberOfLines={1}>
            {memory.storyTitle}
          </Text>
          <Chip label={memory.memoryTier ?? 'episodic'} size="sm" tone={impactTone as never} />
        </View>

        <Text variant="bodySm" tone="secondary">
          {memory.summary ?? memory.experience}
        </Text>

        {memory.personalityChanges?.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 2 }}>
            {memory.personalityChanges.map((change, index) => (
              <Chip
                key={`${change.trait}-${index}`}
                label={`${change.trait} ${change.change > 0 ? '+' : ''}${change.change}`}
                size="sm"
                tone="accent"
              />
            ))}
          </View>
        ) : null}

        <Text variant="caption" tone="muted">
          {formatDate(memory.createdAt ?? memory.timestamp)}
        </Text>
      </View>
    </Card>
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
        <Card>
          <Text variant="overline" tone="tertiary" style={{ marginBottom: spacing.sm }}>
            Charakterzüge
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {narrative.traits.map((trait) => (
              <Chip key={trait} label={trait} size="sm" />
            ))}
          </View>
        </Card>
      ) : null}

      {entries.map((entry) => (
        <Card key={entry.label}>
          <Text variant="overline" tone="tertiary">
            {entry.label}
          </Text>
          <Text variant="bodySm" style={{ marginTop: 4 }}>
            {entry.value}
          </Text>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: 104, height: 104 },
  traitHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  subHeader: { flexDirection: 'row', alignItems: 'center' },
});
