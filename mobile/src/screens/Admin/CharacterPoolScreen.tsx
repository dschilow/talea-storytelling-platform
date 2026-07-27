import React, { useCallback } from 'react';
import { Users } from 'lucide-react-native';

import { useBackend } from '@/api/backend';
import { useTheme } from '@/theme/ThemeProvider';
import { PoolScreen, type PoolEntry } from './PoolScreen';

interface PoolCharacter {
  id: string;
  name: string;
  archetype?: string;
  role?: string;
  imageUrl?: string;
  physicalDescription?: string;
  personalityKeywords?: string[];
}

/** Browsable view of the shared character pool used by story generation. */
export function CharacterPoolScreen() {
  const backend = useBackend();
  const { colors } = useTheme();

  const load = useCallback(async (): Promise<PoolEntry[]> => {
    const response = (await (backend.story as any).listCharacters({ limit: 200 })) as { characters?: PoolCharacter[] };
    return (response?.characters ?? []).map((character) => ({
      id: character.id,
      name: character.name,
      description: character.physicalDescription,
      imageUrl: character.imageUrl,
      meta: [character.archetype, character.role].filter(Boolean).join(' · ') || undefined,
      tags: character.personalityKeywords,
    }));
  }, [backend.story]);

  return (
    <PoolScreen
      title="Charakter-Pool"
      queryKey="admin-character-pool"
      load={load}
      icon={<Users size={22} color={colors.text.tertiary} />}
      emptyTitle="Pool ist leer"
      emptyDescription="Noch keine Charaktere im gemeinsamen Pool."
    />
  );
}
