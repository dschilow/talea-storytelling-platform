import { APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const userDB = SQLDatabase.named("user");

export type SubscriptionPlan = "free" | "starter" | "familie" | "premium";

export const BASE_PROFILE_LIMITS: Record<SubscriptionPlan, number> = {
  free: 1,
  starter: 1,
  familie: 3,
  premium: 5,
};

type ChildProfileRow = {
  id: string;
  user_id: string;
  name: string;
  avatar_color: string | null;
  age: number | null;
  reading_level: string | null;
  interests: string[] | null;
  no_go_topics: string[] | null;
  learning_goals: string[] | null;
  competency_state: unknown;
  preferred_avatar_ids: string[] | null;
  quiz_settings: unknown;
  is_default: boolean;
  is_archived: boolean;
  created_at: Date;
  updated_at: Date;
};

export interface ChildProfile {
  id: string;
  userId: string;
  name: string;
  avatarColor?: string;
  age?: number;
  readingLevel?: string;
  interests: string[];
  noGoTopics: string[];
  learningGoals: string[];
  competencyState: Record<string, unknown>;
  preferredAvatarIds: string[];
  quizSettings: Record<string, unknown>;
  isDefault: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileBudgetPolicy {
  storySoftCap: number | null;
  storyHardCap: number | null;
  dokuSoftCap: number | null;
  dokuHardCap: number | null;
  allowFamilyReserve: boolean;
}

export interface FamilyReserveState {
  story: number;
  doku: number;
  storyUsed: number;
  dokuUsed: number;
}

let schemaEnsured = false;

function parseObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return trimmed
        .slice(1, -1)
        .split(",")
        .map((entry) => entry.replace(/^"|"$/g, "").trim())
        .filter(Boolean);
    }
  }
  return [];
}

function mapProfile(row: ChildProfileRow): ChildProfile {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    avatarColor: row.avatar_color || undefined,
    age: row.age || undefined,
    readingLevel: row.reading_level || undefined,
    interests: parseStringArray(row.interests),
    noGoTopics: parseStringArray(row.no_go_topics),
    learningGoals: parseStringArray(row.learning_goals),
    competencyState: parseObject(row.competency_state),
    preferredAvatarIds: parseStringArray(row.preferred_avatar_ids),
    quizSettings: parseObject(row.quiz_settings),
    isDefault: row.is_default,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeProfileName(name: string | undefined): string {
  const value = (name || "").trim().replace(/\s+/g, " ");
  return value.length > 0 ? value : "Kind";
}

export function getProfileLimitForPlan(plan: SubscriptionPlan, extraAddons = 0): number {
  const base = BASE_PROFILE_LIMITS[plan] ?? 1;
  return Math.max(1, base + Math.max(0, extraAddons || 0));
}

export async function ensureProfileSchema(): Promise<void> {
  if (schemaEnsured) {
    return;
  }

  await userDB.exec`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS extra_profile_addons INTEGER NOT NULL DEFAULT 0
  `;

  await userDB.exec`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS family_reserve_story INTEGER NOT NULL DEFAULT 0
  `;

  await userDB.exec`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS family_reserve_doku INTEGER NOT NULL DEFAULT 0
  `;

  await userDB.exec`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS family_reserve_story_used INTEGER NOT NULL DEFAULT 0
  `;

  await userDB.exec`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS family_reserve_doku_used INTEGER NOT NULL DEFAULT 0
  `;

  await userDB.exec`
    CREATE TABLE IF NOT EXISTS child_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      avatar_color TEXT,
      age INTEGER,
      reading_level TEXT,
      interests TEXT[] NOT NULL DEFAULT '{}',
      no_go_topics TEXT[] NOT NULL DEFAULT '{}',
      learning_goals TEXT[] NOT NULL DEFAULT '{}',
      competency_state JSONB NOT NULL DEFAULT '{}'::jsonb,
      preferred_avatar_ids TEXT[] NOT NULL DEFAULT '{}',
      quiz_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      is_archived BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await userDB.exec`
    CREATE INDEX IF NOT EXISTS idx_child_profiles_user
    ON child_profiles(user_id)
  `;

  await userDB.exec`
    CREATE INDEX IF NOT EXISTS idx_child_profiles_archived
    ON child_profiles(user_id, is_archived)
  `;

  await userDB.exec`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_child_profiles_user_default
    ON child_profiles(user_id)
    WHERE is_default = TRUE
  `;

  await userDB.exec`
    CREATE TABLE IF NOT EXISTS profile_quota_policies (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      profile_id TEXT NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
      story_soft_cap INTEGER,
      story_hard_cap INTEGER,
      doku_soft_cap INTEGER,
      doku_hard_cap INTEGER,
      allow_family_reserve BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, profile_id)
    )
  `;

  await userDB.exec`
    CREATE TABLE IF NOT EXISTS quota_ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      profile_id TEXT REFERENCES child_profiles(id) ON DELETE SET NULL,
      period_start DATE NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('story', 'doku', 'audio')),
      units INTEGER NOT NULL DEFAULT 1 CHECK (units > 0),
      content_ref TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await userDB.exec`
    CREATE INDEX IF NOT EXISTS idx_quota_ledger_user_period_kind
    ON quota_ledger(user_id, period_start, kind)
  `;

  await userDB.exec`
    CREATE INDEX IF NOT EXISTS idx_quota_ledger_profile_period_kind
    ON quota_ledger(profile_id, period_start, kind)
  `;

  schemaEnsured = true;
}

export async function listProfilesForUser(userId: string): Promise<ChildProfile[]> {
  await ensureProfileSchema();
  const rows = await userDB.queryAll<ChildProfileRow>`
    SELECT
      id,
      user_id,
      name,
      avatar_color,
      age,
      reading_level,
      interests,
      no_go_topics,
      learning_goals,
      competency_state,
      preferred_avatar_ids,
      quiz_settings,
      is_default,
      is_archived,
      created_at,
      updated_at
    FROM child_profiles
    WHERE user_id = ${userId}
      AND is_archived = FALSE
    ORDER BY is_default DESC, created_at ASC
  `;
  return rows.map(mapProfile);
}

export async function ensureDefaultProfileForUser(
  userId: string,
  fallbackName?: string
): Promise<ChildProfile> {
  await ensureProfileSchema();

  const existing = await userDB.queryRow<ChildProfileRow>`
    SELECT
      id,
      user_id,
      name,
      avatar_color,
      age,
      reading_level,
      interests,
      no_go_topics,
      learning_goals,
      competency_state,
      preferred_avatar_ids,
      quiz_settings,
      is_default,
      is_archived,
      created_at,
      updated_at
    FROM child_profiles
    WHERE user_id = ${userId}
      AND is_default = TRUE
      AND is_archived = FALSE
    LIMIT 1
  `;

  if (existing) {
    return mapProfile(existing);
  }

  const firstActive = await userDB.queryRow<{
    id: string;
  }>`
    SELECT id
    FROM child_profiles
    WHERE user_id = ${userId}
      AND is_archived = FALSE
    ORDER BY created_at ASC
    LIMIT 1
  `;

  if (firstActive) {
    await userDB.exec`
      UPDATE child_profiles
      SET is_default = (id = ${firstActive.id}),
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${userId}
        AND is_archived = FALSE
    `;

    const recovered = await userDB.queryRow<ChildProfileRow>`
      SELECT
        id,
        user_id,
        name,
        avatar_color,
        age,
        reading_level,
        interests,
        no_go_topics,
        learning_goals,
        competency_state,
        preferred_avatar_ids,
        quiz_settings,
        is_default,
        is_archived,
        created_at,
        updated_at
      FROM child_profiles
      WHERE id = ${firstActive.id}
      LIMIT 1
    `;
    if (recovered) {
      return mapProfile(recovered);
    }
  }

  const id = crypto.randomUUID();
  const now = new Date();
  await userDB.exec`
    INSERT INTO child_profiles (
      id,
      user_id,
      name,
      avatar_color,
      is_default,
      is_archived,
      created_at,
      updated_at
    )
    VALUES (
      ${id},
      ${userId},
      ${normalizeProfileName(fallbackName)},
      '#8ec5ff',
      TRUE,
      FALSE,
      ${now},
      ${now}
    )
  `;

  const created = await userDB.queryRow<ChildProfileRow>`
    SELECT
      id,
      user_id,
      name,
      avatar_color,
      age,
      reading_level,
      interests,
      no_go_topics,
      learning_goals,
      competency_state,
      preferred_avatar_ids,
      quiz_settings,
      is_default,
      is_archived,
      created_at,
      updated_at
    FROM child_profiles
    WHERE id = ${id}
    LIMIT 1
  `;

  if (!created) {
    throw APIError.internal("Failed to create default profile");
  }

  return mapProfile(created);
}

export async function resolveRequestedProfileId(params: {
  userId: string;
  requestedProfileId?: string | null;
  fallbackName?: string;
}): Promise<string> {
  await ensureProfileSchema();
  const requested = params.requestedProfileId?.trim();
  if (!requested) {
    const profile = await ensureDefaultProfileForUser(params.userId, params.fallbackName);
    return profile.id;
  }

  const row = await userDB.queryRow<{ id: string }>`
    SELECT id
    FROM child_profiles
    WHERE id = ${requested}
      AND user_id = ${params.userId}
      AND is_archived = FALSE
    LIMIT 1
  `;

  if (!row) {
    throw APIError.permissionDenied("Profile does not belong to current account");
  }

  return row.id;
}

export async function assertProfilesBelongToUser(
  userId: string,
  profileIds: string[]
): Promise<string[]> {
  await ensureProfileSchema();
  const unique = Array.from(
    new Set(
      profileIds
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    )
  );

  if (unique.length === 0) {
    return [];
  }

  const rows = await userDB.queryAll<{ id: string }>`
    SELECT id
    FROM child_profiles
    WHERE user_id = ${userId}
      AND is_archived = FALSE
      AND id = ANY(${unique})
  `;

  const found = new Set(rows.map((entry) => entry.id));
  const missing = unique.filter((id) => !found.has(id));

  if (missing.length > 0) {
    throw APIError.permissionDenied(`Unknown profiles: ${missing.join(", ")}`);
  }

  return unique;
}

export async function countProfilesForUser(userId: string): Promise<number> {
  await ensureProfileSchema();
  const row = await userDB.queryRow<{ count: number }>`
    SELECT COUNT(*)::int as count
    FROM child_profiles
    WHERE user_id = ${userId}
      AND is_archived = FALSE
  `;
  return row?.count ?? 0;
}

export async function getUserAddonProfileCount(userId: string): Promise<number> {
  await ensureProfileSchema();
  const row = await userDB.queryRow<{ addons: number }>`
    SELECT COALESCE(extra_profile_addons, 0)::int as addons
    FROM users
    WHERE id = ${userId}
  `;
  return row?.addons ?? 0;
}

export async function getProfileBudgetPolicy(params: {
  userId: string;
  profileId: string;
}): Promise<ProfileBudgetPolicy | null> {
  await ensureProfileSchema();
  const row = await userDB.queryRow<{
    story_soft_cap: number | null;
    story_hard_cap: number | null;
    doku_soft_cap: number | null;
    doku_hard_cap: number | null;
    allow_family_reserve: boolean;
  }>`
    SELECT
      story_soft_cap,
      story_hard_cap,
      doku_soft_cap,
      doku_hard_cap,
      allow_family_reserve
    FROM profile_quota_policies
    WHERE user_id = ${params.userId}
      AND profile_id = ${params.profileId}
    LIMIT 1
  `;

  if (!row) {
    return null;
  }

  return {
    storySoftCap: row.story_soft_cap,
    storyHardCap: row.story_hard_cap,
    dokuSoftCap: row.doku_soft_cap,
    dokuHardCap: row.doku_hard_cap,
    allowFamilyReserve: row.allow_family_reserve,
  };
}

export async function upsertProfileBudgetPolicy(params: {
  userId: string;
  profileId: string;
  storySoftCap?: number | null;
  storyHardCap?: number | null;
  dokuSoftCap?: number | null;
  dokuHardCap?: number | null;
  allowFamilyReserve?: boolean;
}): Promise<ProfileBudgetPolicy> {
  await ensureProfileSchema();
  await userDB.exec`
    INSERT INTO profile_quota_policies (
      user_id,
      profile_id,
      story_soft_cap,
      story_hard_cap,
      doku_soft_cap,
      doku_hard_cap,
      allow_family_reserve,
      created_at,
      updated_at
    )
    VALUES (
      ${params.userId},
      ${params.profileId},
      ${params.storySoftCap ?? null},
      ${params.storyHardCap ?? null},
      ${params.dokuSoftCap ?? null},
      ${params.dokuHardCap ?? null},
      ${params.allowFamilyReserve ?? false},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (user_id, profile_id)
    DO UPDATE SET
      story_soft_cap = COALESCE(EXCLUDED.story_soft_cap, profile_quota_policies.story_soft_cap),
      story_hard_cap = COALESCE(EXCLUDED.story_hard_cap, profile_quota_policies.story_hard_cap),
      doku_soft_cap = COALESCE(EXCLUDED.doku_soft_cap, profile_quota_policies.doku_soft_cap),
      doku_hard_cap = COALESCE(EXCLUDED.doku_hard_cap, profile_quota_policies.doku_hard_cap),
      allow_family_reserve = COALESCE(EXCLUDED.allow_family_reserve, profile_quota_policies.allow_family_reserve),
      updated_at = CURRENT_TIMESTAMP
  `;

  const policy = await getProfileBudgetPolicy({
    userId: params.userId,
    profileId: params.profileId,
  });

  if (!policy) {
    throw APIError.internal("Failed to save profile budget policy");
  }

  return policy;
}

export async function getFamilyReserveState(userId: string): Promise<FamilyReserveState> {
  await ensureProfileSchema();
  const row = await userDB.queryRow<{
    family_reserve_story: number;
    family_reserve_doku: number;
    family_reserve_story_used: number;
    family_reserve_doku_used: number;
  }>`
    SELECT
      COALESCE(family_reserve_story, 0)::int as family_reserve_story,
      COALESCE(family_reserve_doku, 0)::int as family_reserve_doku,
      COALESCE(family_reserve_story_used, 0)::int as family_reserve_story_used,
      COALESCE(family_reserve_doku_used, 0)::int as family_reserve_doku_used
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  return {
    story: row?.family_reserve_story ?? 0,
    doku: row?.family_reserve_doku ?? 0,
    storyUsed: row?.family_reserve_story_used ?? 0,
    dokuUsed: row?.family_reserve_doku_used ?? 0,
  };
}

export async function setFamilyReserveState(params: {
  userId: string;
  story?: number;
  doku?: number;
}): Promise<FamilyReserveState> {
  await ensureProfileSchema();
  await userDB.exec`
    UPDATE users
    SET family_reserve_story = COALESCE(${params.story}, family_reserve_story),
        family_reserve_doku = COALESCE(${params.doku}, family_reserve_doku),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${params.userId}
  `;
  return getFamilyReserveState(params.userId);
}

export async function tryConsumeFamilyReserve(params: {
  userId: string;
  kind: "story" | "doku";
}): Promise<boolean> {
  await ensureProfileSchema();

  if (params.kind === "story") {
    const row = await userDB.queryRow<{ id: string }>`
      UPDATE users
      SET family_reserve_story_used = family_reserve_story_used + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${params.userId}
        AND family_reserve_story_used < family_reserve_story
      RETURNING id
    `;
    return Boolean(row?.id);
  }

  const row = await userDB.queryRow<{ id: string }>`
    UPDATE users
    SET family_reserve_doku_used = family_reserve_doku_used + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${params.userId}
      AND family_reserve_doku_used < family_reserve_doku
    RETURNING id
  `;
  return Boolean(row?.id);
}

export async function releaseFamilyReserveUnit(params: {
  userId: string;
  kind: "story" | "doku";
}): Promise<void> {
  await ensureProfileSchema();
  if (params.kind === "story") {
    await userDB.exec`
      UPDATE users
      SET family_reserve_story_used = GREATEST(family_reserve_story_used - 1, 0),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${params.userId}
    `;
    return;
  }

  await userDB.exec`
    UPDATE users
    SET family_reserve_doku_used = GREATEST(family_reserve_doku_used - 1, 0),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${params.userId}
  `;
}
