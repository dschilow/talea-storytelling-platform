import React, { useCallback } from 'react';
import { Sparkles } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';

import { useBackend } from '@/api/backend';
import { useTheme } from '@/theme/ThemeProvider';
import { PoolScreen, type PoolEntry } from './PoolScreen';
import { collectPages } from '@/lib/pagination';

interface AdminFairyTale {
  id: string;
  title: string;
  summary?: string;
  source?: string;
  cultureRegion?: string;
  ageRecommendation?: number;
  durationMinutes?: number;
  genreTags?: string[];
}

/** Browsable view of the fairy-tale catalogue used as story templates. */
export function FairyTalesAdminScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const backend = useBackend();
  const { colors } = useTheme();

  const load = useCallback(async (): Promise<PoolEntry[]> => {
    // The public catalogue omits inactive templates; admins must retain access to them.
    const response = await backend.fairytales.exportFairyTales({});
    const tales: AdminFairyTale[] = response.tales.map((entry: any) => entry.tale);

    return tales.map((tale) => ({
      id: tale.id,
      name: tale.title,
      description: tale.summary,
      meta: [tale.source, tale.cultureRegion, tale.ageRecommendation ? `ab ${tale.ageRecommendation} J.` : null]
        .filter(Boolean)
        .join(' · ') || undefined,
      tags: tale.genreTags,
      data: tale as unknown as Record<string, unknown>,
    }));
  }, [backend.fairytales]);

  return (
    <PoolScreen
      title="Märchen"
      queryKey="admin-fairy-tales"
      load={load}
      detailsLabel="Rollen und Szenen verwalten"
      onDetails={(entry) => navigation.navigate('FairyTaleEditor', { taleId: entry.id })}
      save={(id, updates) => backend.fairytales.updateFairyTale({ id, updates })}
      create={(tale) => backend.fairytales.createFairyTale({ tale })}
      remove={(id) => backend.fairytales.deleteFairyTale({ id })}
      exportData={() => backend.fairytales.exportFairyTales({})}
      importData={(data: any) => backend.fairytales.importFairyTales({ tales: Array.isArray(data) ? data : data.tales, overwriteExisting: false })}
      template={{ id: '', title: '', source: 'custom', cultureRegion: '', ageRecommendation: 6, durationMinutes: 10, genreTags: [], moralLesson: '', summary: '', originalLanguage: 'de', isActive: true }}
      icon={<Sparkles size={22} color={colors.text.tertiary} />}
      emptyTitle="Keine Märchen"
      emptyDescription="Der Märchen-Katalog ist noch leer."
    />
  );
}
