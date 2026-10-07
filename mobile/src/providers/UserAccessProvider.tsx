import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useUser } from '@clerk/clerk-expo';

import { useBackend } from '@/api/backend';

/** Ported from frontend/contexts/UserAccessContext.tsx. */

export type UserRole = 'admin' | 'user';
export type SubscriptionPlan = 'free' | 'starter' | 'familie' | 'premium';

export type CreditUsage = {
  limit: number | null;
  used: number;
  remaining: number | null;
  costPerGeneration: number;
};

export type BillingSnapshot = {
  plan: SubscriptionPlan;
  periodStart: string | Date;
  storyCredits: CreditUsage;
  dokuCredits: CreditUsage;
  audioCredits: CreditUsage;
  chatCredits: CreditUsage;
  imageCredits: CreditUsage;
  ttsCharacterCredits: CreditUsage;
};

export type UserAccessState = {
  isLoading: boolean;
  role: UserRole | null;
  subscription: SubscriptionPlan | null;
  billing: BillingSnapshot | null;
  isAdmin: boolean;
  parentalOnboardingCompleted: boolean | null;
  hasParentalPin: boolean;
  /** Server-side language + theme preferences, used to seed the local ones. */
  serverLanguage: string | null;
  serverTheme: 'light' | 'dark' | 'system' | null;
  refresh: () => Promise<void>;
};

const defaultState: UserAccessState = {
  isLoading: false,
  role: null,
  subscription: null,
  billing: null,
  isAdmin: false,
  parentalOnboardingCompleted: null,
  hasParentalPin: false,
  serverLanguage: null,
  serverTheme: null,
  refresh: async () => {},
};

const UserAccessContext = createContext<UserAccessState | undefined>(undefined);

export function UserAccessProvider({ children }: { children: ReactNode }) {
  const backend = useBackend();
  const { isLoaded, isSignedIn } = useUser();

  // `/user/me` is not profile-scoped, so a new client identity (token resolver,
  // active profile id) must not trigger a reload. Reading it through a ref keeps
  // `loadProfile` stable.
  const backendRef = useRef(backend);
  backendRef.current = backend;
  // Only the first load may show the full-screen splash; later refreshes happen
  // behind the visible UI instead of tearing the whole navigator down.
  const hasLoadedRef = useRef(false);

  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionPlan | null>(null);
  const [billing, setBilling] = useState<BillingSnapshot | null>(null);
  const [parentalOnboardingCompleted, setParentalOnboardingCompleted] = useState<boolean | null>(null);
  const [hasParentalPin, setHasParentalPin] = useState(false);
  const [serverLanguage, setServerLanguage] = useState<string | null>(null);
  const [serverTheme, setServerTheme] = useState<'light' | 'dark' | 'system' | null>(null);

  const reset = useCallback(() => {
    setRole(null);
    setSubscription(null);
    setBilling(null);
    setParentalOnboardingCompleted(null);
    setHasParentalPin(false);
    setServerLanguage(null);
    setServerTheme(null);
  }, []);

  const loadProfile = useCallback(async () => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      reset();
      hasLoadedRef.current = false;
      setIsLoading(false);
      return;
    }

    try {
      if (!hasLoadedRef.current) setIsLoading(true);
      const profile = (await backendRef.current.user.me()) as any;
      const parentalControls = profile.parentalControls;
      const onboardingCompleted =
        typeof parentalControls?.onboardingCompleted === 'boolean' ? parentalControls.onboardingCompleted : null;

      setRole((profile.role as UserRole) ?? 'user');
      setSubscription((profile.subscription as SubscriptionPlan) ?? 'free');
      setBilling(profile.billing ?? null);
      setParentalOnboardingCompleted(onboardingCompleted);
      setHasParentalPin(Boolean(parentalControls?.hasPin));
      setServerLanguage(typeof profile.preferredLanguage === 'string' ? profile.preferredLanguage : null);
      setServerTheme(
        profile.theme === 'light' || profile.theme === 'dark' || profile.theme === 'system' ? profile.theme : null
      );
    } catch (error) {
      console.error('[UserAccess] Failed to load profile', error);
      reset();
    } finally {
      hasLoadedRef.current = true;
      setIsLoading(false);
    }
  }, [isLoaded, isSignedIn, reset]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const value = useMemo<UserAccessState>(
    () => ({
      isLoading,
      role,
      subscription,
      billing,
      isAdmin: role === 'admin',
      parentalOnboardingCompleted,
      hasParentalPin,
      serverLanguage,
      serverTheme,
      refresh: loadProfile,
    }),
    [
      billing,
      hasParentalPin,
      isLoading,
      loadProfile,
      parentalOnboardingCompleted,
      role,
      serverLanguage,
      serverTheme,
      subscription,
    ]
  );

  return <UserAccessContext.Provider value={value}>{children}</UserAccessContext.Provider>;
}

export function useUserAccess(): UserAccessState {
  const context = useContext(UserAccessContext);
  if (!context) throw new Error('useUserAccess must be used within a UserAccessProvider');
  return context;
}

export function useOptionalUserAccess(): UserAccessState {
  return useContext(UserAccessContext) ?? defaultState;
}
