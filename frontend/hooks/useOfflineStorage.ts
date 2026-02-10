import { useState, useEffect, useCallback } from 'react';
import { useBackend } from './useBackend';
import { useUserAccess } from '../contexts/UserAccessContext';
import {
  saveStoryOffline,
  saveDokuOffline,
  saveAudioDokuOffline,
  removeStoryOffline,
  removeDokuOffline,
  removeAudioDokuOffline,
  getAllSavedIds,
} from '../utils/offlineDb';
import type { AudioDoku } from '../types/audio-doku';

export function useOfflineStorage() {
  const { subscription } = useUserAccess();
  const backend = useBackend();

  const [savedStoryIds, setSavedStoryIds] = useState<Set<string>>(new Set());
  const [savedDokuIds, setSavedDokuIds] = useState<Set<string>>(new Set());
  const [savedAudioDokuIds, setSavedAudioDokuIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const canUseOffline = subscription === 'familie' || subscription === 'premium';

  const loadSavedIds = useCallback(async () => {
    if (!canUseOffline) return;
    try {
      const ids = await getAllSavedIds();
      setSavedStoryIds(new Set(ids.stories));
      setSavedDokuIds(new Set(ids.dokus));
      setSavedAudioDokuIds(new Set(ids.audioDokus));
    } catch (error) {
      console.error('[Offline] Failed to load saved IDs:', error);
    }
  }, [canUseOffline]);

  useEffect(() => {
    void loadSavedIds();
  }, [loadSavedIds]);

  const isStorySaved = useCallback((id: string) => savedStoryIds.has(id), [savedStoryIds]);
  const isDokuSaved = useCallback((id: string) => savedDokuIds.has(id), [savedDokuIds]);
  const isAudioDokuSaved = useCallback((id: string) => savedAudioDokuIds.has(id), [savedAudioDokuIds]);
  const isSaving = useCallback((id: string) => savingIds.has(id), [savingIds]);

  const addSavingId = (id: string) => setSavingIds((prev) => new Set(prev).add(id));
  const removeSavingId = (id: string) =>
    setSavingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const toggleStory = useCallback(
    async (storyId: string) => {
      if (savingIds.has(storyId)) return;
      addSavingId(storyId);

      try {
        if (savedStoryIds.has(storyId)) {
          await removeStoryOffline(storyId);
          setSavedStoryIds((prev) => {
            const next = new Set(prev);
            next.delete(storyId);
            return next;
          });
          import('../utils/toastUtils').then(({ showSuccessToast }) =>
            showSuccessToast('Offline-Speicherung entfernt')
          );
        } else {
          const fullStory = await backend.story.get({ id: storyId });
          await saveStoryOffline(fullStory as any);
          setSavedStoryIds((prev) => new Set(prev).add(storyId));
          import('../utils/toastUtils').then(({ showSuccessToast }) =>
            showSuccessToast('Geschichte offline gespeichert')
          );
        }
      } catch (error) {
        console.error('[Offline] Failed to toggle story:', error);
        import('../utils/toastUtils').then(({ showErrorToast }) =>
          showErrorToast('Offline-Speicherung fehlgeschlagen')
        );
      } finally {
        removeSavingId(storyId);
      }
    },
    [backend, savedStoryIds, savingIds]
  );

  const toggleDoku = useCallback(
    async (dokuId: string) => {
      if (savingIds.has(dokuId)) return;
      addSavingId(dokuId);

      try {
        if (savedDokuIds.has(dokuId)) {
          await removeDokuOffline(dokuId);
          setSavedDokuIds((prev) => {
            const next = new Set(prev);
            next.delete(dokuId);
            return next;
          });
          import('../utils/toastUtils').then(({ showSuccessToast }) =>
            showSuccessToast('Offline-Speicherung entfernt')
          );
        } else {
          const fullDoku = await backend.doku.getDoku({ id: dokuId });
          await saveDokuOffline(fullDoku as any);
          setSavedDokuIds((prev) => new Set(prev).add(dokuId));
          import('../utils/toastUtils').then(({ showSuccessToast }) =>
            showSuccessToast('Doku offline gespeichert')
          );
        }
      } catch (error) {
        console.error('[Offline] Failed to toggle doku:', error);
        import('../utils/toastUtils').then(({ showErrorToast }) =>
          showErrorToast('Offline-Speicherung fehlgeschlagen')
        );
      } finally {
        removeSavingId(dokuId);
      }
    },
    [backend, savedDokuIds, savingIds]
  );

  const toggleAudioDoku = useCallback(
    async (audioDoku: AudioDoku) => {
      if (savingIds.has(audioDoku.id)) return;
      addSavingId(audioDoku.id);

      try {
        if (savedAudioDokuIds.has(audioDoku.id)) {
          await removeAudioDokuOffline(audioDoku.id);
          setSavedAudioDokuIds((prev) => {
            const next = new Set(prev);
            next.delete(audioDoku.id);
            return next;
          });
          import('../utils/toastUtils').then(({ showSuccessToast }) =>
            showSuccessToast('Offline-Speicherung entfernt')
          );
        } else {
          await saveAudioDokuOffline(audioDoku);
          setSavedAudioDokuIds((prev) => new Set(prev).add(audioDoku.id));
          import('../utils/toastUtils').then(({ showSuccessToast }) =>
            showSuccessToast('Audio-Doku offline gespeichert')
          );
        }
      } catch (error) {
        console.error('[Offline] Failed to toggle audio doku:', error);
        import('../utils/toastUtils').then(({ showErrorToast }) =>
          showErrorToast('Offline-Speicherung fehlgeschlagen')
        );
      } finally {
        removeSavingId(audioDoku.id);
      }
    },
    [savedAudioDokuIds, savingIds]
  );

  return {
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
