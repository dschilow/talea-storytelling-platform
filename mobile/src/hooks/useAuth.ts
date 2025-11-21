import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-expo';
import { useEffect } from 'react';
import { api } from '@/utils/api/client';

/**
 * Custom auth hook that integrates Clerk with the API client
 */
export const useAuth = () => {
  const { isLoaded, isSignedIn, getToken, signOut } = useClerkAuth();
  const { user } = useUser();

  useEffect(() => {
    // Update API client with auth token whenever it changes
    if (isSignedIn) {
      getToken().then((token) => {
        if (token) {
          api.setAuthToken(token);
        }
      });
    } else {
      api.setAuthToken(null);
    }
  }, [isSignedIn, getToken]);

  return {
    isLoaded,
    isSignedIn,
    user,
    signOut,
    getToken,
  };
};
