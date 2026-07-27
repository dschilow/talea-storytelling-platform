import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';

import { storage, StorageKeys } from '@/lib/storage';
import {
  darkPalette,
  darkShadows,
  lightPalette,
  motion,
  radius,
  shadows,
  spacing,
  zIndex,
  type ThemeMode,
  type ThemePalette,
  type Shadow,
} from './tokens';
import { buildTypeScale, type TypeScale } from './typography';

export type ThemePreference = 'light' | 'dark' | 'system';

export interface Theme {
  colors: ThemePalette;
  type: TypeScale;
  spacing: typeof spacing;
  radius: typeof radius;
  motion: typeof motion;
  zIndex: typeof zIndex;
  shadows: Record<'none' | 'soft' | 'medium' | 'strong' | 'float', Shadow>;
  isDark: boolean;
  mode: ThemeMode;
}

interface ThemeContextValue extends Theme {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** Bumped once bundled fonts resolve so the type scale re-evaluates. */
  fontsLoaded: boolean;
  setFontsLoaded: (loaded: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function buildTheme(mode: ThemeMode): Theme {
  return {
    colors: mode === 'dark' ? darkPalette : lightPalette,
    type: buildTypeScale(),
    spacing,
    radius,
    motion,
    zIndex,
    shadows: mode === 'dark' ? darkShadows : shadows,
    isDark: mode === 'dark',
    mode,
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Restore the stored preference before first paint of any themed surface.
  useEffect(() => {
    let cancelled = false;
    void storage.getString(StorageKeys.theme).then((stored) => {
      if (cancelled) return;
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const mode: ThemeMode = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void storage.setString(StorageKeys.theme, next);
  }, []);

  // Keep the native window background in sync so overscroll and the moment
  // between screens never flashes white in dark mode.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(mode === 'dark' ? darkPalette.pageSolid : lightPalette.pageSolid);
  }, [mode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      ...buildTheme(mode),
      preference,
      setPreference,
      fontsLoaded,
      setFontsLoaded,
    }),
    // `fontsLoaded` is a dependency because the type scale resolves font families eagerly.
    [mode, preference, setPreference, fontsLoaded]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Builds a memoised StyleSheet bound to the active theme.
 *
 * Usage:
 *   const styles = useThemedStyles(({ colors, spacing }) => ({
 *     card: { backgroundColor: colors.surface.primary, padding: spacing.base },
 *   }));
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme, factory]);
}
