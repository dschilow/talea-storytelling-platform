import { APIError } from "encore.dev/api";
import { storyDB } from "./db";

const STORY_GENERATION_LOCK_KEY = 810_001;
const DEFAULT_MAX_GLOBAL = 8;
const DEFAULT_MAX_PER_USER = 2;
const DEFAULT_STALE_MINUTES = 90;

function readBoundedInt(
  envName: string,
  defaultValue: number,
  minValue: number,
  maxValue: number
): number {
  const raw = process.env[envName];
  if (!raw) return defaultValue;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return defaultValue;

  return Math.min(maxValue, Math.max(minValue, parsed));
}

function buildCapacityMessage(active: number, limit: number, scope: "global" | "user"): string {
  if (scope === "user") {
    return `Story generation is already running for this account (${active}/${limit}). Please wait for an existing job to finish.`;
  }

  return `Story generation is currently at capacity (${active}/${limit}). Please retry in a moment.`;
}

export async function reserveStoryGenerationCapacity(input: {
  userId: string;
  createReservation: (tx: Awaited<ReturnType<typeof storyDB.begin>>) => Promise<void>;
}): Promise<void> {
  const maxGlobal = readBoundedInt(
    "TALEA_MAX_CONCURRENT_STORY_GENERATIONS",
    DEFAULT_MAX_GLOBAL,
    1,
    500
  );
  const maxPerUser = readBoundedInt(
    "TALEA_MAX_CONCURRENT_STORIES_PER_USER",
    DEFAULT_MAX_PER_USER,
    1,
    25
  );
  const staleMinutes = readBoundedInt(
    "TALEA_STORY_GENERATION_STALE_MINUTES",
    DEFAULT_STALE_MINUTES,
    5,
    24 * 60
  );
  const staleBefore = new Date(Date.now() - staleMinutes * 60_000);

  await using tx = await storyDB.begin();

  await tx.rawQueryRow<{ locked: boolean }>(
    "SELECT pg_advisory_xact_lock($1) IS NOT NULL AS locked",
    STORY_GENERATION_LOCK_KEY
  );

  await tx.rawExec(
    `UPDATE stories
     SET status = 'error',
         updated_at = CURRENT_TIMESTAMP
     WHERE status = 'generating'
       AND updated_at < $1`,
    staleBefore
  );

  const activeGlobal = await tx.rawQueryRow<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM stories
     WHERE status = 'generating'`
  );
  if ((activeGlobal?.count ?? 0) >= maxGlobal) {
    throw APIError.resourceExhausted(
      buildCapacityMessage(activeGlobal?.count ?? 0, maxGlobal, "global")
    );
  }

  const activeForUser = await tx.rawQueryRow<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM stories
     WHERE status = 'generating'
       AND user_id = $1`,
    input.userId
  );
  if ((activeForUser?.count ?? 0) >= maxPerUser) {
    throw APIError.resourceExhausted(
      buildCapacityMessage(activeForUser?.count ?? 0, maxPerUser, "user")
    );
  }

  await input.createReservation(tx);
  await tx.commit();
}
