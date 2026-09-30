import {
  OFFLINE_LICENSE_MAX_DAYS,
  PLAN_OFFLINE_LIMITS,
  type SubscriptionPlan,
} from '../constants/planCatalog';

// Remembers when the plan was last confirmed online. Offline content stays
// usable for OFFLINE_LICENSE_MAX_DAYS after that, so a cancelled plan cannot
// keep a downloaded library forever. This is a client-side check: it stops
// normal use, not someone who edits local browser storage.

const LICENSE_KEY_PREFIX = 'talea.offline.license.v1:';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type StoredLicense = { plan: SubscriptionPlan; verifiedAt: number; isAdmin: boolean };

export type OfflineLicenseState =
  | { status: 'unknown' }
  | { status: 'valid'; plan: SubscriptionPlan; limit: number | null; daysLeft: number }
  | { status: 'no-plan'; plan: SubscriptionPlan }
  | { status: 'expired'; plan: SubscriptionPlan };

function key(userId: string): string {
  return `${LICENSE_KEY_PREFIX}${userId}`;
}

export function offlineLimitForPlan(plan: SubscriptionPlan, isAdmin = false): number | null {
  return isAdmin ? null : PLAN_OFFLINE_LIMITS[plan];
}

export function recordOfflineLicense(userId: string, plan: SubscriptionPlan, isAdmin: boolean): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const value: StoredLicense = { plan, verifiedAt: Date.now(), isAdmin };
    window.localStorage.setItem(key(userId), JSON.stringify(value));
  } catch {
    // localStorage can be blocked; offline content then stays readable (see "unknown").
  }
}

function readLicense(userId: string): StoredLicense | null {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const raw = window.localStorage.getItem(key(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredLicense>;
    if (
      typeof parsed.verifiedAt !== 'number' ||
      !Number.isFinite(parsed.verifiedAt) ||
      !(parsed.plan! in PLAN_OFFLINE_LIMITS)
    ) {
      return null;
    }
    return { plan: parsed.plan as SubscriptionPlan, verifiedAt: parsed.verifiedAt, isAdmin: parsed.isAdmin === true };
  } catch {
    return null;
  }
}

export function getOfflineLicense(userId: string, now = Date.now()): OfflineLicenseState {
  const license = readLicense(userId);
  // Content saved before licences existed is allowed until the first online visit records one.
  if (!license) return { status: 'unknown' };

  const limit = offlineLimitForPlan(license.plan, license.isAdmin);
  if (limit !== null && limit <= 0) return { status: 'no-plan', plan: license.plan };

  const ageMs = now - license.verifiedAt;
  // A clock set far back would make an old check look fresh.
  const clockTampered = ageMs < -MS_PER_DAY;
  if (clockTampered || ageMs > OFFLINE_LICENSE_MAX_DAYS * MS_PER_DAY) {
    return { status: 'expired', plan: license.plan };
  }
  return {
    status: 'valid',
    plan: license.plan,
    limit,
    daysLeft: Math.max(0, Math.ceil(OFFLINE_LICENSE_MAX_DAYS - ageMs / MS_PER_DAY)),
  };
}

export function isOfflineAccessAllowed(userId: string): boolean {
  const state = getOfflineLicense(userId);
  return state.status === 'unknown' || state.status === 'valid';
}

export function offlineLicenseMessage(state: OfflineLicenseState): string | null {
  if (state.status === 'expired') {
    return `Bitte kurz mit dem Internet verbinden: Der Abo-Check ist länger als ${OFFLINE_LICENSE_MAX_DAYS} Tage her. Danach sind deine Offline-Inhalte wieder verfügbar.`;
  }
  if (state.status === 'no-plan') {
    return 'Offline-Inhalte gehören zu Starter, Familie und Premium. Mit einem Abo sind deine gespeicherten Inhalte wieder verfügbar.';
  }
  return null;
}
