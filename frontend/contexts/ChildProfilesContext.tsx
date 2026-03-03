import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useBackend } from "@/hooks/useBackend";
import { clearStoredActiveProfileId, getStoredActiveProfileId, setStoredActiveProfileId } from "@/lib/active-profile";

export type SubscriptionPlan = "free" | "starter" | "familie" | "premium";

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

type CreateProfileInput = {
  name: string;
  avatarColor?: string;
  age?: number;
  readingLevel?: string;
};

type UpdateProfileInput = {
  profileId: string;
  name?: string;
  avatarColor?: string | null;
  age?: number | null;
  readingLevel?: string | null;
  isDefault?: boolean;
};

type SaveBudgetInput = {
  profileId: string;
  storySoftCap?: number | null;
  storyHardCap?: number | null;
  dokuSoftCap?: number | null;
  dokuHardCap?: number | null;
  allowFamilyReserve?: boolean;
};

type SaveReserveInput = {
  story?: number;
  doku?: number;
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
  saveFamilyReserve: (input: SaveReserveInput) => Promise<void>;
};

const ChildProfilesContext = createContext<ChildProfilesContextValue | undefined>(undefined);

const emptyReserve: FamilyReserveState = {
  story: 0,
  doku: 0,
  storyUsed: 0,
  dokuUsed: 0,
};

function pickInitialActiveProfileId(userId: string, profiles: ProfileDetails[]): string | null {
  if (profiles.length === 0) return null;

  const fromStorage = getStoredActiveProfileId(userId);
  if (fromStorage && profiles.some((profile) => profile.id === fromStorage)) {
    return fromStorage;
  }

  const defaultProfile = profiles.find((profile) => profile.isDefault);
  return defaultProfile?.id || profiles[0].id;
}

export const ChildProfilesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const backend = useBackend();
  const { isLoaded, isSignedIn, user } = useUser();

  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [overview, setOverview] = useState<ProfilesOverview | null>(null);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn || !user?.id) {
      setOverview(null);
      setActiveProfileIdState(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      let nextOverview: ProfilesOverview;
      try {
        nextOverview = (await backend.user.getProfilesOverview()) as unknown as ProfilesOverview;
      } catch (overviewError) {
        // Fallback for partially updated backends: /user/me already contains profiles + limit.
        const fallback = (await backend.user.me()) as unknown as {
          subscription?: SubscriptionPlan;
          profileLimit?: number;
          profiles?: ChildProfile[];
        };
        nextOverview = {
          plan: fallback.subscription || "free",
          profileLimit: fallback.profileLimit || 1,
          profiles: (fallback.profiles || []).map((profile) => ({
            ...profile,
            budget: null,
            usage: {
              profileId: profile.id,
              storyCount: 0,
              dokuCount: 0,
              audioCount: 0,
            },
          })),
          reserve: emptyReserve,
        };
        console.warn("[ChildProfiles] getProfilesOverview failed, using /user/me fallback", overviewError);
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

  const runMutation = useCallback(
    async <T,>(task: () => Promise<T>): Promise<T> => {
      setIsMutating(true);
      try {
        return await task();
      } finally {
        setIsMutating(false);
      }
    },
    []
  );

  const createProfile = useCallback(
    async (input: CreateProfileInput): Promise<ChildProfile> =>
      runMutation(async () => {
        const created = (await backend.user.createProfile({
          name: input.name,
          avatarColor: input.avatarColor,
          age: input.age,
          readingLevel: input.readingLevel,
        })) as unknown as ChildProfile;
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
    async (input: UpdateProfileInput): Promise<ChildProfile> =>
      runMutation(async () => {
        const updated = (await backend.user.updateProfile({
          profileId: input.profileId,
          name: input.name,
          avatarColor: input.avatarColor,
          age: input.age,
          readingLevel: input.readingLevel,
          isDefault: input.isDefault,
        })) as unknown as ChildProfile;
        await refresh();
        return updated;
      }),
    [backend, refresh, runMutation]
  );

  const deleteProfile = useCallback(
    async (profileId: string): Promise<void> =>
      runMutation(async () => {
        const response = await backend.user.deleteProfile({ profileId });
        await refresh();

        const newDefault = (response as { newDefaultProfileId?: string }).newDefaultProfileId;
        if (user?.id && newDefault) {
          setStoredActiveProfileId(user.id, newDefault);
          setActiveProfileIdState(newDefault);
        }
      }),
    [backend, refresh, runMutation, user?.id]
  );

  const saveProfileBudget = useCallback(
    async (input: SaveBudgetInput): Promise<void> =>
      runMutation(async () => {
        await backend.user.saveProfileBudget({
          profileId: input.profileId,
          storySoftCap: input.storySoftCap,
          storyHardCap: input.storyHardCap,
          dokuSoftCap: input.dokuSoftCap,
          dokuHardCap: input.dokuHardCap,
          allowFamilyReserve: input.allowFamilyReserve,
        });
        await refresh();
      }),
    [backend, refresh, runMutation]
  );

  const saveFamilyReserve = useCallback(
    async (input: SaveReserveInput): Promise<void> =>
      runMutation(async () => {
        await backend.user.saveFamilyReserve({
          story: input.story,
          doku: input.doku,
        });
        await refresh();
      }),
    [backend, refresh, runMutation]
  );

  const profiles = overview?.profiles ?? [];
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) || null;

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
};

export function useChildProfiles(): ChildProfilesContextValue {
  const context = useContext(ChildProfilesContext);
  if (!context) {
    throw new Error("useChildProfiles must be used within ChildProfilesProvider");
  }
  return context;
}

export function useOptionalChildProfiles(): ChildProfilesContextValue | null {
  return useContext(ChildProfilesContext) ?? null;
}
