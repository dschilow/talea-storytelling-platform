import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Thin typed wrapper over AsyncStorage.
 *
 * Every read is defensive: a corrupt or partially written JSON blob must never
 * crash startup, so parse failures resolve to the caller's fallback and evict
 * the bad key.
 */
export const StorageKeys = {
  theme: 'talea_theme',
  language: 'talea_language',
  activeProfile: 'talea_active_profile',
  lastOfflineScope: 'talea_offline_scope',
  offlineStories: 'talea_offline_stories',
  offlineDokus: 'talea_offline_dokus',
  audioCacheIndex: 'talea_audio_cache_index',
  readingProgress: 'talea_reading_progress',
  onboardingSeen: 'talea_onboarding_seen',
  developerMode: 'talea_developer_mode',
  lastStoryWizardState: 'talea_story_wizard_draft',
  parentalUnlockedUntil: 'talea_parental_unlocked_until',
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys] | (string & {});

export const storage = {
  async getString(key: StorageKey): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async setString(key: StorageKey, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // Storage failures are non-fatal — the app keeps working in-memory.
    }
  },

  async getJSON<T>(key: StorageKey, fallback: T): Promise<T> {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      await AsyncStorage.removeItem(key).catch(() => {});
      return fallback;
    }
  },

  async setJSON(key: StorageKey, value: unknown): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  },

  async remove(key: StorageKey): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // ignore
    }
  },

  async multiRemove(keys: StorageKey[]): Promise<void> {
    try {
      await AsyncStorage.multiRemove(keys as string[]);
    } catch {
      // ignore
    }
  },

  async keys(prefix?: string): Promise<string[]> {
    try {
      const all = await AsyncStorage.getAllKeys();
      return prefix ? all.filter((key) => key.startsWith(prefix)) : [...all];
    } catch {
      return [];
    }
  },
};

/** Per-user scoping so switching Clerk accounts never leaks the other's state. */
export function scopedKey(base: string, userId: string | null | undefined): string {
  return userId ? `${base}:${userId}` : base;
}
