/**
 * Single source of truth for "is Talea actually online".
 *
 * `navigator.onLine` only reports whether a network interface is up, so a
 * captive portal, a plane's wifi or a dead uplink all read as "online" and the
 * app would keep trying to reach a backend that is not there. Connectivity
 * decisions therefore use real requests to both the frontend and the backend.
 */

import { getBackendUrl } from '../config';

export type ConnectivityStatus = 'online' | 'offline' | 'checking';

const PROBE_TIMEOUT_MS = 4000;
// Re-probing on every listener call would hammer the network; a short floor
// keeps repeated checks cheap while staying responsive to real changes.
const MIN_PROBE_INTERVAL_MS = 5000;

let status: ConnectivityStatus = typeof navigator === 'undefined' || navigator.onLine
  ? 'checking'
  : 'offline';
let lastProbeAt = 0;
let inFlightProbe: Promise<boolean> | null = null;

const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function setStatus(next: ConnectivityStatus): void {
  if (status === next) return;
  status = next;
  notifyListeners();
}

/**
 * Either server responding proves that the network is reachable, even if that
 * server returned an HTTP error. The frontend HEAD bypasses the service worker
 * cache; the backend version endpoint is never cached by the worker. Checking
 * both prevents a failed frontend request from hiding a working backend (also
 * relevant to Android, whose frontend is packaged locally).
 */
export async function probeConnectivity(backendUrl: string, request: typeof fetch = fetch): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const probe = (url: string, method: 'HEAD' | 'GET') =>
    request(url, { method, cache: 'no-store', signal: controller.signal });
  try {
    await Promise.any([
      probe('/config.js', 'HEAD'),
      probe(`${backendUrl}/health/version`, 'GET'),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

export async function checkRealConnectivity(): Promise<boolean> {
  if (inFlightProbe) return inFlightProbe;

  inFlightProbe = (async () => {
    try {
      return await probeConnectivity(getBackendUrl());
    } catch {
      return false;
    } finally {
      lastProbeAt = Date.now();
      inFlightProbe = null;
    }
  })();

  return inFlightProbe;
}

async function probeAndPublish(): Promise<boolean> {
  const reachable = await checkRealConnectivity();
  // A response that arrives after the browser's offline event must not undo it.
  const online = reachable && (typeof navigator === 'undefined' || navigator.onLine);
  setStatus(online ? 'online' : 'offline');
  return online;
}

/**
 * Forces a fresh check. Call this the moment something else fails in a way that
 * suggests the network is gone (e.g. Clerk cannot load) — the last scheduled
 * probe may have succeeded seconds ago and would otherwise keep the app in a
 * confidently wrong "online" state until the next tick.
 */
export function refreshConnectivity(): void {
  void probeAndPublish();
}

export function subscribeToOnlineStatus(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Treats the "checking" phase as online so the app boots straight into its
 * normal shell; it flips to the offline shell only once a probe actually fails.
 */
export function getOnlineStatus(): boolean {
  return status !== 'offline';
}

export function getConnectivityStatus(): ConnectivityStatus {
  return status;
}

/**
 * Strict variant for code that must not guess: `true` only when a probe has
 * confirmed reachability. Used to decide whether to serve audio from the
 * offline cache instead of a URL that would fail to load.
 */
export function isConfirmedOnline(): boolean {
  return status === 'online';
}

// Detection has to work in BOTH directions, and browser events cover neither
// case reliably: `offline` does not fire when the interface stays up but the
// backend is gone (captive portal, dead uplink, server restart), and `online`
// does not fire when that backend simply becomes reachable again. So the app
// probes on a timer — quickly while offline, because a child waiting to get
// back to a story should not have to reload, and slowly while online, where a
// single HEAD request per minute is cheap insurance.
const OFFLINE_RECHECK_INTERVAL_MS = 15000;
const ONLINE_RECHECK_INTERVAL_MS = 60000;

let recheckTimer: number | null = null;
let recheckIntervalMs: number | null = null;

function stopRecheckLoop(): void {
  if (recheckTimer !== null) {
    window.clearInterval(recheckTimer);
    recheckTimer = null;
    recheckIntervalMs = null;
  }
}

function startRecheckLoop(intervalMs: number): void {
  if (recheckTimer !== null && recheckIntervalMs === intervalMs) return;
  stopRecheckLoop();
  recheckIntervalMs = intervalMs;
  recheckTimer = window.setInterval(() => {
    // A hidden tab has nothing to react to; probing it only wastes battery.
    if (document.visibilityState === 'hidden') return;
    void probeAndPublish();
  }, intervalMs);
}

function syncRecheckLoop(): void {
  startRecheckLoop(
    status === 'offline' ? OFFLINE_RECHECK_INTERVAL_MS : ONLINE_RECHECK_INTERVAL_MS,
  );
}

if (typeof window !== 'undefined') {
  listeners.add(syncRecheckLoop);

  if (status === 'checking') {
    void probeAndPublish();
  }
  syncRecheckLoop();

  window.addEventListener('online', () => {
    setStatus('checking');
    void probeAndPublish();
  });

  window.addEventListener('offline', () => {
    setStatus('offline');
  });

  // Returning to the tab is the moment a user most expects the app to be in
  // step with reality — in either direction.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastProbeAt < MIN_PROBE_INTERVAL_MS) return;
    void probeAndPublish();
  });
}
