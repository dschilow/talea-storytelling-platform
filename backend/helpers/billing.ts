import { APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { createClerkClient } from "@clerk/backend";
import { userDB } from "../user/db";

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

const clerkSecretKey = secret("ClerkSecretKey");
let cachedClerkClient: ReturnType<typeof createClerkClient> | null | undefined;

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

function getClerkClient(): ReturnType<typeof createClerkClient> | null {
  if (cachedClerkClient !== undefined) {
    return cachedClerkClient;
  }

  try {
    const key = clerkSecretKey();
    if (!key || key.trim().length === 0) {
      cachedClerkClient = null;
      return null;
    }
    cachedClerkClient = createClerkClient({ secretKey: key });
    return cachedClerkClient;
  } catch {
    cachedClerkClient = null;
    return null;
  }
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

  const client = getClerkClient();
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

  const client = getClerkClient();
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
  // Clerk profile metadata is treated as source of truth when present.
  if (profilePlan) {
    return profilePlan;
  }

  return tokenPlan;
}

export function extractPlanClaimsFromToken(token?: string | null): string[] {
  if (!token) return [];

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return [];

    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
    const planClaim = payload?.pla ?? payload?.plans ?? payload?.plan;
    return parsePlanClaim(planClaim);
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

export type UsageClaim = {
  plan: SubscriptionPlan;
  kind: UsageKind;
  limit: number | null;
  used: number;
  remaining: number | null;
  periodStart: Date;
};

export async function claimGenerationUsage(params: {
  userId: string;
  kind: UsageKind;
  clerkToken?: string | null;
}): Promise<UsageClaim> {
  const now = new Date();
  const periodStart = startOfMonthUTC(now);
  const context = await resolveUserPlanContext(params.userId, params.clerkToken);
  const policy = computePlanPolicy(context.plan, context.createdAt, now, context.isAdmin);
  const limit = getLimitFromPolicy(policy, params.kind);

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

  try {
    await userDB.exec`
      INSERT INTO generation_usage (user_id, period_start, story_count, doku_count, audio_count, updated_at)
      VALUES (${params.userId}, ${periodStart}, 0, 0, 0, ${now})
      ON CONFLICT (user_id, period_start) DO NOTHING
    `;
  } catch (error) {
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
      throw APIError.internal("Konnte Verbrauch nicht aktualisieren.");
    }

    return {
      plan: context.plan,
      kind: params.kind,
      limit,
      used: usedFromRowByKind(row, params.kind),
      remaining: null,
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
      throw APIError.permissionDenied(
        `Abo-Limit erreicht: ${limit} Story-Generierungen pro Monat. Bitte Abo upgraden.`
      );
    }

    return {
      plan: context.plan,
      kind: params.kind,
      limit,
      used: row.story_count,
      remaining: Math.max(0, limit - row.story_count),
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
      throw APIError.permissionDenied(
        `Abo-Limit erreicht: ${limit} Doku-Generierungen pro Monat. Bitte Abo upgraden.`
      );
    }

    return {
      plan: context.plan,
      kind: params.kind,
      limit,
      used: row.doku_count,
      remaining: Math.max(0, limit - row.doku_count),
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
    throw APIError.permissionDenied(
      `Abo-Limit erreicht: ${limit} Audio-Dokus pro Monat. Bitte Abo upgraden.`
    );
  }

  return {
    plan: context.plan,
    kind: params.kind,
    limit,
    used: row.audio_count,
    remaining: Math.max(0, limit - row.audio_count),
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
