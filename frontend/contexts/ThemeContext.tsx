import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useBackend } from '../hooks/useBackend';
import { useUser } from '@clerk/clerk-react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => Promise<void>;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function readSavedTheme(): Theme {
  try {
    const saved = localStorage.getItem('talea_theme');
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
  } catch {
    return 'system';
  }
}

function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem('talea_theme', theme);
  } catch {
    // Appearance still works when the browser blocks persistent storage.
  }
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function syncThemeAppearance(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = resolved === 'dark' ? '#211710' : '#FFF7EC';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const backend = useBackend();
  const { user, isLoaded } = useUser();

  const [theme, setThemeState] = useState<Theme>(readSavedTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    const saved = readSavedTheme();
    return saved === 'system' ? systemTheme() : saved;
  });
  const [isLoading, setIsLoading] = useState(true);

  // Get system theme preference
  const getSystemTheme = (): ResolvedTheme => {
    return systemTheme();
  };

  // Resolve theme (system → actual light/dark)
  const resolveTheme = (themeValue: Theme): ResolvedTheme => {
    if (themeValue === 'system') {
      return getSystemTheme();
    }
    return themeValue;
  };

  // Apply theme to document
  const applyTheme = (resolved: ResolvedTheme) => {
    syncThemeAppearance(resolved);
    setResolvedTheme(resolved);
  };

  // Load user's theme preference from backend
  useEffect(() => {
    const loadUserTheme = async () => {
      try {
        if (!backend || !isLoaded || !user) {
          // Not logged in → use localStorage or system
          const initialTheme = readSavedTheme();
          setThemeState(initialTheme);
          applyTheme(resolveTheme(initialTheme));
          setIsLoading(false);
          return;
        }

        // Logged in → load from backend
        const profile = await backend.user.me();
        const userTheme = profile.theme === 'light' || profile.theme === 'dark' ? profile.theme : 'system';
        setThemeState(userTheme);
        applyTheme(resolveTheme(userTheme));

        // Also save to localStorage for faster initial load
        saveTheme(userTheme);
      } catch (err) {
        console.error('Failed to load theme:', err);
        // Fallback to localStorage or system
        const fallbackTheme = readSavedTheme();
        setThemeState(fallbackTheme);
        applyTheme(resolveTheme(fallbackTheme));
      } finally {
        setIsLoading(false);
      }
    };

    loadUserTheme();
  }, [backend, isLoaded, user]);

  // Listen to system theme changes when in system mode
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      applyTheme(resolveTheme('system'));
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Update theme
  const setTheme = async (newTheme: Theme) => {
    try {
      setThemeState(newTheme);
      applyTheme(resolveTheme(newTheme));

      // Save to localStorage
      saveTheme(newTheme);

      // Save to backend if logged in
      if (backend && user) {
        await backend.user.updateTheme({ theme: newTheme });
      }
    } catch (err) {
      console.error('Failed to update theme:', err);
      throw err;
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Lightweight ThemeProvider for offline mode (no Clerk/backend dependency).
 * Reads theme from localStorage only.
 */
export function OfflineThemeProvider({ children }: { children: ReactNode }) {
  const getSystemTheme = (): ResolvedTheme =>
    systemTheme();

  const resolveTheme = (t: Theme): ResolvedTheme =>
    t === 'system' ? getSystemTheme() : t;

  const savedTheme = readSavedTheme();
  const [theme, setThemeState] = useState<Theme>(savedTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(resolveTheme(savedTheme));

  useEffect(() => {
    syncThemeAppearance(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setResolvedTheme(getSystemTheme());
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    setResolvedTheme(resolveTheme(newTheme));
    saveTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, isLoading: false }}>
      {children}
    </ThemeContext.Provider>
  );
}
