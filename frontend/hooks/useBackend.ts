import { useAuth } from "@clerk/clerk-react";
import Client from "../client_new";
import { getBackendUrl } from "../config";

// Returns a backend client configured with the user's Clerk auth token.
export function useBackend() {
  const { getToken } = useAuth();

  // Get the target URL from environment or auto-detect
  const target = getBackendUrl();

  return new Client(target, {
    auth: async () => {
      // getToken() will return null if the user is not signed in.
      const token = await getToken();
      if (!token) {
        // No token, so no auth header.
        // The backend will reject if the endpoint requires auth.
        return undefined;
      }
      return { authorization: `Bearer ${token}` };
    },
    requestInit: { credentials: "include" }
  });
}
