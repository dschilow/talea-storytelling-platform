import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useUser } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Gem,
  Globe2,
  Headphones,
  Library,
  Map,
  Moon,
  Plus,
  Settings2,
  Sparkles,
  Sun,
  Sunrise,
  UserPlus,
  WifiOff,
} from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { withAlpha } from '@/theme/tokens';
import { useAvatars, useDokus, useStories } from '@/hooks/queries';
import { useOptionalChildProfiles } from '@/providers/ChildProfilesProvider';
import { useOffline } from '@/providers/OfflineProvider';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { Gradient } from '@/components/ui/Gradient';
import { CoverImage } from '@/components/ui/CoverImage';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Rail } from '@/components/ui/Rail';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { TaleaArt } from '@/components/ui/TaleaArt';
import { Glow } from '@/components/fx/Glow';
import { Floating, Shine } from '@/components/fx/Motion';
import { SparkleField } from '@/components/fx/Sparkles';
import { useAmbientMotion } from '@/components/fx/useAmbientMotion';
import { StoryCard } from '@/components/cards/StoryCard';
import { AvatarCard } from '@/components/cards/AvatarCard';
import { ProfileSwitcher } from '@/components/profile/ProfileSwitcher';
import type { WizardAssetGroup } from '@/hooks/useWizardAssets';
import type { RootStackParamList } from '@/navigation/types';
import type { Doku } from '@/types/doku';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TAVI = require('../../../assets/tavi.png');

/**
 * Home.
 *
 * One clear invitation (create tonight's story), then "continue where you left
 * off", the heroes rail and everything to discover. The hero card is the only
 * dark, glowing surface on the page, so the eye lands there first.
 */
export function HomeScreen() {
  const { spacing } = useTheme();
  const navigation = useNavigation<Nav>();
  const { user } = useUser();
  const { t } = useTranslation();
  const { isOnline } = useOffline();
  const childProfiles = useOptionalChildProfiles();
  const { width } = useWindowDimensions();

  const storiesQuery = useStories();
  const avatarsQuery = useAvatars();
  const dokusQuery = useDokus();

  const onRefresh = useCallback(async () => {
    await Promise.all([storiesQuery.refetch(), avatarsQuery.refetch(), dokusQuery.refetch()]);
  }, [avatarsQuery, dokusQuery, storiesQuery]);

  const stories = storiesQuery.data ?? [];
  const avatars = avatarsQuery.data ?? [];
  const dokus = dokusQuery.data ?? [];

  const recentStories = useMemo(() => {
    const inProgress = (story: (typeof stories)[number]) => (story as any).profileState?.completionState === 'in_progress';
    return [...stories]
      .filter((story) => story.status !== 'error')
      .sort((a, b) => {
        if (inProgress(a) !== inProgress(b)) return inProgress(a) ? -1 : 1;
        return new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime();
      })
      .slice(0, 6);
  }, [stories]);

  const name = childProfiles?.activeProfile?.name ?? user?.firstName ?? null;
  const storyCardWidth = Math.min(290, Math.round(width * 0.74));

  return (
    <Screen tabBarClearance playerClearance onRefresh={onRefresh} refreshing={storiesQuery.isRefetching} padded={false} ambient>
      <HomeHeader name={name} onTavi={() => navigation.navigate('Tavi')} onSettings={() => navigation.navigate('Settings')} />

      {!isOnline ? <OfflineBanner onPress={() => navigation.navigate('OfflineLibrary')} /> : null}

      {childProfiles && childProfiles.profiles.length > 1 ? (
        <View style={{ marginTop: spacing.sm }}>
          <ProfileSwitcher />
        </View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(60).springify().damping(18)} style={{ paddingHorizontal: spacing.lg, marginTop: spacing.base }}>
        <HeroCreateCard onPress={() => navigation.navigate('StoryWizard')} title={t('home.createStory', 'Neue Geschichte')} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(140).springify().damping(18)} style={[styles.quickRow, { paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.base }]}>
        <QuickAction label={'Avatar\nerstellen'} art={['character', 'human']} tint="lavender" Icon={UserPlus} onPress={() => navigation.navigate('AvatarWizard')} />
        <QuickAction label={'Doku\nerstellen'} art={['navTab', 'dokus']} tint="ocean" Icon={BookOpen} onPress={() => navigation.navigate('DokuWizard')} />
        <QuickAction label={'Lern-\nkarte'} art={['dokuDomain', 'earth']} tint="warm" Icon={Map} onPress={() => navigation.navigate('Journey')} />
      </Animated.View>

      {/* Continue reading */}
      <View style={[styles.section, { marginTop: spacing.xxl, gap: spacing.md }]}>
        <SectionHeader
          title={t('home.recentStories', 'Weiterlesen')}
          caption={stories.length ? `${stories.length} Geschichten in deiner Bibliothek` : undefined}
          actionLabel="Alle"
          onAction={() => navigation.navigate('Tabs', { screen: 'Stories' })}
        />
        {storiesQuery.isLoading ? (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <Skeleton height={340} width={storyCardWidth} radius={28} />
          </View>
        ) : recentStories.length === 0 ? (
          <EmptyState
            illustration="tavi"
            title="Noch keine Geschichte"
            description="Erschaffe deine erste Geschichte — Tavi hilft dir dabei."
            actionLabel="Geschichte erschaffen"
            onAction={() => navigation.navigate('StoryWizard')}
            compact
          />
        ) : (
          <Rail
            data={recentStories}
            keyExtractor={(story) => story.id}
            itemWidth={storyCardWidth}
            depth
            renderItem={(story) => (
              <StoryCard story={story} variant="hero" onPress={() => navigation.navigate('StoryReader', { storyId: story.id })} />
            )}
          />
        )}
      </View>

      {/* Heroes */}
      <View style={[styles.section, { marginTop: spacing.xxl, gap: spacing.md }]}>
        <SectionHeader
          title={t('home.myAvatars', 'Deine Helden')}
          caption="Sie wachsen mit jeder Geschichte"
          actionLabel="Alle"
          onAction={() => navigation.navigate('Tabs', { screen: 'Avatars' })}
        />
        {avatarsQuery.isLoading ? (
          <View style={[styles.quickRow, { paddingHorizontal: spacing.lg, gap: spacing.base }]}>
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} width={84} height={84} radius={42} />
            ))}
          </View>
        ) : (
          <Rail
            data={avatars}
            keyExtractor={(avatar) => avatar.id}
            itemWidth={92}
            gap={spacing.sm}
            renderItem={(avatar) => (
              <AvatarCard avatar={avatar} variant="bubble" onPress={() => navigation.navigate('AvatarDetail', { avatarId: avatar.id })} />
            )}
            footer={<AddHeroBubble onPress={() => navigation.navigate('AvatarWizard')} />}
          />
        )}
      </View>

      {/* Dokus */}
      {dokus.length > 0 ? (
        <View style={[styles.section, { marginTop: spacing.xxl, gap: spacing.md }]}>
          <SectionHeader title="Neu entdeckt" caption="Wissen zum Staunen" actionLabel="Alle" onAction={() => navigation.navigate('Tabs', { screen: 'Dokus' })} />
          <Rail
            data={dokus.slice(0, 8)}
            keyExtractor={(doku) => doku.id}
            itemWidth={156}
            renderItem={(doku) => <DokuTile doku={doku} onPress={() => navigation.navigate('DokuReader', { dokuId: doku.id })} />}
          />
        </View>
      ) : null}

      {/* Explore */}
      <View style={[styles.section, { marginTop: spacing.xxl, gap: spacing.md }]}>
        <SectionHeader title="Mehr entdecken" />
        <View style={[styles.exploreGrid, { paddingHorizontal: spacing.lg, gap: spacing.md }]}>
          <ExploreTile Icon={Globe2} hue="#2F8FEF" title="Entdecken" caption="Geschichten der Community" onPress={() => navigation.navigate('Community')} />
          <ExploreTile Icon={Gem} hue="#E9A126" title="Schatzkammer" caption="Gesammelte Fundstücke" onPress={() => navigation.navigate('Treasury')} />
          <ExploreTile Icon={Headphones} hue="#E04DA3" title="Hörbibliothek" caption="Hörspiele & Audio-Dokus" onPress={() => navigation.navigate('AudioLibrary')} />
          <ExploreTile Icon={Library} hue="#22A866" title="Offline" caption="Ohne Internet lesen" onPress={() => navigation.navigate('OfflineLibrary')} />
        </View>
      </View>
    </Screen>
  );
}

function HomeHeader({ name, onTavi, onSettings }: { name: string | null; onTavi: () => void; onSettings: () => void }) {
  const { colors, spacing } = useTheme();
  const ambient = useAmbientMotion();

  const daypart = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 11) return { label: 'Guten Morgen', Icon: Sunrise };
    if (hour < 18) return { label: 'Schön, dass du da bist', Icon: Sun };
    return { label: 'Guten Abend', Icon: Moon };
  }, []);

  return (
    <View style={[styles.header, { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md }]}>
      <Animated.View entering={FadeInDown.duration(420)} style={{ flex: 1, gap: 2 }}>
        <View style={styles.daypart}>
          <daypart.Icon size={14} color={colors.gold} strokeWidth={2.4} />
          <Text variant="overline" tone="accent">
            {daypart.label}
          </Text>
        </View>
        <Text variant="displayXl" numberOfLines={1}>
          {name ? `${name}` : 'Willkommen!'}
        </Text>
      </Animated.View>

      <Touchable onPress={onTavi} pressScale={0.9} hapticIntent="light" accessibilityRole="button" accessibilityLabel="Tavi fragen">
        <Floating active={ambient} amplitude={3} period={3600}>
          <View style={[styles.taviShell, { borderColor: colors.surface.primary, boxShadow: '0px 8px 22px rgba(112, 71, 235, 0.32)' }]}>
            <Gradient token={colors.gradient.primary} style={[StyleSheet.absoluteFill, { borderRadius: 27 }]} />
            <Image source={TAVI} style={styles.tavi} contentFit="contain" />
          </View>
        </Floating>
      </Touchable>
      <IconButton onPress={onSettings} accessibilityLabel="Einstellungen">
        <Settings2 size={19} color={colors.text.primary} />
      </IconButton>
    </View>
  );
}

function HeroCreateCard({ onPress, title }: { onPress: () => void; title: string }) {
  const { colors, spacing, brand } = useTheme();
  const ambient = useAmbientMotion();
  const [size, setSize] = useState({ width: 0, height: 0 });

  return (
    <Touchable
      onPress={onPress}
      hapticIntent="medium"
      pressScale={0.98}
      style={[styles.hero, { boxShadow: '0px 18px 40px rgba(76, 38, 170, 0.34), 0px 4px 12px rgba(76, 38, 170, 0.2)' }]}
      accessibilityRole="button"
      accessibilityLabel={title}
      onLayout={(event: LayoutChangeEvent) => setSize(event.nativeEvent.layout)}
    >
      <View style={[StyleSheet.absoluteFill, styles.heroClip]}>
        <Gradient token={colors.gradient.night} style={StyleSheet.absoluteFill} />
        <Glow color="rgba(244, 172, 50, 0.5)" size={300} style={{ top: -150, right: -110 }} />
        <Glow color="rgba(232, 74, 158, 0.45)" size={280} style={{ bottom: -170, right: 40 }} />
        <Glow color="rgba(25, 184, 242, 0.4)" size={260} style={{ bottom: -150, left: -120 }} />
        <SparkleField width={size.width} height={size.height} count={11} color="#FFE6A6" seed={21} minSize={5} maxSize={12} active={ambient} />
        <Shine interval={5600} delay={1600} intensity={0.16} active={ambient} />
      </View>

      <View style={[styles.heroContent, { padding: spacing.xl, gap: spacing.sm }]}>
        <View style={styles.heroEyebrow}>
          <Sparkles size={13} color={brand.goldLight} />
          <Text variant="overline" style={{ color: 'rgba(255,255,255,0.78)' }}>
            {title}
          </Text>
        </View>
        <Text variant="displayMd" tone="media" style={{ maxWidth: 290, paddingRight: spacing.sm }}>
          Welches Abenteuer erleben wir heute?
        </Text>
        <View style={[styles.heroCta, { marginTop: spacing.sm }]}>
          <Text variant="labelSm" style={{ color: brand.violet }}>
            Geschichte erschaffen
          </Text>
          <ArrowRight size={15} color={brand.violet} strokeWidth={2.6} />
        </View>
      </View>

      <Floating active={ambient} amplitude={5} period={4200} rotate={3} style={styles.heroArt}>
        <View style={styles.heroArtFrame}>
          <TaleaArt group="storyCategory" id="magic" size={96} fallback={<Sparkles size={34} color="#FFFFFF" />} />
        </View>
      </Floating>
    </Touchable>
  );
}

function QuickAction({
  label,
  art,
  tint,
  Icon,
  onPress,
}: {
  label: string;
  art: [WizardAssetGroup, string];
  tint: 'lavender' | 'ocean' | 'warm';
  Icon: typeof UserPlus;
  onPress: () => void;
}) {
  const { colors, radius, shadows } = useTheme();

  return (
    <Touchable
      onPress={onPress}
      pressScale={0.95}
      style={[styles.quickTile, shadows.soft, { borderRadius: radius.lg, backgroundColor: colors.surface.primary, borderColor: colors.border.light }]}
      accessibilityRole="button"
      accessibilityLabel={label.replace('\n', ' ').replace('-', '')}
    >
      <View style={[styles.quickArt, { borderRadius: 22 }]}>
        <Gradient token={colors.gradient[tint]} style={StyleSheet.absoluteFill} />
        <TaleaArt group={art[0]} id={art[1]} size={60} fallback={<Icon size={24} color={colors.primary} />} style={{ borderRadius: 22 }} />
      </View>
      <Text variant="labelSm" center numberOfLines={2} style={{ lineHeight: 16 }}>
        {label}
      </Text>
    </Touchable>
  );
}

function AddHeroBubble({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Touchable onPress={onPress} pressScale={0.93} style={styles.addBubble} accessibilityRole="button" accessibilityLabel="Neuen Avatar erstellen">
      <View style={[styles.addCircle, { borderColor: colors.border.accent, backgroundColor: colors.primarySoft }]}>
        <Plus size={26} color={colors.primary} strokeWidth={2.4} />
      </View>
      <Text variant="labelSm" tone="accent" center style={{ marginTop: 10 }}>
        Neuer Held
      </Text>
    </Touchable>
  );
}

function DokuTile({ doku, onPress }: { doku: Doku; onPress: () => void }) {
  const { radius, shadows, spacing, colors } = useTheme();
  return (
    <Touchable onPress={onPress} pressScale={0.96} style={{ gap: spacing.sm }} accessibilityLabel={doku.title}>
      <View style={[shadows.soft, { borderRadius: radius.lg }]}>
        <CoverImage uri={doku.coverImageUrl} style={{ height: 156 }} radius={radius.lg} fallbackGradient="nature" />
        {doku.status === 'generating' ? (
          <View style={[styles.dokuBadge, { backgroundColor: colors.primary }]}>
            <Text variant="caption" weight="bold" tone="inverse" style={{ fontSize: 10.5 }}>
              Entsteht …
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ gap: 2, paddingHorizontal: 2 }}>
        <Text variant="caption" weight="extrabold" tone="accent" numberOfLines={1} style={{ letterSpacing: 0.4 }}>
          {doku.topic.toUpperCase()}
        </Text>
        <Text variant="labelSm" numberOfLines={2}>
          {doku.title}
        </Text>
      </View>
    </Touchable>
  );
}

function ExploreTile({
  Icon,
  hue,
  title,
  caption,
  onPress,
}: {
  Icon: typeof Globe2;
  hue: string;
  title: string;
  caption: string;
  onPress: () => void;
}) {
  const { colors, radius, shadows, spacing } = useTheme();
  return (
    <Touchable
      onPress={onPress}
      pressScale={0.96}
      style={[styles.exploreTile, shadows.soft, { borderRadius: radius.lg, backgroundColor: colors.surface.primary, borderColor: colors.border.light, padding: spacing.base, gap: spacing.md }]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.exploreTop}>
        <View style={[styles.exploreIcon, { backgroundColor: withAlpha(hue, 0.13) }]}>
          <Icon size={20} color={hue} strokeWidth={2.2} />
        </View>
        <ChevronRight size={16} color={colors.text.muted} />
      </View>
      <View style={{ gap: 2 }}>
        <Text variant="title">{title}</Text>
        <Text variant="caption" tone="tertiary" numberOfLines={2}>
          {caption}
        </Text>
      </View>
    </Touchable>
  );
}

function OfflineBanner({ onPress }: { onPress: () => void }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Touchable
      onPress={onPress}
      style={[styles.offlineBanner, { marginHorizontal: spacing.lg, marginTop: spacing.sm, borderRadius: radius.md, backgroundColor: colors.warningSoft, padding: spacing.md, gap: spacing.sm }]}
    >
      <WifiOff size={16} color={colors.warning} />
      <Text variant="labelSm" tone="warning" style={{ flex: 1 }}>
        Offline — gespeicherte Geschichten öffnen
      </Text>
      <ArrowRight size={15} color={colors.warning} />
    </Touchable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  daypart: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  taviShell: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  tavi: { width: 50, height: 50, marginBottom: -4 },
  hero: { borderRadius: 30, minHeight: 210 },
  heroClip: { borderRadius: 30, overflow: 'hidden' },
  heroContent: { flex: 1, justifyContent: 'flex-start' },
  heroEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 6px 16px rgba(20, 10, 60, 0.25)',
  },
  heroArt: { position: 'absolute', right: 18, bottom: 18 },
  heroArtFrame: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
    boxShadow: '0px 10px 30px rgba(244, 172, 50, 0.45)',
  },
  quickRow: { flexDirection: 'row' },
  quickTile: { flex: 1, alignItems: 'center', paddingTop: 14, paddingBottom: 12, gap: 8, borderWidth: 1 },
  quickArt: { width: 60, height: 60, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  section: {},
  addBubble: { alignItems: 'center', width: 92 },
  addCircle: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  dokuBadge: { position: 'absolute', top: 10, left: 10, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  exploreGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  exploreTile: { width: '47.8%', borderWidth: 1 },
  exploreTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exploreIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  offlineBanner: { flexDirection: 'row', alignItems: 'center' },
});
