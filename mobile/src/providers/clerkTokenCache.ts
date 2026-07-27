import * as SecureStore from 'expo-secure-store';
import type { TokenCache } from '@clerk/clerk-expo';

/**
 * Clerk token cache backed by the Android Keystore via expo-secure-store.
 *
 * Session tokens are credentials: they belong in hardware-backed storage, not in
 * AsyncStorage (which is a plaintext SQLite/file store readable on a rooted
 * device or via `adb backup` on misconfigured builds). Without a token cache
 * Clerk keeps the session in memory only, so every cold start would force a
 * re-login — unacceptable for an app children use.
 */
export const clerkTokenCache: TokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      // A corrupt keystore entry must not lock the user out — drop it and
      // fall back to a fresh sign-in.
      console.warn('[clerk] Token cache read failed, clearing entry', error);
      await SecureStore.deleteItemAsync(key).catch(() => {});
      return null;
    }
  },

  async saveToken(key: string, token: string) {
    try {
      await SecureStore.setItemAsync(key, token);
    } catch (error) {
      console.warn('[clerk] Token cache write failed', error);
    }
  },

  async clearToken(key: string) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore
    }
  },
};
