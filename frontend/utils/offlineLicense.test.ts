import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { getOfflineLicense, isOfflineAccessAllowed, recordOfflineLicense } from './offlineLicense';

const store = new Map<string, string>();
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  store.clear();
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
  };
});
afterEach(() => {
  delete (globalThis as any).window;
});

describe('offline licence', () => {
  test('legacy content without a record stays readable', () => {
    expect(getOfflineLicense('u1').status).toBe('unknown');
    expect(isOfflineAccessAllowed('u1')).toBe(true);
  });

  test('a fresh paid plan is valid and counts down', () => {
    recordOfflineLicense('u1', 'starter', false);
    const state = getOfflineLicense('u1');
    expect(state.status).toBe('valid');
    expect(state.status === 'valid' && state.limit).toBe(10);
  });

  test('access ends 14 days after the last online check', () => {
    recordOfflineLicense('u1', 'familie', false);
    expect(getOfflineLicense('u1', Date.now() + 13 * DAY).status).toBe('valid');
    expect(getOfflineLicense('u1', Date.now() + 15 * DAY).status).toBe('expired');
  });

  test('free plan has no offline access, admins are unlimited', () => {
    recordOfflineLicense('u1', 'free', false);
    expect(isOfflineAccessAllowed('u1')).toBe(false);
    recordOfflineLicense('u2', 'free', true);
    const admin = getOfflineLicense('u2');
    expect(admin.status === 'valid' && admin.limit).toBe(null);
  });

  test('a clock set back does not revive an old check', () => {
    recordOfflineLicense('u1', 'premium', false);
    expect(getOfflineLicense('u1', Date.now() - 3 * DAY).status).toBe('expired');
  });
});
