import React, { useCallback } from 'react';
import { Users } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';

import { useBackend } from '@/api/backend';
import { useTheme } from '@/theme/ThemeProvider';
import { PoolScreen, type PoolEntry } from './PoolScreen';

interface PoolCharacter {
  id: string;
  name: string;
  archetype?: string;
  role?: string;
  imageUrl?: string;
  physical_description?: string;
  personality_keywords?: string[];
  visualProfile?: { description?: string };
}

/** Browsable view of the shared character pool used by story generation. */
export function CharacterPoolScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const backend = useBackend();
  const { colors } = useTheme();

  const load = useCallback(async (): Promise<PoolEntry[]> => {
    const response = (await backend.story.listCharacters()) as { characters?: PoolCharacter[] };
    return (response?.characters ?? []).map((character) => ({
      id: character.id,
      name: character.name,
      description: character.physical_description ?? character.visualProfile?.description,
      imageUrl: character.imageUrl,
      meta: [character.archetype, character.role].filter(Boolean).join(' · ') || undefined,
      tags: character.personality_keywords,
      data: character as unknown as Record<string, unknown>,
    }));
  }, [backend.story]);

  return (
    <PoolScreen
      title="Charakter-Pool"
      queryKey="admin-character-pool"
      load={load}
      detailsLabel="Lebensgeschichte verwalten"
      onDetails={(entry) => navigation.navigate('CharacterLifeEditor', { characterId: entry.id })}
      save={(id, updates) => backend.story.updateCharacter({ id, updates })}
      create={(character) => backend.story.addCharacter({ character })}
      remove={(id) => backend.story.deleteCharacter({ id })}
      generateImage={(id) => backend.story.generateCharacterImage({ id })}
      exportData={() => backend.story.exportCharacters()}
      importData={(data: any) => backend.story.importCharacters({ characters: Array.isArray(data) ? data : data.characters })}
      template={{ name: '', role: 'support', archetype: 'helper', emotionalNature: { dominant: 'friendly', secondary: [], triggers: [] }, visualProfile: { description: '', species: 'human', colorPalette: [] }, maxScreenTime: 50, availableChapters: [1, 2, 3, 4, 5], canonSettings: [], isActive: true }}
      icon={<Users size={22} color={colors.text.tertiary} />}
      emptyTitle="Pool ist leer"
      emptyDescription="Noch keine Charaktere im gemeinsamen Pool."
    />
  );
}
