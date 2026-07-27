import React, { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useKeepAwake } from 'expo-keep-awake';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Download, Headphones, Lightbulb, List, Sparkles, Wrench } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useDoku } from '@/hooks/queries';
import { useAudioPlayer } from '@/providers/AudioPlayerProvider';
import { useOffline } from '@/providers/OfflineProvider';
import { useToast } from '@/providers/ToastProvider';
import { dokuPlainText, toParagraphs } from '@/lib/content';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { CoverImage } from '@/components/ui/CoverImage';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { Sheet, type SheetRef } from '@/components/ui/Sheet';
import { SkeletonText } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { HeaderAction, ScreenHeader } from '@/components/ui/ScreenHeader';
import type { DokuSection } from '@/types/doku';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ReaderRoute = RouteProp<RootStackParamList, 'DokuReader'>;

/**
 * Doku reader.
 *
 * Vertical scroll rather than the story reader's paging: dokus are reference
 * material with facts and activities that the reader jumps between, not a linear
 * narrative. Key facts and hands-on ideas are rendered as distinct blocks so
 * they stay scannable.
 */
export function DokuReaderScreen() {
  const { colors, spacing, radius, type } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<ReaderRoute>();
  const toast = useToast();

  const { dokuId } = route.params;
  const dokuQuery = useDoku(dokuId);
  const offline = useOffline();
  const { startDokuConversion, hasDokuInPlaylist } = useAudioPlayer();
  const sectionSheetRef = useRef<SheetRef>(null);

  useKeepAwake('talea-doku-reader');

  const offlineCopy = offline.getDoku(dokuId);
  const doku = dokuQuery.data;

  // The offline copy stores prose and images only (facts and interactive blocks
  // are not mirrored), so it is widened to the full section shape with those
  // parts absent rather than producing a second, narrower type.
  const sections = useMemo<DokuSection[]>(() => {
    if (doku?.content?.sections?.length) return doku.content.sections;
    if (offlineCopy) {
      return offlineCopy.sections.map((section) => ({
        title: section.title,
        content: section.content,
        imageUrl: section.imageUrl,
        keyFacts: [],
      }));
    }
    return [];
  }, [doku, offlineCopy]);

  const title = doku?.title ?? offlineCopy?.title ?? '';

  const handleListen = useCallback(() => {
    const text = doku ? dokuPlainText(doku) : sections.map((section) => `${section.title}\n\n${section.content}`).join('\n\n');
    if (!text) {
      toast.warning('Noch kein Inhalt');
      return;
    }
    startDokuConversion(dokuId, title, text, doku?.coverImageUrl ?? offlineCopy?.coverImageUrl, true);
    toast.info('Hörfassung startet');
  }, [doku, dokuId, offlineCopy?.coverImageUrl, sections, startDokuConversion, title, toast]);

  const handleSaveOffline = useCallback(async () => {
    if (!doku?.content?.sections?.length) return;
    if (offline.isDokuSaved(dokuId)) {
      await offline.removeDoku(dokuId);
      toast.info('Offline-Kopie entfernt');
      return;
    }
    await offline.saveDoku({
      id: doku.id,
      title: doku.title,
      topic: doku.topic,
      coverImageUrl: doku.coverImageUrl,
      sections: doku.content.sections.map((section, index) => ({
        title: section.title,
        content: section.content,
        imageUrl: section.imageUrl,
        order: index,
      })),
    });
    toast.success('Offline gespeichert');
  }, [doku, dokuId, offline, toast]);

  if (dokuQuery.isLoading && !offlineCopy) {
    return (
      <Screen>
        <ScreenHeader title="Doku" />
        <SkeletonText lines={10} />
      </Screen>
    );
  }

  if (sections.length === 0) {
    return (
      <Screen>
        <ScreenHeader title={title || 'Doku'} />
        <EmptyState
          icon={<Sparkles size={24} color={colors.primary} />}
          title={doku?.status === 'generating' ? 'Doku wird erstellt' : 'Kein Inhalt'}
          description={
            doku?.status === 'generating'
              ? 'Das dauert noch einen Moment — wir aktualisieren automatisch.'
              : 'Für dieses Doku konnten keine Abschnitte geladen werden.'
          }
          actionLabel="Zurück"
          onAction={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  return (
    <Screen playerClearance>
      <ScreenHeader
        title={title}
        subtitle={doku?.topic}
        actions={
          <>
            <HeaderAction onPress={handleListen} accessibilityLabel="Anhören">
              <Headphones size={17} color={hasDokuInPlaylist(dokuId) ? colors.primary : colors.text.primary} />
            </HeaderAction>
            <HeaderAction onPress={() => void handleSaveOffline()} accessibilityLabel="Offline speichern">
              <Download size={17} color={offline.isDokuSaved(dokuId) ? colors.primary : colors.text.primary} />
            </HeaderAction>
            <HeaderAction onPress={() => sectionSheetRef.current?.expand()} accessibilityLabel="Abschnitte">
              <List size={17} color={colors.text.primary} />
            </HeaderAction>
          </>
        }
      />

      <View style={{ gap: spacing.xl }}>
        {doku?.coverImageUrl || offlineCopy?.coverImageUrl ? (
          <CoverImage
            uri={offline.resolveImage(doku?.coverImageUrl ?? offlineCopy?.coverImageUrl)}
            style={{ height: 190 }}
            radius={radius.lg}
            fallbackGradient="nature"
          />
        ) : null}

        {doku?.summary ? (
          <Card variant="inset">
            <Text variant="bodyLg" tone="secondary">
              {doku.summary}
            </Text>
          </Card>
        ) : null}

        {sections.map((section, index) => (
          <Animated.View key={`${section.title}-${index}`} entering={FadeIn.delay(index * 60).duration(320)} style={{ gap: spacing.md }}>
            <View style={{ gap: 4 }}>
              <Text variant="overline" tone="tertiary">
                Abschnitt {index + 1}
              </Text>
              <Text variant="headingMd">{section.title}</Text>
            </View>

            {section.imageUrl ? (
              <CoverImage
                uri={offline.resolveImage(section.imageUrl)}
                style={{ height: 180 }}
                radius={radius.lg}
                fallbackGradient="nature"
              />
            ) : null}

            <View style={{ gap: spacing.md }}>
              {toParagraphs(section.content).map((paragraph, paragraphIndex) => (
                <Text key={paragraphIndex} style={type.reading}>
                  {paragraph}
                </Text>
              ))}
            </View>

            {section.keyFacts?.length ? (
              <View style={{ gap: spacing.sm }}>
                {section.keyFacts.map((fact, factIndex) => (
                  <Card key={factIndex} variant="inset">
                    <View style={{ flexDirection: 'row', gap: spacing.md }}>
                      <View style={[styles.factIcon, { borderRadius: radius.sm, backgroundColor: colors.warningSoft }]}>
                        <Lightbulb size={16} color={colors.warning} />
                      </View>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text variant="label">{fact.title}</Text>
                        <Text variant="bodySm" tone="secondary">
                          {fact.fact}
                        </Text>
                        {fact.whyItMatters ? (
                          <Text variant="caption" tone="tertiary">
                            {fact.whyItMatters}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            ) : null}

            {section.interactive?.activities?.enabled && section.interactive.activities.items.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="overline" tone="tertiary">
                  Zum Ausprobieren
                </Text>
                {section.interactive.activities.items.map((activity, activityIndex) => (
                  <Card key={activityIndex}>
                    <View style={{ flexDirection: 'row', gap: spacing.md }}>
                      <View style={[styles.factIcon, { borderRadius: radius.sm, backgroundColor: colors.successSoft }]}>
                        <Wrench size={16} color={colors.success} />
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text variant="label">{activity.title}</Text>
                        <Text variant="bodySm" tone="secondary">
                          {activity.description}
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 2 }}>
                          {activity.durationMinutes ? <Chip label={`${activity.durationMinutes} Min`} size="sm" /> : null}
                          {activity.materials?.map((material) => (
                            <Chip key={material} label={material} size="sm" />
                          ))}
                        </View>
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            ) : null}
          </Animated.View>
        ))}
      </View>

      <Sheet ref={sectionSheetRef} snapPoints={['50%']} title="Abschnitte" subtitle={title}>
        <View style={{ gap: spacing.xs }}>
          {sections.map((section, index) => (
            <Touchable
              key={`${section.title}-${index}`}
              onPress={() => sectionSheetRef.current?.close()}
              style={[styles.sectionRow, { borderRadius: radius.md, padding: spacing.md, gap: spacing.md }]}
            >
              <Text variant="labelSm" tone="tertiary" style={{ width: 22 }}>
                {index + 1}
              </Text>
              <Text variant="label" numberOfLines={2} style={{ flex: 1 }}>
                {section.title}
              </Text>
            </Touchable>
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  factIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'center' },
});
