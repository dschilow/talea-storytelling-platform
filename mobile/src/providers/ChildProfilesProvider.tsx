import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useUser } from '@clerk/clerk-expo';

import { useBackend } from '@/api/backend';
import {
  clearStoredActiveProfileId,
  getStoredActiveProfileId,
  hydrateActiveProfileId,
  setStoredActiveProfileId,
} from './ActiveProfileStore';
import type { SubscriptionPlan } from './UserAccessProvider';

/** Ported from frontend/contexts/ChildProfilesContext.tsx. */

export type ChildProfile = {
  id: string;
  userId: string;
  name: string;
  avatarColor?: string;
  age?: number;
  readingLevel?: string;
  interests: string[];
  noGoTopics: string[];
  learningGoals: string[];
  childAvatarId?: string;
  competencyState: Record<string, unknown>;
  preferredAvatarIds: string[];
  quizSettings: Record<string, unknown>;
  isDefault: boolean;
  isArchived: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type ProfileBudgetPolicy = {
  storySoftCap: number | null;
  storyHardCap: number | null;
  dokuSoftCap: number | null;
  dokuHardCap: number | null;
  allowFamilyReserve: boolean;
};

export type ProfileUsage = {
  profileId: string;
  storyCount: number;
  dokuCount: number;
  audioCount: number;
};

export type ProfileDetails = ChildProfile & {
  budget: ProfileBudgetPolicy | null;
  usage: ProfileUsage;
};

export type FamilyReserveState = {
  story: number;
  doku: number;
  storyUsed: number;
  dokuUsed: number;
};

type ProfilesOverview = {
  plan: SubscriptionPlan;
  profileLimit: number;
  profiles: ProfileDetails[];
  reserve: FamilyReserveState;
};

export type CreateProfileInput = {
  name: string;
  avatarColor?: string;
  age?: number;
  readingLevel?: string;
  interests?: string[];
  noGoTopics?: string[];
  learningGoals?: string[];
  childAvatarId?: string;
  preferredAvatarIds?: string[];
};

export type UpdateProfileInput = {
  profileId: string;
  name?: string;
  avatarColor?: string | null;
  age?: number | null;
  readingLevel?: string | null;
  interests?: string[];
  noGoTopics?: string[];
  learningGoals?: string[];
  childAvatarId?: string | null;
  preferredAvatarIds?: string[];
  isDefault?: boolean;
};

export type SaveBudgetInput = {
  profileId: string;
  storySoftCap?: number | null;
  storyHardCap?: number | null;
  dokuSoftCap?: number | null;
  dokuHardCap?: number | null;
  allowFamilyReserve?: boolean;
};

type ChildProfilesContextValue = {
  isLoading: boolean;
  isMutating: boolean;
  plan: SubscriptionPlan | null;
  profileLimit: number;
  profiles: ProfileDetails[];
  reserve: FamilyReserveState | null;
  activeProfileId: string | null;
  activeProfile: ProfileDetails | null;
  refresh: () => Promise<void>;
  setActiveProfileId: (profileId: string) => void;
  createProfile: (input: CreateProfileInput) => Promise<ChildProfile>;
  updateProfile: (input: UpdateProfileInput) => Promise<ChildProfile>;
  deleteProfile: (profileId: string) => Promise<void>;
  saveProfileBudget: (input: SaveBudgetInput) => Promise<void>;
  saveFamilyReserve: (input: { story?: number; doku?: number }) => Promise<void>;
};

const ChildProfilesContext = createContext<ChildProfilesContextValue | undefined>(undefined);

const emptyReserve: FamilyReserveState = { story: 0, doku: 0, storyUsed: 0, dokuUsed: 0 };

function pickInitialActiveProfileId(userId: string, profiles: ProfileDetails[]): string | null {
  if (profiles.length === 0) return null;

  const fromStorage = getStoredActiveProfileId(userId);
  if (fromStorage && profiles.some((profile) => profile.id === fromStorage)) {
    return fromStorage;
  }

  const defaultProfile = profiles.find((profile) => profile.isDefault);
  return defaultProfile?.id ?? profiles[0].id;
}

export function ChildProfilesProvider({ children }: { children: ReactNode }) {
  const backend = useBackend();
  const { isLoaded, isSignedIn, user } = useUser();

  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [overview, setOverview] = useState<ProfilesOverview | null>(null);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isLoaded) return;

    if (!isSignedIn || !user?.id) {
      setOverview(null);
      setActiveProfileIdState(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // The stored id must be in memory before we can prefer it over the default.
      await hydrateActiveProfileId(user.id);

      let nextOverview: ProfilesOverview;
      try {
        nextOverview = (await backend.user.getProfilesOverview()) as unknown as ProfilesOverview;
      } catch (overviewError) {
        // Fallback for partially updated backends: /user/me already carries profiles + limit.
        const fallback = (await backend.user.me()) as unknown as {
          subscription?: SubscriptionPlan;
          profileLimit?: number;
          profiles?: ChildProfile[];
        };
        nextOverview = {
          plan: fallback.subscription ?? 'free',
          profileLimit: fallback.profileLimit ?? 1,
          profiles: (fallback.profiles ?? []).map((profile) => ({
            ...profile,
            budget: null,
            usage: { profileId: profile.id, storyCount: 0, dokuCount: 0, audioCount: 0 },
          })),
          reserve: emptyReserve,
        };
        console.warn('[ChildProfiles] getProfilesOverview failed, using /user/me fallback', overviewError);
      }

      setOverview(nextOverview);

      const nextActiveId = pickInitialActiveProfileId(user.id, nextOverview.profiles);
      setActiveProfileIdState(nextActiveId);
      if (nextActiveId) {
        setStoredActiveProfileId(user.id, nextActiveId);
      } else {
        clearStoredActiveProfileId(user.id);
      }
    } finally {
      setIsLoading(false);
    }
  }, [backend, isLoaded, isSignedIn, user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setActiveProfileId = useCallback(
    (profileId: string) => {
      if (!user?.id || !overview) return;
      if (!overview.profiles.some((profile) => profile.id === profileId)) return;
      setActiveProfileIdState(profileId);
      setStoredActiveProfileId(user.id, profileId);
    },
    [overview, user?.id]
  );

  const runMutation = useCallback(async <T,>(task: () => Promise<T>): Promise<T> => {
    setIsMutating(true);
    try {
      return await task();
    } finally {
      setIsMutating(false);
    }
  }, []);

  const createProfile = useCallback(
    (input: CreateProfileInput) =>
      runMutation(async () => {
        const created = (await backend.user.createProfile(input as any)) as unknown as ChildProfile;
        await refresh();
        if (user?.id) {
          setStoredActiveProfileId(user.id, created.id);
          setActiveProfileIdState(created.id);
        }
        return created;
      }),
    [backend, refresh, runMutation, user?.id]
  );

  const updateProfile = useCallback(
    (input: UpdateProfileInput) =>
      runMutation(async () => {
        const updated = (await backend.user.updateProfile(input as any)) as unknown as ChildProfile;
        await refresh();
        return updated;
      }),
    [backend, refresh, runMutation]
  );

  const deleteProfile = useCallback(
    (profileId: string) =>
      runMutation(async () => {
        const response = (await backend.user.deleteProfile({ profileId })) as { newDefaultProfileId?: string };
        await refresh();
        if (user?.id && response?.newDefaultProfileId) {
          setStoredActiveProfileId(user.id, response.newDefaultProfileId);
          setActiveProfileIdState(response.newDefaultProfileId);
        }
      }),
    [backend, refresh, runMutation, user?.id]
  );

  const saveProfileBudget = useCallback(
    (input: SaveBudgetInput) =>
      runMutation(async () => {
        await backend.user.saveProfileBudget(input as any);
        await refresh();
      }),
    [backend, refresh, runMutation]
  );

  const saveFamilyReserve = useCallback(
    (input: { story?: number; doku?: number }) =>
      runMutation(async () => {
        await backend.user.saveFamilyReserve(input as any);
        await refresh();
      }),
    [backend, refresh, runMutation]
  );

  const profiles = overview?.profiles ?? [];
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? null;

  const value = useMemo<ChildProfilesContextValue>(
    () => ({
      isLoading,
      isMutating,
      plan: overview?.plan ?? null,
      profileLimit: overview?.profileLimit ?? 1,
      profiles,
      reserve: overview?.reserve ?? emptyReserve,
      activeProfileId,
      activeProfile,
      refresh,
      setActiveProfileId,
      createProfile,
      updateProfile,
      deleteProfile,
      saveProfileBudget,
      saveFamilyReserve,
    }),
    [
      activeProfile,
      activeProfileId,
      createProfile,
      deleteProfile,
      isLoading,
      isMutating,
      overview?.plan,
      overview?.profileLimit,
      overview?.reserve,
      profiles,
      refresh,
      saveFamilyReserve,
      saveProfileBudget,
      setActiveProfileId,
      updateProfile,
    ]
  );

  return <ChildProfilesContext.Provider value={value}>{children}</ChildProfilesContext.Provider>;
}

export function useChildProfiles(): ChildProfilesContextValue {
  const context = useContext(ChildProfilesContext);
  if (!context) throw new Error('useChildProfiles must be used within ChildProfilesProvider');
  return context;
}

export function useOptionalChildProfiles(): ChildProfilesContextValue | null {
  return useContext(ChildProfilesContext) ?? null;
}
