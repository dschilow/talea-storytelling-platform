import React, { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ClerkProvider, useUser } from '@clerk/clerk-react';
import { Toaster } from 'sonner';
import { MotionConfig } from 'framer-motion';
import { store } from './store/store';

import AppLayout from './components/layout/AppLayout';
import TaviButton from './components/common/TaviButton';
import { colors } from './utils/constants/colors';
import { clerkPublishableKey } from './config';
import { ThemeProvider, OfflineThemeProvider } from './contexts/ThemeContext';
import { AudioPlayerProvider } from './contexts/AudioPlayerContext';
import { UserAccessProvider, useOptionalUserAccess } from './contexts/UserAccessContext';
import { ChildProfilesProvider } from './contexts/ChildProfilesContext';
import { OfflineStorageProvider } from './contexts/OfflineStorageContext';
import { OfflineClerkProvider } from './contexts/OfflineClerkProvider';
import { parseHapticIntent, triggerHaptic } from './utils/haptics';
import { AgentProvider } from './agents';

import { useLanguageSync } from './hooks/useLanguageSync';

const HomeScreen = React.lazy(() => import('./screens/Home/TaleaHomeScreen'));
const ModernHomeScreen = React.lazy(() => import('./screens/Home/ModernHomeScreen'));
const LandingPage = React.lazy(() => import('./screens/Landing/LandingPage'));
const AuthScreen = React.lazy(() => import('./screens/Auth/AuthScreen'));
const AvatarsScreen = React.lazy(() => import('./screens/Avatar/TaleaAvatarsScreen'));
const AvatarWizardScreen = React.lazy(() => import('./screens/Avatar/AvatarWizardScreen'));
const AvatarDetailScreen = React.lazy(() => import('./screens/Avatar/AvatarDetailScreen'));
const EditAvatarScreen = React.lazy(() => import('./screens/Avatar/EditAvatarScreen'));
const StoryWizardScreen = React.lazy(() => import('./screens/Story/StoryWizardScreen'));
const ModernStoryWizard = React.lazy(() => import('./screens/Story/TaleaStoryWizard'));
const FairyTaleSelectionScreen = React.lazy(() => import('./screens/Story/FairyTaleSelectionScreen'));
const CharacterMappingScreen = React.lazy(() => import('./screens/Story/CharacterMappingScreen'));
const StoriesScreen = React.lazy(() => import('./screens/Story/TaleaStoriesScreen'));
const StoryReaderScreen = React.lazy(() => import('./screens/Story/StoryReaderScreen'));
const StoryScrollReaderScreen = React.lazy(() => import('./screens/Story/StoryScrollReaderScreen'));
const CinematicStoryViewer = React.lazy(() => import('./screens/Story/CinematicStoryViewer'));
const DokusScreen = React.lazy(() => import('./screens/Doku/TaleaDokusScreen'));
const ModernDokuWizard = React.lazy(() => import('./screens/Doku/ModernDokuWizard'));
const CreateAudioDokuScreen = React.lazy(() => import('./screens/Doku/CreateAudioDokuScreen'));
const DokuReaderScreen = React.lazy(() => import('./screens/Doku/DokuReaderScreen'));
const DokuScrollReaderScreen = React.lazy(() => import('./screens/Doku/DokuScrollReaderScreen'));
const CinematicDokuViewer = React.lazy(() => import('./screens/Doku/CinematicDokuViewer'));
const CommunityQuizScreen = React.lazy(() => import('./screens/Quiz/CommunityQuizScreen'));
const TaleaLearningPathMapView = React.lazy(() => import('./screens/Journey/TaleaLearningPathMapView'));
const SettingsScreen = React.lazy(() => import('./screens/Settings/SettingsScreen'));
const ParentalOnboardingScreen = React.lazy(() => import('./screens/Settings/ParentalOnboardingScreen'));
const CharacterPoolScreen = React.lazy(() => import('./screens/CharacterPool/CharacterPoolScreen'));
const ArtifactPoolScreen = React.lazy(() => import('./screens/ArtifactPool/ArtifactPoolScreen'));
const FairyTalesScreen = React.lazy(() => import('./screens/FairyTales/FairyTalesScreen'));
const LogViewerScreen = React.lazy(() => import('./screens/Logs/LogViewerScreen'));
const AdminDashboard = React.lazy(() => import('./screens/Admin/AdminDashboard'));
const OfflineContentScreen = React.lazy(() => import('./screens/Offline/OfflineContentScreen'));
const CosmosScreen = React.lazy(() => import('./screens/Cosmos/CosmosScreen'));
const ParentDashboardRoot = React.lazy(() => import('./screens/Cosmos/ParentDashboardRoot'));

// Reactive online/offline detection.
// navigator.onLine is unreliable (returns true when connected to a local network
// without actual internet), so we also perform a real connectivity check.
let _connectivityStatus: 'online' | 'offline' | 'checking' = navigator.onLine ? 'checking' : 'offline';
const _listeners = new Set<() => void>();

function notifyListeners() {
  _listeners.forEach((cb) => cb());
}

// Perform a lightweight fetch to verify actual internet connectivity
async function checkRealConnectivity(): Promise<boolean> {
  try {
    // Use a tiny request with a short timeout to verify real connectivity
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const response = await fetch('/config.js', {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

// Check connectivity on startup
if (_connectivityStatus === 'checking') {
  checkRealConnectivity().then((ok) => {
    _connectivityStatus = ok ? 'online' : 'offline';
    notifyListeners();
  });
}

window.addEventListener('online', () => {
  // navigator.onLine just became true, but verify real connectivity
  _connectivityStatus = 'checking';
  notifyListeners();
  checkRealConnectivity().then((ok) => {
    _connectivityStatus = ok ? 'online' : 'offline';
    notifyListeners();
  });
});
window.addEventListener('offline', () => {
  _connectivityStatus = 'offline';
  notifyListeners();
});

function subscribeToOnlineStatus(callback: () => void) {
  _listeners.add(callback);
  return () => { _listeners.delete(callback); };
}
function getOnlineStatus() {
  return _connectivityStatus !== 'offline';
}

const GLOBAL_HAPTIC_SELECTOR =
  'button, a[href], [role="button"], input[type="button"], input[type="submit"], [data-haptic]';

const GlobalHaptics: React.FC = () => {
  useEffect(() => {
    const pointerListenerOptions: AddEventListenerOptions = {
      capture: true,
      passive: true,
    };

    const handlePointerUp = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const interactiveElement = target.closest(GLOBAL_HAPTIC_SELECTOR) as HTMLElement | null;
      if (!interactiveElement) return;

      const hapticAttr = interactiveElement.getAttribute('data-haptic');
      if (hapticAttr === 'off') return;

      const intent = parseHapticIntent(hapticAttr);
      triggerHaptic(intent ?? 'tap');
    };

    const handleKeyboardActivate = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const interactiveElement = target.closest(GLOBAL_HAPTIC_SELECTOR) as HTMLElement | null;
      if (!interactiveElement) return;

      const hapticAttr = interactiveElement.getAttribute('data-haptic');
      if (hapticAttr === 'off') return;

      const intent = parseHapticIntent(hapticAttr);
      triggerHaptic(intent ?? 'tap');
    };

    document.addEventListener('pointerup', handlePointerUp, pointerListenerOptions);
    document.addEventListener('keydown', handleKeyboardActivate, true);

    return () => {
      document.removeEventListener('pointerup', handlePointerUp, true);
      document.removeEventListener('keydown', handleKeyboardActivate, true);
    };
  }, []);

  return null;
};

const RouteLoadingFallback = () => (
  <div className="flex h-screen items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c47832] border-t-transparent" />
  </div>
);

const AdminOnlyRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isLoading, isAdmin } = useOptionalUserAccess();
  if (isLoading) {
    return null;
  }
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  return children;
};

// Inner component that uses router hooks
const RouterContent = () => {
  const { isLoaded, isSignedIn } = useUser();
  const userAccess = useOptionalUserAccess();
  const location = useLocation();
  const deferredUntilRaw =
    typeof window !== 'undefined' ? window.localStorage.getItem('talea.parentalOnboardingDeferredUntil') : null;
  const deferredUntil = deferredUntilRaw ? Number(deferredUntilRaw) : 0;
  const onboardingDeferred = Number.isFinite(deferredUntil) && deferredUntil > Date.now();
  const isLandingRoute =
    location.pathname.startsWith('/landing') ||
    location.pathname.startsWith('/parental-onboarding') ||
    (!isSignedIn && location.pathname === '/');
  const isCosmosFullscreenRoute = location.pathname.startsWith('/cosmos');

  if (!isLoaded) {
    return null;
  }

  if (
    isSignedIn &&
    !userAccess.isLoading &&
    userAccess.parentalOnboardingCompleted === false &&
    !onboardingDeferred &&
    location.pathname !== '/parental-onboarding'
  ) {
    return <Navigate to="/parental-onboarding" replace />;
  }

  return (
    <>
      <React.Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          {!isSignedIn ? (
            <>
              <Route path="/" element={<LandingPage />} />
              <Route path="/landing" element={<LandingPage />} />
              <Route path="/auth" element={<AuthScreen />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="/landing" element={<Navigate to="/" replace />} />
              <Route path="/parental-onboarding" element={<ParentalOnboardingScreen />} />
              <Route element={<AppLayout />}>
                <Route path="/" element={<HomeScreen />} />
                <Route path="/avatar" element={<AvatarsScreen />} />
                <Route path="/avatar/create" element={<AvatarWizardScreen />} />
                <Route path="/avatar/:avatarId" element={<AvatarDetailScreen />} />
                <Route path="/avatar/edit/:avatarId" element={<EditAvatarScreen />} />
                <Route path="/story" element={<ModernStoryWizard />} />
                <Route path="/story/wizard-old" element={<StoryWizardScreen />} />
                <Route path="/story/fairytale-selection" element={<FairyTaleSelectionScreen />} />
                <Route path="/story/fairytale/:taleId/map-characters" element={<CharacterMappingScreen />} />
                <Route path="/story-reader/:storyId" element={<CinematicStoryViewer />} />
                <Route path="/story-reader-scroll/:storyId" element={<StoryScrollReaderScreen />} />
                <Route path="/story-reader-old/:storyId" element={<StoryReaderScreen />} />
                <Route path="/stories" element={<StoriesScreen />} />
                <Route path="/community" element={<ModernHomeScreen />} />
                <Route path="/logs" element={<AdminOnlyRoute><LogViewerScreen /></AdminOnlyRoute>} />
                <Route path="/doku" element={<DokusScreen />} />
                <Route path="/createaudiodoku" element={<AdminOnlyRoute><CreateAudioDokuScreen /></AdminOnlyRoute>} />
                <Route path="/quiz" element={<CommunityQuizScreen />} />
                <Route path="/characters" element={<AdminOnlyRoute><CharacterPoolScreen /></AdminOnlyRoute>} />
                <Route path="/artifacts" element={<AdminOnlyRoute><ArtifactPoolScreen /></AdminOnlyRoute>} />
                <Route path="/fairytales" element={<AdminOnlyRoute><FairyTalesScreen /></AdminOnlyRoute>} />
                <Route path="/doku/create" element={<ModernDokuWizard />} />
                <Route path="/doku-reader/:dokuId" element={<CinematicDokuViewer />} />
                <Route path="/doku-reader-old/:dokuId" element={<DokuReaderScreen />} />
                <Route path="/auth" element={<Navigate to="/" replace />} />
                <Route path="/settings" element={<SettingsScreen />} />
                <Route path="/cosmos" element={<CosmosScreen />} />
                <Route path="/cosmos/parent" element={<ParentDashboardRoot />} />
                <Route path="/map" element={<TaleaLearningPathMapView />} />
                <Route path="/_admin" element={<AdminOnlyRoute><AdminDashboard /></AdminOnlyRoute>} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </React.Suspense>
      {isSignedIn && !isLandingRoute && !isCosmosFullscreenRoute && <TaviButton showLauncher={false} />}
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          style: {
            background: colors.glass.backgroundAlt,
            backdropFilter: 'blur(20px)',
            border: `2px solid ${colors.border.light}`,
            borderRadius: '16px',
            color: colors.text.primary,
          },
        }}
      />
    </>
  );
};

const AppContent = () => {
  useLanguageSync(); // Sync language on load

  return (
    <MotionConfig reducedMotion="user">
      <GlobalHaptics />
      <Router>
        <div className="min-h-screen">
          <RouterContent />
        </div>
      </Router>
    </MotionConfig>
  );
};

const MissingKeyScreen = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: colors.gradients.background,
    padding: '2rem',
    textAlign: 'center',
    fontFamily: '"Nunito", system-ui, sans-serif',
  }}>
    <div style={{
      maxWidth: '600px',
      padding: '2.5rem',
      borderRadius: '24px',
      background: colors.glass.backgroundAlt,
      border: `2px solid ${colors.border.light}`,
      boxShadow: '0 20px 60px rgba(169, 137, 242, 0.2)',
    }}>
      <div style={{ fontSize: '64px', marginBottom: '1.5rem' }}>🔐</div>
      <h1 style={{
        fontSize: '28px',
        fontWeight: '700',
        color: colors.text.primary,
        marginBottom: '1rem',
        fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif',
      }}>
        Clerk Publishable Key fehlt
      </h1>
      <p style={{ color: colors.text.secondary, marginBottom: '1.5rem', fontSize: '16px' }}>
        Um die Authentifizierung zu nutzen, benötigst du einen Clerk Publishable Key.
      </p>
      <p style={{ color: colors.text.secondary, fontSize: '15px' }}>
        Bitte öffne die Datei <code style={{
          background: colors.lavender[100],
          padding: '0.3rem 0.6rem',
          borderRadius: '8px',
          color: colors.lavender[700],
          fontFamily: 'monospace',
        }}>frontend/config.ts</code> und setze den Wert von <code style={{
          background: colors.lavender[100],
          padding: '0.3rem 0.6rem',
          borderRadius: '8px',
          color: colors.lavender[700],
          fontFamily: 'monospace',
        }}>clerkPublishableKey</code>.
      </p>
      <p style={{ color: colors.text.secondary, marginTop: '1.5rem', fontSize: '14px' }}>
        Du erhältst deinen Key im <a
          href="https://dashboard.clerk.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: colors.lavender[600],
            textDecoration: 'none',
            fontWeight: '600',
          }}
        >Clerk Dashboard</a>.
      </p>
    </div>
  </div>
);

const AuthUnavailableScreen: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: colors.gradients.background,
    padding: '2rem',
    textAlign: 'center',
    fontFamily: '"Nunito", system-ui, sans-serif',
  }}>
    <div style={{
      maxWidth: '640px',
      padding: '2.5rem',
      borderRadius: '24px',
      background: colors.glass.backgroundAlt,
      border: `2px solid ${colors.border.light}`,
      boxShadow: '0 20px 60px rgba(44, 57, 75, 0.12)',
    }}>
      <div style={{ fontSize: '56px', marginBottom: '1.25rem' }}>Auth</div>
      <h1 style={{
        fontSize: '28px',
        fontWeight: '700',
        color: colors.text.primary,
        marginBottom: '1rem',
        fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif',
      }}>
        Authentifizierung ist gerade nicht erreichbar
      </h1>
      <p style={{ color: colors.text.secondary, marginBottom: '1rem', fontSize: '16px', lineHeight: 1.6 }}>
        Die App ist nicht offline. Der Auth-Dienst konnte nur nicht sauber geladen werden.
      </p>
      <p style={{ color: colors.text.secondary, marginBottom: '1.75rem', fontSize: '15px', lineHeight: 1.6 }}>
        Das passiert oft durch Netzwerkfilter, Privacy-Erweiterungen oder eine veraltete Browser-Session. Statt in einen irrefuehrenden Offline-Modus zu springen, zeigen wir jetzt diesen klaren Retry-Zustand.
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onRetry ?? (() => window.location.reload())}
          style={{
            border: 'none',
            borderRadius: '999px',
            padding: '0.9rem 1.35rem',
            background: 'linear-gradient(135deg, var(--primary), var(--talea-accent-sky))',
            color: '#fff',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Erneut laden
        </button>
      </div>
    </div>
  </div>
);

// Offline app shell: renders without real Clerk when browser is offline
// OfflineClerkProvider mocks Clerk's internal contexts (useAuth, useUser etc.)
// OfflineThemeProvider uses localStorage only (no backend API)
// Original reader components are used for full feature parity (animations, quiz, facts)
const OfflineApp = () => (
  <MotionConfig reducedMotion="user">
    <GlobalHaptics />
    <Router>
      <OfflineClerkProvider>
        <OfflineThemeProvider>
          <AudioPlayerProvider>
            <React.Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
                <Route path="/story-reader/:storyId" element={<CinematicStoryViewer />} />
                <Route path="/story-reader-scroll/:storyId" element={<StoryScrollReaderScreen />} />
                <Route path="/story-reader-old/:storyId" element={<StoryReaderScreen />} />
                <Route path="/doku-reader/:dokuId" element={<CinematicDokuViewer />} />
                <Route path="/doku-reader-old/:dokuId" element={<DokuReaderScreen />} />
                <Route path="/doku-reader-scroll/:dokuId" element={<DokuScrollReaderScreen />} />
                <Route path="*" element={<OfflineContentScreen />} />
              </Routes>
            </React.Suspense>
          </AudioPlayerProvider>
        </OfflineThemeProvider>
      </OfflineClerkProvider>
    </Router>
  </MotionConfig>
);

// Error boundary that catches Clerk load failures and falls back to offline mode
class ClerkErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // Log but don't crash - we'll show the offline fallback
    console.warn('[Talea] Clerk failed to load, switching to offline mode:', error.message);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Detects unhandled Clerk load promise rejections and forces offline mode
function useClerkLoadFailureDetection(onFail: () => void) {
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      const msg = String(event.reason?.message || event.reason || '');
      if (msg.includes('failed_to_load_clerk_js') || msg.includes('Failed to load Clerk')) {
        event.preventDefault(); // Prevent console noise
        console.warn('[Talea] Clerk JS failed to load, switching to offline mode');
        onFail();
      }
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, [onFail]);
}

export default function App() {
  const isOnline = useSyncExternalStore(subscribeToOnlineStatus, getOnlineStatus);
  const [clerkFailed, setClerkFailed] = useState(false);

  const handleClerkFailure = useCallback(() => setClerkFailed(true), []);
  useClerkLoadFailureDetection(handleClerkFailure);

  // Reset clerkFailed when connectivity is restored
  useEffect(() => {
    if (isOnline && clerkFailed) {
      // Re-check after a short delay when we come back online
      const timer = setTimeout(() => {
        checkRealConnectivity().then((ok) => {
          if (ok) setClerkFailed(false);
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, clerkFailed]);

  if (!isOnline || clerkFailed) {
    return (
      <Provider store={store}>
        {!isOnline ? <OfflineApp /> : <AuthUnavailableScreen onRetry={() => window.location.reload()} />}
      </Provider>
    );
  }

  if (!clerkPublishableKey) {
    return <MissingKeyScreen />;
  }

  const clerkFallback = (
    <Provider store={store}>
      <AuthUnavailableScreen onRetry={() => window.location.reload()} />
    </Provider>
  );

  return (
    <ClerkErrorBoundary fallback={clerkFallback}>
      <Provider store={store}>
        <ClerkProvider publishableKey={clerkPublishableKey}>
          <ThemeProvider>
            <AudioPlayerProvider>
              <UserAccessProvider>
                <ChildProfilesProvider>
                  <OfflineStorageProvider>
                    <AgentProvider>
                      <AppContent />
                    </AgentProvider>
                  </OfflineStorageProvider>
                </ChildProfilesProvider>
              </UserAccessProvider>
            </AudioPlayerProvider>
          </ThemeProvider>
        </ClerkProvider>
      </Provider>
    </ClerkErrorBoundary>
  );
}
