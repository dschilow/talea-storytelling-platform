import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { resolvePlanForUser } from "../helpers/billing";
import {
  assertProfilesBelongToUser,
  countProfilesForUser,
  ensureDefaultProfileForUser,
  getFamilyReserveState,
  getProfileBudgetPolicy,
  getProfileLimitForPlan,
  getUserAddonProfileCount,
  listProfilesForUser,
  setFamilyReserveState,
  upsertProfileBudgetPolicy,
  type ChildProfile,
  type FamilyReserveState,
  type ProfileBudgetPolicy,
} from "../helpers/profiles";
import { userDB } from "./db";

type ProfileUsage = {
  profileId: string;
  storyCount: number;
  dokuCount: number;
  audioCount: number;
};

type ProfileDetails = ChildProfile & {
  budget: ProfileBudgetPolicy | null;
  usage: ProfileUsage;
};

type ProfilesOverviewResponse = {
  plan: "free" | "starter" | "familie" | "premium";
  profileLimit: number;
  profiles: ProfileDetails[];
  reserve: FamilyReserveState;
};

type ListProfilesResponse = {
  profiles: ChildProfile[];
  profileLimit: number;
};

type CreateProfileRequest = {
  name: string;
  avatarColor?: string;
  age?: number;
  readingLevel?: string;
  interests?: string[];
  noGoTopics?: string[];
  learningGoals?: string[];
  competencyState?: Record<string, unknown>;
  preferredAvatarIds?: string[];
  quizSettings?: Record<string, unknown>;
};

type UpdateProfileRequest = {
  profileId: string;
  name?: string;
  avatarColor?: string | null;
  age?: number | null;
  readingLevel?: string | null;
  interests?: string[];
  noGoTopics?: string[];
  learningGoals?: string[];
  competencyState?: Record<string, unknown>;
  preferredAvatarIds?: string[];
  quizSettings?: Record<string, unknown>;
  isDefault?: boolean;
};

type DeleteProfileParams = {
  profileId: string;
};

type DeleteProfileResponse = {
  success: boolean;
  newDefaultProfileId?: string;
};

type SaveBudgetPolicyRequest = {
  profileId: string;
  storySoftCap?: number | null;
  storyHardCap?: number | null;
  dokuSoftCap?: number | null;
  dokuHardCap?: number | null;
  allowFamilyReserve?: boolean;
};

type SaveBudgetPolicyResponse = {
  profileId: string;
  policy: ProfileBudgetPolicy;
};

type SaveReserveRequest = {
  story?: number;
  doku?: number;
};

type SaveReserveResponse = {
  reserve: FamilyReserveState;
};

async function ensureUserExists(userId: string, fallbackEmail?: string | null): Promise<void> {
  const row = await userDB.queryRow<{ id: string }>`
    SELECT id FROM users WHERE id = ${userId}
  `;

  if (row) {
    return;
  }

  const now = new Date();
  const email = fallbackEmail || `${userId}@local.talea`;
  const name = (fallbackEmail || "new-user").split("@")[0] || "new-user";

  await userDB.exec`
    INSERT INTO users (id, email, name, subscription, role, created_at, updated_at)
    VALUES (${userId}, ${email}, ${name}, 'free', 'user', ${now}, ${now})
    ON CONFLICT (id) DO NOTHING
  `;
}

function startOfMonthUTC(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function clampOptional(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.floor(value));
}

function cleanTextArray(value: string[] | undefined): string[] {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)
    )
  );
}

async function getProfileLimitForCurrentUser(userId: string, clerkToken?: string | null): Promise<{
  plan: "free" | "starter" | "familie" | "premium";
  limit: number;
}> {
  const [plan, addons] = await Promise.all([
    resolvePlanForUser(userId, clerkToken),
    getUserAddonProfileCount(userId),
  ]);
  return {
    plan,
    limit: getProfileLimitForPlan(plan, addons),
  };
}

async function readUsageByProfile(userId: string, profileIds: string[]): Promise<Map<string, ProfileUsage>> {
  if (profileIds.length === 0) {
    return new Map();
  }
  const periodStart = startOfMonthUTC(new Date());
  const rows = await userDB.queryAll<{
    profile_id: string;
    kind: "story" | "doku" | "audio";
    units: number;
  }>`
    SELECT profile_id, kind, COALESCE(SUM(units), 0)::int as units
    FROM quota_ledger
    WHERE user_id = ${userId}
      AND period_start = ${periodStart}
      AND profile_id = ANY(${profileIds})
    GROUP BY profile_id, kind
  `;

  const map = new Map<string, ProfileUsage>();
  for (const profileId of profileIds) {
    map.set(profileId, {
      profileId,
      storyCount: 0,
      dokuCount: 0,
      audioCount: 0,
    });
  }

  for (const row of rows) {
    const bucket = map.get(row.profile_id);
    if (!bucket) continue;
    if (row.kind === "story") bucket.storyCount = row.units;
    if (row.kind === "doku") bucket.dokuCount = row.units;
    if (row.kind === "audio") bucket.audioCount = row.units;
  }

  return map;
}

export const listProfiles = api<void, ListProfilesResponse>(
  { expose: true, method: "GET", path: "/user/profiles", auth: true },
  async () => {
    const auth = getAuthData()!;
    await ensureUserExists(auth.userID, auth.email);
    await ensureDefaultProfileForUser(auth.userID);
    const profiles = await listProfilesForUser(auth.userID);
    const { limit } = await getProfileLimitForCurrentUser(auth.userID, auth.clerkToken);
    return {
      profiles,
      profileLimit: limit,
    };
  }
);

export const createProfile = api<CreateProfileRequest, ChildProfile>(
  { expose: true, method: "POST", path: "/user/profiles", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    await ensureUserExists(auth.userID, auth.email);
    await ensureDefaultProfileForUser(auth.userID);

    const { limit } = await getProfileLimitForCurrentUser(auth.userID, auth.clerkToken);
    const currentCount = await countProfilesForUser(auth.userID);
    if (currentCount >= limit) {
      throw APIError.failedPrecondition(
        `Profile limit reached (${currentCount}/${limit}). Please upgrade or add profile add-ons.`
      );
    }

    const id = crypto.randomUUID();
    const now = new Date();
    const name = (req.name || "").trim();
    if (!name) {
      throw APIError.invalidArgument("Profile name is required");
    }

    await userDB.exec`
      INSERT INTO child_profiles (
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
      )
      VALUES (
        ${id},
        ${auth.userID},
        ${name},
        ${req.avatarColor ?? '#8ec5ff'},
        ${clampOptional(req.age)},
        ${req.readingLevel ?? null},
        ${cleanTextArray(req.interests)},
        ${cleanTextArray(req.noGoTopics)},
        ${cleanTextArray(req.learningGoals)},
        ${JSON.stringify(req.competencyState ?? {})}::jsonb,
        ${cleanTextArray(req.preferredAvatarIds)},
        ${JSON.stringify(req.quizSettings ?? {})}::jsonb,
        FALSE,
        FALSE,
        ${now},
        ${now}
      )
    `;

    const profiles = await listProfilesForUser(auth.userID);
    const created = profiles.find((entry) => entry.id === id);
    if (!created) {
      throw APIError.internal("Failed to load created profile");
    }
    return created;
  }
);

export const updateProfile = api<UpdateProfileRequest, ChildProfile>(
  { expose: true, method: "PUT", path: "/user/profiles/:profileId", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    await ensureUserExists(auth.userID, auth.email);
    await assertProfilesBelongToUser(auth.userID, [req.profileId]);

    const now = new Date();
    if (req.isDefault === true) {
      await userDB.exec`
        UPDATE child_profiles
        SET is_default = (id = ${req.profileId}),
            updated_at = ${now}
        WHERE user_id = ${auth.userID}
          AND is_archived = FALSE
      `;
    }

    await userDB.exec`
      UPDATE child_profiles
      SET
        name = COALESCE(${req.name?.trim() || null}, name),
        avatar_color = CASE WHEN ${req.avatarColor !== undefined} THEN ${req.avatarColor} ELSE avatar_color END,
        age = CASE WHEN ${req.age !== undefined} THEN ${clampOptional(req.age)} ELSE age END,
        reading_level = CASE WHEN ${req.readingLevel !== undefined} THEN ${req.readingLevel} ELSE reading_level END,
        interests = CASE WHEN ${req.interests !== undefined} THEN ${cleanTextArray(req.interests)} ELSE interests END,
        no_go_topics = CASE WHEN ${req.noGoTopics !== undefined} THEN ${cleanTextArray(req.noGoTopics)} ELSE no_go_topics END,
        learning_goals = CASE WHEN ${req.learningGoals !== undefined} THEN ${cleanTextArray(req.learningGoals)} ELSE learning_goals END,
        competency_state = CASE WHEN ${req.competencyState !== undefined} THEN ${JSON.stringify(req.competencyState)}::jsonb ELSE competency_state END,
        preferred_avatar_ids = CASE WHEN ${req.preferredAvatarIds !== undefined} THEN ${cleanTextArray(req.preferredAvatarIds)} ELSE preferred_avatar_ids END,
        quiz_settings = CASE WHEN ${req.quizSettings !== undefined} THEN ${JSON.stringify(req.quizSettings)}::jsonb ELSE quiz_settings END,
        updated_at = ${now}
      WHERE id = ${req.profileId}
        AND user_id = ${auth.userID}
    `;

    const profiles = await listProfilesForUser(auth.userID);
    const updated = profiles.find((entry) => entry.id === req.profileId);
    if (!updated) {
      throw APIError.notFound("Profile not found");
    }
    return updated;
  }
);

export const deleteProfile = api<DeleteProfileParams, DeleteProfileResponse>(
  { expose: true, method: "DELETE", path: "/user/profiles/:profileId", auth: true },
  async ({ profileId }) => {
    const auth = getAuthData()!;
    await ensureUserExists(auth.userID, auth.email);
    await assertProfilesBelongToUser(auth.userID, [profileId]);

    const profiles = await listProfilesForUser(auth.userID);
    if (profiles.length <= 1) {
      throw APIError.failedPrecondition("At least one profile must remain.");
    }

    await userDB.exec`
      UPDATE child_profiles
      SET is_archived = TRUE,
          is_default = FALSE,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${profileId}
        AND user_id = ${auth.userID}
    `;

    const remaining = await listProfilesForUser(auth.userID);
    const hasDefault = remaining.some((entry) => entry.isDefault);
    if (!hasDefault && remaining.length > 0) {
      const newDefault = remaining[0];
      await userDB.exec`
        UPDATE child_profiles
        SET is_default = (id = ${newDefault.id}),
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ${auth.userID}
          AND is_archived = FALSE
      `;
      return {
        success: true,
        newDefaultProfileId: newDefault.id,
      };
    }

    return { success: true };
  }
);

export const getProfilesOverview = api<void, ProfilesOverviewResponse>(
  { expose: true, method: "GET", path: "/user/profiles/overview", auth: true },
  async () => {
    const auth = getAuthData()!;
    await ensureUserExists(auth.userID, auth.email);
    await ensureDefaultProfileForUser(auth.userID);

    const [{ plan, limit }, profiles, reserve] = await Promise.all([
      getProfileLimitForCurrentUser(auth.userID, auth.clerkToken),
      listProfilesForUser(auth.userID),
      getFamilyReserveState(auth.userID),
    ]);

    const usageByProfile = await readUsageByProfile(
      auth.userID,
      profiles.map((entry) => entry.id)
    );

    const details: ProfileDetails[] = [];
    for (const profile of profiles) {
      const [budget, usage] = await Promise.all([
        getProfileBudgetPolicy({ userId: auth.userID, profileId: profile.id }),
        Promise.resolve(
          usageByProfile.get(profile.id) || {
            profileId: profile.id,
            storyCount: 0,
            dokuCount: 0,
            audioCount: 0,
          }
        ),
      ]);
      details.push({
        ...profile,
        budget,
        usage,
      });
    }

    return {
      plan,
      profileLimit: limit,
      profiles: details,
      reserve,
    };
  }
);

export const saveProfileBudget = api<SaveBudgetPolicyRequest, SaveBudgetPolicyResponse>(
  { expose: true, method: "POST", path: "/user/profiles/:profileId/budget", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    await ensureUserExists(auth.userID, auth.email);
    await assertProfilesBelongToUser(auth.userID, [req.profileId]);

    const policy = await upsertProfileBudgetPolicy({
      userId: auth.userID,
      profileId: req.profileId,
      storySoftCap: clampOptional(req.storySoftCap),
      storyHardCap: clampOptional(req.storyHardCap),
      dokuSoftCap: clampOptional(req.dokuSoftCap),
      dokuHardCap: clampOptional(req.dokuHardCap),
      allowFamilyReserve: req.allowFamilyReserve,
    });

    return {
      profileId: req.profileId,
      policy,
    };
  }
);

export const saveFamilyReserve = api<SaveReserveRequest, SaveReserveResponse>(
  { expose: true, method: "POST", path: "/user/profiles/family-reserve", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    await ensureUserExists(auth.userID, auth.email);
    const reserve = await setFamilyReserveState({
      userId: auth.userID,
      story: clampOptional(req.story) ?? undefined,
      doku: clampOptional(req.doku) ?? undefined,
    });
    return { reserve };
  }
);

