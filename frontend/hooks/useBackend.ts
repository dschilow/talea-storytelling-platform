import { useAuth } from "@clerk/clerk-react";
import Client from "../client_new";

// Returns a backend client configured with the user's Clerk auth token.
export function useBackend() {
  const { getToken, isSignedIn } = useAuth();

  // Get the target URL from environment or use default
  const target = import.meta.env.VITE_CLIENT_TARGET || 'http://localhost:4000';

  return new Client(target, {
    auth: async () => {
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
