/**
 * useAvatarTraitsForMap.ts
 * Fetches the current user's first avatar's personality traits
 * and returns them as a normalized map { traitId → value }.
 */
import { useState, useEffect, useMemo } from 'react';
import { useBackend } from '../../../hooks/useBackend';
import { convertBackendTraitsToFrontend, type TraitValue } from '../../../constants/traits';

export interface AvatarTraitMap {
  /** traitId → total base value (0–100) */
  byId: Record<string, number>;
  /** All trait values including subcategories */
  all: TraitValue[];
  /** Whether data is still loading */
  loading: boolean;
  /** Avatar name (for display) */
  avatarName: string | null;
}

export function useAvatarTraitsForMap(): AvatarTraitMap {
  const backend = useBackend();
  const [traits, setTraits] = useState<TraitValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarName, setAvatarName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        const res = await backend.avatar.list();
        if (cancelled) return;

        const avatars = (res as any)?.avatars ?? [];
        if (avatars.length === 0) {
          setLoading(false);
          return;
        }

        // Use the first avatar (primary)
        const avatar = avatars[0];
        setAvatarName(avatar.name ?? null);

        const raw = (avatar as any).personalityTraits;
        if (raw) {
          const converted = convertBackendTraitsToFrontend(raw);
          setTraits(converted);
        }
      } catch (err) {
        console.warn('[useAvatarTraitsForMap] Failed to load avatar traits:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [backend]);

  const byId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of traits) {
      // Only count base traits (no subcategory)
      if (!t.subcategory) {
        map[t.traitId] = t.value;
      }
    }
    return map;
  }, [traits]);

  return { byId, all: traits, loading, avatarName };
}
