import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store/store';

import HomeScreen from './screens/Home/HomeScreen';
import AvatarCreationScreen from './screens/Avatar/AvatarCreationScreen';
import StoryWizardScreen from './screens/Story/StoryWizardScreen';
import Navigation from './components/navigation/Navigation';

export default function App() {
  return (
    <Provider store={store}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/avatar" element={<AvatarCreationScreen />} />
            <Route path="/story" element={<StoryWizardScreen />} />
          </Routes>
          <Navigation />
        </div>
      </Router>
    </Provider>
  );
}
