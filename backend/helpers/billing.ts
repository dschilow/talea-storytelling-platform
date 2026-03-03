import { APIError } from "encore.dev/api";
import { createClerkClient } from "@clerk/backend";
import { userDB } from "../user/db";
import {
  getProfileBudgetPolicy,
  releaseFamilyReserveUnit,
  resolveRequestedProfileId,
  tryConsumeFamilyReserve,
} from "./profiles";

export type SubscriptionPlan = "free" | "starter" | "familie" | "premium";
export type UsageKind = "story" | "doku" | "audio";
type UserRole = "admin" | "user";

export type PlanQuota = {
  stories: number | null;
  dokus: number | null;
  audio: number | null;
};

export const PLAN_QUOTAS: Record<SubscriptionPlan, PlanQuota> = {
  free: { stories: 3, dokus: 3, audio: 1 },
  starter: { stories: 10, dokus: 10, audio: 2 },
  familie: { stories: 25, dokus: 25, audio: 10 },
  premium: { stories: 50, dokus: 50, audio: null },
};

const PLAN_PRIORITY: SubscriptionPlan[] = ["premium", "familie", "starter", "free"];
const PLAN_ALIASES: Record<SubscriptionPlan, string[]> = {
  free: ["free", "kostenlos"],
  starter: ["starter"],
  familie: ["familie", "family"],
  premium: ["premium"],
};

const DEFAULT_PLAN: SubscriptionPlan = "free";
const FREE_TRIAL_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PLAN_SYNC_CACHE_TTL_MS = 30_000;

let cachedClerkClient: ReturnType<typeof createClerkClient> | null | undefined;
let cachedClerkClientPromise: Promise<ReturnType<typeof createClerkClient> | null> | null = null;

type CachedPlanResolution = {
  plan: SubscriptionPlan | null;
  expiresAt: number;
};

type CachedRoleResolution = {
  role: UserRole | null;
  expiresAt: number;
};

const clerkPlanCache = new Map<string, CachedPlanResolution>();
const clerkRoleCache = new Map<string, CachedRoleResolution>();

export type BillingCancellationResult = {
  attempted: boolean;
  scheduled: boolean;
  activeItems: number;
  canceledItems: number;
  source: "sdk" | "rest" | "none";
  note?: string;
};

function startOfMonthUTC(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function addDaysUTC(date: Date, days: number) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function remainingDaysUntil(now: Date, end: Date): number {
  if (now >= end) return 0;
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / MS_PER_DAY));
}

async function loadClerkSecretKey(): Promise<string | null> {
  try {
    const config = await import("encore.dev/config");
    const value = (
      config.secret as (key: string, options?: { optional?: boolean }) => () => string | undefined
    )("ClerkSecretKey", { optional: true })();

    if (value && value.trim().length > 0) {
      return value.trim();
    }
  } catch {
    // Ignore and fall back to env.
  }

  const fromEnv = process.env.ClerkSecretKey?.trim() || process.env.CLERK_SECRET_KEY?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : null;
}

async function getClerkClient(): Promise<ReturnType<typeof createClerkClient> | null> {
  if (cachedClerkClient !== undefined) {
    return cachedClerkClient;
  }

  if (cachedClerkClientPromise) {
    return cachedClerkClientPromise;
  }

  cachedClerkClientPromise = (async () => {
    try {
      const key = await loadClerkSecretKey();
      if (!key) {
        cachedClerkClient = null;
        return null;
      }

      cachedClerkClient = createClerkClient({ secretKey: key });
      return cachedClerkClient;
    } catch {
      cachedClerkClient = null;
      return null;
    }
  })();

  const client = await cachedClerkClientPromise;
  cachedClerkClientPromise = null;
  return client;
}

function extractSubscriptionItems(raw: unknown): Array<{ id: string; status: string | null }> {
  if (!raw || typeof raw !== "object") {
    return [];
  }

  const payload = raw as Record<string, unknown>;
  const candidates: unknown[] = [
    payload.subscriptionItems,
    payload.subscription_items,
    payload.items,
    payload.data,
    (payload.data as Record<string, unknown> | undefined)?.subscriptionItems,
    (payload.data as Record<string, unknown> | undefined)?.subscription_items,
    (payload.data as Record<string, unknown> | undefined)?.items,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    const items = candidate
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const row = entry as Record<string, unknown>;
        const id = typeof row.id === "string" ? row.id : "";
        if (!id) return null;
        const status = typeof row.status === "string" ? row.status : null;
        return { id, status };
      })
      .filter((entry): entry is { id: string; status: string | null } => entry !== null);

    if (items.length > 0) {
      return items;
    }
  }

  return [];
}

function isFinalSubscriptionStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const normalized = status.trim().toLowerCase();
  return normalized === "canceled" ||
    normalized === "cancelled" ||
    normalized === "expired" ||
    normalized === "terminated";
}

async function fetchBillingSubscriptionViaRest(userId: string, secretKey: string): Promise<unknown | null> {
  const endpoints = [
    `https://api.clerk.com/v1/users/${encodeURIComponent(userId)}/billing/subscription`,
    `https://api.clerk.com/v1/users/${encodeURIComponent(userId)}/commerce/subscription`,
  ];

  let lastError: string | null = null;

  for (const endpoint of endpoints) {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      lastError = `${response.status} ${response.statusText}`;
      continue;
    }

    return response.json();
  }

  throw new Error(`Could not fetch Clerk subscription (${lastError ?? "unknown error"})`);
}

async function cancelSubscriptionItemViaRest(itemId: string, secretKey: string): Promise<boolean> {
  const endpoints = [
    `https://api.clerk.com/v1/billing/subscription_items/${encodeURIComponent(itemId)}`,
    `https://api.clerk.com/v1/commerce/subscription_items/${encodeURIComponent(itemId)}`,
  ];

  let lastError: string | null = null;

  for (const endpoint of endpoints) {
    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok || response.status === 404 || response.status === 409) {
      return true;
    }

    lastError = `${response.status} ${response.statusText}`;
  }

  throw new Error(`Could not cancel subscription item ${itemId} (${lastError ?? "unknown error"})`);
}

export async function cancelUserBillingAtPeriodEnd(userId: string): Promise<BillingCancellationResult> {
  const client = await getClerkClient();
  const sdkBilling = (client as any)?.billing;

  if (sdkBilling?.getUserBillingSubscription && sdkBilling?.cancelSubscriptionItem) {
    const subscription = await sdkBilling.getUserBillingSubscription(userId);
    const items = extractSubscriptionItems(subscription);
    const activeItems = items.filter((item) => !isFinalSubscriptionStatus(item.status));

    let canceledItems = 0;
    for (const item of activeItems) {
      await sdkBilling.cancelSubscriptionItem(item.id, { endNow: false });
      canceledItems += 1;
    }

    return {
      attempted: activeItems.length > 0,
      scheduled: canceledItems === activeItems.length,
      activeItems: activeItems.length,
      canceledItems,
      source: "sdk",
      note: activeItems.length === 0 ? "no_active_subscription_items" : undefined,
    };
  }

  const secretKey = await loadClerkSecretKey();
  if (!secretKey) {
    return {
      attempted: false,
      scheduled: false,
      activeItems: 0,
      canceledItems: 0,
      source: "none",
      note: "missing_clerk_secret",
    };
  }

  const subscription = await fetchBillingSubscriptionViaRest(userId, secretKey);
  if (!subscription) {
    return {
      attempted: false,
      scheduled: true,
      activeItems: 0,
      canceledItems: 0,
      source: "rest",
      note: "no_billing_subscription",
    };
  }

  const items = extractSubscriptionItems(subscription);
  const activeItems = items.filter((item) => !isFinalSubscriptionStatus(item.status));
  if (activeItems.length === 0) {
    return {
      attempted: false,
      scheduled: true,
      activeItems: 0,
      canceledItems: 0,
      source: "rest",
      note: "no_active_subscription_items",
    };
  }

  let canceledItems = 0;
  for (const item of activeItems) {
    await cancelSubscriptionItemViaRest(item.id, secretKey);
    canceledItems += 1;
  }

  return {
    attempted: true,
    scheduled: canceledItems === activeItems.length,
    activeItems: activeItems.length,
    canceledItems,
    source: "rest",
  };
}

function parsePlanClaim(raw: unknown): string[] {
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (Array.isArray(raw)) {
    return raw
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);
  }

  return collectStringValues(raw).map((entry) => entry.trim()).filter(Boolean);
}

function uniquePreserveOrder(entries: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of entries) {
    const normalized = entry.trim();
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function normalizePlanCandidate(raw: string): SubscriptionPlan | null {
  const lowered = raw.toLowerCase().trim();
  const normalized = lowered
    .replace(/[\s_-]+/g, "")
    .split(":")
    .pop() ?? "";

  for (const plan of PLAN_PRIORITY) {
    const aliases = PLAN_ALIASES[plan].map((alias) => alias.replace(/[\s_-]+/g, ""));
    if (aliases.includes(normalized) || aliases.some((alias) => lowered === alias)) {
      return plan;
    }

    for (const aliasRaw of PLAN_ALIASES[plan]) {
      const alias = aliasRaw.toLowerCase();
      const tokenRegex = new RegExp(`(^|[^a-z])${alias}([^a-z]|$)`, "i");
      if (tokenRegex.test(lowered)) {
        return plan;
      }
    }
  }

  return null;
}

function extractPlanFromEntries(entries: string[]): SubscriptionPlan | null {
  let bestPlan: SubscriptionPlan | null = null;

  for (const entry of entries) {
    const plan = normalizePlanCandidate(entry);
    if (!plan) {
      continue;
    }

    if (!bestPlan) {
      bestPlan = plan;
      continue;
    }

    const currentRank = PLAN_PRIORITY.indexOf(plan);
    const bestRank = PLAN_PRIORITY.indexOf(bestPlan);
    if (currentRank >= 0 && bestRank >= 0 && currentRank < bestRank) {
      bestPlan = plan;
    }
  }

  return bestPlan;
}

function collectStringValues(value: unknown, depth = 0): string[] {
  if (depth > 5 || value == null) {
    return [];
  }

  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectStringValues(entry, depth + 1));
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((entry) =>
      collectStringValues(entry, depth + 1)
    );
  }

  return [];
}

function normalizeRoleCandidate(raw: string): UserRole | null {
  const lowered = raw.toLowerCase().trim();
  const normalized = lowered.replace(/[\s_-]+/g, "").split(":").pop() ?? "";

  if (normalized === "admin" || normalized === "administrator") {
    return "admin";
  }

  if (normalized === "user" || normalized === "member") {
    return "user";
  }

  if (/(^|[^a-z])(admin|administrator)([^a-z]|$)/i.test(lowered)) {
    return "admin";
  }

  if (/(^|[^a-z])(user|member)([^a-z]|$)/i.test(lowered)) {
    return "user";
  }

  return null;
}

function extractRoleFromEntries(entries: string[]): UserRole | null {
  let bestRole: UserRole | null = null;

  for (const entry of entries) {
    const role = normalizeRoleCandidate(entry);
    if (!role) {
      continue;
    }

    if (role === "admin") {
      return "admin";
    }

    if (!bestRole) {
      bestRole = role;
    }
  }

  return bestRole;
}

function extractRoleFromMetadataValue(raw: unknown): UserRole | null {
  const strings = collectStringValues(raw);
  return extractRoleFromEntries(strings);
}

function extractRoleFromMetadataObject(metadata: unknown): UserRole | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  const preferredKeys = [
    "role",
    "roles",
    "app_role",
    "appRole",
    "user_role",
    "userRole",
    "talea_role",
    "taleaRole",
  ];

  for (const key of preferredKeys) {
    if (key in record) {
      const role = extractRoleFromMetadataValue(record[key]);
      if (role) {
        return role;
      }
    }
  }

  return null;
}

async function extractRoleFromClerkProfile(userId: string): Promise<UserRole | null> {
  const now = Date.now();
  const cached = clerkRoleCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.role;
  }

  const client = await getClerkClient();
  if (!client) {
    clerkRoleCache.set(userId, {
      role: null,
      expiresAt: now + PLAN_SYNC_CACHE_TTL_MS,
    });
    return null;
  }

  try {
    const user = await client.users.getUser(userId);
    const fromPrivate = extractRoleFromMetadataObject(user.privateMetadata);
    const fromPublic = extractRoleFromMetadataObject(user.publicMetadata);
    const resolved = fromPrivate ?? fromPublic ?? null;

    clerkRoleCache.set(userId, {
      role: resolved,
      expiresAt: now + PLAN_SYNC_CACHE_TTL_MS,
    });

    return resolved;
  } catch (error) {
    console.warn("[billing.extractRoleFromClerkProfile] Failed to fetch Clerk profile role", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });

    clerkRoleCache.set(userId, {
      role: null,
      expiresAt: now + PLAN_SYNC_CACHE_TTL_MS,
    });

    return null;
  }
}

function extractPlanFromMetadataValue(raw: unknown): SubscriptionPlan | null {
  const strings = collectStringValues(raw);
  return extractPlanFromEntries(strings);
}

function extractPlanFromMetadataObject(metadata: unknown): SubscriptionPlan | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  const preferredKeys = [
    "subscription",
    "subscription_plan",
    "subscriptionPlan",
    "plan",
    "plan_name",
    "planName",
    "tier",
    "package_name",
    "packageName",
    "billing_plan",
    "billingPlan",
    "product_plan",
    "productPlan",
    "package",
    "price_id",
    "priceId",
  ];

  for (const key of preferredKeys) {
    if (key in record) {
      const plan = extractPlanFromMetadataValue(record[key]);
      if (plan) {
        return plan;
      }
    }
  }

  return extractPlanFromMetadataValue(record);
}

async function extractPlanFromClerkProfile(userId: string): Promise<SubscriptionPlan | null> {
  const now = Date.now();
  const cached = clerkPlanCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.plan;
  }

  const client = await getClerkClient();
  if (!client) {
    clerkPlanCache.set(userId, {
      plan: null,
      expiresAt: now + PLAN_SYNC_CACHE_TTL_MS,
    });
    return null;
  }

  try {
    const user = await client.users.getUser(userId);
    const fromPublic = extractPlanFromMetadataObject(user.publicMetadata);
    const fromPrivate = extractPlanFromMetadataObject(user.privateMetadata);
    const fromUnsafe = extractPlanFromMetadataObject(user.unsafeMetadata);
    const resolved = fromPublic ?? fromPrivate ?? fromUnsafe ?? null;

    clerkPlanCache.set(userId, {
      plan: resolved,
      expiresAt: now + PLAN_SYNC_CACHE_TTL_MS,
    });

    return resolved;
  } catch (error) {
    console.warn("[billing.extractPlanFromClerkProfile] Failed to fetch Clerk profile plan", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });

    clerkPlanCache.set(userId, {
      plan: null,
      expiresAt: now + PLAN_SYNC_CACHE_TTL_MS,
    });

    return null;
  }
}

async function persistPlanIfChanged(userId: string, plan: SubscriptionPlan): Promise<void> {
  const now = new Date();
  await userDB.exec`
    UPDATE users
    SET subscription = ${plan}, updated_at = ${now}
    WHERE id = ${userId} AND subscription <> ${plan}
  `;
}

async function persistRoleIfChanged(userId: string, role: UserRole): Promise<void> {
  const now = new Date();
  try {
    await userDB.exec`
      UPDATE users
      SET role = ${role}, updated_at = ${now}
      WHERE id = ${userId} AND COALESCE(role, 'user') <> ${role}
    `;
  } catch (error) {
    console.warn("[billing.persistRoleIfChanged] Failed to persist role", {
      userId,
      role,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function pickAuthoritativePlan(
  tokenPlan: SubscriptionPlan | null,
  profilePlan: SubscriptionPlan | null
): SubscriptionPlan | null {
  if (tokenPlan && profilePlan) {
    if (tokenPlan === profilePlan) {
      return profilePlan;
    }

    const tokenRank = PLAN_PRIORITY.indexOf(tokenPlan);
    const profileRank = PLAN_PRIORITY.indexOf(profilePlan);

    if (tokenRank >= 0 && profileRank >= 0) {
      // Prefer the higher-tier plan while sources are out-of-sync.
      return tokenRank < profileRank ? tokenPlan : profilePlan;
    }
  }

  return profilePlan ?? tokenPlan;
}

export function extractPlanClaimsFromToken(token?: string | null): string[] {
  if (!token) return [];

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return [];

    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));

    const directPlanClaims: unknown[] = [
      payload?.pla,
      payload?.plans,
      payload?.plan,
      payload?.subscription,
      payload?.subscription_plan,
      payload?.subscriptionPlan,
      payload?.plan_name,
      payload?.planName,
      payload?.tier,
      payload?.package_name,
      payload?.packageName,
      payload?.billing_plan,
      payload?.billingPlan,
      payload?.product_plan,
      payload?.productPlan,
      payload?.stripe_plan,
      payload?.stripePlan,
    ];

    const metadataCandidates: unknown[] = [
      payload?.metadata,
      payload?.public_metadata,
      payload?.publicMetadata,
      payload?.private_metadata,
      payload?.privateMetadata,
    ];

    const claimsFromDirect = directPlanClaims.flatMap((claim) => parsePlanClaim(claim));
    const claimsFromMetadata = metadataCandidates.flatMap((candidate) => {
      const fromKeys = parsePlanClaim(candidate);
      const fromStructuredPlan = (() => {
        const plan = extractPlanFromMetadataObject(candidate);
        return plan ? [plan] : [];
      })();
      return [...fromKeys, ...fromStructuredPlan];
    });

    return uniquePreserveOrder([...claimsFromDirect, ...claimsFromMetadata]);
  } catch {
    return [];
  }
}

export function extractPlanFromClerkToken(token?: string | null): SubscriptionPlan | null {
  const entries = extractPlanClaimsFromToken(token);
  if (entries.length === 0) return null;
  return extractPlanFromEntries(entries);
}

export async function resolvePlanForUser(userId: string, clerkToken?: string | null): Promise<SubscriptionPlan> {
  const tokenPlan = extractPlanFromClerkToken(clerkToken);
  const profilePlan = await extractPlanFromClerkProfile(userId);
  const authoritativePlan = pickAuthoritativePlan(tokenPlan, profilePlan);

  if (authoritativePlan) {
    if (tokenPlan && profilePlan && tokenPlan !== profilePlan) {
      console.warn("[billing.resolvePlanForUser] Token plan differs from Clerk profile plan. Using profile plan.", {
        userId,
        tokenPlan,
        profilePlan,
      });
    }

    await persistPlanIfChanged(userId, authoritativePlan);
    return authoritativePlan;
  }

  const row = await userDB.queryRow<{ subscription: SubscriptionPlan }>`
    SELECT subscription FROM users WHERE id = ${userId}
  `;

  return row?.subscription ?? DEFAULT_PLAN;
}

// Backward-compatible legacy parser retained for callers that import this symbol directly.
export function extractPlanFromLegacyStringClaim(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

type PlanPolicy = {
  plan: SubscriptionPlan;
  limits: PlanQuota;
  freeTrialActive: boolean;
  freeTrialEndsAt: Date | null;
  freeTrialDaysRemaining: number;
  canReadCommunityDokus: boolean;
  canUseAudioDokus: boolean;
};

type UsageCounts = {
  story_count: number;
  doku_count: number;
  audio_count: number;
};

type UserPlanContext = {
  plan: SubscriptionPlan;
  createdAt: Date;
  role: UserRole;
  isAdmin: boolean;
};

async function resolveRoleForUser(userId: string, dbRole: UserRole): Promise<UserRole> {
  if (dbRole === "admin") {
    return "admin";
  }

  const profileRole = await extractRoleFromClerkProfile(userId);
  if (profileRole !== "admin") {
    return dbRole;
  }

  await persistRoleIfChanged(userId, profileRole);
  return profileRole;
}

async function resolveUserPlanContext(userId: string, clerkToken?: string | null): Promise<UserPlanContext> {
  const plan = await resolvePlanForUser(userId, clerkToken);

  let row: { created_at: Date | null; role: UserRole | null } | null = null;
  let hasRoleColumn = true;
  try {
    row = await userDB.queryRow<{ created_at: Date | null; role: UserRole | null }>`
      SELECT created_at, COALESCE(role, 'user') as role FROM users WHERE id = ${userId}
    `;
  } catch {
    // Defensive fallback for environments that have not applied role migration yet.
    hasRoleColumn = false;
    const fallback = await userDB.queryRow<{ created_at: Date | null }>`
      SELECT created_at FROM users WHERE id = ${userId}
    `;
    row = fallback ? { created_at: fallback.created_at, role: "user" } : null;
  }

  if (!row) {
    throw APIError.notFound("User not found");
  }

  const dbRole: UserRole = row.role === "admin" ? "admin" : "user";
  const role: UserRole = hasRoleColumn ? await resolveRoleForUser(userId, dbRole) : dbRole;
  return {
    plan,
    createdAt: row.created_at ?? new Date(),
    role,
    isAdmin: role === "admin",
  };
}

function computePlanPolicy(plan: SubscriptionPlan, createdAt: Date, now: Date, isAdmin = false): PlanPolicy {
  if (isAdmin) {
    return {
      plan,
      limits: { stories: null, dokus: null, audio: null },
      freeTrialActive: false,
      freeTrialEndsAt: null,
      freeTrialDaysRemaining: 0,
      canReadCommunityDokus: true,
      canUseAudioDokus: true,
    };
  }

  if (plan !== "free") {
    return {
      plan,
      limits: PLAN_QUOTAS[plan],
      freeTrialActive: false,
      freeTrialEndsAt: null,
      freeTrialDaysRemaining: 0,
      canReadCommunityDokus: true,
      canUseAudioDokus: true,
    };
  }

  const freeTrialEndsAt = addDaysUTC(createdAt, FREE_TRIAL_DAYS);
  const freeTrialActive = now < freeTrialEndsAt;

  if (!freeTrialActive) {
    return {
      plan,
      limits: { stories: 0, dokus: 0, audio: 0 },
      freeTrialActive,
      freeTrialEndsAt,
      freeTrialDaysRemaining: 0,
      canReadCommunityDokus: false,
      canUseAudioDokus: false,
    };
  }

  return {
    plan,
    limits: PLAN_QUOTAS.free,
    freeTrialActive,
    freeTrialEndsAt,
    freeTrialDaysRemaining: remainingDaysUntil(now, freeTrialEndsAt),
    canReadCommunityDokus: true,
    canUseAudioDokus: true,
  };
}

async function readUsageCounts(userId: string, periodStart: Date): Promise<UsageCounts> {
  const row = await userDB.queryRow<UsageCounts>`
    SELECT story_count, doku_count, audio_count
    FROM generation_usage
    WHERE user_id = ${userId} AND period_start = ${periodStart}
  `;

  return {
    story_count: row?.story_count ?? 0,
    doku_count: row?.doku_count ?? 0,
    audio_count: row?.audio_count ?? 0,
  };
}

type UsageBucket = {
  limit: number | null;
  used: number;
  remaining: number | null;
  costPerGeneration: 1;
};

function buildUsageBucket(limit: number | null, used: number): UsageBucket {
  return {
    limit,
    used,
    remaining: limit === null ? null : Math.max(0, limit - used),
    costPerGeneration: 1,
  };
}

export type BillingOverview = {
  plan: SubscriptionPlan;
  periodStart: Date;
  storyCredits: UsageBucket;
  dokuCredits: UsageBucket;
  audioCredits: UsageBucket;
  permissions: {
    canReadCommunityDokus: boolean;
    canUseAudioDokus: boolean;
    freeTrialActive: boolean;
    freeTrialEndsAt: Date | null;
    freeTrialDaysRemaining: number;
  };
};

export async function getBillingOverview(params: {
  userId: string;
  clerkToken?: string | null;
}): Promise<BillingOverview> {
  const now = new Date();
  const periodStart = startOfMonthUTC(now);
  const context = await resolveUserPlanContext(params.userId, params.clerkToken);
  const policy = computePlanPolicy(context.plan, context.createdAt, now, context.isAdmin);
  let usage: UsageCounts = {
    story_count: 0,
    doku_count: 0,
    audio_count: 0,
  };

  try {
    usage = await readUsageCounts(params.userId, periodStart);
  } catch (error) {
    console.warn("[billing.getBillingOverview] Failed to read usage counters, falling back to zero usage.", {
      userId: params.userId,
      error,
    });
  }

  return {
    plan: context.plan,
    periodStart,
    storyCredits: buildUsageBucket(policy.limits.stories, usage.story_count),
    dokuCredits: buildUsageBucket(policy.limits.dokus, usage.doku_count),
    audioCredits: buildUsageBucket(policy.limits.audio, usage.audio_count),
    permissions: {
      canReadCommunityDokus: policy.canReadCommunityDokus,
      canUseAudioDokus: policy.canUseAudioDokus,
      freeTrialActive: policy.freeTrialActive,
      freeTrialEndsAt: policy.freeTrialEndsAt,
      freeTrialDaysRemaining: policy.freeTrialDaysRemaining,
    },
  };
}

function getLimitFromPolicy(policy: PlanPolicy, kind: UsageKind): number | null {
  if (kind === "story") return policy.limits.stories;
  if (kind === "doku") return policy.limits.dokus;
  return policy.limits.audio;
}

function usageFieldForKind(kind: UsageKind): "story_count" | "doku_count" | "audio_count" {
  if (kind === "story") return "story_count";
  if (kind === "doku") return "doku_count";
  return "audio_count";
}

function usedFromRowByKind(row: UsageCounts, kind: UsageKind): number {
  if (kind === "story") return row.story_count;
  if (kind === "doku") return row.doku_count;
  return row.audio_count;
}

function getLimitLabel(kind: UsageKind) {
  if (kind === "story") return "Story-Generierungen";
  if (kind === "doku") return "Doku-Generierungen";
  return "Audio-Dokus";
}

type ProfileBudgetSnapshot = {
  softCap: number | null;
  hardCap: number | null;
  allowFamilyReserve: boolean;
};

async function readProfileUsageForKind(params: {
  userId: string;
  profileId: string;
  periodStart: Date;
  kind: UsageKind;
}): Promise<number> {
  const row = await userDB.queryRow<{ used: number }>`
    SELECT COALESCE(SUM(units), 0)::int as used
    FROM quota_ledger
    WHERE user_id = ${params.userId}
      AND profile_id = ${params.profileId}
      AND period_start = ${params.periodStart}
      AND kind = ${params.kind}
  `;
  return row?.used ?? 0;
}

function budgetForKind(
  kind: UsageKind,
  budget: Awaited<ReturnType<typeof getProfileBudgetPolicy>> | null
): ProfileBudgetSnapshot {
  if (!budget) {
    return {
      softCap: null,
      hardCap: null,
      allowFamilyReserve: false,
    };
  }

  if (kind === "story") {
    return {
      softCap: budget.storySoftCap,
      hardCap: budget.storyHardCap,
      allowFamilyReserve: budget.allowFamilyReserve,
    };
  }

  if (kind === "doku") {
    return {
      softCap: budget.dokuSoftCap,
      hardCap: budget.dokuHardCap,
      allowFamilyReserve: budget.allowFamilyReserve,
    };
  }

  return {
    softCap: null,
    hardCap: null,
    allowFamilyReserve: false,
  };
}

async function insertQuotaLedger(params: {
  userId: string;
  profileId: string;
  periodStart: Date;
  kind: UsageKind;
  contentRef?: string | null;
}): Promise<void> {
  await userDB.exec`
    INSERT INTO quota_ledger (
      id,
      user_id,
      profile_id,
      period_start,
      kind,
      units,
      content_ref,
      created_at
    )
    VALUES (
      ${crypto.randomUUID()},
      ${params.userId},
      ${params.profileId},
      ${params.periodStart},
      ${params.kind},
      1,
      ${params.contentRef ?? null},
      CURRENT_TIMESTAMP
    )
  `;
}

export type UsageClaim = {
  plan: SubscriptionPlan;
  kind: UsageKind;
  limit: number | null;
  used: number;
  remaining: number | null;
  profileId: string;
  usedByProfile: number;
  softCapReached: boolean;
  usedFamilyReserve: boolean;
  periodStart: Date;
};

export async function claimGenerationUsage(params: {
  userId: string;
  kind: UsageKind;
  profileId?: string | null;
  contentRef?: string | null;
  clerkToken?: string | null;
}): Promise<UsageClaim> {
  const now = new Date();
  const periodStart = startOfMonthUTC(now);
  const context = await resolveUserPlanContext(params.userId, params.clerkToken);
  const policy = computePlanPolicy(context.plan, context.createdAt, now, context.isAdmin);
  const limit = getLimitFromPolicy(policy, params.kind);
  const profileId = await resolveRequestedProfileId({
    userId: params.userId,
    requestedProfileId: params.profileId,
  });
  const profileBudget = await getProfileBudgetPolicy({
    userId: params.userId,
    profileId,
  });
  const budgetSnapshot = budgetForKind(params.kind, profileBudget);
  const usedByProfileBefore = await readProfileUsageForKind({
    userId: params.userId,
    profileId,
    periodStart,
    kind: params.kind,
  });
  const softCapReached =
    budgetSnapshot.softCap !== null && usedByProfileBefore >= budgetSnapshot.softCap;
  const hardCapReached =
    budgetSnapshot.hardCap !== null && usedByProfileBefore >= budgetSnapshot.hardCap;
  const canUseReserve =
    hardCapReached &&
    budgetSnapshot.allowFamilyReserve &&
    (params.kind === "story" || params.kind === "doku");
  let usedFamilyReserve = false;

  if (params.kind === "audio" && !policy.canUseAudioDokus) {
    throw APIError.permissionDenied(
      "Abo-Limit erreicht: Audio-Dokus sind nur in der 7-Tage-Free-Testphase oder mit einem bezahlten Abo verfügbar."
    );
  }

  if (limit !== null && limit <= 0) {
    if (context.plan === "free" && !policy.freeTrialActive) {
      throw APIError.permissionDenied(
        "Abo-Limit erreicht: Deine Free-Testphase ist abgelaufen. Upgrade auf Starter, Familie oder Premium."
      );
    }
    throw APIError.permissionDenied(`Abo-Limit erreicht: 0 ${getLimitLabel(params.kind)} pro Monat.`);
  }

  if (hardCapReached && !canUseReserve) {
    throw APIError.permissionDenied(
      `Profil-Hard-Cap erreicht: ${budgetSnapshot.hardCap} ${getLimitLabel(params.kind)} fuer dieses Profil.`
    );
  }

  if (canUseReserve) {
    usedFamilyReserve = await tryConsumeFamilyReserve({
      userId: params.userId,
      kind: params.kind as "story" | "doku",
    });

    if (!usedFamilyReserve) {
      throw APIError.permissionDenied(
        `Profil-Hard-Cap erreicht und Family Reserve fuer ${getLimitLabel(params.kind)} ist aufgebraucht.`
      );
    }
  }

  try {
    await userDB.exec`
      INSERT INTO generation_usage (user_id, period_start, story_count, doku_count, audio_count, updated_at)
      VALUES (${params.userId}, ${periodStart}, 0, 0, 0, ${now})
      ON CONFLICT (user_id, period_start) DO NOTHING
    `;
  } catch (error) {
    if (usedFamilyReserve && (params.kind === "story" || params.kind === "doku")) {
      await releaseFamilyReserveUnit({
        userId: params.userId,
        kind: params.kind as "story" | "doku",
      });
    }
    throw APIError.failedPrecondition(
      "Billing-Datenbank nicht bereit. Bitte User-Migrationen ueber Script ausfuehren (6_add_generation_usage und 7_add_audio_usage)."
    );
  }

  if (limit === null) {
    const usageField = usageFieldForKind(params.kind);
    let row: UsageCounts | null = null;

    if (usageField === "story_count") {
      row = await userDB.queryRow<UsageCounts>`
        UPDATE generation_usage
        SET story_count = story_count + 1, updated_at = ${now}
        WHERE user_id = ${params.userId}
          AND period_start = ${periodStart}
        RETURNING story_count, doku_count, audio_count
      `;
    } else if (usageField === "doku_count") {
      row = await userDB.queryRow<UsageCounts>`
        UPDATE generation_usage
        SET doku_count = doku_count + 1, updated_at = ${now}
        WHERE user_id = ${params.userId}
          AND period_start = ${periodStart}
        RETURNING story_count, doku_count, audio_count
      `;
    } else {
      row = await userDB.queryRow<UsageCounts>`
        UPDATE generation_usage
        SET audio_count = audio_count + 1, updated_at = ${now}
        WHERE user_id = ${params.userId}
          AND period_start = ${periodStart}
        RETURNING story_count, doku_count, audio_count
      `;
    }

    if (!row) {
      if (usedFamilyReserve) {
        await releaseFamilyReserveUnit({
          userId: params.userId,
          kind: params.kind as "story" | "doku",
        });
      }
      throw APIError.internal("Konnte Verbrauch nicht aktualisieren.");
    }

    await insertQuotaLedger({
      userId: params.userId,
      profileId,
      periodStart,
      kind: params.kind,
      contentRef: params.contentRef,
    });

    return {
      plan: context.plan,
      kind: params.kind,
      limit,
      used: usedFromRowByKind(row, params.kind),
      remaining: null,
      profileId,
      usedByProfile: usedByProfileBefore + 1,
      softCapReached,
      usedFamilyReserve,
      periodStart,
    };
  }

  if (params.kind === "story") {
    const row = await userDB.queryRow<UsageCounts>`
      UPDATE generation_usage
      SET story_count = story_count + 1, updated_at = ${now}
      WHERE user_id = ${params.userId}
        AND period_start = ${periodStart}
        AND story_count < ${limit}
      RETURNING story_count, doku_count, audio_count
    `;

    if (!row) {
      if (usedFamilyReserve) {
        await releaseFamilyReserveUnit({
          userId: params.userId,
          kind: params.kind as "story" | "doku",
        });
      }
      throw APIError.permissionDenied(
        `Abo-Limit erreicht: ${limit} Story-Generierungen pro Monat. Bitte Abo upgraden.`
      );
    }

    await insertQuotaLedger({
      userId: params.userId,
      profileId,
      periodStart,
      kind: params.kind,
      contentRef: params.contentRef,
    });

    return {
      plan: context.plan,
      kind: params.kind,
      limit,
      used: row.story_count,
      remaining: Math.max(0, limit - row.story_count),
      profileId,
      usedByProfile: usedByProfileBefore + 1,
      softCapReached,
      usedFamilyReserve,
      periodStart,
    };
  }

  if (params.kind === "doku") {
    const row = await userDB.queryRow<UsageCounts>`
      UPDATE generation_usage
      SET doku_count = doku_count + 1, updated_at = ${now}
      WHERE user_id = ${params.userId}
        AND period_start = ${periodStart}
        AND doku_count < ${limit}
      RETURNING story_count, doku_count, audio_count
    `;

    if (!row) {
      if (usedFamilyReserve) {
        await releaseFamilyReserveUnit({
          userId: params.userId,
          kind: params.kind as "story" | "doku",
        });
      }
      throw APIError.permissionDenied(
        `Abo-Limit erreicht: ${limit} Doku-Generierungen pro Monat. Bitte Abo upgraden.`
      );
    }

    await insertQuotaLedger({
      userId: params.userId,
      profileId,
      periodStart,
      kind: params.kind,
      contentRef: params.contentRef,
    });

    return {
      plan: context.plan,
      kind: params.kind,
      limit,
      used: row.doku_count,
      remaining: Math.max(0, limit - row.doku_count),
      profileId,
      usedByProfile: usedByProfileBefore + 1,
      softCapReached,
      usedFamilyReserve,
      periodStart,
    };
  }

  const row = await userDB.queryRow<UsageCounts>`
    UPDATE generation_usage
    SET audio_count = audio_count + 1, updated_at = ${now}
    WHERE user_id = ${params.userId}
      AND period_start = ${periodStart}
      AND audio_count < ${limit}
    RETURNING story_count, doku_count, audio_count
  `;

  if (!row) {
    if (usedFamilyReserve) {
      await releaseFamilyReserveUnit({
        userId: params.userId,
        kind: params.kind as "story" | "doku",
      });
    }
    throw APIError.permissionDenied(
      `Abo-Limit erreicht: ${limit} Audio-Dokus pro Monat. Bitte Abo upgraden.`
    );
  }

  await insertQuotaLedger({
    userId: params.userId,
    profileId,
    periodStart,
    kind: params.kind,
    contentRef: params.contentRef,
  });

  return {
    plan: context.plan,
    kind: params.kind,
    limit,
    used: row.audio_count,
    remaining: Math.max(0, limit - row.audio_count),
    profileId,
    usedByProfile: usedByProfileBefore + 1,
    softCapReached,
    usedFamilyReserve,
    periodStart,
  };
}

export async function assertCommunityDokuAccess(params: {
  userId: string;
  clerkToken?: string | null;
}): Promise<BillingOverview> {
  const billing = await getBillingOverview(params);
  if (!billing.permissions.canReadCommunityDokus) {
    throw APIError.permissionDenied(
      "Community-Dokus sind nur in der 7-Tage-Free-Testphase oder mit Starter/Familie/Premium verfügbar."
    );
  }
  return billing;
}

export async function assertAudioDokuAccess(params: {
  userId: string;
  clerkToken?: string | null;
}): Promise<BillingOverview> {
  const billing = await getBillingOverview(params);
  if (!billing.permissions.canUseAudioDokus) {
    throw APIError.permissionDenied(
      "Audio-Dokus sind nur in der 7-Tage-Free-Testphase oder mit Starter/Familie/Premium verfügbar."
    );
  }
  return billing;
}
