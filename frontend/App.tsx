import React, { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ClerkProvider, useUser } from '@clerk/clerk-react';
import { Toaster } from 'sonner';
import { MotionConfig } from 'framer-motion';
import { store } from './store/store';

import HomeScreen from './screens/Home/TaleaHomeScreen';
import AvatarWizardScreen from './screens/Avatar/AvatarWizardScreen';
import EditAvatarScreen from './screens/Avatar/EditAvatarScreen';
import AvatarsScreen from './screens/Avatar/TaleaAvatarsScreen';
import AvatarDetailScreen from './screens/Avatar/AvatarDetailScreen';
import StoryWizardScreen from './screens/Story/StoryWizardScreen';
import ModernStoryWizard from './screens/Story/TaleaStoryWizard';
import StoryReaderScreen from './screens/Story/StoryReaderScreen';
import StoryScrollReaderScreen from './screens/Story/StoryScrollReaderScreen';
import CinematicStoryViewer from './screens/Story/CinematicStoryViewer';
import CinematicDokuViewer from './screens/Doku/CinematicDokuViewer';

import StoriesScreen from './screens/Story/TaleaStoriesScreen';
import FairyTaleSelectionScreen from './screens/Story/FairyTaleSelectionScreen';
import CharacterMappingScreen from './screens/Story/CharacterMappingScreen';
import LogViewerScreen from './screens/Logs/LogViewerScreen';
import AppLayout from './components/layout/AppLayout';
import TaviButton from './components/common/TaviButton';
import { colors } from './utils/constants/colors';
import AuthScreen from './screens/Auth/AuthScreen';
import AdminDashboard from './screens/Admin/AdminDashboard';
import { clerkPublishableKey } from './config';
import ModernDokuWizard from './screens/Doku/ModernDokuWizard';
import DokuReaderScreen from './screens/Doku/DokuReaderScreen';
import DokuScrollReaderScreen from './screens/Doku/DokuScrollReaderScreen';
import DokusScreen from './screens/Doku/TaleaDokusScreen';
import CreateAudioDokuScreen from './screens/Doku/CreateAudioDokuScreen';
import CharacterPoolScreen from './screens/CharacterPool/CharacterPoolScreen';
import ArtifactPoolScreen from './screens/ArtifactPool/ArtifactPoolScreen';
import FairyTalesScreen from './screens/FairyTales/FairyTalesScreen';
import SettingsScreen from './screens/Settings/SettingsScreen';
import CommunityQuizScreen from './screens/Quiz/CommunityQuizScreen';
import TaleaLearningPathMapView from './screens/Journey/TaleaLearningPathMapView';
import { ThemeProvider, OfflineThemeProvider } from './contexts/ThemeContext';
import { AudioPlayerProvider } from './contexts/AudioPlayerContext';
import { UserAccessProvider, useOptionalUserAccess } from './contexts/UserAccessContext';
import { OfflineStorageProvider } from './contexts/OfflineStorageContext';
import ModernHomeScreen from './screens/Home/ModernHomeScreen';
import LandingPage from './screens/Landing/LandingPage';
import ParentalOnboardingScreen from './screens/Settings/ParentalOnboardingScreen';
import OfflineContentScreen from './screens/Offline/OfflineContentScreen';
import { OfflineClerkProvider } from './contexts/OfflineClerkProvider';

import { useLanguageSync } from './hooks/useLanguageSync';

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
              <Route path="/map" element={<TaleaLearningPathMapView />} />
              <Route path="/_admin" element={<AdminOnlyRoute><AdminDashboard /></AdminOnlyRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
      {isSignedIn && !isLandingRoute && <TaviButton showLauncher={false} />}
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

// Offline app shell: renders without real Clerk when browser is offline
// OfflineClerkProvider mocks Clerk's internal contexts (useAuth, useUser etc.)
// OfflineThemeProvider uses localStorage only (no backend API)
// Original reader components are used for full feature parity (animations, quiz, facts)
const OfflineApp = () => (
  <MotionConfig reducedMotion="user">
    <Router>
      <OfflineClerkProvider>
        <OfflineThemeProvider>
          <AudioPlayerProvider>
            <Routes>
              <Route path="/story-reader/:storyId" element={<CinematicStoryViewer />} />
              <Route path="/story-reader-scroll/:storyId" element={<StoryScrollReaderScreen />} />
              <Route path="/story-reader-old/:storyId" element={<StoryReaderScreen />} />
              <Route path="/doku-reader/:dokuId" element={<CinematicDokuViewer />} />
              <Route path="/doku-reader-old/:dokuId" element={<DokuReaderScreen />} />
              <Route path="/doku-reader-scroll/:dokuId" element={<DokuScrollReaderScreen />} />
              <Route path="*" element={<OfflineContentScreen />} />
            </Routes>
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
        <OfflineApp />
      </Provider>
    );
  }

  if (!clerkPublishableKey) {
    return <MissingKeyScreen />;
  }

  const offlineFallback = (
    <Provider store={store}>
      <OfflineApp />
    </Provider>
  );

  return (
    <ClerkErrorBoundary fallback={offlineFallback}>
      <Provider store={store}>
        <ClerkProvider publishableKey={clerkPublishableKey}>
          <ThemeProvider>
            <AudioPlayerProvider>
              <UserAccessProvider>
                <OfflineStorageProvider>
                  <AppContent />
                </OfflineStorageProvider>
              </UserAccessProvider>
            </AudioPlayerProvider>
          </ThemeProvider>
        </ClerkProvider>
      </Provider>
    </ClerkErrorBoundary>
  );
}