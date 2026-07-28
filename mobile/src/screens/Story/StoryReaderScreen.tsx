import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useKeepAwake } from 'expo-keep-awake';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Check, ChevronLeft, ChevronRight, Download, Headphones, List, Sparkles, Type, X } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useMarkStoryRead, useStory } from '@/hooks/queries';
import { useAudioPlayer } from '@/providers/AudioPlayerProvider';
import { useOffline } from '@/providers/OfflineProvider';
import { useToast } from '@/providers/ToastProvider';
import { storage, StorageKeys } from '@/lib/storage';
import { haptic } from '@/lib/haptics';
import { storyChapters, toParagraphs } from '@/lib/content';
import { readDevelopments } from '@/lib/personality';
import { PageBackground } from '@/components/ui/PageBackground';
import { CoverImage } from '@/components/ui/CoverImage';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { Sheet, type SheetRef } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SkeletonText } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { OverlayGradient } from '@/components/ui/Gradient';
import { GrowthSheet } from './GrowthSheet';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ReaderRoute = RouteProp<RootStackParamList, 'StoryReader'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FONT_SCALES = [0.9, 1, 1.15, 1.3] as const;

/**
 * Story reader.
 *
 * One chapter per horizontally-paged screen — the closest native analogue to
 * turning a page, and far better on a phone than the web's continuous scroll.
 * Chrome auto-hides on read so the illustration and text own the screen; a tap
 * brings it back.
 *
 * On finishing the last chapter the story is marked read and the avatar growth
 * sheet opens, which is where the personality changes earned by this story are
 * shown with the reason for each one.
 */
export function StoryReaderScreen() {
  const { colors, spacing, radius, type } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<ReaderRoute>();
  const toast = useToast();

  const { storyId, startChapter } = route.params;
  const storyQuery = useStory(storyId);
  const markRead = useMarkStoryRead();
  const offline = useOffline();
  const { startStoryConversion, hasStoryInPlaylist } = useAudioPlayer();

  const [chapterIndex, setChapterIndex] = useState(startChapter ?? 0);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [fontScaleIndex, setFontScaleIndex] = useState(1);
  const [showGrowth, setShowGrowth] = useState(false);
  const [isRepeatRead, setIsRepeatRead] = useState(false);

  const pagerRef = useRef<ScrollView>(null);
  const chapterSheetRef = useRef<SheetRef>(null);
  const hasMarkedRead = useRef(false);

  useKeepAwake('talea-reader');

  const offlineCopy = offline.getStory(storyId);
  const story = storyQuery.data;

  // Offline fallback: a saved story reads identically without a network.
  const chapters = useMemo(() => {
    if (story) return storyChapters(story);
    if (offlineCopy) {
      return offlineCopy.chapters.map((chapter) => ({
        id: chapter.id ?? `${storyId}-${chapter.order}`,
        title: chapter.title,
        content: chapter.content,
        imageUrl: chapter.imageUrl,
        order: chapter.order,
      }));
    }
    return [];
  }, [offlineCopy, story, storyId]);

  const title = story?.title ?? offlineCopy?.title ?? '';
  const isGenerating = story?.status === 'generating';

  const fontScale = FONT_SCALES[fontScaleIndex];

  const developments = useMemo(() => readDevelopments(story?.avatarDevelopments), [story?.avatarDevelopments]);

  // Restore the last read position.
  useEffect(() => {
    if (startChapter !== undefined) return;
    void storage
      .getJSON<Record<string, number>>(StorageKeys.readingProgress, {})
      .then((progress) => {
        const saved = progress[storyId];
        if (typeof saved === 'number' && saved > 0) {
          setChapterIndex(saved);
          // Defer so the pager has laid out before we jump.
          requestAnimationFrame(() => pagerRef.current?.scrollTo({ x: saved * SCREEN_WIDTH, animated: false }));
        }
      });
  }, [startChapter, storyId]);

  // Persist position as the reader moves.
  useEffect(() => {
    if (chapters.length === 0) return;
    void storage.getJSON<Record<string, number>>(StorageKeys.readingProgress, {}).then((progress) => {
      void storage.setJSON(StorageKeys.readingProgress, { ...progress, [storyId]: chapterIndex });
    });
  }, [chapterIndex, chapters.length, storyId]);

  const goToChapter = useCallback(
    (index: number) => {
      if (index < 0 || index >= chapters.length) return;
      haptic('light');
      setChapterIndex(index);
      pagerRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    },
    [chapters.length]
  );

  const handleFinish = useCallback(async () => {
    if (hasMarkedRead.current) {
      setShowGrowth(true);
      return;
    }
    if (!title) return;
    hasMarkedRead.current = true;
    haptic('celebrate');

    try {
      const outcome = await markRead.mutateAsync({
        storyId,
        storyTitle: title,
        genre: story?.config?.genre,
        avatarIds: (story?.config?.avatars ?? []).map((avatar) => avatar.id).filter(Boolean),
      });
      // A re-read grants nothing: the server already awarded everything on the
      // first completion. Showing the growth sheet again would promise points
      // the child does not get.
      setIsRepeatRead(outcome.alreadyCompleted);
    } catch {
      // Progress could not be saved — say so instead of celebrating growth
      // that never happened, and allow a retry.
      hasMarkedRead.current = false;
      toast.info('Noch nicht gespeichert', 'Tippe nochmal, sobald du wieder online bist.');
      return;
    }
    setShowGrowth(true);
  }, [markRead, story?.config?.avatars, story?.config?.genre, storyId, title, toast]);

  const handleListen = useCallback(() => {
    if (chapters.length === 0) return;
    startStoryConversion(storyId, title, chapters, story?.coverImageUrl ?? offlineCopy?.coverImageUrl, true);
    toast.info('Hörfassung startet', 'Die ersten Abschnitte werden vorbereitet.');
  }, [chapters, offlineCopy?.coverImageUrl, startStoryConversion, story?.coverImageUrl, title, toast]);

  const handleSaveOffline = useCallback(async () => {
    if (!story) return;
    if (offline.isStorySaved(storyId)) {
      await offline.removeStory(storyId);
      toast.info('Offline-Kopie entfernt');
      return;
    }
    await offline.saveStory({
      id: story.id,
      title: story.title,
      summary: story.summary,
      coverImageUrl: story.coverImageUrl,
      chapters: chapters.map((entry) => ({
        id: entry.id,
        title: entry.title,
        content: entry.content,
        imageUrl: entry.imageUrl,
        order: entry.order,
      })),
    });
    toast.success('Offline gespeichert');
  }, [chapters, offline, story, storyId, toast]);

  // ── Loading / empty states ─────────────────────────────────────────────

  if (storyQuery.isLoading && !offlineCopy) {
    return (
      <View style={[styles.container, { backgroundColor: colors.pageSolid, paddingTop: insets.top + spacing.xxl }]}>
        <PageBackground />
        <View style={{ padding: spacing.base, gap: spacing.lg }}>
          <SkeletonText lines={2} />
          <SkeletonText lines={8} />
        </View>
      </View>
    );
  }

  if (chapters.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.pageSolid, paddingTop: insets.top }]}>
        <PageBackground />
        <ReaderChrome
          visible
          title={title}
          onClose={() => navigation.goBack()}
          insetTop={insets.top}
          actions={null}
        />
        <EmptyState
          icon={<Sparkles size={24} color={colors.primary} />}
          title={isGenerating ? 'Die Geschichte wird noch geschrieben' : 'Diese Geschichte ist leer'}
          description={
            isGenerating
              ? 'Das dauert noch einen Moment. Wir aktualisieren automatisch, sobald sie fertig ist.'
              : 'Es konnten keine Kapitel geladen werden.'
          }
          actionLabel="Zurück"
          onAction={() => navigation.goBack()}
        />
      </View>
    );
  }

  const isLastChapter = chapterIndex === chapters.length - 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.pageSolid }]}>
      <PageBackground />

      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          if (index !== chapterIndex) {
            setChapterIndex(index);
            haptic('selection');
          }
        }}
        style={styles.container}
      >
        {chapters.map((entry, index) => (
          <ScrollView
            key={entry.id ?? index}
            style={{ width: SCREEN_WIDTH }}
            contentContainerStyle={{
              paddingTop: insets.top + 64,
              paddingBottom: insets.bottom + 120,
              paddingHorizontal: spacing.lg,
            }}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={32}
            // Chrome gets out of the way while reading and comes back the moment
            // the reader stops — no tap target competing with the scroll.
            onScrollBeginDrag={() => setChromeVisible(false)}
            onMomentumScrollEnd={() => setChromeVisible(true)}
            onScrollEndDrag={() => setChromeVisible(true)}
          >
            {/* Plain View, deliberately.
                Wrapping the chapter in a Pressable to toggle the chrome made it
                the touch responder for the whole page, which starved both this
                vertical ScrollView and the horizontal pager — the reader
                rendered but neither scrolled nor turned pages. The chrome now
                hides on scroll instead, which is the better reader behaviour
                anyway. */}
            <View style={{ gap: spacing.lg }}>
              {entry.imageUrl ? (
                <CoverImage
                  uri={offline.resolveImage(entry.imageUrl)}
                  style={{ height: 240 }}
                  radius={radius.lg}
                  fallbackGradient="sunset"
                />
              ) : null}

              <View style={{ gap: 4 }}>
                <Text variant="overline" tone="tertiary">
                  Kapitel {index + 1} von {chapters.length}
                </Text>
                <Text variant="displaySm">{entry.title}</Text>
              </View>

              <View style={{ gap: spacing.base }}>
                {toParagraphs(entry.content).map((paragraph, paragraphIndex) => (
                  <Text
                    key={paragraphIndex}
                    style={[
                      type.reading,
                      {
                        fontSize: type.reading.fontSize! * fontScale,
                        lineHeight: type.reading.lineHeight! * fontScale,
                      },
                    ]}
                  >
                    {paragraph}
                  </Text>
                ))}
              </View>

              {index === chapters.length - 1 ? (
                <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
                  <Button
                    label="Geschichte beenden"
                    onPress={handleFinish}
                    icon={<Check size={17} color={colors.primaryForeground} />}
                    size="lg"
                    fullWidth
                    hapticIntent="celebrate"
                  />
                </View>
              ) : null}
            </View>
          </ScrollView>
        ))}
      </ScrollView>

      <ReaderChrome
        visible={chromeVisible}
        title={title}
        onClose={() => navigation.goBack()}
        insetTop={insets.top}
        actions={
          <>
            <ChromeButton
              onPress={() => setFontScaleIndex((index) => (index + 1) % FONT_SCALES.length)}
              accessibilityLabel="Schriftgröße ändern"
            >
              <Type size={17} color={colors.text.primary} />
            </ChromeButton>
            <ChromeButton onPress={handleListen} accessibilityLabel="Anhören">
              <Headphones size={17} color={hasStoryInPlaylist(storyId) ? colors.primary : colors.text.primary} />
            </ChromeButton>
            <ChromeButton onPress={() => void handleSaveOffline()} accessibilityLabel="Offline speichern">
              <Download size={17} color={offline.isStorySaved(storyId) ? colors.primary : colors.text.primary} />
            </ChromeButton>
            <ChromeButton onPress={() => chapterSheetRef.current?.expand()} accessibilityLabel="Kapitelübersicht">
              <List size={17} color={colors.text.primary} />
            </ChromeButton>
          </>
        }
      />

      {chromeVisible ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(160)}
          style={[
            styles.bottomBar,
            {
              paddingBottom: insets.bottom + spacing.md,
              paddingHorizontal: spacing.base,
              paddingTop: spacing.md,
              backgroundColor: colors.surface.panel,
              borderTopColor: colors.border.light,
              gap: spacing.sm,
            },
          ]}
        >
          <ProgressBar progress={(chapterIndex + 1) / chapters.length} height={4} />

          <View style={styles.bottomRow}>
            <ChromeButton
              onPress={() => goToChapter(chapterIndex - 1)}
              disabled={chapterIndex === 0}
              accessibilityLabel="Vorheriges Kapitel"
            >
              <ChevronLeft size={20} color={chapterIndex === 0 ? colors.text.muted : colors.text.primary} />
            </ChromeButton>

            <Text variant="caption" tone="secondary">
              {chapterIndex + 1} / {chapters.length}
            </Text>

            <ChromeButton
              onPress={() => (isLastChapter ? void handleFinish() : goToChapter(chapterIndex + 1))}
              accessibilityLabel={isLastChapter ? 'Geschichte beenden' : 'Nächstes Kapitel'}
            >
              {isLastChapter ? (
                <Check size={20} color={colors.primary} />
              ) : (
                <ChevronRight size={20} color={colors.text.primary} />
              )}
            </ChromeButton>
          </View>
        </Animated.View>
      ) : null}

      <Sheet ref={chapterSheetRef} snapPoints={['55%']} title="Kapitel" subtitle={title}>
        <View style={{ gap: spacing.xs }}>
          {chapters.map((entry, index) => (
            <Touchable
              key={entry.id ?? index}
              onPress={() => {
                chapterSheetRef.current?.close();
                goToChapter(index);
              }}
              style={[
                styles.chapterRow,
                {
                  borderRadius: radius.md,
                  padding: spacing.md,
                  gap: spacing.md,
                  backgroundColor: index === chapterIndex ? colors.surface.item : 'transparent',
                },
              ]}
            >
              <Text variant="labelSm" tone="tertiary" style={{ width: 22 }}>
                {index + 1}
              </Text>
              <Text variant="label" tone={index === chapterIndex ? 'accent' : 'primary'} numberOfLines={2} style={{ flex: 1 }}>
                {entry.title}
              </Text>
            </Touchable>
          ))}
        </View>
      </Sheet>

      <GrowthSheet
        open={showGrowth}
        storyTitle={title}
        developments={developments}
        isRepeat={isRepeatRead}
        onClose={() => {
          setShowGrowth(false);
          navigation.goBack();
        }}
      />
    </View>
  );
}

function ReaderChrome({
  visible,
  title,
  onClose,
  actions,
  insetTop,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  actions: React.ReactNode;
  insetTop: number;
}) {
  const { colors, spacing } = useTheme();

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(160)}
      style={[styles.topBar, { paddingTop: insetTop + spacing.sm, paddingHorizontal: spacing.base, gap: spacing.sm }]}
    >
      <OverlayGradient colors={colors.media.overlay} style={StyleSheet.absoluteFill} />
      <ChromeButton onPress={onClose} accessibilityLabel="Schließen">
        <X size={18} color={colors.text.primary} />
      </ChromeButton>
      <Text variant="labelSm" numberOfLines={1} style={{ flex: 1 }}>
        {title}
      </Text>
      {actions}
    </Animated.View>
  );
}

function ChromeButton({
  children,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  const { colors, radius } = useTheme();

  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.chromeButton,
        { borderRadius: radius.pill, backgroundColor: colors.surface.primary, borderColor: colors.border.light },
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
  },
  chromeButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chapterRow: { flexDirection: 'row', alignItems: 'center' },
});
