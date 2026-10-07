import React, { useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react-native';
import { useBackend } from '@/api/backend';
import { useTheme } from '@/theme/ThemeProvider';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonText } from '@/components/ui/Skeleton';
import { HeaderAction, ScreenHeader } from '@/components/ui/ScreenHeader';

export function LogsScreen() {
  const backend = useBackend();
  const { spacing, colors } = useTheme();
  const [source, setSource] = useState('');
  const [date, setDate] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const validDate = !date || /^\d{4}-\d{2}-\d{2}$/.test(date);
  const sources = useQuery({ queryKey: ['admin-log-sources'], queryFn: () => backend.log.getSources() });
  const logs = useQuery<{ logs: Array<{ id: string; source: string; timestamp: string; request: unknown; response: unknown; metadata?: unknown }>; totalCount: number }>({
    queryKey: ['admin-logs', source, date], enabled: validDate,
    queryFn: () => backend.log.list({ source: source || undefined, date: date || undefined, limit: 200 }),
  });
  return <Screen><ScreenHeader title="Logs" subtitle={`${logs.data?.totalCount ?? 0} Einträge · maximal 200 pro Abfrage`} actions={<HeaderAction accessibilityLabel="Aktualisieren" onPress={() => void logs.refetch()}><RefreshCw size={20} color={colors.text.primary} /></HeaderAction>} />
    <View style={{ gap: spacing.base }}>
      <Input label="Datum" placeholder="JJJJ-MM-TT · leer für alle" value={date} onChangeText={setDate} autoCapitalize="none" />
      {!validDate ? <Text tone="danger">Bitte ein Datum im Format JJJJ-MM-TT eingeben.</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}><Chip label="Alle Quellen" selected={!source} onPress={() => setSource('')} />{(sources.data?.sources ?? []).map((item: any) => <Chip key={item.name} label={`${item.name} (${item.count})`} selected={source === item.name} onPress={() => setSource(item.name)} />)}</View>
      {logs.isLoading ? <SkeletonText lines={8} /> : logs.isError ? <EmptyState title="Logs konnten nicht geladen werden" actionLabel="Erneut versuchen" onAction={() => void logs.refetch()} /> : !logs.data?.logs.length ? <EmptyState title="Keine Einträge" /> : logs.data.logs.map((entry) => <Card key={entry.id} onPress={() => setExpanded(expanded === entry.id ? null : entry.id)}>
        <Text variant="label">{entry.source}</Text><Text variant="caption" tone="secondary">{new Date(entry.timestamp).toLocaleString('de-DE')}</Text>
        {expanded === entry.id ? <View style={{ gap: spacing.sm }}><Text variant="labelSm">Anfrage</Text><Text variant="mono" selectable>{JSON.stringify(entry.request, null, 2)}</Text><Text variant="labelSm">Antwort</Text><Text variant="mono" selectable>{JSON.stringify(entry.response, null, 2)}</Text><Text variant="labelSm">Metadaten</Text><Text variant="mono" selectable>{JSON.stringify(entry.metadata ?? {}, null, 2)}</Text></View> : <Text variant="caption" tone="accent">Details anzeigen</Text>}
      </Card>)}
    </View>
  </Screen>;
}
