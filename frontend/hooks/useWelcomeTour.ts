import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'talea.welcomeTour.completedAt';
const VERSION_KEY = 'talea.welcomeTour.version';

/**
 * Bump when the tour gains a chapter worth re-showing to existing users.
 * Users who finished an older version get the tour offered once more.
 */
export const WELCOME_TOUR_VERSION = 1;

function readCompletedVersion(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!window.localStorage.getItem(STORAGE_KEY)) return null;
    const raw = window.localStorage.getItem(VERSION_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    // Private mode / storage disabled — treat as "never seen" but never crash.
    return null;
  }
}

/**
 * The hook is used both by App (which renders the tour) and by the profile
 * menu (which restarts it), so state changes are broadcast instead of kept
 * local — otherwise the two instances would drift apart.
 */
const RESTART_EVENT = 'talea:welcome-tour-restart';

export function useWelcomeTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasCompleted, setHasCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    const completedVersion = readCompletedVersion();
    setHasCompleted(completedVersion !== null && completedVersion >= WELCOME_TOUR_VERSION);

    const onRestart = () => setHasCompleted(false);
    window.addEventListener(RESTART_EVENT, onRestart);
    return () => window.removeEventListener(RESTART_EVENT, onRestart);
  }, []);

  const markCompleted = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
      window.localStorage.setItem(VERSION_KEY, String(WELCOME_TOUR_VERSION));
    } catch {
      // Storage unavailable: the tour simply shows again next session.
    }
    setHasCompleted(true);
    setIsOpen(false);
  }, []);

  const open = useCallback(() => setIsOpen(true), []);

  /** Dismissing without finishing still counts — never trap a user in a tour. */
  const close = useCallback(() => {
    markCompleted();
  }, [markCompleted]);

  /** Restart the guide from anywhere (profile menu, settings). */
  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(VERSION_KEY);
    } catch {
      /* noop */
    }
    window.dispatchEvent(new CustomEvent(RESTART_EVENT));
  }, []);

  return { isOpen, hasCompleted, open, close, markCompleted, reset };
}
