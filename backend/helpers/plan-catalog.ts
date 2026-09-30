// Single source of truth for what each subscription plan includes.
// Pure data without imports so tests and the frontend mirror
// (frontend/constants/planCatalog.ts) can be checked against it.

export type SubscriptionPlan = "free" | "starter" | "familie" | "premium";

export type PlanQuota = {
  stories: number | null;
  dokus: number | null;
};

export type MeteredUsageKind = "chat" | "assist" | "image" | "tts";
export type MeteredPlanQuota = Record<MeteredUsageKind, number>;

// sample = only the oldest public episode, basic = episodes older than
// AUDIO_BASIC_LIBRARY_MIN_AGE_DAYS, full = everything.
export type AudioLibraryAccess = "sample" | "basic" | "full";

export const FREE_TRIAL_DAYS = 7;

// Monthly coins per account. They are shared by all child profiles.
export const PLAN_QUOTAS: Record<SubscriptionPlan, PlanQuota> = {
  free: { stories: 1, dokus: 1 },
  starter: { stories: 8, dokus: 8 },
  familie: { stories: 20, dokus: 20 },
  premium: { stories: 40, dokus: 40 },
};

// Replaces PLAN_QUOTAS.free while the free trial runs; counted over the whole trial window.
export const FREE_TRIAL_QUOTAS: PlanQuota = { stories: 3, dokus: 3 };

// Per Europe/Berlin calendar day, per account.
export const PLAN_DAILY_LIMITS: Record<SubscriptionPlan, { stories: number; dokus: number }> = {
  free: { stories: 1, dokus: 1 },
  starter: { stories: 2, dokus: 2 },
  familie: { stories: 4, dokus: 4 },
  premium: { stories: 5, dokus: 5 },
};

// Monthly hard limits. TTS is measured in input characters, images per output,
// chat per Tavi message and assist per helper request. All limits are finite to cap spend.
export const PLAN_METERED_QUOTAS: Record<SubscriptionPlan, MeteredPlanQuota> = {
  free: { chat: 10, assist: 15, image: 5, tts: 20_000 },
  starter: { chat: 30, assist: 40, image: 20, tts: 150_000 },
  familie: { chat: 100, assist: 100, image: 50, tts: 600_000 },
  premium: { chat: 200, assist: 200, image: 100, tts: 1_500_000 },
};

export const FREE_TRIAL_METERED_QUOTAS: MeteredPlanQuota = {
  chat: 25,
  assist: 15,
  image: 5,
  tts: 20_000,
};

export const PLAN_AUDIO_LIBRARY_ACCESS: Record<SubscriptionPlan, AudioLibraryAccess> = {
  free: "sample",
  starter: "basic",
  familie: "full",
  premium: "full",
};
export const AUDIO_BASIC_LIBRARY_MIN_AGE_DAYS = 30;

// Free accounts may chat with Tavi, but Tavi may not create content for them.
export const PLAN_TAVI_CAN_CREATE: Record<SubscriptionPlan, boolean> = {
  free: false,
  starter: true,
  familie: true,
  premium: true,
};

// Child profiles that may spend coins. Extra profiles after a downgrade stay
// visible but locked.
export const BASE_PROFILE_LIMITS: Record<SubscriptionPlan, number> = {
  free: 1,
  starter: 1,
  familie: 3,
  premium: 10,
};

// Stories, dokus and audio dokus a child profile may keep saved for offline use.
// 0 = offline saving is not part of the plan.
export const PLAN_OFFLINE_LIMITS: Record<SubscriptionPlan, number> = {
  free: 0,
  starter: 10,
  familie: 50,
  premium: 100,
};

// Saved items stay playable without internet only this long after the last
// online check of the plan, so cancelling the plan also ends offline access.
export const OFFLINE_LICENSE_MAX_DAYS = 14;
