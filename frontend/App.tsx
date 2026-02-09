import React from 'react';
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
import { ThemeProvider } from './contexts/ThemeContext';
import { AudioPlayerProvider } from './contexts/AudioPlayerContext';
import ModernHomeScreen from './screens/Home/ModernHomeScreen';
import LandingPage from './screens/Landing/LandingPage';

import { useLanguageSync } from './hooks/useLanguageSync';

// Inner component that uses router hooks
const RouterContent = () => {
  const { isLoaded, isSignedIn } = useUser();
  const location = useLocation();
  const isLandingRoute = location.pathname.startsWith('/landing') || (!isSignedIn && location.pathname === '/');

  if (!isLoaded) {
    return null;
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
              <Route path="/logs" element={<LogViewerScreen />} />
              <Route path="/doku" element={<DokusScreen />} />
              <Route path="/createaudiodoku" element={<CreateAudioDokuScreen />} />
              <Route path="/characters" element={<CharacterPoolScreen />} />
              <Route path="/artifacts" element={<ArtifactPoolScreen />} />
              <Route path="/fairytales" element={<FairyTalesScreen />} />
              <Route path="/doku/create" element={<ModernDokuWizard />} />
              <Route path="/doku-reader/:dokuId" element={<CinematicDokuViewer />} />
              <Route path="/doku-reader-old/:dokuId" element={<DokuReaderScreen />} />
              <Route path="/auth" element={<Navigate to="/" replace />} />
              <Route path="/settings" element={<SettingsScreen />} />
              <Route path="/_admin" element={<AdminDashboard />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
      {isSignedIn && !isLandingRoute && <TaviButton />}
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

export default function App() {
  if (!clerkPublishableKey) {
    return <MissingKeyScreen />;
  }

  return (
    <Provider store={store}>
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <ThemeProvider>
          <AudioPlayerProvider>
            <AppContent />
          </AudioPlayerProvider>
        </ThemeProvider>
      </ClerkProvider>
    </Provider>
  );
}
