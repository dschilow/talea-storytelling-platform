import { useMemo } from "react";
import { useAuth } from "@clerk/clerk-react";
import BackendClient from "../client_new";
import { getBackendUrl } from "../config";

// Returns a backend client configured with the user's Clerk auth token.
export function useBackend() {
  const { getToken, isSignedIn, isLoaded } = useAuth();

  // Get the target URL from environment or auto-detect
  const target = getBackendUrl();

  // Memoize the client instance to prevent recreation on every render
  return useMemo(() => {
    return new BackendClient(target, {
      auth: async () => {
        // Wait for Clerk to load before checking authentication
        if (!isLoaded) {
          return undefined;
        }

        // If user is not signed in, no auth header needed
        if (!isSignedIn) {
          return undefined;
        }

        // Get token for signed-in user
        const token = await getToken();
        return token ? { authorization: `Bearer ${token}` } : undefined;
      },
      requestInit: { credentials: "include" }
    });
  }, [target, getToken, isSignedIn, isLoaded]);
}
