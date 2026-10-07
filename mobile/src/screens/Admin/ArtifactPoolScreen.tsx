import React, { useCallback } from 'react';
import { Gem } from 'lucide-react-native';

import { useBackend } from '@/api/backend';
import { useTheme } from '@/theme/ThemeProvider';
import { PoolScreen, type PoolEntry } from './PoolScreen';

interface PoolArtifact {
  id: string;
  name: { de: string; en: string };
  description?: { de: string; en: string };
  imageUrl?: string;
  category?: string;
  rarity?: string;
  setName?: string;
  visualKeywords?: string[];
}

/** Browsable view of the artifact pool that feeds the treasury system. */
export function ArtifactPoolScreen() {
  const backend = useBackend();
  const { colors } = useTheme();

  const load = useCallback(async (): Promise<PoolEntry[]> => {
    const response = (await backend.story.listArtifacts()) as { artifacts?: PoolArtifact[] };
    return (response?.artifacts ?? []).map((artifact) => ({
      id: artifact.id,
      name: artifact.name.de || artifact.name.en,
      description: artifact.description?.de || artifact.description?.en,
      imageUrl: artifact.imageUrl,
      meta: [artifact.category, artifact.rarity, artifact.setName].filter(Boolean).join(' · ') || undefined,
      tags: artifact.visualKeywords,
      data: artifact as unknown as Record<string, unknown>,
    }));
  }, [backend.story]);

  return (
    <PoolScreen
      title="Artefakt-Pool"
      queryKey="admin-artifact-pool"
      load={load}
      save={(id, updates) => backend.story.updateArtifact({ id, updates })}
      create={(artifact) => backend.story.addArtifact({ artifact })}
      remove={(id) => backend.story.deleteArtifact({ id })}
      generateImage={(id) => backend.story.generateArtifactImage({ id })}
      exportData={() => backend.story.exportArtifacts()}
      importData={(data: any) => backend.story.importArtifacts({ artifacts: Array.isArray(data) ? data : data.artifacts })}
      template={{ name: { de: '', en: '' }, description: { de: '', en: '' }, category: 'tool', rarity: 'common', storyRole: '', discoveryScenarios: [], usageScenarios: [], emoji: '✨', visualKeywords: [], genreAffinity: { adventure: 0.5, fantasy: 0.5, mystery: 0.5, nature: 0.5, friendship: 0.5, courage: 0.5, learning: 0.5 }, isActive: true }}
      icon={<Gem size={22} color={colors.text.tertiary} />}
      emptyTitle="Pool ist leer"
      emptyDescription="Noch keine Artefakte angelegt."
    />
  );
}
