import { APIError } from "encore.dev/api";
import { userDB } from "../user/db";

export type SubscriptionPlan = "starter" | "familie" | "premium";
export type UsageKind = "story" | "doku";

export type PlanQuota = {
  stories: number;
  dokus: number;
};

export const PLAN_QUOTAS: Record<SubscriptionPlan, PlanQuota> = {
  starter: { stories: 5, dokus: 3 },
  familie: { stories: 20, dokus: 10 },
  premium: { stories: 60, dokus: 30 },
};

const PLAN_PRIORITY: SubscriptionPlan[] = ["premium", "familie", "starter"];
const PLAN_ALIASES: Record<SubscriptionPlan, string[]> = {
  starter: ["starter"],
  familie: ["familie", "family"],
  premium: ["premium"],
};

const DEFAULT_PLAN: SubscriptionPlan = "starter";

function startOfMonthUTC(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function parsePlanClaim(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function extractPlanFromClerkToken(token?: string | null): SubscriptionPlan | null {
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
    const planClaim = payload?.pla ?? payload?.plans ?? payload?.plan;
    const entries = parsePlanClaim(planClaim);
    if (entries.length === 0) return null;

    const normalized = entries
      .map((entry) => entry.split(":").pop() || "")
      .map((entry) => entry.toLowerCase());

    for (const plan of PLAN_PRIORITY) {
      const aliases = PLAN_ALIASES[plan];
      if (aliases.some((alias) => normalized.includes(alias))) {
        return plan;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export async function resolvePlanForUser(userId: string, clerkToken?: string | null): Promise<SubscriptionPlan> {
  const tokenPlan = extractPlanFromClerkToken(clerkToken);
  if (tokenPlan) {
    const now = new Date();
    await userDB.exec`
      UPDATE users
      SET subscription = ${tokenPlan}, updated_at = ${now}
      WHERE id = ${userId} AND subscription <> ${tokenPlan}
    `;
    return tokenPlan;
  }

  const row = await userDB.queryRow<{ subscription: SubscriptionPlan }>`
    SELECT subscription FROM users WHERE id = ${userId}
  `;

  return row?.subscription ?? DEFAULT_PLAN;
}

export type UsageClaim = {
  plan: SubscriptionPlan;
  limit: number;
  used: number;
  remaining: number;
  periodStart: Date;
};

export async function claimGenerationUsage(params: {
  userId: string;
  kind: UsageKind;
  clerkToken?: string | null;
}): Promise<UsageClaim> {
  const plan = await resolvePlanForUser(params.userId, params.clerkToken);
  const limit = params.kind === "story" ? PLAN_QUOTAS[plan].stories : PLAN_QUOTAS[plan].dokus;

  if (limit <= 0) {
    throw APIError.permissionDenied("Abo-Limit erreicht: 0 Generierungen pro Monat.");
  }

  const now = new Date();
  const periodStart = startOfMonthUTC(now);

  await userDB.exec`
    INSERT INTO generation_usage (user_id, period_start, story_count, doku_count, updated_at)
    VALUES (${params.userId}, ${periodStart}, 0, 0, ${now})
    ON CONFLICT (user_id, period_start) DO NOTHING
  `;

  if (params.kind === "story") {
    const row = await userDB.queryRow<{ story_count: number; doku_count: number }>`
      UPDATE generation_usage
      SET story_count = story_count + 1, updated_at = ${now}
      WHERE user_id = ${params.userId}
        AND period_start = ${periodStart}
        AND story_count < ${limit}
      RETURNING story_count, doku_count
    `;

    if (!row) {
      throw APIError.permissionDenied(
        `Abo-Limit erreicht: ${limit} Story-Generierungen pro Monat. Bitte Abo upgraden.`
      );
    }

    return {
      plan,
      limit,
      used: row.story_count,
      remaining: Math.max(0, limit - row.story_count),
      periodStart,
    };
  }

  const row = await userDB.queryRow<{ story_count: number; doku_count: number }>`
    UPDATE generation_usage
    SET doku_count = doku_count + 1, updated_at = ${now}
    WHERE user_id = ${params.userId}
      AND period_start = ${periodStart}
      AND doku_count < ${limit}
    RETURNING story_count, doku_count
  `;

  if (!row) {
    throw APIError.permissionDenied(
      `Abo-Limit erreicht: ${limit} Doku-Generierungen pro Monat. Bitte Abo upgraden.`
    );
  }

  return {
    plan,
    limit,
    used: row.doku_count,
    remaining: Math.max(0, limit - row.doku_count),
    periodStart,
  };
}
