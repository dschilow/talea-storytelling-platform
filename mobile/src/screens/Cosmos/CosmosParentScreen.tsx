import React, { useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useBackend } from '@/api/backend';
import { useAvatars } from '@/hooks/queries';
import { useOptionalChildProfiles } from '@/providers/ChildProfilesProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { domainLabel } from '@/lib/featureModels';
import { formatDate } from '@/lib/content';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Chip } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState } from '@/components/ui/EmptyState';

type Summary = {
  highlights: Array<{ id: string; domainId: string; eventType: string; summary: string; score: number; maxScore: number; timestamp: string }>;
  competencies: Array<{ domainId: string; skillType: string; mastery: number; confidence: number; stage: string }>;
  pendingRecalls: number; totalEvidenceEvents: number;
};
export function CosmosParentScreen() {
  const { spacing } = useTheme();
  const backend = useBackend();
  const profiles = useOptionalChildProfiles();
  const avatars = useAvatars();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [range, setRange] = useState('month');
  const avatar = avatars.data?.find((a) => a.id === selectedId) ?? avatars.data?.[0];
  const summary = useQuery<Summary>({
    queryKey: ['cosmos-parent', profiles?.activeProfileId, avatar?.id, range],
    queryFn: () => backend.avatar.cosmosParentSummary({ avatarId: avatar!.id, profileId: profiles?.activeProfileId ?? undefined, range }),
    enabled: Boolean(avatar),
  });
  return <Screen>
    <ScreenHeader title="Bildungskompass" subtitle={profiles?.activeProfile?.name} />
    <View style={{ gap: spacing.base }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {avatars.data?.map((a) => <Chip key={a.id} label={a.name} selected={a.id === avatar?.id} onPress={() => setSelectedId(a.id)} />)}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
        {[['week', 'Woche'], ['month', 'Monat'], ['all', 'Gesamt']].map(([id, label]) => <Chip key={id} label={label} selected={range === id} onPress={() => setRange(id)} />)}
      </View>
      {avatars.isLoading || summary.isLoading ? <Text>Lädt …</Text> : !avatar ? <EmptyState title="Noch kein Avatar" description="Sobald ein Avatar lernt, siehst du hier Fortschritte und Belege." /> :
        summary.isError ? <EmptyState title="Überblick konnte nicht geladen werden" actionLabel="Erneut versuchen" onAction={() => void summary.refetch()} /> : null}
      {summary.data ? <>
        <Card><Text variant="headingSm">{summary.data.totalEvidenceEvents} Lernereignisse</Text>
          <Text>{summary.data.pendingRecalls} Wiederholungen fällig</Text></Card>
        <Text variant="headingSm">Kompetenzen und Interessen</Text>
        {summary.data.competencies.map((entry, i) => <Card key={`${entry.domainId}-${entry.skillType}-${i}`}>
          <View style={{ gap: spacing.sm }}>
            <Text variant="label">{domainLabel(entry.domainId)} · {entry.skillType}</Text>
            <Text variant="caption">Wissen: {Math.round(entry.mastery)}% · Sicherheit: {Math.round(entry.confidence)}% · {entry.stage}</Text>
            <ProgressBar progress={entry.mastery / 100} />
          </View>
        </Card>)}
        <Text variant="headingSm">Belege für den Lernfortschritt</Text>
        {summary.data.highlights.map((entry) => <Card key={entry.id} variant="inset">
          <Text variant="label">{domainLabel(entry.domainId)}</Text><Text>{entry.summary}</Text>
          <Text variant="caption">{entry.score}/{entry.maxScore} · {formatDate(entry.timestamp)}</Text>
        </Card>)}
        {!summary.data.highlights.length ? <Text>Noch keine Lernereignisse in diesem Zeitraum.</Text> : null}
      </> : null}
    </View>
  </Screen>;
}
