import React, { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useUser } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowRight, Bot, Globe2, Map, Plus, Settings2, Sparkles, UserPlus, WifiOff } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useAvatars, useDokus, useStories } from '@/hooks/queries';
import { useOptionalChildProfiles } from '@/providers/ChildProfilesProvider';
import { useOffline } from '@/providers/OfflineProvider';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { Gradient } from '@/components/ui/Gradient';
import { CoverImage } from '@/components/ui/CoverImage';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { HeaderAction } from '@/components/ui/ScreenHeader';
import { StoryCard } from '@/components/cards/StoryCard';
import { AvatarCard } from '@/components/cards/AvatarCard';
import { ProfileSwitcher } from '@/components/profile/ProfileSwitcher';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Home.
 *
 * The web home page is a long dashboard; on mobile the hierarchy is tighter:
 * one primary action (create a story), then "continue where you left off",
 * then the avatar rail. Everything below the fold is discovery.
 */
export function HomeScreen() {
  const { colors, spacing, radius } = useTheme();
  const navigation = useNavigation<Nav>();
  const { user } = useUser();
  const { t } = useTranslation();
  const { isOnline } = useOffline();
  const childProfiles = useOptionalChildProfiles();

  const storiesQuery = useStories();
  const avatarsQuery = useAvatars();
  const dokusQuery = useDokus();

  const isLoading = storiesQuery.isLoading || avatarsQuery.isLoading;

  const onRefresh = useCallback(async () => {
    await Promise.all([storiesQuery.refetch(), avatarsQuery.refetch(), dokusQuery.refetch()]);
  }, [avatarsQuery, dokusQuery, storiesQuery]);

  const stories = storiesQuery.data ?? [];
  const avatars = avatarsQuery.data ?? [];
  const dokus = dokusQuery.data ?? [];

  const recentStories = useMemo(
    () =>
      [...stories]
        .filter((story) => story.status !== 'error')
        .sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())
        .slice(0, 6),
    [stories]
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Guten Morgen';
    if (hour < 18) return 'Hallo';
    return 'Guten Abend';
  }, []);

  const displayName = childProfiles?.activeProfile?.name ?? user?.firstName ?? 'du';

  return (
    <Screen tabBarClearance playerClearance onRefresh={onRefresh} refreshing={storiesQuery.isRefetching} padded={false}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: spacing.base, paddingTop: spacing.sm, gap: spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" tone="tertiary">
            {greeting}
          </Text>
          <Text variant="displaySm" numberOfLines={1}>
            {displayName}
          </Text>
        </View>

        <HeaderAction onPress={() => navigation.navigate('Community')} accessibilityLabel="Entdecken">
          <Globe2 size={19} color={colors.text.primary} />
        </HeaderAction>
        <HeaderAction onPress={() => navigation.navigate('Tavi')} accessibilityLabel="Tavi öffnen">
          <Bot size={19} color={colors.text.primary} />
        </HeaderAction>
        <HeaderAction onPress={() => navigation.navigate('Settings')} accessibilityLabel="Einstellungen">
          <Settings2 size={19} color={colors.text.primary} />
        </HeaderAction>
      </View>

      {!isOnline ? (
        <Touchable
          onPress={() => navigation.navigate('OfflineLibrary')}
          style={[
            styles.offlineBanner,
            {
              marginHorizontal: spacing.base,
              marginTop: spacing.sm,
              borderRadius: radius.md,
              backgroundColor: colors.warningSoft,
              padding: spacing.md,
              gap: spacing.sm,
            },
          ]}
        >
          <WifiOff size={16} color={colors.warning} />
          <Text variant="labelSm" tone="warning" style={{ flex: 1 }}>
            Offline — gespeicherte Geschichten öffnen
          </Text>
          <ArrowRight size={15} color={colors.warning} />
        </Touchable>
      ) : null}

      {childProfiles && childProfiles.profiles.length > 1 ? (
        <View style={{ marginTop: spacing.base }}>
          <ProfileSwitcher />
        </View>
      ) : null}

      {/* Primary actions */}
      <Animated.View
        entering={FadeInDown.duration(420)}
        style={{ paddingHorizontal: spacing.base, marginTop: spacing.lg, gap: spacing.sm }}
      >
        <Touchable
          onPress={() => navigation.navigate('StoryWizard')}
          hapticIntent="medium"
          style={[styles.primaryAction, { borderRadius: radius.xl }]}
          accessibilityLabel={t('home.createStory', 'Neue Geschichte erstellen')}
        >
          <Gradient token={colors.gradient.action} style={StyleSheet.absoluteFill} />
          <View style={{ flex: 1, padding: spacing.lg, gap: 4 }}>
            <Text variant="headingSm" tone="inverse">
              {t('home.createStory', 'Neue Geschichte')}
            </Text>
            <Text variant="bodySm" style={{ color: 'rgba(255,255,255,0.86)' }}>
              Genre wählen, Avatare mitnehmen — fertig in wenigen Minuten.
            </Text>
          </View>
          <View style={[styles.primaryActionIcon, { borderRadius: radius.pill }]}>
            <Sparkles size={22} color={colors.primaryForeground} />
          </View>
        </Touchable>

        <View style={[styles.quickRow, { gap: spacing.sm }]}>
          <QuickAction
            icon={<UserPlus size={18} color={colors.accent.lavender} />}
            label="Avatar erstellen"
            onPress={() => navigation.navigate('AvatarWizard')}
          />
          <QuickAction
            icon={<Map size={18} color={colors.accent.mint} />}
            label="Lernkarte"
            onPress={() => navigation.navigate('Journey')}
          />
          <QuickAction
            icon={<Plus size={18} color={colors.accent.peach} />}
            label="Doku"
            onPress={() => navigation.navigate('DokuWizard')}
          />
        </View>
      </Animated.View>

      {/* Continue reading */}
      <Section
        title={t('home.recentStories', 'Weiterlesen')}
        actionLabel="Alle"
        onAction={() => navigation.navigate('Tabs', { screen: 'Stories' })}
      >
        {isLoading ? (
          <View style={{ paddingHorizontal: spacing.base, gap: spacing.md }}>
            <SkeletonCard height={150} />
          </View>
        ) : recentStories.length === 0 ? (
          <View style={{ paddingHorizontal: spacing.base }}>
            <EmptyState
              icon={<Sparkles size={24} color={colors.primary} />}
              title="Noch keine Geschichte"
              description="Erstelle deine erste Geschichte — sie dauert nur ein paar Minuten."
              actionLabel="Geschichte erstellen"
              onAction={() => navigation.navigate('StoryWizard')}
              compact
            />
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.base, gap: spacing.md }}
            snapToInterval={252}
            decelerationRate="fast"
          >
            {recentStories.map((story) => (
              <View key={story.id} style={{ width: 240 }}>
                <StoryCard story={story} onPress={() => navigation.navigate('StoryReader', { storyId: story.id })} />
              </View>
            ))}
          </ScrollView>
        )}
      </Section>

      {/* Avatars */}
      <Section
        title={t('home.myAvatars', 'Deine Avatare')}
        actionLabel="Alle"
        onAction={() => navigation.navigate('Tabs', { screen: 'Avatars' })}
      >
        {avatarsQuery.isLoading ? (
          <View style={{ paddingHorizontal: spacing.base }}>
            <SkeletonCard height={120} />
          </View>
        ) : avatars.length === 0 ? (
          <View style={{ paddingHorizontal: spacing.base }}>
            <EmptyState
              icon={<UserPlus size={24} color={colors.accent.lavender} />}
              title="Noch kein Avatar"
              description="Avatare sind die Helden deiner Geschichten — und sie entwickeln sich mit jedem Abenteuer."
              actionLabel="Avatar erstellen"
              onAction={() => navigation.navigate('AvatarWizard')}
              compact
            />
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.base, gap: spacing.md }}
          >
            {avatars.map((avatar) => (
              <View key={avatar.id} style={{ width: 158 }}>
                <AvatarCard avatar={avatar} onPress={() => navigation.navigate('AvatarDetail', { avatarId: avatar.id })} />
              </View>
            ))}
          </ScrollView>
        )}
      </Section>

      {/* Dokus */}
      {dokus.length > 0 ? (
        <Section
          title="Zuletzt entdeckt"
          actionLabel="Alle"
          onAction={() => navigation.navigate('Tabs', { screen: 'Dokus' })}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.base, gap: spacing.md }}
          >
            {dokus.slice(0, 6).map((doku) => (
              <Touchable
                key={doku.id}
                onPress={() => navigation.navigate('DokuReader', { dokuId: doku.id })}
                style={{ width: 172 }}
              >
                <Card padded={false} style={{ overflow: 'hidden' }}>
                  <CoverImage uri={doku.coverImageUrl} style={{ height: 104 }} radius={0} fallbackGradient="nature" />
                  <View style={{ padding: spacing.md, gap: 2 }}>
                    <Text variant="labelSm" numberOfLines={2}>
                      {doku.title}
                    </Text>
                    <Chip label={doku.topic} size="sm" style={{ marginTop: 4 }} />
                  </View>
                </Card>
              </Touchable>
            ))}
          </ScrollView>
        </Section>
      ) : null}
    </Screen>
  );
}

function Section({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  const { spacing } = useTheme();

  return (
    <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
      <View style={[styles.sectionHeader, { paddingHorizontal: spacing.base }]}>
        <Text variant="headingSm" style={{ flex: 1 }}>
          {title}
        </Text>
        {actionLabel && onAction ? (
          <Touchable onPress={onAction} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }} hapticIntent="light">
            <Text variant="labelSm" tone="accent">
              {actionLabel}
            </Text>
            <ArrowRight size={13} color={undefined} />
          </Touchable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  const { colors, spacing, radius } = useTheme();

  return (
    <Touchable
      onPress={onPress}
      style={[
        styles.quickAction,
        {
          borderRadius: radius.lg,
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.light,
          paddingVertical: spacing.md,
          gap: 6,
        },
      ]}
      accessibilityLabel={label}
    >
      {icon}
      <Text variant="caption" tone="secondary" center numberOfLines={1}>
        {label}
      </Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  offlineBanner: { flexDirection: 'row', alignItems: 'center' },
  primaryAction: { flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  primaryActionIcon: {
    width: 52,
    height: 52,
    marginRight: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  quickRow: { flexDirection: 'row' },
  quickAction: { flex: 1, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  sectionHeader: { flexDirection: 'row', alignItems: 'center' },
});
