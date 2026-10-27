// A deploy replaces every hashed chunk. A tab that still runs the previous
// build then fails on its next lazy import ("Failed to fetch dynamically
// imported module"), and a plain reload does not help while the previous
// service worker stays in charge: it serves the old app shell again. These
// helpers move the tab onto the newest build before reloading.

const STALE_BUILD_RECOVERY_KEY = 'talea:stale-build-recovery-at';
// One automatic attempt per minute, so a chunk that is really missing on the
// server cannot turn into a reload loop.
const STALE_BUILD_RECOVERY_COOLDOWN_MS = 60_000;
const INSTALL_TIMEOUT_MS = 15_000;
const TAKEOVER_TIMEOUT_MS = 5_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitWhileInstalling(worker: ServiceWorker, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (worker.state !== 'installing') {
      resolve();
      return;
    }
    const finish = () => {
      clearTimeout(timer);
      worker.removeEventListener('statechange', onStateChange);
      resolve();
    };
    const onStateChange = () => {
      if (worker.state !== 'installing') finish();
    };
    const timer = setTimeout(finish, timeoutMs);
    worker.addEventListener('statechange', onStateChange);
  });
}

async function activateNewestServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;

  // Look for a newer sw.js first: the tab may not have noticed the deploy yet.
  await registration.update().catch(() => undefined);
  if (registration.installing) {
    await waitWhileInstalling(registration.installing, INSTALL_TIMEOUT_MS);
  }

  const waiting = registration.waiting;
  if (!waiting) return;
  const takeover = new Promise<void>((resolve) => {
    navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
  });
  waiting.postMessage({ type: 'SKIP_WAITING' });
  await Promise.race([takeover, delay(TAKEOVER_TIMEOUT_MS)]);
}

/** Reloads onto the newest deployed build, not the one the old worker cached. */
export async function reloadToLatestVersion(): Promise<void> {
  try {
    await activateNewestServiceWorker();
  } catch {
    // Reload anyway; at worst this is the plain reload we had before.
  }
  window.location.reload();
}

/**
 * Called after a chunk failed to load. Returns true when an automatic reload
 * onto the newest build has started. Offline the old shell is the best we have,
 * and a reload without a service worker would end on the browser's error page.
 */
export function recoverFromStaleBuild(): boolean {
  if (!navigator.onLine) return false;
  try {
    const lastAttempt = Number(sessionStorage.getItem(STALE_BUILD_RECOVERY_KEY) || '0');
    if (Date.now() - lastAttempt < STALE_BUILD_RECOVERY_COOLDOWN_MS) return false;
    sessionStorage.setItem(STALE_BUILD_RECOVERY_KEY, String(Date.now()));
  } catch {
    return false;
  }
  void reloadToLatestVersion();
  return true;
}
