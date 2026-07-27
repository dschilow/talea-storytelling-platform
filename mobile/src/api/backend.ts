import { useMemo } from 'react';
import { useAuth, useUser } from '@clerk/clerk-expo';

import { Client as BackendClient } from './client';
import { BACKEND_URL } from '@/config';
import { useActiveProfileId } from '@/providers/ActiveProfileStore';

/**
 * Backend access, ported from frontend/hooks/useBackend.ts.
 *
 * Two responsibilities:
 *   1. Attach the Clerk session token to every request.
 *   2. Transparently inject the active child profile id into the calls that are
 *      profile-scoped, so screens never have to thread it through by hand. The
 *      method lists below are the contract with the backend and must stay in
 *      sync with the web client.
 */

const PROFILE_METHODS: Record<'avatar' | 'story' | 'doku', Set<string>> = {
  avatar: new Set(['create', 'deleteAvatar', 'get', 'list', 'update']),
  story: new Set([
    'addStoryToProfile',
    'deleteStory',
    'generate',
    'generateFromFairyTale',
    'get',
    'list',
    'markRead',
    'submitStoryQuizResult',
    'update',
    'updateStoryProfileState',
  ]),
  doku: new Set([
    'addDokuToProfile',
    'deleteDoku',
    'generateDoku',
    'getDoku',
    'listDokus',
    'listAudioDokus',
    'markRead',
    'submitDokuQuizResult',
    'updateDoku',
    'updateDokuProfileState',
  ]),
};

const TARGET_PROFILE_METHODS: Record<'avatar' | 'story' | 'doku', Set<string>> = {
  avatar: new Set(['adoptPoolTemplate', 'cloneToProfile']),
  story: new Set(['addStoryToProfile']),
  doku: new Set(['addDokuToProfile']),
};

function wrapService<T extends Record<string, unknown>>(
  service: T,
  serviceName: 'avatar' | 'story' | 'doku',
  activeProfileId: string
): T {
  return new Proxy(service, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;

      const methodName = String(prop);
      const needsProfile = PROFILE_METHODS[serviceName].has(methodName);
      const needsTargetProfile = TARGET_PROFILE_METHODS[serviceName].has(methodName);

      if (!needsProfile && !needsTargetProfile) {
        return (value as Function).bind(target);
      }

      return (input?: unknown, ...rest: unknown[]) => {
        const params =
          input && typeof input === 'object' && !Array.isArray(input)
            ? ({ ...(input as Record<string, unknown>) } as Record<string, unknown>)
            : ({} as Record<string, unknown>);

        if (needsProfile && params.profileId == null) {
          params.profileId = activeProfileId;
        }
        if (needsTargetProfile && params.targetProfileId == null) {
          params.targetProfileId = activeProfileId;
        }

        return (value as Function).call(target, params, ...rest);
      };
    },
  }) as T;
}

export type Backend = BackendClient;

export function useBackend(): Backend {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const activeProfileId = useActiveProfileId(user?.id ?? null);

  return useMemo(() => {
    const baseClient = new BackendClient(BACKEND_URL, {
      auth: async () => {
        if (!isLoaded || !isSignedIn) return undefined;
        try {
          const token = await getToken();
          return token ? { authorization: `Bearer ${token}` } : undefined;
        } catch (error) {
          console.warn('[backend] Failed to resolve Clerk token', error);
          return undefined;
        }
      },
    });

    if (!activeProfileId) {
      return baseClient;
    }

    const avatarService = wrapService((baseClient as any).avatar, 'avatar', activeProfileId);
    const storyService = wrapService((baseClient as any).story, 'story', activeProfileId);
    const dokuService = wrapService((baseClient as any).doku, 'doku', activeProfileId);

    return new Proxy(baseClient as any, {
      get(targetClient, prop, receiver) {
        if (prop === 'avatar') return avatarService;
        if (prop === 'story') return storyService;
        if (prop === 'doku') return dokuService;
        return Reflect.get(targetClient, prop, receiver);
      },
    }) as BackendClient;
  }, [getToken, isSignedIn, isLoaded, activeProfileId]);
}

/**
 * Non-hook client for use outside React (background audio prefetch, cache warmers).
 * Callers supply the token resolver themselves.
 */
export function createBackendClient(getToken: () => Promise<string | null>): BackendClient {
  return new BackendClient(BACKEND_URL, {
    auth: async () => {
      const token = await getToken();
      return token ? { authorization: `Bearer ${token}` } : undefined;
    },
  });
}
