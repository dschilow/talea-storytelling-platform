import { APIError } from "encore.dev/api";
import type { SQLDatabase } from "encore.dev/storage/sqldb";

type GenerationResource = "story" | "doku";

type ResourceConfig = {
  tableName: "stories" | "dokus";
  label: string;
  advisoryLockKey: number;
  maxGlobalEnv: string;
  maxPerUserEnv: string;
  staleMinutesEnv: string;
  defaultMaxGlobal: number;
  defaultMaxPerUser: number;
  defaultStaleMinutes: number;
};

const RESOURCE_CONFIGS: Record<GenerationResource, ResourceConfig> = {
  story: {
    tableName: "stories",
    label: "Story generation",
    advisoryLockKey: 810_001,
    maxGlobalEnv: "TALEA_MAX_CONCURRENT_STORY_GENERATIONS",
    maxPerUserEnv: "TALEA_MAX_CONCURRENT_STORIES_PER_USER",
    staleMinutesEnv: "TALEA_STORY_GENERATION_STALE_MINUTES",
    defaultMaxGlobal: 8,
    defaultMaxPerUser: 2,
    defaultStaleMinutes: 90,
  },
  doku: {
    tableName: "dokus",
    label: "Doku generation",
    advisoryLockKey: 810_002,
    maxGlobalEnv: "TALEA_MAX_CONCURRENT_DOKU_GENERATIONS",
    maxPerUserEnv: "TALEA_MAX_CONCURRENT_DOKUS_PER_USER",
    staleMinutesEnv: "TALEA_DOKU_GENERATION_STALE_MINUTES",
    defaultMaxGlobal: 10,
    defaultMaxPerUser: 2,
    defaultStaleMinutes: 45,
  },
};

type ReserveGenerationCapacityInput<T> = {
  db: SQLDatabase;
  resource: GenerationResource;
  userId: string;
  createReservation: (tx: Awaited<ReturnType<SQLDatabase["begin"]>>) => Promise<T>;
};

function readBoundedInt(
  envName: string,
  defaultValue: number,
  minValue: number,
  maxValue: number
): number {
  const raw = process.env[envName];
  if (!raw) {
    return defaultValue;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.min(maxValue, Math.max(minValue, parsed));
}

function buildExhaustedMessage(input: {
  label: string;
  active: number;
  limit: number;
  scope: "global" | "user";
}): string {
  if (input.scope === "user") {
    return `${input.label} is already running for this account (${input.active}/${input.limit}). Please wait for an existing job to finish.`;
  }

  return `${input.label} is currently at capacity (${input.active}/${input.limit}). Please retry in a moment.`;
}

async function acquireCapacityLock(
  tx: Awaited<ReturnType<SQLDatabase["begin"]>>,
  lockKey: number
): Promise<void> {
  await tx.rawQueryRow<{ locked: boolean }>(
    "SELECT pg_advisory_xact_lock($1) IS NOT NULL AS locked",
    lockKey
  );
}

async function expireStaleGeneratingRows(
  tx: Awaited<ReturnType<SQLDatabase["begin"]>>,
  tableName: "stories" | "dokus",
  staleBefore: Date
): Promise<void> {
  await tx.rawExec(
    `UPDATE ${tableName}
     SET status = 'error',
         updated_at = CURRENT_TIMESTAMP
     WHERE status = 'generating'
       AND updated_at < $1`,
    staleBefore
  );
}

async function countActiveGeneratingRows(
  tx: Awaited<ReturnType<SQLDatabase["begin"]>>,
  tableName: "stories" | "dokus",
  userId?: string
): Promise<number> {
  if (userId) {
    const row = await tx.rawQueryRow<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM ${tableName}
       WHERE status = 'generating'
         AND user_id = $1`,
      userId
    );
    return row?.count ?? 0;
  }

  const row = await tx.rawQueryRow<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM ${tableName}
     WHERE status = 'generating'`
  );
  return row?.count ?? 0;
}

export async function reserveGenerationCapacity<T>(
  input: ReserveGenerationCapacityInput<T>
): Promise<T> {
  const resourceConfig = RESOURCE_CONFIGS[input.resource];
  const maxGlobal = readBoundedInt(
    resourceConfig.maxGlobalEnv,
    resourceConfig.defaultMaxGlobal,
    1,
    500
  );
  const maxPerUser = readBoundedInt(
    resourceConfig.maxPerUserEnv,
    resourceConfig.defaultMaxPerUser,
    1,
    25
  );
  const staleMinutes = readBoundedInt(
    resourceConfig.staleMinutesEnv,
    resourceConfig.defaultStaleMinutes,
    5,
    24 * 60
  );
  const staleBefore = new Date(Date.now() - staleMinutes * 60_000);

  await using tx = await input.db.begin();

  await acquireCapacityLock(tx, resourceConfig.advisoryLockKey);
  await expireStaleGeneratingRows(tx, resourceConfig.tableName, staleBefore);

  const activeGlobal = await countActiveGeneratingRows(tx, resourceConfig.tableName);
  if (activeGlobal >= maxGlobal) {
    throw APIError.resourceExhausted(
      buildExhaustedMessage({
        label: resourceConfig.label,
        active: activeGlobal,
        limit: maxGlobal,
        scope: "global",
      })
    );
  }

  const activeForUser = await countActiveGeneratingRows(
    tx,
    resourceConfig.tableName,
    input.userId
  );
  if (activeForUser >= maxPerUser) {
    throw APIError.resourceExhausted(
      buildExhaustedMessage({
        label: resourceConfig.label,
        active: activeForUser,
        limit: maxPerUser,
        scope: "user",
      })
    );
  }

  const result = await input.createReservation(tx);
  await tx.commit();
  return result;
}
