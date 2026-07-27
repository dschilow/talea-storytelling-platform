import Constants from 'expo-constants';

/**
 * Runtime configuration.
 *
 * Precedence mirrors the web app (frontend/config.ts):
 *   1. EXPO_PUBLIC_* env var (inlined at bundle time, overridable per build)
 *   2. app.json → expo.extra
 *   3. Production default
 *
 * The retired Railway host guard is kept at this boundary for the same reason as
 * on the web: a stale env value must not silently route the app to a service
 * that no longer receives releases.
 */

const PRODUCTION_BACKEND_URL = 'https://backend-2-production-3de1.up.railway.app';
const RETIRED_PRODUCTION_BACKEND_HOST = 'talea-backend-production.up.railway.app';

function normalizeBackendUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  try {
    if (new URL(trimmed).hostname === RETIRED_PRODUCTION_BACKEND_HOST) {
      return PRODUCTION_BACKEND_URL;
    }
  } catch {
    // Keep local and custom development URLs unchanged.
  }
  return trimmed;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

export function getBackendUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (fromEnv) return normalizeBackendUrl(fromEnv);

  const fromExtra = typeof extra.backendUrl === 'string' ? extra.backendUrl : null;
  if (fromExtra) return normalizeBackendUrl(fromExtra);

  return PRODUCTION_BACKEND_URL;
}

export function getClerkPublishableKey(): string {
  const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? (extra.clerkPublishableKey as string | undefined);
  if (!key) {
    console.warn(
      '[config] Clerk publishable key missing. Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in mobile/.env before running the app.'
    );
    return '';
  }
  return key;
}

export const BACKEND_URL = getBackendUrl();
export const CLERK_PUBLISHABLE_KEY = getClerkPublishableKey();

/** Deep-link scheme registered in AndroidManifest.xml + app.json. */
export const APP_SCHEME = 'talea';

export const IS_DEV = __DEV__;
