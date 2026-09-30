import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useBackend } from './useBackend';
import { useUserAccess } from '../contexts/UserAccessContext';
import { useOptionalChildProfiles } from '../contexts/ChildProfilesContext';
import {
  saveStoryOffline,
  saveDokuOffline,
  saveAudioDokuOffline,
  saveGeneratedAudiosOffline,
  removeStoryOffline,
  removeDokuOffline,
  removeAudioDokuOffline,
  removeGeneratedAudioOffline,
  getAllSavedIds,
  listOfflineGeneratedAudioIdsBySource,
  storeLastOfflineScope,
  type OfflineCacheScope,
} from '../utils/offlineDb';
import { fetchGeneratedAudioBySource } from '../utils/audioLibraryApi';
import type { AudioDoku } from '../types/audio-doku';
import type { GeneratedAudioSourceType } from '../types/generated-audio';
import { offlineLimitForPlan, recordOfflineLicense } from '../utils/offlineLicense';
import { PLAN_TITLES } from '../constants/planCatalog';

function scopeKey(scope: OfflineCacheScope): string {
  return JSON.stringify([scope.userId, scope.profileId]);
}

function operationKey(cacheScopeKey: string, contentId: string): string {
  return JSON.stringify([cacheScopeKey, contentId]);
}

// "Saved" must not be announced when the audio file itself did not make it —
// that is exactly the file the child will go looking for on the plane.
function reportSaveResult(label: string, failedMedia: number): void {
  void import('../utils/toastUtils').then(({ showSuccessToast, showWarningToast }) => {
    if (failedMedia > 0) {
      showWarningToast(
        `${label} nur teilweise offline gespeichert (${failedMedia} Datei${failedMedia === 1 ? '' : 'en'} fehlen). Bitte mit Internet erneut versuchen.`,
      );
      return;
    }
    showSuccessToast(`${label} offline gespeichert`);
  });
}

export function useOfflineStorage() {
  const { subscription, isAdmin, isLoading: accessLoading } = useUserAccess();
  const backend = useBackend();
  const { getToken } = useAuth();
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

  // Offline saving is part of Starter and above; the number of saved items is
  // capped per child profile (null = unlimited, for admins).
  const offlineLimit = subscription ? offlineLimitForPlan(subscription, isAdmin) : 0;
  const hasOfflineEntitlement = offlineLimit === null || offlineLimit > 0;
  const canUseOffline = hasOfflineEntitlement && !!scope && !storageUnavailable;
  const savedCount = savedStoryIds.size + savedDokuIds.size + savedAudioDokuIds.size;

  // Every online visit confirms the plan; offline access expires without it.
  useEffect(() => {
    if (!user?.id || !subscription || accessLoading) return;
    recordOfflineLicense(user.id, subscription, isAdmin);
  }, [accessLoading, isAdmin, subscription, user?.id]);

  // True (after telling the user) when another item would exceed the plan limit.
  const offlineLimitReached = useCallback((): boolean => {
    if (offlineLimit === null || savedCount < offlineLimit) return false;
    import('../utils/toastUtils').then(({ showWarningToast }) =>
      showWarningToast(
        `Dein ${subscription ? PLAN_TITLES[subscription] : ''}-Plan erlaubt bis zu ${offlineLimit} Offline-Inhalte pro Kinderprofil. Entferne einen gespeicherten Inhalt oder upgrade dein Abo.`,
      ),
    );
    return true;
  }, [offlineLimit, savedCount, subscription]);

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

  // Saving a story or doku for offline use takes its narration along. Text
  // without audio is a half-saved item: the child opens it on the train, hits
  // play, and nothing happens. Audio is best-effort — a story that has no
  // generated audio yet, or a failing audio API, must never fail the save.
  // Resolves with the number of audio/cover files that could not be stored.
  const saveRelatedAudioOffline = useCallback(
    async (
      cacheScope: OfflineCacheScope,
      sourceType: GeneratedAudioSourceType,
      sourceId: string,
    ): Promise<number> => {
      try {
        const entries = await fetchGeneratedAudioBySource(getToken, sourceType, sourceId);
        if (entries.length === 0) return 0;
        const result = await saveGeneratedAudiosOffline(cacheScope, entries);
        return result.failedMedia;
      } catch (error) {
        console.warn(`[Offline] Could not save ${sourceType} audio for ${sourceId}:`, error);
        return 1;
      }
    },
    [getToken],
  );

  const removeRelatedAudioOffline = useCallback(
    async (
      cacheScope: OfflineCacheScope,
      sourceType: GeneratedAudioSourceType,
      sourceId: string,
    ): Promise<void> => {
      try {
        const entryIds = await listOfflineGeneratedAudioIdsBySource(
          cacheScope,
          sourceType,
          sourceId,
        );
        await Promise.allSettled(
          entryIds.map((entryId) => removeGeneratedAudioOffline(cacheScope, entryId)),
        );
      } catch (error) {
        console.warn(`[Offline] Could not remove ${sourceType} audio for ${sourceId}:`, error);
      }
    },
    [],
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
      if (!wasSaved && offlineLimitReached()) {
        finishSaving(key);
        return;
      }

      try {
        if (wasSaved) {
          await removeRelatedAudioOffline(scope, 'story', storyId);
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
          const saved = await saveStoryOffline(scope, fullStory as any);
          const failedAudio = await saveRelatedAudioOffline(scope, 'story', storyId);
          if (scopeKeyRef.current === currentScopeKey) {
            setSavedStoryIds((previous) => new Set(previous).add(storyId));
            setLoadedScopeKey(currentScopeKey);
          }
          reportSaveResult('Geschichte', saved.failedMedia + failedAudio);
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
      offlineLimitReached,
      removeRelatedAudioOffline,
      savedStoryIds,
      saveRelatedAudioOffline,
      scope,
    ],
  );

  const toggleDoku = useCallback(
    async (dokuId: string) => {
      if (!canUseOffline || !scope || !currentScopeKey) return;
      const key = operationKey(currentScopeKey, dokuId);
      if (!beginSaving(key)) return;
      const wasSaved = loadedScopeKey === currentScopeKey && savedDokuIds.has(dokuId);
      if (!wasSaved && offlineLimitReached()) {
        finishSaving(key);
        return;
      }

      try {
        if (wasSaved) {
          await removeRelatedAudioOffline(scope, 'doku', dokuId);
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
          const saved = await saveDokuOffline(scope, fullDoku as any);
          const failedAudio = await saveRelatedAudioOffline(scope, 'doku', dokuId);
          if (scopeKeyRef.current === currentScopeKey) {
            setSavedDokuIds((previous) => new Set(previous).add(dokuId));
            setLoadedScopeKey(currentScopeKey);
          }
          reportSaveResult('Doku', saved.failedMedia + failedAudio);
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
      offlineLimitReached,
      removeRelatedAudioOffline,
      savedDokuIds,
      saveRelatedAudioOffline,
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
      if (!wasSaved && audioDoku.locked) {
        import('../utils/toastUtils').then(({ showWarningToast }) =>
          showWarningToast(audioDoku.lockReason || 'Diese Folge ist in deinem Plan nicht enthalten.'),
        );
        finishSaving(key);
        return;
      }
      if (!wasSaved && offlineLimitReached()) {
        finishSaving(key);
        return;
      }

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
          const saved = await saveAudioDokuOffline(scope, audioDoku);
          if (scopeKeyRef.current === currentScopeKey) {
            setSavedAudioDokuIds((previous) => new Set(previous).add(audioDoku.id));
            setLoadedScopeKey(currentScopeKey);
          }
          reportSaveResult('Audio-Doku', saved.failedMedia);
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
      offlineLimitReached,
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
