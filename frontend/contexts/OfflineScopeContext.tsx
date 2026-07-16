import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useOptionalChildProfiles } from './ChildProfilesContext';
import {
  getLastOfflineScope,
  storeLastOfflineScope,
  type OfflineCacheScope,
} from '../utils/offlineDb';

const OfflineScopeContext = createContext<OfflineCacheScope | null>(null);

/**
 * Resolves the offline cache scope (user + child profile) for offlineDb access.
 *
 * Online: derived from the signed-in Clerk user and the active child profile,
 * and persisted to localStorage so offline sessions can restore it.
 * Offline (OfflineApp tree with mocked Clerk / no ChildProfilesProvider):
 * falls back to the last persisted scope.
 */
export const OfflineScopeProvider: React.FC<{
  children: React.ReactNode;
  /** Explicit scope override (e.g. OfflineApp passes the persisted scope). */
  scope?: OfflineCacheScope | null;
}> = ({ children, scope: scopeOverride }) => {
  const { user } = useUser();
  const activeProfileId = useOptionalChildProfiles()?.activeProfileId ?? null;

  const resolvedScope = useMemo<OfflineCacheScope | null>(() => {
    if (user?.id && activeProfileId) {
      return { userId: user.id, profileId: activeProfileId };
    }
    // Profiles not loaded yet, profile fetch failed, or offline tree without
    // Clerk: reuse the persisted scope as long as it doesn't belong to a
    // different signed-in user.
    const stored = getLastOfflineScope();
    if (stored && (!user?.id || stored.userId === user.id)) {
      return stored;
    }
    return null;
  }, [user?.id, activeProfileId]);

  useEffect(() => {
    if (user?.id && activeProfileId) {
      storeLastOfflineScope({ userId: user.id, profileId: activeProfileId });
    }
  }, [user?.id, activeProfileId]);

  const scope = scopeOverride !== undefined ? scopeOverride : resolvedScope;

  return <OfflineScopeContext.Provider value={scope}>{children}</OfflineScopeContext.Provider>;
};

export function useOfflineScope(): OfflineCacheScope | null {
  return useContext(OfflineScopeContext);
}
