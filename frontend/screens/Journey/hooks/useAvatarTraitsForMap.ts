/**
 * useAvatarTraitsForMap.ts
 * Avatar context for Journey map:
 * - resolves active avatar (query/avatar context first, fallback first avatar)
 * - provides base traits + progression from the same backend source as Avatar profile
 * - reacts to personalityUpdated events
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBackend } from '../../../hooks/useBackend';
import { convertBackendTraitsToFrontend, type TraitValue } from '../../../constants/traits';
import type { AvatarProgression } from '../../../types/avatar';

export interface AvatarTraitMap {
  /** traitId -> total base value (0-100) */
  byId: Record<string, number>;
  /** All trait values including subcategories */
  all: TraitValue[];
  /** Whether data is still loading */
  loading: boolean;
  /** Avatar name (for display) */
  avatarName: string | null;
  /** Avatar ID (for map context + backend queries) */
  avatarId: string | null;
  /** Backend progression model used in Avatar profile */
  progression: AvatarProgression | null;
}

type BackendAvatar = {
  id?: string;
  name?: string;
  personalityTraits?: unknown;
  progression?: AvatarProgression;
};

export function useAvatarTraitsForMap(preferredAvatarId?: string | null): AvatarTraitMap {
  const backend = useBackend();
  const [traits, setTraits] = useState<TraitValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarName, setAvatarName] = useState<string | null>(null);
  const [avatarId, setAvatarId] = useState<string | null>(preferredAvatarId ?? null);
  const [progression, setProgression] = useState<AvatarProgression | null>(null);

  const hydrateFromAvatar = useCallback((avatar: BackendAvatar | null | undefined) => {
    setAvatarId(avatar?.id ?? null);
    setAvatarName(avatar?.name ?? null);
    setProgression((avatar?.progression as AvatarProgression) ?? null);

    const raw = avatar?.personalityTraits;
    if (raw) {
      setTraits(convertBackendTraitsToFrontend(raw));
    } else {
      setTraits([]);
    }
  }, []);

  const fetchAvatar = useCallback(async () => {
    setLoading(true);
    try {
      if (preferredAvatarId) {
        const avatar = await backend.avatar.get({ id: preferredAvatarId });
        hydrateFromAvatar(avatar as BackendAvatar);
        return;
      }

      const res = await backend.avatar.list();
      const avatars = ((res as any)?.avatars ?? []) as BackendAvatar[];
      if (avatars.length === 0) {
        hydrateFromAvatar(null);
        return;
      }

      const first = avatars[0];
      // Ensure we load full details including progression payload.
      if (first?.id) {
        const fullAvatar = await backend.avatar.get({ id: first.id });
        hydrateFromAvatar(fullAvatar as BackendAvatar);
      } else {
        hydrateFromAvatar(first);
      }
    } catch (err) {
      console.warn('[useAvatarTraitsForMap] Failed to load avatar traits/progression:', err);
      hydrateFromAvatar(null);
    } finally {
      setLoading(false);
    }
  }, [backend, hydrateFromAvatar, preferredAvatarId]);

  useEffect(() => {
    void fetchAvatar();
  }, [fetchAvatar]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{
        avatarId?: string;
        updatedTraits?: Record<string, unknown>;
        progression?: AvatarProgression;
        refreshProgression?: boolean;
      }>;

      const targetAvatarId = customEvent.detail?.avatarId;
      const matchesAvatar = !targetAvatarId || (avatarId && targetAvatarId === avatarId);
      if (!matchesAvatar) return;

      if (customEvent.detail?.updatedTraits) {
        setTraits(convertBackendTraitsToFrontend(customEvent.detail.updatedTraits));
      }

      if (customEvent.detail?.progression) {
        setProgression(customEvent.detail.progression);
      }

      if (customEvent.detail?.refreshProgression && avatarId) {
        backend.avatar.get({ id: avatarId })
          .then((avatar) => hydrateFromAvatar(avatar as BackendAvatar))
          .catch((err) => console.warn('[useAvatarTraitsForMap] refreshProgression failed:', err));
      }
    };

    window.addEventListener('personalityUpdated', handler as EventListener);
    return () => window.removeEventListener('personalityUpdated', handler as EventListener);
  }, [avatarId, backend.avatar, hydrateFromAvatar]);

  const byId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of traits) {
      if (!t.subcategory) {
        map[t.traitId] = t.value;
      }
    }
    return map;
  }, [traits]);

  return { byId, all: traits, loading, avatarName, avatarId, progression };
}

