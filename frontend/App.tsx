import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ClerkProvider } from '@clerk/clerk-react';
import { store } from './store/store';

import HomeScreen from './screens/Home/HomeScreen';
import AvatarCreationScreen from './screens/Avatar/AvatarCreationScreen';
import EditAvatarScreen from './screens/Avatar/EditAvatarScreen';
import StoryWizardScreen from './screens/Story/StoryWizardScreen';
import StoryReaderScreen from './screens/Story/StoryReaderScreen';
import LogViewerScreen from './screens/Logs/LogViewerScreen';
import Navigation from './components/navigation/Navigation';
import { colors } from './utils/constants/colors';
import AuthScreen from './screens/Auth/AuthScreen';
import AdminDashboard from './screens/Admin/AdminDashboard';
import { clerkPublishableKey } from './config';

export default function App() {
  return (
    <Provider store={store}>
      <ClerkProvider publishableKey={clerkPublishableKey || undefined}>
        <Router>
          <div style={{ minHeight: '100vh', backgroundColor: colors.background }}>
            <Routes>
              <Route path="/" element={<HomeScreen />} />
              <Route path="/avatar" element={<AvatarCreationScreen />} />
              <Route path="/avatar/edit/:avatarId" element={<EditAvatarScreen />} />
              <Route path="/story" element={<StoryWizardScreen />} />
              <Route path="/story-reader/:storyId" element={<StoryReaderScreen />} />
              <Route path="/stories" element={<HomeScreen />} />
              <Route path="/community" element={<HomeScreen />} />
              <Route path="/logs" element={<LogViewerScreen />} />
              {/* Auth routes */}
              <Route path="/auth" element={<AuthScreen />} />
              {/* Hidden admin route */}
              <Route path="/_admin" element={<AdminDashboard />} />
            </Routes>
            <Navigation />
          </div>
        </Router>
      </ClerkProvider>
    </Provider>
  );
}
