/**
 * OfflineClerkProvider: Mocks Clerk's internal React contexts so that
 * useAuth(), useUser(), and useBackend() work without a real ClerkProvider.
 *
 * This allows original reader components (CinematicStoryViewer, DokuReaderScreen, etc.)
 * to render in offline mode without crashing.
 *
 * All auth values are set to "not signed in" / null, so no privileged
 * operations will succeed (which is correct for offline mode).
 */
import React from 'react';
import {
  ClerkInstanceContext,
  ClientContext,
  SessionContext,
  UserContext,
} from '@clerk/shared/react';

// AuthContext is defined in @clerk/clerk-react, not @clerk/shared
// We import it from the internal chunk that re-exports it
import { AuthContext } from '@clerk/clerk-react/dist/chunk-F54Q6IK5.mjs';

// Clerk's createContextAndHook wraps values as { value: actualValue }
const wrapValue = <T,>(val: T) => ({ value: val });

const noopAsync = async () => null;
const noopSync = () => null;

export const OfflineClerkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Minimal mock of IsomorphicClerk – only needs properties that useAuth/useUser access
  const clerkMock = {
    loaded: true,
    load: noopAsync,
    signOut: noopAsync,
    openSignIn: noopSync,
    openSignUp: noopSync,
    openUserProfile: noopSync,
    closeSignIn: noopSync,
    closeSignUp: noopSync,
    closeUserProfile: noopSync,
    mountSignIn: noopSync,
    mountSignUp: noopSync,
    mountUserProfile: noopSync,
    unmountSignIn: noopSync,
    unmountSignUp: noopSync,
    unmountUserProfile: noopSync,
    addListener: () => () => {},
    navigate: noopAsync,
    session: null,
    user: null,
    client: null,
    organization: null,
    __internal_last: null,
    getToken: noopAsync,
    setActive: noopAsync,
    // telemetry stub (useAuth calls isomorphicClerk.telemetry?.record(...))
    telemetry: { record: noopSync, isEnabled: false },
    // event emitter stubs (clerkLoaded() calls .on('status', handler, { notify: true }))
    on: (_event: string, handler: (status: string) => void, opts?: { notify?: boolean }) => {
      if (opts?.notify) handler('ready');
    },
    off: noopSync,
    __unstable__environment: null,
  };

  const authMock = {
    userId: null,
    sessionId: null,
    orgId: null,
    orgRole: null,
    orgSlug: null,
    actor: null,
    isLoaded: true,
    isSignedIn: false,
    getToken: noopAsync,
    has: () => false,
    signOut: noopAsync,
    orgPermissions: null,
  };

  const userMock = {
    isLoaded: true,
    isSignedIn: false,
    user: null,
  };

  const sessionMock = {
    isLoaded: true,
    isSignedIn: false,
    session: null,
  };

  const clientMock = {
    isLoaded: true,
    client: null,
  };

  return (
    <ClerkInstanceContext.Provider value={clerkMock as any}>
      <ClientContext.Provider value={wrapValue(clientMock) as any}>
        <SessionContext.Provider value={wrapValue(sessionMock) as any}>
          <AuthContext.Provider value={wrapValue(authMock) as any}>
            <UserContext.Provider value={wrapValue(userMock) as any}>
              {children}
            </UserContext.Provider>
          </AuthContext.Provider>
        </SessionContext.Provider>
      </ClientContext.Provider>
    </ClerkInstanceContext.Provider>
  );
};