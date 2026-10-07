import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { storage, StorageKeys } from '@/lib/storage';
import type { OfflineDoku, OfflineStory } from '@/providers/OfflineProvider';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { CoverImage } from '@/components/ui/CoverImage';
import { useTheme } from '@/theme/ThemeProvider';

/** Cached books remain readable even when Clerk cannot initialize offline. */
export function ConnectionRecoveryScreen({ retry, userId }: { retry: () => void; userId?: string | null }) {
  const { spacing } = useTheme();
  const [books, setBooks] = useState<Array<OfflineStory | OfflineDoku>>([]);
  const [selected, setSelected] = useState<OfflineStory | OfflineDoku | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const scope = await storage.getString(StorageKeys.lastOfflineScope);
      if (!scope || (userId && !scope.startsWith(`${userId}:`))) return;
      const [stories, dokus] = await Promise.all([storage.getJSON<OfflineStory[]>(`${StorageKeys.offlineStories}:${scope}`, []), storage.getJSON<OfflineDoku[]>(`${StorageKeys.offlineDokus}:${scope}`, [])]);
      if (!cancelled) setBooks([...stories, ...dokus]);
    })();
    return () => { cancelled = true; };
  }, [userId]);
  if (selected) {
    const sections = 'chapters' in selected ? selected.chapters : selected.sections;
    return <Screen><View style={{ gap: spacing.lg }}><Button label="Zur Offline-Bibliothek" variant="secondary" onPress={() => setSelected(null)} /><Text variant="headingLg">{selected.title}</Text>{sections.map((section, i) => <View key={i} style={{ gap: spacing.md }}><Text variant="headingMd">{section.title}</Text>{section.imageUrl && selected.imageMap[section.imageUrl] ? <CoverImage uri={selected.imageMap[section.imageUrl]} style={{ height: 200 }} /> : null}<Text variant="bodyLg">{section.content}</Text>{'keyFacts' in section && section.keyFacts?.length ? <Text>{section.keyFacts.join('\n')}</Text> : null}</View>)}</View></Screen>;
  }
  return <Screen><View style={{ gap: spacing.lg }}><Text variant="headingLg">Keine Verbindung zu Talea</Text><Text>Prüfe deine Verbindung oder lies bereits gespeicherte Inhalte.</Text><Button label="Erneut verbinden" onPress={retry} /><Text variant="headingMd">Offline-Bibliothek</Text>{books.length ? books.map((book) => <Button key={book.id} label={book.title} variant="secondary" onPress={() => setSelected(book)} />) : <Text>Noch keine Inhalte für dieses Profil gespeichert.</Text>}</View></Screen>;
}
