import { useAuth } from "@clerk/clerk-react";
import backend from "~backend/client";

// Returns a backend client configured with the user's Clerk auth token (if signed in).
export function useBackend() {
  const { getToken, isSignedIn } = useAuth();
  if (!isSignedIn) return backend;
  return backend.with({
    auth: async () => {
      const token = await getToken();
      if (!token) return null;
      return { authorization: `Bearer ${token}` };
    },
  });
}
