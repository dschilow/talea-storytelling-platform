import React, { useCallback } from 'react';
import { Sparkles } from 'lucide-react-native';

import { useBackend } from '@/api/backend';
import { useTheme } from '@/theme/ThemeProvider';
import { PoolScreen, type PoolEntry } from './PoolScreen';

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
  const backend = useBackend();
  const { colors } = useTheme();

  const load = useCallback(async (): Promise<PoolEntry[]> => {
    const response = (await (backend.fairytales as any).listFairyTales({ limit: 200 })) as {
      tales?: AdminFairyTale[];
      fairyTales?: AdminFairyTale[];
    };
    const tales = response?.tales ?? response?.fairyTales ?? [];

    return tales.map((tale) => ({
      id: tale.id,
      name: tale.title,
      description: tale.summary,
      meta: [tale.source, tale.cultureRegion, tale.ageRecommendation ? `ab ${tale.ageRecommendation} J.` : null]
        .filter(Boolean)
        .join(' · ') || undefined,
      tags: tale.genreTags,
    }));
  }, [backend.fairytales]);

  return (
    <PoolScreen
      title="Märchen"
      queryKey="admin-fairy-tales"
      load={load}
      icon={<Sparkles size={22} color={colors.text.tertiary} />}
      emptyTitle="Keine Märchen"
      emptyDescription="Der Märchen-Katalog ist noch leer."
    />
  );
}
