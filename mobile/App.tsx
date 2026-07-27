import 'react-native-gesture-handler';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, DarkTheme, type Theme as NavTheme } from '@react-navigation/native';
import { ClerkProvider, ClerkLoaded } from '@clerk/clerk-expo';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreenModule from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts, Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';

import { CLERK_PUBLISHABLE_KEY } from '@/config';
import { clerkTokenCache } from '@/providers/clerkTokenCache';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { setFontsReady } from '@/theme/typography';
import { UserAccessProvider } from '@/providers/UserAccessProvider';
import { ChildProfilesProvider } from '@/providers/ChildProfilesProvider';
import { AudioPlayerProvider } from '@/providers/AudioPlayerProvider';
import { OfflineProvider } from '@/providers/OfflineProvider';
import { ToastProvider } from '@/providers/ToastProvider';
import { LanguageSync } from '@/providers/LanguageSync';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { RootNavigator } from '@/navigation/RootNavigator';
import { linking } from '@/navigation/linking';
import { restoreStoredLanguage } from '@/i18n';
import '@/i18n';

// Hold the native splash until fonts + the stored language are ready, so the
// first painted frame is already correct instead of flashing a fallback.
void SplashScreenModule.preventAutoHideAsync().catch(() => {});

/** Upper bound on the startup gate, so first paint is guaranteed. */
const STARTUP_TIMEOUT_MS = 4000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Story/avatar data changes on user action, not in the background — a
      // generous stale time avoids refetching on every tab switch, and screens
      // that need freshness invalidate explicitly.
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const [languageRestored, setLanguageRestored] = useState(false);
  // Hard deadline on the startup gate. Whatever happens to fonts or storage,
  // the app must reach first paint — a splash that never resolves is
  // indistinguishable from a crash to the user and impossible to report.
  const [startupDeadlineReached, setStartupDeadlineReached] = useState(false);

  useEffect(() => {
    void restoreStoredLanguage().finally(() => setLanguageRestored(true));
    const deadline = setTimeout(() => setStartupDeadlineReached(true), STARTUP_TIMEOUT_MS);
    return () => clearTimeout(deadline);
  }, []);

  // A font download failure must not block the app — the platform stack is a
  // deliberate fallback in `theme/typography.ts`.
  const fontsSettled = fontsLoaded || Boolean(fontError);
  const startupComplete = (fontsSettled && languageRestored) || startupDeadlineReached;

  useEffect(() => {
    if (fontsLoaded) setFontsReady(true);
  }, [fontsLoaded]);

  const onLayoutRoot = useCallback(() => {
    if (startupComplete) {
      void SplashScreenModule.hideAsync().catch(() => {});
    }
  }, [startupComplete]);

  if (!startupComplete) {
    return null;
  }

  // Without a Clerk key there is no session and every screen would fail on its
  // first request. Say so plainly instead of leaving the user on a dead screen.
  if (!CLERK_PUBLISHABLE_KEY) {
    return <ConfigErrorScreen onLayout={onLayoutRoot} />;
  }

  return (
    <GestureHandlerRootView style={styles.flex} onLayout={onLayoutRoot}>
      <SafeAreaProvider>
        <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={clerkTokenCache}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <ErrorBoundary>
                <ToastProvider>
                  <ClerkLoaded>
                    <UserAccessProvider>
                      <ChildProfilesProvider>
                        <OfflineProvider>
                          <AudioPlayerProvider>
                            <LanguageSync />
                            <AppShell />
                          </AudioPlayerProvider>
                        </OfflineProvider>
                      </ChildProfilesProvider>
                    </UserAccessProvider>
                  </ClerkLoaded>
                </ToastProvider>
              </ErrorBoundary>
            </ThemeProvider>
          </QueryClientProvider>
        </ClerkProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Bridges the Talea theme into React Navigation's own theming. */
function AppShell() {
  const { colors, isDark } = useTheme();

  const navigationTheme: NavTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      primary: colors.primary,
      background: colors.pageSolid,
      card: colors.surface.panel,
      text: colors.text.primary,
      border: colors.border.soft,
      notification: colors.danger,
    },
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.pageSolid }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavigationContainer theme={navigationTheme} linking={linking}>
        <RootNavigator />
      </NavigationContainer>
    </View>
  );
}

/**
 * Shown when the build has no Clerk publishable key.
 *
 * Styled with raw values rather than the theme, because this renders outside
 * every provider — it has to work when nothing else is initialised.
 */
function ConfigErrorScreen({ onLayout }: { onLayout: () => void }) {
  return (
    <View style={styles.configError} onLayout={onLayout}>
      <Text style={styles.configErrorTitle}>Konfiguration fehlt</Text>
      <Text style={styles.configErrorBody}>
        Diesem Build fehlt der Clerk-Schlüssel, deshalb ist keine Anmeldung möglich.
        {'\n\n'}
        Trage <Text style={styles.configErrorCode}>EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY</Text> in{' '}
        <Text style={styles.configErrorCode}>mobile/.env</Text> ein und baue die App neu.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  configError: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 14,
    backgroundColor: '#fbf5ef',
  },
  configErrorTitle: { fontSize: 21, fontWeight: '700', color: '#233248', textAlign: 'center' },
  configErrorBody: { fontSize: 15, lineHeight: 23, color: '#5f7186', textAlign: 'center', maxWidth: 380 },
  configErrorCode: { fontFamily: 'monospace', fontSize: 13, color: '#233248' },
});
