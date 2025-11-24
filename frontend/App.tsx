import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ClerkProvider } from '@clerk/clerk-react';
import { Toaster } from 'sonner';
import { store } from './store/store';

import HomeScreen from './screens/Home/HomeScreen';
import AvatarWizardScreen from './screens/Avatar/AvatarWizardScreen';
import EditAvatarScreen from './screens/Avatar/EditAvatarScreen';
import AvatarsScreen from './screens/Avatar/AvatarsScreen';
import AvatarDetailScreen from './screens/Avatar/AvatarDetailScreen';
import StoryWizardScreen from './screens/Story/StoryWizardScreen';
import ModernStoryWizard from './screens/Story/ModernStoryWizard';
import StoryReaderScreen from './screens/Story/StoryReaderScreen';
import StoryScrollReaderScreen from './screens/Story/StoryScrollReaderScreen';
import CinematicStoryViewer from './screens/Story/CinematicStoryViewer';
import CinematicDokuViewer from './screens/Doku/CinematicDokuViewer';

import StoriesScreen from './screens/Story/StoriesScreen';
import FairyTaleSelectionScreen from './screens/Story/FairyTaleSelectionScreen';
import CharacterMappingScreen from './screens/Story/CharacterMappingScreen';
import LogViewerScreen from './screens/Logs/LogViewerScreen';
import AppLayout from './components/layout/AppLayout';
import TaviButton from './components/common/TaviButton';
import { colors } from './utils/constants/colors';
import AuthScreen from './screens/Auth/AuthScreen';
import AdminDashboard from './screens/Admin/AdminDashboard';
import { clerkPublishableKey } from './config';
import DokuWizardScreen from './screens/Doku/DokuWizardScreen';
import DokuReaderScreen from './screens/Doku/DokuReaderScreen';
import DokuScrollReaderScreen from './screens/Doku/DokuScrollReaderScreen';
import DokusScreen from './screens/Doku/DokusScreen';
import CharacterPoolScreen from './screens/CharacterPool/CharacterPoolScreen';
import FairyTalesScreen from './screens/FairyTales/FairyTalesScreen';
import SettingsScreen from './screens/Settings/SettingsScreen';
import { ThemeProvider } from './contexts/ThemeContext';
import ModernHomeScreen from './screens/Home/ModernHomeScreen';

const AppContent = () => (
  <Router>
    <div style={{ minHeight: '100vh', background: colors.gradients.background }}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<ModernHomeScreen />} />
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
          <Route path="/characters" element={<CharacterPoolScreen />} />
          <Route path="/fairytales" element={<FairyTalesScreen />} />
          <Route path="/doku/create" element={<DokuWizardScreen />} />
          <Route path="/doku-reader/:dokuId" element={<CinematicDokuViewer />} />
          <Route path="/doku-reader-old/:dokuId" element={<DokuReaderScreen />} />
          <Route path="/auth" element={<AuthScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/_admin" element={<AdminDashboard />} />
        </Route>
      </Routes>
      <TaviButton />
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
    </div>
  </Router>
);

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
          <AppContent />
        </ThemeProvider>
      </ClerkProvider>
    </Provider>
  );
}
