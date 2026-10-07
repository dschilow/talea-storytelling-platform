import React, { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { CoverImage } from '@/components/ui/CoverImage';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import type { SheetRef } from '@/components/ui/Sheet';
import { RecordEditor } from './RecordEditor';
import { useToast } from '@/providers/ToastProvider';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

export interface PoolEntry {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  tags?: string[];
  meta?: string;
  data?: Record<string, unknown>;
}

interface PoolScreenProps {
  title: string;
  subtitle?: string;
  queryKey: string;
  load: () => Promise<PoolEntry[]>;
  emptyTitle: string;
  emptyDescription: string;
  icon: React.ReactNode;
  save?: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  create?: (data: Record<string, unknown>) => Promise<unknown>;
  template?: Record<string, unknown>;
  remove?: (id: string) => Promise<unknown>;
  generateImage?: (id: string) => Promise<unknown>;
  importData?: (data: unknown) => Promise<unknown>;
  exportData?: () => Promise<unknown>;
  children?: React.ReactNode;
  detailsLabel?: string;
  onDetails?: (entry: PoolEntry) => void;
}

/** Shared catalogue management; structured editing preserves all backend fields. */
export function PoolScreen({ title, subtitle, queryKey, load, emptyTitle, emptyDescription, icon, save, create, template, remove, generateImage, importData, exportData, children, detailsLabel, onDetails }: PoolScreenProps) {
  const { colors, spacing, radius } = useTheme();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<PoolEntry | null>(null);
  const [editorData, setEditorData] = useState<Record<string, unknown> | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PoolEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const editorRef = useRef<SheetRef>(null);
  const toast = useToast();

  const poolQuery = useQuery<PoolEntry[]>({ queryKey: [queryKey], queryFn: load });
  const entries = poolQuery.data ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter(
      (entry) =>
        entry.name.toLowerCase().includes(term) ||
        (entry.description ?? '').toLowerCase().includes(term) ||
        (entry.tags ?? []).some((tag) => tag.toLowerCase().includes(term))
    );
  }, [entries, search]);

  return (
    <Screen>
      <ScreenHeader title={title} subtitle={subtitle ?? `${entries.length} Einträge`} />

      <View style={{ gap: spacing.base }}>
        {children}
        {create ? <Button label="Neuen Eintrag erstellen" onPress={() => { setEditing(null); setEditorData({ ...template }); editorRef.current?.expand(); }} /> : null}
        {exportData ? <Button label="Katalog exportieren" variant="secondary" disabled={busy} onPress={async () => {
          setBusy(true);
          try { const data = await exportData(); const uri = `${FileSystem.cacheDirectory}${queryKey}.json`;
            await FileSystem.writeAsStringAsync(uri, JSON.stringify(data, null, 2)); await Sharing.shareAsync(uri, { mimeType: 'application/json' });
          } catch (error) { toast.error('Export fehlgeschlagen', error instanceof Error ? error.message : undefined); }
          finally { setBusy(false); }
        }} /> : null}
        {importData ? <Button label="Katalog importieren" variant="secondary" disabled={busy} onPress={async () => {
          setBusy(true);
          try { const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], copyToCacheDirectory: true });
            if (!result.canceled) { const raw = await FileSystem.readAsStringAsync(result.assets[0].uri); await importData(JSON.parse(raw)); await poolQuery.refetch(); toast.success('Import abgeschlossen'); }
          } catch (error) { toast.error('Import fehlgeschlagen', error instanceof Error ? error.message : undefined); }
          finally { setBusy(false); }
        }} /> : null}
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Suchen"
          autoCapitalize="none"
          icon={<Search size={16} color={colors.text.tertiary} />}
        />

        {poolQuery.isLoading ? (
          <View style={{ gap: spacing.lg }}>
            <SkeletonCard height={90} />
            <SkeletonCard height={90} />
          </View>
        ) : poolQuery.isError ? (
          <EmptyState
            title="Konnte nicht geladen werden"
            description="Prüfe deine Verbindung und versuche es erneut."
            actionLabel="Erneut versuchen"
            onAction={() => void poolQuery.refetch()}
          />
        ) : filtered.length === 0 ? (
          <EmptyState icon={icon} title={search ? 'Nichts gefunden' : emptyTitle} description={search ? undefined : emptyDescription} compact />
        ) : (
          filtered.map((entry) => (
            <Card key={entry.id} padded={false}>
              <View style={{ flexDirection: 'row', padding: spacing.sm, gap: spacing.md, alignItems: 'center' }}>
                <CoverImage uri={entry.imageUrl} style={{ width: 64, height: 64 }} radius={radius.md} fallbackGradient="warm" />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text variant="title" numberOfLines={1}>
                    {entry.name}
                  </Text>
                  {entry.description ? (
                    <Text variant="caption" tone="secondary" numberOfLines={2}>
                      {entry.description}
                    </Text>
                  ) : null}
                  {entry.meta ? (
                    <Text variant="caption" tone="muted">
                      {entry.meta}
                    </Text>
                  ) : null}
                  {entry.tags?.length ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 2 }}>
                      {entry.tags.slice(0, 4).map((tag) => (
                        <Chip key={tag} label={tag} size="sm" />
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={{ padding: spacing.md, gap: spacing.sm }}>
                {onDetails ? <Button label={detailsLabel ?? 'Details bearbeiten'} variant="secondary" onPress={() => onDetails(entry)} /> : null}
                {save ? <Button label="Bearbeiten" variant="secondary" onPress={() => { setEditing(entry); setEditorData(entry.data ?? {}); editorRef.current?.expand(); }} /> : null}
                {generateImage ? <Button label="Bild neu generieren" disabled={busy} variant="secondary" onPress={async () => {
                  setBusy(true); try { await generateImage(entry.id); await poolQuery.refetch(); toast.success('Bild aktualisiert'); }
                  catch (error) { toast.error('Bildgenerierung fehlgeschlagen', error instanceof Error ? error.message : undefined); } finally { setBusy(false); }
                }} /> : null}
                {remove ? <Button label="Löschen" variant="secondary" onPress={() => setPendingDelete(entry)} /> : null}
              </View>
            </Card>
          ))
        )}
      </View>
      <RecordEditor sheetRef={editorRef} title={editing ? `${editing.name} bearbeiten` : 'Neuer Eintrag'} data={editorData} onSave={async (data) => {
        if (editing && save) await save(editing.id, data); else if (create) await create(data);
        await poolQuery.refetch();
      }} />
      <ConfirmSheet open={Boolean(pendingDelete)} title="Eintrag löschen?" message={`„${pendingDelete?.name ?? ''}“ wird dauerhaft entfernt.`} destructive confirmLabel="Löschen" onCancel={() => setPendingDelete(null)} onConfirm={async () => {
        if (!pendingDelete || !remove) return;
        try { await remove(pendingDelete.id); setPendingDelete(null); await poolQuery.refetch(); }
        catch (error) { toast.error('Löschen fehlgeschlagen', error instanceof Error ? error.message : undefined); }
      }} />
    </Screen>
  );
}
