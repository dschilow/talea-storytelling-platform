import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useUser } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ArrowRight, BookOpen, Gem, Globe2, Headphones, Library, Map, Plus, Settings2, UserPlus, WifiOff } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useAvatars, useDokus, useStories } from '@/hooks/queries';
import { useOptionalChildProfiles } from '@/providers/ChildProfilesProvider';
import { useOffline } from '@/providers/OfflineProvider';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { CoverImage } from '@/components/ui/CoverImage';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Glass } from '@/components/ui/Glass';
import { OverlayGradient } from '@/components/ui/Gradient';
import { Rail } from '@/components/ui/Rail';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { IconSquircle, ListRow, ListSection } from '@/components/ui/List';
import { StoryCard } from '@/components/cards/StoryCard';
import { AvatarCard } from '@/components/cards/AvatarCard';
import { ProfileSwitcher } from '@/components/profile/ProfileSwitcher';
import type { RootStackParamList } from '@/navigation/types';
import type { Doku } from '@/types/doku';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TAVI = require('../../../assets/tavi.png');
const HERO = require('../../../assets/home-hero.webp');

/**
 * Home, laid out like the App Store's Today tab: the date and a large title,
 * one featured card to start tonight's story, then shelves — continue
 * reading, the heroes, new dokus — and a grouped list for everything else.
 */
export function HomeScreen() {
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<Nav>();
  const { user } = useUser();
  const { t } = useTranslation();
  const { isOnline } = useOffline();
  const childProfiles = useOptionalChildProfiles();

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
      .slice(0, 8);
  }, [stories]);

  const name = childProfiles?.activeProfile?.name ?? user?.firstName ?? null;
  const today = useMemo(() => new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }), []);
  const tints = colors.system;

  return (
    <Screen tabBarClearance playerClearance onRefresh={onRefresh} refreshing={storiesQuery.isRefetching} padded={false}>
      <ScreenHeader
        large
        showBack={false}
        eyebrow={today}
        title={name ? `Hallo, ${name}` : 'Start'}
        actions={
          <>
            <IconButton onPress={() => navigation.navigate('Tavi')} accessibilityLabel="Tavi fragen">
              <Image source={TAVI} style={styles.tavi} contentFit="contain" />
            </IconButton>
            <IconButton onPress={() => navigation.navigate('Settings')} accessibilityLabel="Einstellungen">
              <Settings2 size={20} color={colors.text.primary} strokeWidth={2} />
            </IconButton>
          </>
        }
      />

      {!isOnline ? <OfflineBanner onPress={() => navigation.navigate('OfflineLibrary')} /> : null}

      {childProfiles && childProfiles.profiles.length > 1 ? (
        <View style={{ marginBottom: spacing.sm }}>
          <ProfileSwitcher />
        </View>
      ) : null}

      <Animated.View entering={FadeIn.duration(320)} style={{ paddingHorizontal: spacing.lg }}>
        <FeaturedCard onPress={() => navigation.navigate('StoryWizard')} eyebrow={t('home.createStory', 'Neue Geschichte')} />
      </Animated.View>

      <View style={[styles.quickRow, { paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.md }]}>
        <QuickAction label="Avatar erstellen" color={tints.green} Icon={UserPlus} onPress={() => navigation.navigate('AvatarWizard')} />
        <QuickAction label="Doku erstellen" color={tints.orange} Icon={BookOpen} onPress={() => navigation.navigate('DokuWizard')} />
        <QuickAction label="Lernkarte" color={tints.teal} Icon={Map} onPress={() => navigation.navigate('Journey')} />
      </View>

      {/* Continue reading */}
      <View style={[styles.section, { marginTop: spacing.xxl }]}>
        <SectionHeader title={t('home.recentStories', 'Weiterlesen')} actionLabel="Alle" onAction={() => navigation.navigate('Tabs', { screen: 'Stories' })} />
        {storiesQuery.isLoading ? (
          <View style={[styles.quickRow, { paddingHorizontal: spacing.lg, gap: spacing.md }]}>
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} width={132} height={176} radius={16} />
            ))}
          </View>
        ) : recentStories.length === 0 ? (
          <EmptyState
            illustration="tavi"
            title="Noch keine Geschichte"
            description="Erstelle deine erste Geschichte — sie dauert nur ein paar Minuten."
            actionLabel="Geschichte erstellen"
            onAction={() => navigation.navigate('StoryWizard')}
            compact
          />
        ) : (
          <Rail
            data={recentStories}
            keyExtractor={(story) => story.id}
            itemWidth={132}
            gap={spacing.base}
            renderItem={(story) => <StoryCard story={story} onPress={() => navigation.navigate('StoryReader', { storyId: story.id })} />}
          />
        )}
      </View>

      {/* Heroes */}
      <View style={[styles.section, { marginTop: spacing.xl }]}>
        <SectionHeader title={t('home.myAvatars', 'Deine Helden')} actionLabel="Alle" onAction={() => navigation.navigate('Tabs', { screen: 'Avatars' })} />
        {avatarsQuery.isLoading ? (
          <View style={[styles.quickRow, { paddingHorizontal: spacing.lg, gap: spacing.base }]}>
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} width={82} height={82} radius={41} />
            ))}
          </View>
        ) : (
          <Rail
            data={avatars}
            keyExtractor={(avatar) => avatar.id}
            itemWidth={92}
            gap={spacing.xs}
            renderItem={(avatar) => <AvatarCard avatar={avatar} variant="bubble" onPress={() => navigation.navigate('AvatarDetail', { avatarId: avatar.id })} />}
            footer={<AddHeroBubble onPress={() => navigation.navigate('AvatarWizard')} />}
          />
        )}
      </View>

      {/* Dokus */}
      {dokus.length > 0 ? (
        <View style={[styles.section, { marginTop: spacing.xl }]}>
          <SectionHeader title="Neu entdeckt" actionLabel="Alle" onAction={() => navigation.navigate('Tabs', { screen: 'Dokus' })} />
          <Rail
            data={dokus.slice(0, 8)}
            keyExtractor={(doku) => doku.id}
            itemWidth={148}
            gap={spacing.base}
            renderItem={(doku) => <DokuTile doku={doku} onPress={() => navigation.navigate('DokuReader', { dokuId: doku.id })} />}
          />
        </View>
      ) : null}

      {/* More */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xxl }}>
        <ListSection header="Mehr entdecken" separatorInset={58}>
          <ListRow
            title="Entdecken"
            subtitle="Geschichten aus der Community"
            leading={<IconSquircle color={tints.blue}><Globe2 size={18} color="#FFFFFF" /></IconSquircle>}
            onPress={() => navigation.navigate('Community')}
          />
          <ListRow
            title="Schatzkammer"
            subtitle="Fundstücke aus euren Abenteuern"
            leading={<IconSquircle color={tints.orange}><Gem size={18} color="#FFFFFF" /></IconSquircle>}
            onPress={() => navigation.navigate('Treasury')}
          />
          <ListRow
            title="Hörbibliothek"
            subtitle="Hörspiele und Audio-Dokus"
            leading={<IconSquircle color={tints.pink}><Headphones size={18} color="#FFFFFF" /></IconSquircle>}
            onPress={() => navigation.navigate('AudioLibrary')}
          />
          <ListRow
            title="Offline-Bibliothek"
            subtitle="Ohne Internet weiterlesen"
            leading={<IconSquircle color={tints.green}><Library size={18} color="#FFFFFF" /></IconSquircle>}
            onPress={() => navigation.navigate('OfflineLibrary')}
          />
        </ListSection>
      </View>
    </Screen>
  );
}

/** App Store "Today"-style featured card with real artwork. */
function FeaturedCard({ onPress, eyebrow }: { onPress: () => void; eyebrow: string }) {
  const { radius, shadows, spacing } = useTheme();

  return (
    <Touchable
      onPress={onPress}
      hapticIntent="medium"
      pressScale={0.98}
      style={[styles.featured, shadows.medium, { borderRadius: radius.xl }]}
      accessibilityRole="button"
      accessibilityLabel="Neue Geschichte erstellen"
    >
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius.xl, overflow: 'hidden' }]}>
        <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" />
        <OverlayGradient colors={['rgba(0,0,0,0.38)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFill} />
      </View>
      <View style={[styles.featuredContent, { padding: spacing.lg }]}>
        <View style={{ gap: 4 }}>
          <Text variant="overline" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {eyebrow}
          </Text>
          <Text variant="displayLg" tone="media" style={{ maxWidth: 300 }}>
            Welches Abenteuer erleben wir heute?
          </Text>
        </View>
        <View style={styles.featuredFooter}>
          <Text variant="bodySm" style={{ color: 'rgba(255,255,255,0.88)', flex: 1 }}>
            Genre wählen, Helden mitnehmen — fertig in wenigen Minuten.
          </Text>
          <Glass tone="dark" borderRadius={20} style={styles.featuredButton}>
            <Text variant="label" tone="media">
              Erstellen
            </Text>
          </Glass>
        </View>
      </View>
    </Touchable>
  );
}

function QuickAction({ label, color, Icon, onPress }: { label: string; color: string; Icon: typeof UserPlus; onPress: () => void }) {
  const { colors, radius, spacing } = useTheme();
  return (
    <Touchable
      onPress={onPress}
      pressScale={0.96}
      style={[styles.quickTile, { borderRadius: radius.lg, backgroundColor: colors.surface.primary, padding: spacing.md, gap: spacing.md }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <IconSquircle color={color} size={34}>
        <Icon size={19} color="#FFFFFF" strokeWidth={2.2} />
      </IconSquircle>
      <Text variant="labelSm" numberOfLines={2}>
        {label}
      </Text>
    </Touchable>
  );
}

function AddHeroBubble({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Touchable onPress={onPress} pressScale={0.93} style={styles.addBubble} accessibilityRole="button" accessibilityLabel="Neuen Avatar erstellen">
      <View style={[styles.addCircle, { backgroundColor: colors.surface.inset }]}>
        <Plus size={28} color={colors.primary} strokeWidth={2.2} />
      </View>
      <Text variant="labelSm" tone="accent" center style={{ marginTop: 8 }}>
        Neu
      </Text>
    </Touchable>
  );
}

function DokuTile({ doku, onPress }: { doku: Doku; onPress: () => void }) {
  const { radius, spacing } = useTheme();
  return (
    <Touchable onPress={onPress} pressScale={0.96} style={{ gap: spacing.sm }} accessibilityLabel={doku.title}>
      <CoverImage uri={doku.coverImageUrl} style={{ aspectRatio: 1 }} radius={radius.md} fallbackGradient="nature" />
      <View style={{ gap: 1, paddingHorizontal: 2 }}>
        <Text variant="labelSm" numberOfLines={2}>
          {doku.title}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {doku.status === 'generating' ? 'Entsteht gerade …' : doku.topic}
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
      style={[styles.offlineBanner, { marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: radius.md, backgroundColor: colors.warningSoft, padding: spacing.md, gap: spacing.sm }]}
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
  tavi: { width: 34, height: 34 },
  featured: { height: 400 },
  featuredContent: { flex: 1, justifyContent: 'space-between' },
  featuredFooter: { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  featuredButton: { height: 40, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  quickRow: { flexDirection: 'row' },
  quickTile: { flex: 1, minHeight: 104, justifyContent: 'space-between' },
  section: { gap: 12 },
  addBubble: { alignItems: 'center', width: 92 },
  addCircle: { width: 82, height: 82, borderRadius: 41, alignItems: 'center', justifyContent: 'center' },
  offlineBanner: { flexDirection: 'row', alignItems: 'center' },
});
