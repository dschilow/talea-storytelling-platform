const EVENT_NAME = "talea:active-profile-changed";
const KEY_PREFIX = "talea.activeProfile";

function storageKey(userId: string) {
  return `${KEY_PREFIX}:${userId}`;
}

export function getStoredActiveProfileId(userId: string | null | undefined): string | null {
  if (!userId || typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(storageKey(userId));
}

export function setStoredActiveProfileId(userId: string, profileId: string): void {
  if (!userId || typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey(userId), profileId);
  window.dispatchEvent(
    new CustomEvent(EVENT_NAME, {
      detail: { userId, profileId },
    })
  );
}

export function clearStoredActiveProfileId(userId: string): void {
  if (!userId || typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(storageKey(userId));
  window.dispatchEvent(
    new CustomEvent(EVENT_NAME, {
      detail: { userId, profileId: null },
    })
  );
}

export function subscribeActiveProfileChanges(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key?.startsWith(KEY_PREFIX)) {
      listener();
    }
  };

  window.addEventListener(EVENT_NAME, listener as EventListener);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(EVENT_NAME, listener as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}
