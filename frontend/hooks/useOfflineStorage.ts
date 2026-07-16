import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useBackend } from './useBackend';
import { useUserAccess } from '../contexts/UserAccessContext';
import { useOptionalChildProfiles } from '../contexts/ChildProfilesContext';
import {
  saveStoryOffline,
  saveDokuOffline,
  saveAudioDokuOffline,
  removeStoryOffline,
  removeDokuOffline,
  removeAudioDokuOffline,
  getAllSavedIds,
  storeLastOfflineScope,
  type OfflineCacheScope,
} from '../utils/offlineDb';
import type { AudioDoku } from '../types/audio-doku';

function scopeKey(scope: OfflineCacheScope): string {
  return JSON.stringify([scope.userId, scope.profileId]);
}

function operationKey(cacheScopeKey: string, contentId: string): string {
  return JSON.stringify([cacheScopeKey, contentId]);
}

export function useOfflineStorage() {
  const { subscription } = useUserAccess();
  const backend = useBackend();
  const { isLoaded, isSignedIn, user } = useUser();
  const activeProfileId = useOptionalChildProfiles()?.activeProfileId;

  const scope = useMemo<OfflineCacheScope | null>(() => {
    if (!isLoaded || !isSignedIn || !user?.id || !activeProfileId) return null;
    return { userId: user.id, profileId: activeProfileId };
  }, [activeProfileId, isLoaded, isSignedIn, user?.id]);
  const currentScopeKey = scope ? scopeKey(scope) : null;
  const scopeKeyRef = useRef<string | null>(currentScopeKey);
  scopeKeyRef.current = currentScopeKey;

  const [savedStoryIds, setSavedStoryIds] = useState<Set<string>>(new Set());
  const [savedDokuIds, setSavedDokuIds] = useState<Set<string>>(new Set());
  const [savedAudioDokuIds, setSavedAudioDokuIds] = useState<Set<string>>(new Set());
  const [loadedScopeKey, setLoadedScopeKey] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const savingIdsRef = useRef<Set<string>>(new Set());
  const loadRequestRef = useRef(0);
  const [storageUnavailable, setStorageUnavailable] = useState(false);

  const hasOfflineEntitlement = subscription === 'familie' || subscription === 'premium';
  const canUseOffline = hasOfflineEntitlement && !!scope && !storageUnavailable;

  useEffect(() => {
    if (scope) storeLastOfflineScope(scope);
  }, [currentScopeKey, scope]);

  useEffect(() => {
    const requestId = ++loadRequestRef.current;
    savingIdsRef.current.clear();
    setSavingIds(new Set());
    setSavedStoryIds(new Set());
    setSavedDokuIds(new Set());
    setSavedAudioDokuIds(new Set());
    setLoadedScopeKey(null);

    if (!canUseOffline || !scope || !currentScopeKey) {
      return () => {
        if (loadRequestRef.current === requestId) loadRequestRef.current += 1;
      };
    }

    void getAllSavedIds(scope)
      .then((ids) => {
        if (
          loadRequestRef.current !== requestId ||
          scopeKeyRef.current !== currentScopeKey
        ) return;
        setSavedStoryIds(new Set(ids.stories));
        setSavedDokuIds(new Set(ids.dokus));
        setSavedAudioDokuIds(new Set(ids.audioDokus));
        setLoadedScopeKey(currentScopeKey);
      })
      .catch((error) => {
        if (
          loadRequestRef.current !== requestId ||
          scopeKeyRef.current !== currentScopeKey
        ) return;
        setStorageUnavailable(true);
        console.warn('[Offline] Disabled offline storage for this session:', error);
      });

    return () => {
      if (loadRequestRef.current === requestId) loadRequestRef.current += 1;
    };
  }, [canUseOffline, currentScopeKey, scope]);

  const isStorySaved = useCallback(
    (id: string) => loadedScopeKey === currentScopeKey && savedStoryIds.has(id),
    [currentScopeKey, loadedScopeKey, savedStoryIds],
  );
  const isDokuSaved = useCallback(
    (id: string) => loadedScopeKey === currentScopeKey && savedDokuIds.has(id),
    [currentScopeKey, loadedScopeKey, savedDokuIds],
  );
  const isAudioDokuSaved = useCallback(
    (id: string) => loadedScopeKey === currentScopeKey && savedAudioDokuIds.has(id),
    [currentScopeKey, loadedScopeKey, savedAudioDokuIds],
  );
  const isSaving = useCallback(
    (id: string) => !!currentScopeKey && savingIds.has(operationKey(currentScopeKey, id)),
    [currentScopeKey, savingIds],
  );

  const beginSaving = useCallback((key: string): boolean => {
    if (savingIdsRef.current.has(key)) return false;
    savingIdsRef.current.add(key);
    setSavingIds((previous) => new Set(previous).add(key));
    return true;
  }, []);

  const finishSaving = useCallback((key: string): void => {
    savingIdsRef.current.delete(key);
    setSavingIds((previous) => {
      const next = new Set(previous);
      next.delete(key);
      return next;
    });
  }, []);

  const toggleStory = useCallback(
    async (storyId: string) => {
      if (!canUseOffline || !scope || !currentScopeKey) return;
      const key = operationKey(currentScopeKey, storyId);
      if (!beginSaving(key)) return;
      const wasSaved = loadedScopeKey === currentScopeKey && savedStoryIds.has(storyId);

      try {
        if (wasSaved) {
          await removeStoryOffline(scope, storyId);
          if (scopeKeyRef.current === currentScopeKey) {
            setSavedStoryIds((previous) => {
              const next = new Set(previous);
              next.delete(storyId);
              return next;
            });
          }
          import('../utils/toastUtils').then(({ showSuccessToast }) =>
            showSuccessToast('Offline-Speicherung entfernt'),
          );
        } else {
          const fullStory = await backend.story.get({
            id: storyId,
            profileId: scope.profileId,
          });
          await saveStoryOffline(scope, fullStory as any);
          if (scopeKeyRef.current === currentScopeKey) {
            setSavedStoryIds((previous) => new Set(previous).add(storyId));
            setLoadedScopeKey(currentScopeKey);
          }
          import('../utils/toastUtils').then(({ showSuccessToast }) =>
            showSuccessToast('Geschichte offline gespeichert'),
          );
        }
      } catch (error) {
        console.error('[Offline] Failed to toggle story:', error);
        import('../utils/toastUtils').then(({ showErrorToast }) =>
          showErrorToast('Offline-Speicherung fehlgeschlagen'),
        );
      } finally {
        finishSaving(key);
      }
    },
    [
      backend.story,
      beginSaving,
      canUseOffline,
      currentScopeKey,
      finishSaving,
      loadedScopeKey,
      savedStoryIds,
      scope,
    ],
  );

  const toggleDoku = useCallback(
    async (dokuId: string) => {
      if (!canUseOffline || !scope || !currentScopeKey) return;
      const key = operationKey(currentScopeKey, dokuId);
      if (!beginSaving(key)) return;
      const wasSaved = loadedScopeKey === currentScopeKey && savedDokuIds.has(dokuId);

      try {
        if (wasSaved) {
          await removeDokuOffline(scope, dokuId);
          if (scopeKeyRef.current === currentScopeKey) {
            setSavedDokuIds((previous) => {
              const next = new Set(previous);
              next.delete(dokuId);
              return next;
            });
          }
          import('../utils/toastUtils').then(({ showSuccessToast }) =>
            showSuccessToast('Offline-Speicherung entfernt'),
          );
        } else {
          const fullDoku = await backend.doku.getDoku({
            id: dokuId,
            profileId: scope.profileId,
          });
          await saveDokuOffline(scope, fullDoku as any);
          if (scopeKeyRef.current === currentScopeKey) {
            setSavedDokuIds((previous) => new Set(previous).add(dokuId));
            setLoadedScopeKey(currentScopeKey);
          }
          import('../utils/toastUtils').then(({ showSuccessToast }) =>
            showSuccessToast('Doku offline gespeichert'),
          );
        }
      } catch (error) {
        console.error('[Offline] Failed to toggle doku:', error);
        import('../utils/toastUtils').then(({ showErrorToast }) =>
          showErrorToast('Offline-Speicherung fehlgeschlagen'),
        );
      } finally {
        finishSaving(key);
      }
    },
    [
      backend.doku,
      beginSaving,
      canUseOffline,
      currentScopeKey,
      finishSaving,
      loadedScopeKey,
      savedDokuIds,
      scope,
    ],
  );

  const toggleAudioDoku = useCallback(
    async (audioDoku: AudioDoku) => {
      if (!canUseOffline || !scope || !currentScopeKey) return;
      const key = operationKey(currentScopeKey, audioDoku.id);
      if (!beginSaving(key)) return;
      const wasSaved =
        loadedScopeKey === currentScopeKey && savedAudioDokuIds.has(audioDoku.id);

      try {
        if (wasSaved) {
          await removeAudioDokuOffline(scope, audioDoku.id);
          if (scopeKeyRef.current === currentScopeKey) {
            setSavedAudioDokuIds((previous) => {
              const next = new Set(previous);
              next.delete(audioDoku.id);
              return next;
            });
          }
          import('../utils/toastUtils').then(({ showSuccessToast }) =>
            showSuccessToast('Offline-Speicherung entfernt'),
          );
        } else {
          await saveAudioDokuOffline(scope, audioDoku);
          if (scopeKeyRef.current === currentScopeKey) {
            setSavedAudioDokuIds((previous) => new Set(previous).add(audioDoku.id));
            setLoadedScopeKey(currentScopeKey);
          }
          import('../utils/toastUtils').then(({ showSuccessToast }) =>
            showSuccessToast('Audio-Doku offline gespeichert'),
          );
        }
      } catch (error) {
        console.error('[Offline] Failed to toggle audio doku:', error);
        import('../utils/toastUtils').then(({ showErrorToast }) =>
          showErrorToast('Offline-Speicherung fehlgeschlagen'),
        );
      } finally {
        finishSaving(key);
      }
    },
    [
      beginSaving,
      canUseOffline,
      currentScopeKey,
      finishSaving,
      loadedScopeKey,
      savedAudioDokuIds,
      scope,
    ],
  );

  return {
    scope,
    canUseOffline,
    isStorySaved,
    isDokuSaved,
    isAudioDokuSaved,
    isSaving,
    toggleStory,
    toggleDoku,
    toggleAudioDoku,
  };
}
