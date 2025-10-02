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
import DokusScreen from './screens/Doku/DokusScreen';

const AppContent = () => (
  <Router>
    <div style={{ minHeight: '100vh', backgroundColor: colors.background }}>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/avatar" element={<AvatarsScreen />} />
        <Route path="/avatar/create" element={<AvatarWizardScreen />} />
        <Route path="/avatar/:avatarId" element={<AvatarDetailScreen />} />
        <Route path="/avatar/edit/:avatarId" element={<EditAvatarScreen />} />
        <Route path="/story" element={<StoryWizardScreen />} />
        <Route path="/story-reader/:storyId" element={<StoryReaderScreen />} />
        <Route path="/stories" element={<StoriesScreen />} />
        <Route path="/community" element={<HomeScreen />} />
        <Route path="/logs" element={<LogViewerScreen />} />
        {/* Doku / Galileo mode */}
        <Route path="/doku" element={<DokusScreen />} />
        <Route path="/doku/create" element={<DokuWizardScreen />} />
        <Route path="/doku-reader/:dokuId" element={<DokuReaderScreen />} />

        {/* Auth routes */}
        <Route path="/auth" element={<AuthScreen />} />
        {/* Hidden admin route */}
        <Route path="/_admin" element={<AdminDashboard />} />
      </Routes>
      <Navigation />
      <TaviButton />
      <Toaster position="top-right" richColors closeButton />
    </div>
  </Router>
);

const MissingKeyScreen = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: colors.appBackground,
    padding: '2rem',
    textAlign: 'center',
    fontFamily: 'sans-serif',
  }}>
    <div style={{
      maxWidth: '600px',
      padding: '2rem',
      borderRadius: '1rem',
      background: 'white',
      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
    }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: colors.textPrimary, marginBottom: '1rem' }}>
        Clerk Publishable Key Missing
      </h1>
      <p style={{ color: colors.textSecondary, marginBottom: '1.5rem' }}>
        To use authentication features, you need to provide your Clerk Publishable Key.
      </p>
      <p style={{ color: colors.textSecondary }}>
        Please open the file <code style={{ background: '#f3f4f6', padding: '0.2rem 0.4rem', borderRadius: '0.25rem', color: colors.primary }}>frontend/config.ts</code> and set the value of <code style={{ background: '#f3f4f6', padding: '0.2rem 0.4rem', borderRadius: '0.25rem', color: colors.primary }}>clerkPublishableKey</code>.
      </p>
      <p style={{ color: colors.textSecondary, marginTop: '1rem' }}>
        You can get your key from the <a href="https://dashboard.clerk.com" target="_blank" rel="noopener noreferrer" style={{ color: colors.primary, textDecoration: 'underline' }}>Clerk Dashboard</a>.
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
