import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { ArrowUpDown, BookOpen, Download, Headphones, Plus, Search, Trash2, X } from 'lucide-react-native';

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
import { Sheet } from '@/components/ui/Sheet';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { HeaderAction, ScreenHeader } from '@/components/ui/ScreenHeader';
import { StoryCard } from '@/components/cards/StoryCard';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import type { Story } from '@/types/story';
import type { RootStackParamList } from '@/navigation/types';

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

  const storiesQuery = useStories();
  const deleteStory = useDeleteStory();
  const { startStoryConversion, hasStoryInPlaylist } = useAudioPlayer();
  const offline = useOffline();

  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [genre, setGenre] = useState<string>('all');
  const [sort, setSort] = useState<SortMode>('recent');
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Story | null>(null);

  const actionSheetRef = useRef<BottomSheet>(null);

  const stories = storiesQuery.data ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    const matched = stories.filter((story) => {
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
  }, [genre, search, sort, stories]);

  const openActions = useCallback((story: Story) => {
    setSelectedStory(story);
    actionSheetRef.current?.expand();
  }, []);

  const handleListen = useCallback(
    (story: Story) => {
      const chapters = story.chapters ?? story.pages ?? [];
      if (chapters.length === 0) {
        toast.warning('Noch keine Kapitel', 'Diese Geschichte ist noch nicht fertig.');
        return;
      }
      actionSheetRef.current?.close();
      startStoryConversion(story.id, story.title, chapters, story.coverImageUrl, true);
      toast.info('Hörfassung startet', 'Die ersten Abschnitte werden vorbereitet.');
    },
    [startStoryConversion, toast]
  );

  const handleSaveOffline = useCallback(
    async (story: Story) => {
      actionSheetRef.current?.close();
      const chapters = story.chapters ?? story.pages ?? [];
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
    },
    [offline, toast]
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
        title={t('navigation.stories', 'Geschichten')}
        subtitle={`${stories.length} ${stories.length === 1 ? 'Geschichte' : 'Geschichten'}`}
        showBack={false}
        large
        actions={
          <>
            <HeaderAction
              onPress={() => {
                setShowSearch((value) => !value);
                if (showSearch) setSearch('');
              }}
              accessibilityLabel={showSearch ? 'Suche schließen' : 'Suchen'}
            >
              {showSearch ? <X size={18} color={colors.text.primary} /> : <Search size={18} color={colors.text.primary} />}
            </HeaderAction>
            <HeaderAction onPress={() => navigation.navigate('StoryWizard')} accessibilityLabel="Neue Geschichte">
              <Plus size={19} color={colors.text.primary} />
            </HeaderAction>
          </>
        }
      />

      {showSearch ? (
        <View style={{ paddingHorizontal: spacing.base, paddingBottom: spacing.sm }}>
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Titel, Zusammenfassung oder Avatar"
            autoFocus
            returnKeyType="search"
            icon={<Search size={16} color={colors.text.tertiary} />}
          />
        </View>
      ) : null}

      <FlashList
        data={filtered}
        keyExtractor={(story) => story.id}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingBottom: TAB_BAR_CLEARANCE + spacing.xxl }}
        showsVerticalScrollIndicator={false}
        refreshing={storiesQuery.isRefetching}
        onRefresh={() => void storiesQuery.refetch()}
        ListHeaderComponent={
          // A plain ScrollView rather than a nested list: seven fixed chips do
          // not need virtualisation, and a virtualised list inside another
          // list's header is a recycling hazard.
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.sm, gap: spacing.xs, paddingVertical: spacing.sm }}
          >
            {GENRE_FILTERS.map((filter) => (
              <Chip key={filter.id} label={filter.label} selected={genre === filter.id} onPress={() => setGenre(filter.id)} />
            ))}

            <View style={{ width: spacing.sm }} />
            <Chip
              label={sort === 'recent' ? 'Neueste' : 'A–Z'}
              icon={<ArrowUpDown size={11} color={colors.text.secondary} />}
              onPress={() => setSort((current) => (current === 'recent' ? 'title' : 'recent'))}
            />
          </ScrollView>
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1, padding: spacing.xs }}>
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
          ) : (
            <EmptyState
              icon={<BookOpen size={24} color={colors.primary} />}
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

      <Sheet ref={actionSheetRef} snapPoints={['42%']} title={selectedStory?.title} scrollable={false}>
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
            icon={<Trash2 size={18} color={colors.danger} />}
            label="Löschen"
            destructive
            onPress={() => {
              actionSheetRef.current?.close();
              setPendingDelete(selectedStory);
            }}
          />
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
        { borderRadius: radius.md, padding: spacing.md, gap: spacing.md, backgroundColor: colors.surface.inset },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon}
      <Text variant="label" tone={destructive ? 'danger' : 'primary'}>
        {label}
      </Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  sheetAction: { flexDirection: 'row', alignItems: 'center' },
});
