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
import StoryReaderScreen from './screens/Story/StoryReaderScreen';
import StoryScrollReaderScreen from './screens/Story/StoryScrollReaderScreen';
import StoriesScreen from './screens/Story/StoriesScreen';
import LogViewerScreen from './screens/Logs/LogViewerScreen';
import Navigation from './components/navigation/Navigation';
import TaviButton from './components/common/TaviButton';
import { colors } from './utils/constants/colors';
import AuthScreen from './screens/Auth/AuthScreen';
import AdminDashboard from './screens/Admin/AdminDashboard';
import { clerkPublishableKey } from './config';
import DokuWizardScreen from './screens/Doku/DokuWizardScreen';
import DokuReaderScreen from './screens/Doku/DokuReaderScreen';
import DokuScrollReaderScreen from './screens/Doku/DokuScrollReaderScreen';
import DokusScreen from './screens/Doku/DokusScreen';

const AppContent = () => (
  <Router>
    <div style={{ minHeight: '100vh', background: colors.gradients.background }}>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/avatar" element={<AvatarsScreen />} />
        <Route path="/avatar/create" element={<AvatarWizardScreen />} />
        <Route path="/avatar/:avatarId" element={<AvatarDetailScreen />} />
        <Route path="/avatar/edit/:avatarId" element={<EditAvatarScreen />} />
        <Route path="/story" element={<StoryWizardScreen />} />
        <Route path="/story-reader/:storyId" element={<StoryScrollReaderScreen />} />
        <Route path="/story-reader-old/:storyId" element={<StoryReaderScreen />} />
        <Route path="/stories" element={<StoriesScreen />} />
        <Route path="/community" element={<HomeScreen />} />
        <Route path="/logs" element={<LogViewerScreen />} />
        <Route path="/doku" element={<DokusScreen />} />
        <Route path="/doku/create" element={<DokuWizardScreen />} />
        <Route path="/doku-reader/:dokuId" element={<DokuScrollReaderScreen />} />
        <Route path="/doku-reader-old/:dokuId" element={<DokuReaderScreen />} />
        <Route path="/auth" element={<AuthScreen />} />
        <Route path="/_admin" element={<AdminDashboard />} />
      </Routes>
      <Navigation />
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
        <AppContent />
      </ClerkProvider>
    </Provider>
  );
}
