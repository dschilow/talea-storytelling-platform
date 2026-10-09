import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useBackend } from '@/hooks/useBackend';
import type { NotificationSummary } from '../../backend/user/notifications';

type NotificationsContextValue = {
  summary: NotificationSummary | null;
  refresh: () => Promise<void>;
  updateSummary: (summary: NotificationSummary) => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const backend = useBackend();
  const { isSignedIn, user } = useUser();
  const [summary, setSummary] = useState<NotificationSummary | null>(null);
  const generation = useRef(0);
  const version = useRef(0);

  const updateSummary = useCallback((next: NotificationSummary) => {
    version.current++;
    setSummary(next);
  }, []);

  const refresh = useCallback(async () => {
    if (!isSignedIn || !navigator.onLine) return;
    const currentGeneration = generation.current;
    const currentVersion = ++version.current;
    try {
      const next = await backend.user.notificationSummary();
      if (currentGeneration === generation.current && currentVersion === version.current) setSummary(next);
    } catch {
      // The inbox handles errors explicitly. A transient badge failure must not interrupt a reader.
    }
  }, [backend, isSignedIn]);

  useEffect(() => {
    generation.current++;
    setSummary(null);
    void refresh();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const interval = window.setInterval(refreshWhenVisible, 60_000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);
    window.addEventListener('online', refreshWhenVisible);
    return () => {
      generation.current++;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
      window.removeEventListener('online', refreshWhenVisible);
    };
  }, [refresh, user?.id]);

  return <NotificationsContext.Provider value={{ summary, refresh, updateSummary }}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
