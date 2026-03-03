import { useMemo, useSyncExternalStore } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { Client as BackendClient } from "../client";
import { getBackendUrl } from "../config";
import { getStoredActiveProfileId, subscribeActiveProfileChanges } from "@/lib/active-profile";

const PROFILE_METHODS: Record<"avatar" | "story" | "doku", Set<string>> = {
  avatar: new Set(["create", "deleteAvatar", "get", "list", "update"]),
  story: new Set([
    "addStoryToProfile",
    "deleteStory",
    "generate",
    "generateFromFairyTale",
    "get",
    "list",
    "markRead",
    "submitStoryQuizResult",
    "update",
    "updateStoryProfileState",
  ]),
  doku: new Set([
    "addDokuToProfile",
    "deleteDoku",
    "generateDoku",
    "getDoku",
    "listDokus",
    "listAudioDokus",
    "markRead",
    "submitDokuQuizResult",
    "updateDoku",
    "updateDokuProfileState",
  ]),
};

const TARGET_PROFILE_METHODS: Record<"avatar" | "story" | "doku", Set<string>> = {
  avatar: new Set(["adoptPoolTemplate", "cloneToProfile"]),
  story: new Set(["addStoryToProfile"]),
  doku: new Set(["addDokuToProfile"]),
};

function wrapService<T extends Record<string, unknown>>(
  service: T,
  serviceName: "avatar" | "story" | "doku",
  activeProfileId: string
): T {
  return new Proxy(service, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;

      const methodName = String(prop);
      const needsProfile = PROFILE_METHODS[serviceName].has(methodName);
      const needsTargetProfile = TARGET_PROFILE_METHODS[serviceName].has(methodName);

      if (!needsProfile && !needsTargetProfile) {
        return (value as Function).bind(target);
      }

      return (input?: unknown, ...rest: unknown[]) => {
        const params =
          input && typeof input === "object" && !Array.isArray(input)
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

// Returns a backend client configured with the user's Clerk auth token.
export function useBackend() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const userId = user?.id ?? null;

  const activeProfileId = useSyncExternalStore(
    subscribeActiveProfileChanges,
    () => getStoredActiveProfileId(userId),
    () => null
  );

  // Get the target URL from environment or auto-detect
  const target = getBackendUrl();

  // Memoize the client instance to prevent recreation on every render
  return useMemo(() => {
    const baseClient = new BackendClient(target, {
      auth: async () => {
        // Wait for Clerk to load before checking authentication
        if (!isLoaded) {
          return undefined;
        }

        // If user is not signed in, no auth header needed
        if (!isSignedIn) {
          return undefined;
        }

        // Get token for signed-in user
        const token = await getToken();
        return token ? { authorization: `Bearer ${token}` } : undefined;
      },
      requestInit: { credentials: "include" }
    });

    if (!activeProfileId) {
      return baseClient;
    }

    const avatarService = wrapService((baseClient as any).avatar, "avatar", activeProfileId);
    const storyService = wrapService((baseClient as any).story, "story", activeProfileId);
    const dokuService = wrapService((baseClient as any).doku, "doku", activeProfileId);

    return new Proxy(baseClient as any, {
      get(targetClient, prop, receiver) {
        if (prop === "avatar") return avatarService;
        if (prop === "story") return storyService;
        if (prop === "doku") return dokuService;
        return Reflect.get(targetClient, prop, receiver);
      },
    }) as BackendClient;
  }, [target, getToken, isSignedIn, isLoaded, activeProfileId]);
}
