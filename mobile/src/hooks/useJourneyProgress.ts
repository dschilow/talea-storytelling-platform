import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { useOptionalChildProfiles } from '@/providers/ChildProfilesProvider';
import { storage } from '@/lib/storage';
import { initialJourneyProgress, finishJourneySource, type JourneySource } from '@/lib/journeyModel';
import type { ProgressState } from '@/lib/TaleaLearningPathTypes';

const queues = new Map<string, Promise<unknown>>();
function mutate(key: string, operation: (state: ProgressState) => ProgressState) {
  const next = (queues.get(key) ?? Promise.resolve()).then(async () => {
    const state = await storage.getJSON(key, initialJourneyProgress());
    await storage.setJSONOrThrow(key, operation(state));
  });
  const settled = next.catch(() => {});
  queues.set(key, settled);
  void settled.then(() => { if (queues.get(key) === settled) queues.delete(key); });
  return next;
}
export function useJourneyProgress(avatarId?: string | null) {
  const { userId } = useAuth();
  const profileId = useOptionalChildProfiles()?.activeProfileId;
  const queryClient = useQueryClient();
  const scope = `talea.journey:${userId}:${profileId}:`;
  const key = `${scope}${avatarId ?? 'global'}`;
  const queryKey = ['journey-progress', key];
  const progress = useQuery({ queryKey, queryFn: () => storage.getJSON(key, initialJourneyProgress()) });
  return { progress: progress.data ?? initialJourneyProgress(), isLoading: progress.isLoading,
    update: async (operation: (state: ProgressState) => ProgressState) => { await mutate(key, operation); await queryClient.invalidateQueries({ queryKey }); },
    complete: async (source: JourneySource) => {
      const keys = await storage.keys(scope);
      await Promise.all(keys.map((storageKey) => mutate(storageKey, (state) => finishJourneySource(state, source))));
      await queryClient.invalidateQueries({ queryKey: ['journey-progress'] });
    },
  };
}
