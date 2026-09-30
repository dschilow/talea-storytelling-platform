// What each subscription plan includes and costs. The limits mirror
// backend/helpers/plan-catalog.ts (enforced there); backend/helpers/plan-catalog.test.ts
// fails when the two drift apart. Prices are charged by Clerk Billing and have
// to match the plans configured in the Clerk dashboard.

export type SubscriptionPlan = 'free' | 'starter' | 'familie' | 'premium';

export const PLAN_ORDER: SubscriptionPlan[] = ['free', 'starter', 'familie', 'premium'];

export const FREE_TRIAL_DAYS = 7;

export const PLAN_PRICES: Record<SubscriptionPlan, { monthly: number; yearly: number | null }> = {
  free: { monthly: 0, yearly: null },
  starter: { monthly: 4.99, yearly: 39.99 },
  familie: { monthly: 9.99, yearly: 79.99 },
  premium: { monthly: 14.99, yearly: 119.99 },
};

export const PLAN_QUOTAS: Record<SubscriptionPlan, { stories: number; dokus: number }> = {
  free: { stories: 1, dokus: 1 },
  starter: { stories: 8, dokus: 8 },
  familie: { stories: 20, dokus: 20 },
  premium: { stories: 40, dokus: 40 },
};

export const FREE_TRIAL_QUOTAS = { stories: 3, dokus: 3 };

export const PLAN_DAILY_LIMITS: Record<SubscriptionPlan, { stories: number; dokus: number }> = {
  free: { stories: 1, dokus: 1 },
  starter: { stories: 2, dokus: 2 },
  familie: { stories: 4, dokus: 4 },
  premium: { stories: 5, dokus: 5 },
};

export const PLAN_TAVI_MESSAGES: Record<SubscriptionPlan, number> = {
  free: 10,
  starter: 30,
  familie: 100,
  premium: 200,
};

export const FREE_TRIAL_TAVI_MESSAGES = 25;

export const PLAN_IMAGES: Record<SubscriptionPlan, number> = {
  free: 5,
  starter: 20,
  familie: 50,
  premium: 100,
};

export const PLAN_PROFILE_LIMITS: Record<SubscriptionPlan, number> = {
  free: 1,
  starter: 1,
  familie: 3,
  premium: 10,
};

export type AudioLibraryAccess = 'sample' | 'basic' | 'full';

export const PLAN_AUDIO_LIBRARY_ACCESS: Record<SubscriptionPlan, AudioLibraryAccess> = {
  free: 'sample',
  starter: 'basic',
  familie: 'full',
  premium: 'full',
};

export const AUDIO_BASIC_LIBRARY_MIN_AGE_DAYS = 30;

export const PLAN_TAVI_CAN_CREATE: Record<SubscriptionPlan, boolean> = {
  free: false,
  starter: true,
  familie: true,
  premium: true,
};

export const PLAN_TITLES: Record<SubscriptionPlan, string> = {
  free: 'Entdecker',
  starter: 'Starter',
  familie: 'Familie',
  premium: 'Premium',
};

export const RECOMMENDED_PLAN: SubscriptionPlan = 'familie';

export function formatEuro(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

// Months you get free when paying yearly instead of 12x monthly.
export function yearlySavingMonths(plan: SubscriptionPlan): number {
  const { monthly, yearly } = PLAN_PRICES[plan];
  if (!yearly || monthly <= 0) return 0;
  return Math.round((monthly * 12 - yearly) / monthly);
}

export const AUDIO_ACCESS_LABELS: Record<AudioLibraryAccess, string> = {
  sample: '1 Probe-Folge',
  basic: `Ältere Folgen (${AUDIO_BASIC_LIBRARY_MIN_AGE_DAYS}+ Tage)`,
  full: 'Komplette Bibliothek',
};

export type PlanFeatureRow = {
  label: string;
  hint?: string;
  values: Record<SubscriptionPlan, string | boolean>;
};

export const PLAN_FEATURE_ROWS: PlanFeatureRow[] = [
  {
    label: 'Story-Münzen pro Monat',
    hint: '1 Geschichte = 1 Münze, gilt für alle Kinderprofile zusammen',
    values: {
      free: `${FREE_TRIAL_QUOTAS.stories} im Test, dann ${PLAN_QUOTAS.free.stories}`,
      starter: String(PLAN_QUOTAS.starter.stories),
      familie: String(PLAN_QUOTAS.familie.stories),
      premium: String(PLAN_QUOTAS.premium.stories),
    },
  },
  {
    label: 'Doku-Münzen pro Monat',
    hint: '1 Doku = 1 Münze',
    values: {
      free: `${FREE_TRIAL_QUOTAS.dokus} im Test, dann ${PLAN_QUOTAS.free.dokus}`,
      starter: String(PLAN_QUOTAS.starter.dokus),
      familie: String(PLAN_QUOTAS.familie.dokus),
      premium: String(PLAN_QUOTAS.premium.dokus),
    },
  },
  {
    label: 'Pro Tag höchstens',
    hint: 'je Stories und Dokus',
    values: {
      free: String(PLAN_DAILY_LIMITS.free.stories),
      starter: String(PLAN_DAILY_LIMITS.starter.stories),
      familie: String(PLAN_DAILY_LIMITS.familie.stories),
      premium: String(PLAN_DAILY_LIMITS.premium.stories),
    },
  },
  {
    label: 'Tavi-Nachrichten pro Monat',
    values: {
      free: `${FREE_TRIAL_TAVI_MESSAGES} im Test, dann ${PLAN_TAVI_MESSAGES.free}`,
      starter: String(PLAN_TAVI_MESSAGES.starter),
      familie: String(PLAN_TAVI_MESSAGES.familie),
      premium: String(PLAN_TAVI_MESSAGES.premium),
    },
  },
  {
    label: 'Tavi erstellt Geschichten & Dokus direkt im Chat',
    values: { ...PLAN_TAVI_CAN_CREATE },
  },
  {
    label: 'Audio-Dokus hören',
    values: {
      free: AUDIO_ACCESS_LABELS[PLAN_AUDIO_LIBRARY_ACCESS.free],
      starter: AUDIO_ACCESS_LABELS[PLAN_AUDIO_LIBRARY_ACCESS.starter],
      familie: AUDIO_ACCESS_LABELS[PLAN_AUDIO_LIBRARY_ACCESS.familie],
      premium: AUDIO_ACCESS_LABELS[PLAN_AUDIO_LIBRARY_ACCESS.premium],
    },
  },
  {
    label: 'KI-Bilder pro Monat',
    hint: 'Avatar-Bilder und Bilder, die Tavi malt',
    values: {
      free: String(PLAN_IMAGES.free),
      starter: String(PLAN_IMAGES.starter),
      familie: String(PLAN_IMAGES.familie),
      premium: String(PLAN_IMAGES.premium),
    },
  },
  {
    label: 'Kinderprofile',
    values: {
      free: String(PLAN_PROFILE_LIMITS.free),
      starter: String(PLAN_PROFILE_LIMITS.starter),
      familie: String(PLAN_PROFILE_LIMITS.familie),
      premium: String(PLAN_PROFILE_LIMITS.premium),
    },
  },
  {
    label: 'Community-Dokus lesen',
    values: { free: true, starter: true, familie: true, premium: true },
  },
  {
    label: 'Elternkontrolle',
    values: {
      free: 'Basis',
      starter: 'Basis',
      familie: 'Voll + Profil-Budgets',
      premium: 'Voll + Profil-Budgets',
    },
  },
];
