import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { BookOpen, Download, FlaskConical, Headphones, Plus, Trash2 } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useDeleteDoku, useDokus, usePublicDokus } from '@/hooks/queries';
import { useAudioPlayer } from '@/providers/AudioPlayerProvider';
import { useOffline } from '@/providers/OfflineProvider';
import { useToast } from '@/providers/ToastProvider';
import { Screen, TAB_BAR_CLEARANCE } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { CoverImage } from '@/components/ui/CoverImage';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { Sheet, type SheetRef } from '@/components/ui/Sheet';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { HeaderAction, ScreenHeader } from '@/components/ui/ScreenHeader';
import { SheetAction } from '@/screens/Story/StoriesScreen';
import { dokuPlainText } from '@/lib/content';
import type { Doku } from '@/types/doku';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'mine' | 'discover';

/** Knowledge documentaries: the user's own library plus the public catalogue. */
export function DokusScreen() {
  const { colors, spacing, radius } = useTheme();
  const navigation = useNavigation<Nav>();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>('mine');
  const [selected, setSelected] = useState<Doku | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Doku | null>(null);
  const actionSheetRef = useRef<SheetRef>(null);

  const myDokus = useDokus();
  const publicDokus = usePublicDokus();
  const deleteDoku = useDeleteDoku();
  const { startDokuConversion } = useAudioPlayer();
  const offline = useOffline();

  const activeQuery = tab === 'mine' ? myDokus : publicDokus;
  const dokus = useMemo(() => activeQuery.data ?? [], [activeQuery.data]);

  const handleListen = useCallback(
    (doku: Doku) => {
      actionSheetRef.current?.close();
      const text = dokuPlainText(doku);
      if (!text) {
        toast.warning('Noch kein Inhalt', 'Dieses Doku ist noch nicht fertig.');
        return;
      }
      startDokuConversion(doku.id, doku.title, text, doku.coverImageUrl, true);
      toast.info('Hörfassung startet');
    },
    [startDokuConversion, toast]
  );

  const handleSaveOffline = useCallback(
    async (doku: Doku) => {
      actionSheetRef.current?.close();
      const sections = doku.content?.sections ?? [];
      if (sections.length === 0) {
        toast.warning('Noch nichts zu speichern');
        return;
      }

      if (offline.isDokuSaved(doku.id)) {
        await offline.removeDoku(doku.id);
        toast.info('Aus Offline-Bibliothek entfernt');
        return;
      }

      await offline.saveDoku({
        id: doku.id,
        title: doku.title,
        topic: doku.topic,
        coverImageUrl: doku.coverImageUrl,
        sections: sections.map((section, index) => ({
          title: section.title,
          content: section.content,
          imageUrl: section.imageUrl,
          order: index,
        })),
      });
      toast.success('Offline gespeichert');
    },
    [offline, toast]
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const doku = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteDoku.mutateAsync(doku.id);
      toast.success('Doku gelöscht');
    } catch (error) {
      toast.error('Löschen fehlgeschlagen', error instanceof Error ? error.message : undefined);
    }
  }, [deleteDoku, pendingDelete, toast]);

  return (
    <Screen scroll={false} padded={false} tabBarClearance playerClearance>
      <ScreenHeader
        title="Dokus"
        subtitle="Wissen zum Entdecken"
        showBack={false}
        large
        actions={
          <HeaderAction onPress={() => navigation.navigate('DokuWizard')} accessibilityLabel="Neues Doku">
            <Plus size={19} color={colors.text.primary} />
          </HeaderAction>
        }
      />

      <View style={{ flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.base, paddingBottom: spacing.sm }}>
        <Chip label="Meine Dokus" selected={tab === 'mine'} onPress={() => setTab('mine')} />
        <Chip label="Entdecken" selected={tab === 'discover'} onPress={() => setTab('discover')} />
      </View>

      <FlashList
        data={dokus}
        keyExtractor={(doku) => doku.id}
        contentContainerStyle={{ paddingHorizontal: spacing.base, paddingBottom: TAB_BAR_CLEARANCE + spacing.xxl }}
        showsVerticalScrollIndicator={false}
        refreshing={activeQuery.isRefetching}
        onRefresh={() => void activeQuery.refetch()}
        renderItem={({ item }) => (
          <View style={{ paddingVertical: spacing.xs }}>
            <Touchable
              onPress={() => navigation.navigate('DokuReader', { dokuId: item.id })}
              onLongPress={() => {
                setSelected(item);
                actionSheetRef.current?.expand();
              }}
            >
              <Card padded={false}>
                <View style={{ flexDirection: 'row', padding: spacing.sm, gap: spacing.md, alignItems: 'center' }}>
                  <CoverImage uri={item.coverImageUrl} style={{ width: 84, height: 84 }} radius={radius.md} fallbackGradient="nature" />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text variant="title" numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text variant="caption" tone="secondary" numberOfLines={2}>
                      {item.summary}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: 2 }}>
                      <Chip label={item.topic} size="sm" />
                      {item.status === 'generating' ? <Chip label="Wird erstellt" size="sm" tone="accent" /> : null}
                      {item.status === 'error' ? <Chip label="Fehler" size="sm" tone="danger" /> : null}
                    </View>
                  </View>
                </View>
              </Card>
            </Touchable>
          </View>
        )}
        ListEmptyComponent={
          activeQuery.isLoading ? (
            <View style={{ gap: spacing.lg, paddingTop: spacing.md }}>
              <SkeletonCard height={84} />
              <SkeletonCard height={84} />
            </View>
          ) : (
            <EmptyState
              icon={<FlaskConical size={24} color={colors.accent.mint} />}
              title={tab === 'mine' ? 'Noch keine Dokus' : 'Noch nichts zu entdecken'}
              description={
                tab === 'mine'
                  ? 'Erstelle ein Doku zu einem Thema, das dein Kind gerade interessiert — mit Quiz und Mitmach-Ideen.'
                  : 'Öffentliche Dokus erscheinen hier, sobald welche verfügbar sind.'
              }
              actionLabel={tab === 'mine' ? 'Doku erstellen' : undefined}
              onAction={tab === 'mine' ? () => navigation.navigate('DokuWizard') : undefined}
            />
          )
        }
      />

      <Sheet ref={actionSheetRef} snapPoints={['38%']} title={selected?.title} scrollable={false}>
        <View style={{ gap: spacing.xs }}>
          <SheetAction
            icon={<BookOpen size={18} color={colors.text.secondary} />}
            label="Lesen"
            onPress={() => {
              actionSheetRef.current?.close();
              if (selected) navigation.navigate('DokuReader', { dokuId: selected.id });
            }}
          />
          <SheetAction
            icon={<Headphones size={18} color={colors.text.secondary} />}
            label="Anhören"
            onPress={() => selected && handleListen(selected)}
          />
          <SheetAction
            icon={<Download size={18} color={colors.text.secondary} />}
            label={selected && offline.isDokuSaved(selected.id) ? 'Offline-Kopie entfernen' : 'Offline speichern'}
            onPress={() => selected && void handleSaveOffline(selected)}
          />
          {tab === 'mine' ? (
            <SheetAction
              icon={<Trash2 size={18} color={colors.danger} />}
              label="Löschen"
              destructive
              onPress={() => {
                actionSheetRef.current?.close();
                setPendingDelete(selected);
              }}
            />
          ) : null}
        </View>
      </Sheet>

      <ConfirmSheet
        open={Boolean(pendingDelete)}
        title="Doku löschen?"
        message={`„${pendingDelete?.title ?? ''}“ wird dauerhaft entfernt.`}
        confirmLabel="Löschen"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </Screen>
  );
}
