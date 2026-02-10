import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useBackend } from "../hooks/useBackend";

type UserRole = "admin" | "user";
type SubscriptionPlan = "free" | "starter" | "familie" | "premium";

type UserAccessState = {
  isLoading: boolean;
  role: UserRole | null;
  subscription: SubscriptionPlan | null;
  isAdmin: boolean;
  refresh: () => Promise<void>;
};

const UserAccessContext = createContext<UserAccessState | undefined>(undefined);

const defaultState: UserAccessState = {
  isLoading: false,
  role: null,
  subscription: null,
  isAdmin: false,
  refresh: async () => {},
};

export const UserAccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const backend = useBackend();
  const { isLoaded, isSignedIn } = useUser();

  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionPlan | null>(null);

  const loadProfile = useCallback(async () => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      setRole(null);
      setSubscription(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const profile = await backend.user.me();
      setRole((profile.role as UserRole) ?? "user");
      setSubscription((profile.subscription as SubscriptionPlan) ?? "free");
    } catch (error) {
      console.error("Failed to load user access profile", error);
      setRole(null);
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  }, [backend, isLoaded, isSignedIn]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const value = useMemo<UserAccessState>(
    () => ({
      isLoading,
      role,
      subscription,
      isAdmin: role === "admin",
      refresh: loadProfile,
    }),
    [isLoading, loadProfile, role, subscription]
  );

  return <UserAccessContext.Provider value={value}>{children}</UserAccessContext.Provider>;
};

export const useUserAccess = () => {
  const context = useContext(UserAccessContext);
  if (!context) {
    throw new Error("useUserAccess must be used within a UserAccessProvider");
  }
  return context;
};

export const useOptionalUserAccess = () => {
  return useContext(UserAccessContext) ?? defaultState;
};

