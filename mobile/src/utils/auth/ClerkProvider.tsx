import React from 'react';
import { ClerkProvider as ExpoClerkProvider, ClerkLoaded } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import { ENV } from '@/config/env';

// Token cache for Clerk using Expo SecureStore
const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      console.error('Error getting token:', err);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return await SecureStore.setItemAsync(key, value);
    } catch (err) {
      console.error('Error saving token:', err);
    }
  },
};

interface Props {
  children: React.ReactNode;
}

export const ClerkProvider: React.FC<Props> = ({ children }) => {
  if (!ENV.CLERK_PUBLISHABLE_KEY) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <h2>⚠️ Clerk Key Missing</h2>
        <p>Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env file</p>
      </div>
    );
  }

  return (
    <ExpoClerkProvider
      publishableKey={ENV.CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
    >
      <ClerkLoaded>{children}</ClerkLoaded>
    </ExpoClerkProvider>
  );
};
