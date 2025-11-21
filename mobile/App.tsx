import 'react-native-gesture-handler';
import './global.css'; // Import NativeWind styles
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { store } from './src/store/store';
import { ClerkProvider } from './src/utils/auth/ClerkProvider';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <ClerkProvider>
          <StatusBar style="auto" />
          <AppNavigator />
        </ClerkProvider>
      </Provider>
    </SafeAreaProvider>
  );
}
