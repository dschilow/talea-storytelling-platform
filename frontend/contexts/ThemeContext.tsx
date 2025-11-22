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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const backend = useBackend();
  const { user, isLoaded } = useUser();

  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');
  const [isLoading, setIsLoading] = useState(true);

  // Get system theme preference
  const getSystemTheme = (): ResolvedTheme => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
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
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
    setResolvedTheme(resolved);
  };

  // Load user's theme preference from backend
  useEffect(() => {
    const loadUserTheme = async () => {
      try {
        if (!backend || !isLoaded || !user) {
          // Not logged in → use localStorage or system
          const savedTheme = localStorage.getItem('talea_theme') as Theme | null;
          const initialTheme = savedTheme || 'system';
          setThemeState(initialTheme);
          applyTheme(resolveTheme(initialTheme));
          setIsLoading(false);
          return;
        }

        // Logged in → load from backend
        const profile = await backend.user.me();
        const userTheme = profile.theme || 'system';
        setThemeState(userTheme);
        applyTheme(resolveTheme(userTheme));

        // Also save to localStorage for faster initial load
        localStorage.setItem('talea_theme', userTheme);
      } catch (err) {
        console.error('Failed to load theme:', err);
        // Fallback to localStorage or system
        const savedTheme = localStorage.getItem('talea_theme') as Theme | null;
        const fallbackTheme = savedTheme || 'system';
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
      localStorage.setItem('talea_theme', newTheme);

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
