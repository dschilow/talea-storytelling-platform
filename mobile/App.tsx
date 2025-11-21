import 'react-native-gesture-handler';
import './global.css'; // Import NativeWind styles
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { store } from './src/store/store';
import { ClerkProvider } from './src/utils/auth/ClerkProvider';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ThemeProvider, useTheme } from './src/utils/theme/ThemeContext';

// Wrapper component to access theme context
const AppContent = () => {
  const { isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <Provider store={store}>
          <ClerkProvider>
            <AppContent />
          </ClerkProvider>
        </Provider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
