import { useAuth } from "@clerk/clerk-react";
import { Client as BackendClient } from "../client_new";
import { getBackendUrl } from "../config";

// Returns a backend client configured with the user's Clerk auth token.
export function useBackend() {
  const { getToken, isSignedIn, isLoaded } = useAuth();

  // Get the target URL from environment or auto-detect
  const target = getBackendUrl();

  return new BackendClient(target, {
    auth: async () => {
      // Wait for Clerk to load before checking authentication
      if (!isLoaded) {
        throw new Error("Authentication not loaded yet");
      }

      // If user is not signed in, no auth header needed
      if (!isSignedIn) {
        return undefined;
      }

      // Get token for signed-in user
      const token = await getToken();
      if (!token) {
        // User is signed in but no token available - throw error to prevent hanging
        throw new Error("No authentication token available");
      }
      return { authorization: `Bearer ${token}` };
    },
    requestInit: { credentials: "include" }
  });
}
