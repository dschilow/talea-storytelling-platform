import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Bug, Info, RefreshCw, XCircle } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useBackend } from '@/api/backend';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { SkeletonText } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { HeaderAction, ScreenHeader } from '@/components/ui/ScreenHeader';

type LogLevel = 'all' | 'error' | 'warn' | 'info';

interface LogEntry {
  id?: string;
  level?: string;
  source?: string;
  message?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log viewer.
 *
 * Scoped to recent story-pipeline errors — the thing worth checking from a
 * phone. Full log search stays in the web admin.
 */
export function LogsScreen() {
  const { colors, spacing } = useTheme();
  const backend = useBackend();
  const [level, setLevel] = useState<LogLevel>('all');

  const logsQuery = useQuery<LogEntry[]>({
    queryKey: ['admin-logs'],
    queryFn: async () => {
      const response = (await (backend.story as any).debugRecentStories({ limit: 40 })) as {
        entries?: LogEntry[];
        stories?: LogEntry[];
      };
      return response?.entries ?? response?.stories ?? [];
    },
    refetchInterval: 30_000,
  });

  const entries = logsQuery.data ?? [];

  const filtered = useMemo(() => {
    if (level === 'all') return entries;
    return entries.filter((entry) => (entry.level ?? 'info').toLowerCase() === level);
  }, [entries, level]);

  const levelConfig: Record<string, { color: string; Icon: typeof Info }> = {
    error: { color: colors.danger, Icon: XCircle },
    warn: { color: colors.warning, Icon: AlertTriangle },
    info: { color: colors.primary, Icon: Info },
  };

  return (
    <Screen>
      <ScreenHeader
        title="Logs"
        subtitle={`${entries.length} Einträge`}
        actions={
          <HeaderAction onPress={() => void logsQuery.refetch()} accessibilityLabel="Aktualisieren">
            <RefreshCw size={17} color={colors.text.primary} />
          </HeaderAction>
        }
      />

      <View style={{ gap: spacing.base }}>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {(['all', 'error', 'warn', 'info'] as LogLevel[]).map((entry) => (
            <Chip
              key={entry}
              label={entry === 'all' ? 'Alle' : entry.toUpperCase()}
              selected={level === entry}
              onPress={() => setLevel(entry)}
            />
          ))}
        </View>

        {logsQuery.isLoading ? (
          <SkeletonText lines={10} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Bug size={22} color={colors.text.tertiary} />} title="Keine Einträge" compact />
        ) : (
          filtered.map((entry, index) => {
            const config = levelConfig[(entry.level ?? 'info').toLowerCase()] ?? levelConfig.info;
            const { Icon } = config;

            return (
              <Card key={entry.id ?? index} variant="inset">
                <View style={{ gap: 6 }}>
                  <View style={[styles.row, { gap: spacing.sm }]}>
                    <Icon size={14} color={config.color} />
                    <Text variant="labelSm" style={{ flex: 1 }} numberOfLines={1}>
                      {entry.source ?? 'system'}
                    </Text>
                    {entry.timestamp ? (
                      <Text variant="caption" tone="muted">
                        {new Date(entry.timestamp).toLocaleTimeString('de-DE')}
                      </Text>
                    ) : null}
                  </View>

                  <Text variant="mono" tone="secondary" selectable>
                    {entry.message ?? JSON.stringify(entry.metadata ?? {}, null, 2)}
                  </Text>
                </View>
              </Card>
            );
          })
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
