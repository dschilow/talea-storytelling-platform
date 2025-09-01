import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store/store';

import HomeScreen from './screens/Home/HomeScreen';
import AvatarCreationScreen from './screens/Avatar/AvatarCreationScreen';
import EditAvatarScreen from './screens/Avatar/EditAvatarScreen';
import StoryWizardScreen from './screens/Story/StoryWizardScreen';
import StoryReaderScreen from './screens/Story/StoryReaderScreen';
import Navigation from './components/navigation/Navigation';
import { colors } from './utils/constants/colors';

export default function App() {
  return (
    <Provider store={store}>
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
          </Routes>
          <Navigation />
        </div>
      </Router>
    </Provider>
  );
}
