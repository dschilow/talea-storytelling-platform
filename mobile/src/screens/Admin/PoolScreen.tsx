import React, { useMemo, useState } from 'react';
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

export interface PoolEntry {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  tags?: string[];
  meta?: string;
}

interface PoolScreenProps {
  title: string;
  subtitle?: string;
  queryKey: string;
  load: () => Promise<PoolEntry[]>;
  emptyTitle: string;
  emptyDescription: string;
  icon: React.ReactNode;
}

/**
 * Shared read-only browser for the admin content pools.
 *
 * Characters, artifacts and fairy tales differ only in where the data comes from
 * and what the empty state says, so they share one screen rather than three
 * near-identical copies. Editing stays in the web admin.
 */
export function PoolScreen({ title, subtitle, queryKey, load, emptyTitle, emptyDescription, icon }: PoolScreenProps) {
  const { colors, spacing, radius } = useTheme();
  const [search, setSearch] = useState('');

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
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
}
