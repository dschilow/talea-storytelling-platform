import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TaleaWebApp } from './src/web/TaleaWebApp';

/** All screens, providers, auth and UI come from frontend/, including Android. */
export default function App() {
  return <SafeAreaProvider><TaleaWebApp /></SafeAreaProvider>;
}
