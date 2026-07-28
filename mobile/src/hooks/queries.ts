import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-expo';

import { useBackend } from '@/api/backend';
import { useOptionalChildProfiles } from '@/providers/ChildProfilesProvider';
import type { Avatar } from '@/types/avatar';
import type { Story } from '@/types/story';
import type { Doku } from '@/types/doku';

/**
 * Data access.
 *
 * Every query key is scoped by the active child profile, because the backend
 * returns different content per profile — without that, switching profiles
 * would serve the previous child's stories from cache.
 */

export const queryKeys = {
  avatars: (profileId: string | null) => ['avatars', profileId] as const,
  avatar: (id: string, profileId: string | null) => ['avatar', id, profileId] as const,
  avatarMemories: (id: string) => ['avatar-memories', id] as const,
  stories: (profileId: string | null) => ['stories', profileId] as const,
  story: (id: string, profileId: string | null) => ['story', id, profileId] as const,
  dokus: (profileId: string | null) => ['dokus', profileId] as const,
  doku: (id: string, profileId: string | null) => ['doku', id, profileId] as const,
  publicDokus: () => ['public-dokus'] as const,
  audioDokus: (profileId: string | null) => ['audio-dokus', profileId] as const,
  me: () => ['me'] as const,
  treasury: (avatarId?: string) => ['treasury', avatarId ?? 'all'] as const,
  fairyTales: () => ['fairy-tales'] as const,
  cosmos: (avatarId: string) => ['cosmos', avatarId] as const,
  communityStories: () => ['community-stories'] as const,
} as const;

function useProfileId(): string | null {
  return useOptionalChildProfiles()?.activeProfileId ?? null;
}

// ── Avatars ────────────────────────────────────────────────────────────────

export function useAvatars(options?: Partial<UseQueryOptions<Avatar[]>>) {
  const backend = useBackend();
  const { user } = useUser();
  const profileId = useProfileId();

  return useQuery<Avatar[]>({
    queryKey: queryKeys.avatars(profileId),
    queryFn: async () => {
      const response = (await backend.avatar.list({ userId: user?.id } as never)) as { avatars?: Avatar[] };
      return response?.avatars ?? [];
    },
    enabled: Boolean(user?.id),
    ...options,
  });
}

export function useAvatar(avatarId: string | undefined) {
  const backend = useBackend();
  const profileId = useProfileId();

  return useQuery<Avatar | null>({
    queryKey: queryKeys.avatar(avatarId ?? '', profileId),
    queryFn: async () => ((await backend.avatar.get({ id: avatarId! } as never)) as Avatar) ?? null,
    enabled: Boolean(avatarId),
  });
}

export function useAvatarMemories(avatarId: string | undefined) {
  const backend = useBackend();

  return useQuery({
    queryKey: queryKeys.avatarMemories(avatarId ?? ''),
    queryFn: async () => {
      const response = (await backend.avatar.getMemories({ id: avatarId! })) as { memories?: unknown[] };
      return response?.memories ?? [];
    },
    enabled: Boolean(avatarId),
  });
}

export function useDeleteAvatar() {
  const backend = useBackend();
  const queryClient = useQueryClient();
  const profileId = useProfileId();

  return useMutation({
    mutationFn: async (avatarId: string) => {
      await backend.avatar.deleteAvatar({ id: avatarId } as never);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.avatars(profileId) });
    },
  });
}

// ── Stories ────────────────────────────────────────────────────────────────

export function useStories(options?: Partial<UseQueryOptions<Story[]>>) {
  const backend = useBackend();
  const { user } = useUser();
  const profileId = useProfileId();

  return useQuery<Story[]>({
    queryKey: queryKeys.stories(profileId),
    queryFn: async () => {
      const response = (await backend.story.list({ userId: user?.id } as never)) as { stories?: Story[] };
      return response?.stories ?? [];
    },
    enabled: Boolean(user?.id),
    ...options,
  });
}

export function useStory(storyId: string | undefined) {
  const backend = useBackend();
  const profileId = useProfileId();

  return useQuery<Story | null>({
    queryKey: queryKeys.story(storyId ?? '', profileId),
    queryFn: async () => ((await backend.story.get({ id: storyId! } as never)) as Story) ?? null,
    enabled: Boolean(storyId),
    // A story that is still generating needs to be polled until it completes.
    refetchInterval: (query) => (query.state.data?.status === 'generating' ? 4000 : false),
  });
}

export function useDeleteStory() {
  const backend = useBackend();
  const queryClient = useQueryClient();
  const profileId = useProfileId();

  return useMutation({
    mutationFn: async (storyId: string) => {
      await backend.story.deleteStory({ id: storyId } as never);
    },
    onMutate: async (storyId) => {
      // Optimistic removal — the list should not sit there with a spinner while
      // the delete round-trips.
      await queryClient.cancelQueries({ queryKey: queryKeys.stories(profileId) });
      const previous = queryClient.getQueryData<Story[]>(queryKeys.stories(profileId));
      queryClient.setQueryData<Story[]>(
        queryKeys.stories(profileId),
        (current) => current?.filter((story) => story.id !== storyId) ?? []
      );
      return { previous };
    },
    onError: (_error, _storyId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.stories(profileId), context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.stories(profileId) });
    },
  });
}

export interface MarkStoryReadInput {
  storyId: string;
  storyTitle: string;
  genre?: string;
  /** Participating avatars — they are the ones whose personality develops. */
  avatarIds?: string[];
}

export interface MarkStoryReadOutcome {
  updatedAvatars: number;
  /** True when the story had already been finished — nothing was earned again. */
  alreadyCompleted: boolean;
}

/**
 * Marks a story read, which is what actually applies the avatar development.
 *
 * The payload must match /story/mark-read exactly: it previously sent
 * `{ id }`, which the endpoint does not understand — every completion failed
 * with "Story not found" and no avatar ever grew from the app.
 */
export function useMarkStoryRead() {
  const backend = useBackend();
  const queryClient = useQueryClient();
  const profileId = useProfileId();

  return useMutation<MarkStoryReadOutcome, Error, MarkStoryReadInput>({
    mutationFn: async (input) => {
      const response = (await backend.story.markRead({
        storyId: input.storyId,
        storyTitle: input.storyTitle,
        ...(input.genre ? { genre: input.genre } : {}),
        ...(profileId ? { profileId } : {}),
        ...(input.avatarIds && input.avatarIds.length > 0 ? { avatarIds: input.avatarIds } : {}),
      } as never)) as { updatedAvatars?: number; alreadyCompleted?: boolean } | undefined;

      return {
        updatedAvatars: response?.updatedAvatars ?? 0,
        alreadyCompleted: response?.alreadyCompleted === true,
      };
    },
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.stories(profileId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.story(input.storyId, profileId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.avatars(profileId) });
    },
  });
}

// ── Dokus ──────────────────────────────────────────────────────────────────

export function useDokus(options?: Partial<UseQueryOptions<Doku[]>>) {
  const backend = useBackend();
  const profileId = useProfileId();

  return useQuery<Doku[]>({
    queryKey: queryKeys.dokus(profileId),
    queryFn: async () => {
      const response = (await backend.doku.listDokus({} as never)) as { dokus?: Doku[] };
      return response?.dokus ?? [];
    },
    ...options,
  });
}

export function useDoku(dokuId: string | undefined) {
  const backend = useBackend();
  const profileId = useProfileId();

  return useQuery<Doku | null>({
    queryKey: queryKeys.doku(dokuId ?? '', profileId),
    queryFn: async () => ((await backend.doku.getDoku({ id: dokuId! } as never)) as Doku) ?? null,
    enabled: Boolean(dokuId),
    refetchInterval: (query) => (query.state.data?.status === 'generating' ? 4000 : false),
  });
}

export function usePublicDokus() {
  const backend = useBackend();

  return useQuery<Doku[]>({
    queryKey: queryKeys.publicDokus(),
    queryFn: async () => {
      const response = (await backend.doku.listPublicDokus({} as never)) as { dokus?: Doku[] };
      return response?.dokus ?? [];
    },
  });
}

export function useDeleteDoku() {
  const backend = useBackend();
  const queryClient = useQueryClient();
  const profileId = useProfileId();

  return useMutation({
    mutationFn: async (dokuId: string) => {
      await backend.doku.deleteDoku({ id: dokuId } as never);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dokus(profileId) });
    },
  });
}

// ── Cross-cutting ──────────────────────────────────────────────────────────

/** Invalidates everything that a completed generation can affect. */
export function useInvalidateContent() {
  const queryClient = useQueryClient();
  const profileId = useProfileId();

  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.stories(profileId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.avatars(profileId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dokus(profileId) });
  };
}
