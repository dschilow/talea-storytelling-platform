import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const profile = (await backend.user.me()) as any;
      const parentalControls = profile.parentalControls;
      const onboardingCompleted =
        typeof parentalControls?.onboardingCompleted === 'boolean' ? parentalControls.onboardingCompleted : null;

      setRole((profile.role as UserRole) ?? 'user');
      setSubscription((profile.subscription as SubscriptionPlan) ?? 'free');
      setBilling(profile.billing ?? null);
      setParentalOnboardingCompleted(onboardingCompleted);
      setHasParentalPin(Boolean(parentalControls?.hasPin));
      setServerLanguage(typeof profile.language === 'string' ? profile.language : null);
      setServerTheme(
        profile.theme === 'light' || profile.theme === 'dark' || profile.theme === 'system' ? profile.theme : null
      );
    } catch (error) {
      console.error('[UserAccess] Failed to load profile', error);
      reset();
    } finally {
      setIsLoading(false);
    }
  }, [backend, isLoaded, isSignedIn, reset]);

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
