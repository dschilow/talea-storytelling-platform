export type HapticIntent = 'tap' | 'selection' | 'success' | 'error';

const HAPTIC_PATTERNS: Record<HapticIntent, number | number[]> = {
  tap: 8,
  selection: [10, 18, 8],
  success: [12, 24, 16],
  error: [18, 34, 18, 34, 18],
};

const MIN_INTERVAL_MS = 55;

let lastHapticAt = 0;

export function isLikelyTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    navigator.maxTouchPoints > 0 ||
    window.matchMedia?.('(pointer: coarse)').matches === true
  );
}

function canVibrate(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (typeof navigator.vibrate !== 'function') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  return true;
}

export function triggerHaptic(
  intent: HapticIntent = 'tap',
  options?: { force?: boolean }
): boolean {
  if (!canVibrate()) return false;
  if (!options?.force && !isLikelyTouchDevice()) return false;

  const now = Date.now();
  if (now - lastHapticAt < MIN_INTERVAL_MS) return false;
  lastHapticAt = now;

  try {
    return navigator.vibrate(HAPTIC_PATTERNS[intent]);
  } catch {
    return false;
  }
}

export function parseHapticIntent(raw: string | null | undefined): HapticIntent | null {
  if (!raw) return null;
  if (raw === 'tap' || raw === 'selection' || raw === 'success' || raw === 'error') {
    return raw;
  }
  return null;
}
