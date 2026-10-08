import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTranslation } from 'react-i18next';
import { ArrowUpDown, BookOpen, Download, Headphones, Heart, Plus, Search, Trash2, X } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useDeleteStory, useStories } from '@/hooks/queries';
import { useAudioPlayer } from '@/providers/AudioPlayerProvider';
import { useOffline } from '@/providers/OfflineProvider';
import { useToast } from '@/providers/ToastProvider';
import { Screen, TAB_BAR_CLEARANCE } from '@/components/ui/Screen';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { Sheet, type SheetRef } from '@/components/ui/Sheet';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { HeaderAction, ScreenHeader } from '@/components/ui/ScreenHeader';
import { FloatingAction } from '@/components/ui/FloatingAction';
import { genreMeta } from '@/lib/genres';
import { StoryCard } from '@/components/cards/StoryCard';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import type { Story } from '@/types/story';
import type { RootStackParamList } from '@/navigation/types';
import { useBackend } from '@/api/backend';
import { exportBook } from '@/lib/exportBook';
import { storyChapters } from '@/lib/content';
import { ContentManagement } from '@/components/ContentManagement';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type SortMode = 'recent' | 'title' | 'unread';

const GENRE_FILTERS = [
  { id: 'all', label: 'Alle' },
  { id: 'fairy_tales', label: 'Märchen' },
  { id: 'adventure', label: 'Abenteuer' },
  { id: 'magic', label: 'Magie' },
  { id: 'animals', label: 'Tiere' },
  { id: 'scifi', label: 'Sci-Fi' },
  { id: 'modern', label: 'Alltag' },
] as const;

/**
 * Story library.
 *
 * Uses FlashList rather than FlatList because a heavy user accumulates hundreds
 * of image-backed cards, and FlashList's recycling keeps that at 60fps.
 * Long-press opens the per-story action sheet (read, listen, save offline,
 * delete) — the mobile equivalent of the web's hover actions.
 */
export function StoriesScreen() {
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const toast = useToast();
  const backend = useBackend();

  const storiesQuery = useStories();
  const deleteStory = useDeleteStory();
  const { startStoryConversion, hasStoryInPlaylist } = useAudioPlayer();
  const offline = useOffline();

  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [genre, setGenre] = useState<string>('all');
  const [sort, setSort] = useState<SortMode>('recent');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Story | null>(null);

  const actionSheetRef = useRef<SheetRef>(null);

  const stories = storiesQuery.data ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    const matched = stories.filter((story) => {
      if (onlyFavorites && !(story as any).profileState?.isFavorite) return false;
      if (onlyUnread && (story as any).profileState?.completionState === 'completed') return false;
      if (genre !== 'all' && story.config?.genre !== genre) return false;
      if (!term) return true;
      return (
        story.title.toLowerCase().includes(term) ||
        (story.summary ?? '').toLowerCase().includes(term) ||
        (story.config?.avatars ?? []).some((avatar) => avatar.name?.toLowerCase().includes(term))
      );
    });

    return matched.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      return new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime();
    });
  }, [genre, search, sort, stories, onlyFavorites, onlyUnread]);

  const librarySummary = useMemo(() => {
    const writing = stories.filter((story) => story.status === 'generating').length;
    const count = `${stories.length} ${stories.length === 1 ? 'Geschichte' : 'Geschichten'}`;
    return writing > 0 ? `${count} · ${writing} ${writing === 1 ? 'entsteht' : 'entstehen'} gerade` : count;
  }, [stories]);

  const openActions = useCallback((story: Story) => {
    setSelectedStory(story);
    actionSheetRef.current?.expand();
  }, []);

  const handleListen = useCallback(
    async (summary: Story) => {
      actionSheetRef.current?.close();
      try {
      const story = await backend.story.get({ id: summary.id }) as Story;
      const chapters = storyChapters(story);
      if (chapters.length === 0) {
        toast.warning('Noch keine Kapitel', 'Diese Geschichte ist noch nicht fertig.');
        return;
      }
      actionSheetRef.current?.close();
      startStoryConversion(story.id, story.title, chapters, story.coverImageUrl, true);
      toast.info('Hörfassung startet', 'Die ersten Abschnitte werden vorbereitet.');
      } catch (error) { toast.error('Hörfassung konnte nicht geladen werden', error instanceof Error ? error.message : undefined); }
    },
    [backend.story, startStoryConversion, toast]
  );

  const handleSaveOffline = useCallback(
    async (summary: Story) => {
      actionSheetRef.current?.close();
      try {
      if (offline.isStorySaved(summary.id)) {
        await offline.removeStory(summary.id); toast.info('Aus Offline-Bibliothek entfernt'); return;
      }
      const story = await backend.story.get({ id: summary.id }) as Story;
      const chapters = storyChapters(story);
      if (chapters.length === 0) {
        toast.warning('Noch nichts zu speichern', 'Diese Geschichte ist noch nicht fertig.');
        return;
      }

      if (offline.isStorySaved(story.id)) {
        await offline.removeStory(story.id);
        toast.info('Aus Offline-Bibliothek entfernt');
        return;
      }

      await offline.saveStory({
        id: story.id,
        title: story.title,
        summary: story.summary,
        coverImageUrl: story.coverImageUrl,
        chapters: chapters.map((chapter) => ({
          id: chapter.id,
          title: chapter.title,
          content: chapter.content,
          imageUrl: chapter.imageUrl ?? chapter.scenicImageUrl,
          order: chapter.order,
        })),
      });
      toast.success('Offline gespeichert', 'Diese Geschichte funktioniert jetzt auch ohne Internet.');
      } catch (error) { toast.error('Offline-Speichern fehlgeschlagen', error instanceof Error ? error.message : undefined); }
    },
    [backend.story, offline, toast]
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const story = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteStory.mutateAsync(story.id);
      toast.success('Geschichte gelöscht');
    } catch (error) {
      toast.error('Löschen fehlgeschlagen', error instanceof Error ? error.message : undefined);
    }
  }, [deleteStory, pendingDelete, toast]);

  return (
    <Screen scroll={false} padded={false} tabBarClearance playerClearance>
      <ScreenHeader
        eyebrow="Deine Bibliothek"
        title={t('navigation.stories', 'Geschichten')}
        subtitle={librarySummary}
        showBack={false}
        large
        actions={
          <HeaderAction
            onPress={() => {
              setShowSearch((value) => !value);
              if (showSearch) setSearch('');
            }}
            accessibilityLabel={showSearch ? 'Suche schließen' : 'Suchen'}
          >
            {showSearch ? <X size={19} color={colors.text.primary} /> : <Search size={19} color={colors.text.primary} />}
          </HeaderAction>
        }
      />

      {showSearch ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Titel, Inhalt oder Avatar suchen"
            autoFocus
            returnKeyType="search"
            icon={<Search size={17} color={colors.text.tertiary} />}
          />
        </View>
      ) : null}

      <FlashList
        data={filtered}
        keyExtractor={(story) => story.id}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: TAB_BAR_CLEARANCE + spacing.huge + spacing.xl }}
        showsVerticalScrollIndicator={false}
        refreshing={storiesQuery.isRefetching}
        onRefresh={() => void storiesQuery.refetch()}
        ListHeaderComponent={
          // A plain ScrollView rather than a nested list: a handful of fixed
          // chips do not need virtualisation, and a virtualised list inside
          // another list's header is a recycling hazard.
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.sm, gap: spacing.sm, paddingTop: spacing.xs, paddingBottom: spacing.md }}
          >
            {GENRE_FILTERS.map((filter) => {
              const meta = genreMeta(filter.id);
              return (
                <Chip
                  key={filter.id}
                  label={filter.label}
                  selected={genre === filter.id}
                  onPress={() => setGenre(filter.id)}
                  icon={meta && genre !== filter.id ? <View style={[styles.dot, { backgroundColor: meta.hue }]} /> : undefined}
                />
              );
            })}

            <View style={[styles.divider, { backgroundColor: colors.border.soft }]} />
            <Chip
              label="Favoriten"
              selected={onlyFavorites}
              onPress={() => setOnlyFavorites(!onlyFavorites)}
              icon={<Heart size={13} color={onlyFavorites ? colors.primaryForeground : colors.accent.rose} fill={onlyFavorites ? colors.primaryForeground : 'transparent'} />}
            />
            <Chip label="Ungelesen" selected={onlyUnread} onPress={() => setOnlyUnread(!onlyUnread)} />
            <Chip
              label={sort === 'recent' ? 'Neueste' : 'A–Z'}
              icon={<ArrowUpDown size={12} color={colors.text.secondary} />}
              onPress={() => setSort((current) => (current === 'recent' ? 'title' : 'recent'))}
            />
          </ScrollView>
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1, padding: spacing.xs + 2 }}>
            <StoryCard
              story={item}
              onPress={() => navigation.navigate('StoryReader', { storyId: item.id })}
              onLongPress={() => openActions(item)}
            />
          </View>
        )}
        ListEmptyComponent={
          storiesQuery.isLoading ? (
            <View style={{ paddingHorizontal: spacing.sm, gap: spacing.lg, paddingTop: spacing.md }}>
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : storiesQuery.isError ? <EmptyState title="Geschichten konnten nicht geladen werden" actionLabel="Erneut versuchen" onAction={() => void storiesQuery.refetch()} /> : (
            <EmptyState
              illustration={search || genre !== 'all' ? undefined : 'tavi'}
              icon={<Search size={26} color={colors.primary} />}
              title={search || genre !== 'all' ? 'Nichts gefunden' : 'Noch keine Geschichten'}
              description={
                search || genre !== 'all'
                  ? 'Versuche einen anderen Suchbegriff oder Filter.'
                  : 'Erstelle deine erste Geschichte und sieh zu, wie deine Avatare wachsen.'
              }
              actionLabel={search || genre !== 'all' ? 'Filter zurücksetzen' : 'Geschichte erstellen'}
              onAction={() => {
                if (search || genre !== 'all') {
                  setSearch('');
                  setGenre('all');
                } else {
                  navigation.navigate('StoryWizard');
                }
              }}
            />
          )
        }
      />

      <FloatingAction
        label="Neue Geschichte"
        icon={<Plus size={20} color={colors.primaryForeground} strokeWidth={2.6} />}
        onPress={() => navigation.navigate('StoryWizard')}
      />

      <Sheet ref={actionSheetRef} snapPoints={['65%']} title={selectedStory?.title}>
        <View style={{ gap: spacing.xs }}>
          <SheetAction
            icon={<BookOpen size={18} color={colors.text.secondary} />}
            label="Lesen"
            onPress={() => {
              actionSheetRef.current?.close();
              if (selectedStory) navigation.navigate('StoryReader', { storyId: selectedStory.id });
            }}
          />
          <SheetAction
            icon={<Headphones size={18} color={colors.text.secondary} />}
            label={selectedStory && hasStoryInPlaylist(selectedStory.id) ? 'In der Warteschlange' : 'Anhören'}
            onPress={() => selectedStory && handleListen(selectedStory)}
          />
          <SheetAction
            icon={<Download size={18} color={colors.text.secondary} />}
            label={selectedStory && offline.isStorySaved(selectedStory.id) ? 'Offline-Kopie entfernen' : 'Offline speichern'}
            onPress={() => selectedStory && void handleSaveOffline(selectedStory)}
          />
          <SheetAction
            icon={<Download size={18} color={colors.text.secondary} />}
            label="Als PDF exportieren"
            onPress={async () => {
              actionSheetRef.current?.close();
              if (!selectedStory) return;
              try { const story = await backend.story.get({ id: selectedStory.id }) as Story;
                await exportBook({ title: story.title, summary: story.summary, coverImageUrl: story.coverImageUrl, sections: storyChapters(story) }); }
              catch (error) { toast.error('PDF-Export fehlgeschlagen', error instanceof Error ? error.message : undefined); }
            }}
          />
          <SheetAction
            icon={<Trash2 size={18} color={colors.danger} />}
            label="Löschen"
            destructive
            onPress={() => {
              actionSheetRef.current?.close();
              setPendingDelete(selectedStory);
            }}
          />
          {selectedStory ? <ContentManagement kind="story" content={stories.find((item) => item.id === selectedStory.id) ?? selectedStory} refresh={() => storiesQuery.refetch()} /> : null}
        </View>
      </Sheet>

      <ConfirmSheet
        open={Boolean(pendingDelete)}
        title="Geschichte löschen?"
        message={`„${pendingDelete?.title ?? ''}“ wird dauerhaft entfernt. Die Entwicklung deiner Avatare bleibt erhalten.`}
        confirmLabel="Löschen"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </Screen>
  );
}

export function SheetAction({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const { colors, spacing, radius } = useTheme();

  return (
    <Touchable
      onPress={onPress}
      style={[
        styles.sheetAction,
        {
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          gap: spacing.md,
          backgroundColor: destructive ? colors.dangerSoft : colors.surface.primary,
          borderColor: destructive ? 'transparent' : colors.border.light,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.sheetIcon, { backgroundColor: destructive ? 'transparent' : colors.primarySoft }]}>{icon}</View>
      <Text variant="label" tone={destructive ? 'danger' : 'primary'} style={{ flex: 1 }}>
        {label}
      </Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  sheetAction: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  sheetIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  divider: { width: 1, height: 22, alignSelf: 'center', marginHorizontal: 2 },
});
