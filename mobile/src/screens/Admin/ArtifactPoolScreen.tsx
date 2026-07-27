import React, { useCallback } from 'react';
import { Gem } from 'lucide-react-native';

import { useBackend } from '@/api/backend';
import { useTheme } from '@/theme/ThemeProvider';
import { PoolScreen, type PoolEntry } from './PoolScreen';

interface PoolArtifact {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  type?: string;
  rarity?: string;
  setName?: string;
  visualDescriptorKeywords?: string[];
}

/** Browsable view of the artifact pool that feeds the treasury system. */
export function ArtifactPoolScreen() {
  const backend = useBackend();
  const { colors } = useTheme();

  const load = useCallback(async (): Promise<PoolEntry[]> => {
    const response = (await (backend.story as any).listArtifacts({ limit: 200 })) as { artifacts?: PoolArtifact[] };
    return (response?.artifacts ?? []).map((artifact) => ({
      id: artifact.id,
      name: artifact.name,
      description: artifact.description,
      imageUrl: artifact.imageUrl,
      meta: [artifact.type, artifact.rarity, artifact.setName].filter(Boolean).join(' · ') || undefined,
      tags: artifact.visualDescriptorKeywords,
    }));
  }, [backend.story]);

  return (
    <PoolScreen
      title="Artefakt-Pool"
      queryKey="admin-artifact-pool"
      load={load}
      icon={<Gem size={22} color={colors.text.tertiary} />}
      emptyTitle="Pool ist leer"
      emptyDescription="Noch keine Artefakte angelegt."
    />
  );
}
