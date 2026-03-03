import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { dokuDB } from "./db";
import { resolveRequestedProfileId } from "../helpers/profiles";

type CompletionState = "not_started" | "in_progress" | "completed";

type UpdateDokuStateRequest = {
  id: string;
  profileId?: string;
  isFavorite?: boolean;
  progressPct?: number;
  completionState?: CompletionState;
  lastPositionSec?: number | null;
  lastPlayedAt?: Date | null;
  quizRepeatDueAt?: Date | null;
};

type DokuStateResponse = {
  profileId: string;
  dokuId: string;
  isFavorite: boolean;
  progressPct: number;
  completionState: CompletionState;
  lastPositionSec?: number;
  lastPlayedAt?: Date;
  quizRepeatDueAt?: Date;
};

type SubmitDokuQuizRequest = {
  id: string;
  profileId?: string;
  score?: number;
  totalQuestions?: number;
  answers?: unknown[];
  masteryDelta?: Record<string, unknown>;
  nextRepeatHours?: number | null;
};

type SubmitDokuQuizResponse = {
  profileId: string;
  dokuId: string;
  attempt: number;
  score?: number;
  totalQuestions?: number;
  quizRepeatDueAt?: Date;
};

type AddDokuToProfileRequest = {
  id: string;
  profileId?: string;
  targetProfileId: string;
  avatarIds?: string[];
};

type AddDokuToProfileResponse = {
  dokuId: string;
  targetProfileId: string;
  participantProfileIds: string[];
};

function normalizeCompletionState(value: CompletionState | undefined): CompletionState | undefined {
  if (!value) return undefined;
  if (value === "not_started" || value === "in_progress" || value === "completed") {
    return value;
  }
  return undefined;
}

function clampProgress(progress: number | undefined): number | undefined {
  if (progress == null || !Number.isFinite(progress)) return undefined;
  return Math.max(0, Math.min(100, Number(progress)));
}

async function assertDokuAccess(userId: string, profileId: string, dokuId: string): Promise<void> {
  const doku = await dokuDB.queryRow<{
    user_id: string;
    is_public: boolean;
  }>`
    SELECT user_id, is_public
    FROM dokus
    WHERE id = ${dokuId}
    LIMIT 1
  `;
  if (!doku) {
    throw APIError.notFound("Doku not found");
  }
  if (doku.user_id !== userId) {
    throw APIError.permissionDenied("You do not have permission for this doku.");
  }

  const participant = await dokuDB.queryRow<{ profile_id: string }>`
    SELECT profile_id
    FROM doku_participants
    WHERE doku_id = ${dokuId}
      AND profile_id = ${profileId}
    LIMIT 1
  `;
  const hasParticipants = await dokuDB.queryRow<{ has_any: boolean }>`
    SELECT EXISTS (
      SELECT 1 FROM doku_participants WHERE doku_id = ${dokuId}
    ) AS has_any
  `;

  if (hasParticipants?.has_any && !participant && !doku.is_public) {
    throw APIError.permissionDenied("Doku belongs to another child profile.");
  }
}

export const updateDokuProfileState = api<UpdateDokuStateRequest, DokuStateResponse>(
  { expose: true, method: "POST", path: "/doku/:id/state", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    const profileId = await resolveRequestedProfileId({
      userId: auth.userID,
      requestedProfileId: req.profileId,
      fallbackName: auth.email ?? undefined,
    });
    await assertDokuAccess(auth.userID, profileId, req.id);

    const progressPct = clampProgress(req.progressPct);
    const completionState = normalizeCompletionState(req.completionState);

    await dokuDB.exec`
      INSERT INTO doku_profile_state (
        profile_id,
        doku_id,
        is_favorite,
        progress_pct,
        completion_state,
        last_position_sec,
        last_played_at,
        quiz_repeat_due_at,
        created_at,
        updated_at
      )
      VALUES (
        ${profileId},
        ${req.id},
        ${req.isFavorite ?? false},
        ${progressPct ?? 0},
        ${completionState ?? "not_started"},
        ${req.lastPositionSec ?? null},
        ${req.lastPlayedAt ?? null},
        ${req.quizRepeatDueAt ?? null},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (profile_id, doku_id) DO UPDATE
      SET is_favorite = COALESCE(${req.isFavorite}, doku_profile_state.is_favorite),
          progress_pct = COALESCE(${progressPct}, doku_profile_state.progress_pct),
          completion_state = COALESCE(${completionState}, doku_profile_state.completion_state),
          last_position_sec = CASE
            WHEN ${req.lastPositionSec !== undefined} THEN ${req.lastPositionSec ?? null}
            ELSE doku_profile_state.last_position_sec
          END,
          last_played_at = CASE
            WHEN ${req.lastPlayedAt !== undefined} THEN ${req.lastPlayedAt ?? null}
            ELSE doku_profile_state.last_played_at
          END,
          quiz_repeat_due_at = CASE
            WHEN ${req.quizRepeatDueAt !== undefined} THEN ${req.quizRepeatDueAt ?? null}
            ELSE doku_profile_state.quiz_repeat_due_at
          END,
          updated_at = CURRENT_TIMESTAMP
    `;

    const row = await dokuDB.queryRow<{
      is_favorite: boolean;
      progress_pct: number;
      completion_state: CompletionState;
      last_position_sec: number | null;
      last_played_at: Date | null;
      quiz_repeat_due_at: Date | null;
    }>`
      SELECT
        is_favorite,
        progress_pct,
        completion_state,
        last_position_sec,
        last_played_at,
        quiz_repeat_due_at
      FROM doku_profile_state
      WHERE profile_id = ${profileId}
        AND doku_id = ${req.id}
      LIMIT 1
    `;

    if (!row) {
      throw APIError.internal("Failed to persist doku profile state.");
    }

    return {
      profileId,
      dokuId: req.id,
      isFavorite: row.is_favorite,
      progressPct: Number(row.progress_pct || 0),
      completionState: row.completion_state,
      lastPositionSec: row.last_position_sec ?? undefined,
      lastPlayedAt: row.last_played_at ?? undefined,
      quizRepeatDueAt: row.quiz_repeat_due_at ?? undefined,
    };
  }
);

export const submitDokuQuizResult = api<SubmitDokuQuizRequest, SubmitDokuQuizResponse>(
  { expose: true, method: "POST", path: "/doku/:id/quiz", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    const profileId = await resolveRequestedProfileId({
      userId: auth.userID,
      requestedProfileId: req.profileId,
      fallbackName: auth.email ?? undefined,
    });
    await assertDokuAccess(auth.userID, profileId, req.id);

    const nextAttempt = await dokuDB.queryRow<{ attempt: number }>`
      SELECT COALESCE(MAX(attempt), 0)::int + 1 AS attempt
      FROM doku_quiz_results
      WHERE profile_id = ${profileId}
        AND doku_id = ${req.id}
    `;
    const attempt = nextAttempt?.attempt ?? 1;

    await dokuDB.exec`
      INSERT INTO doku_quiz_results (
        id,
        profile_id,
        doku_id,
        attempt,
        score,
        total_questions,
        answers,
        mastery_delta,
        created_at
      )
      VALUES (
        ${crypto.randomUUID()},
        ${profileId},
        ${req.id},
        ${attempt},
        ${req.score ?? null},
        ${req.totalQuestions ?? null},
        ${JSON.stringify(req.answers ?? [])}::jsonb,
        ${JSON.stringify(req.masteryDelta ?? {})}::jsonb,
        CURRENT_TIMESTAMP
      )
    `;

    const nextRepeatDueAt = req.nextRepeatHours != null && Number.isFinite(req.nextRepeatHours)
      ? new Date(Date.now() + Math.max(0, req.nextRepeatHours) * 60 * 60 * 1000)
      : null;

    await dokuDB.exec`
      INSERT INTO doku_profile_state (
        profile_id,
        doku_id,
        progress_pct,
        completion_state,
        quiz_repeat_due_at,
        created_at,
        updated_at
      )
      VALUES (
        ${profileId},
        ${req.id},
        100,
        'completed',
        ${nextRepeatDueAt},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (profile_id, doku_id) DO UPDATE
      SET progress_pct = GREATEST(doku_profile_state.progress_pct, 100),
          completion_state = 'completed',
          quiz_repeat_due_at = COALESCE(${nextRepeatDueAt}, doku_profile_state.quiz_repeat_due_at),
          updated_at = CURRENT_TIMESTAMP
    `;

    return {
      profileId,
      dokuId: req.id,
      attempt,
      score: req.score ?? undefined,
      totalQuestions: req.totalQuestions ?? undefined,
      quizRepeatDueAt: nextRepeatDueAt ?? undefined,
    };
  }
);

export const addDokuToProfile = api<AddDokuToProfileRequest, AddDokuToProfileResponse>(
  { expose: true, method: "POST", path: "/doku/:id/add-to-profile", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    const activeProfileId = await resolveRequestedProfileId({
      userId: auth.userID,
      requestedProfileId: req.profileId,
      fallbackName: auth.email ?? undefined,
    });
    const targetProfileId = await resolveRequestedProfileId({
      userId: auth.userID,
      requestedProfileId: req.targetProfileId,
      fallbackName: auth.email ?? undefined,
    });
    await assertDokuAccess(auth.userID, activeProfileId, req.id);

    const avatarIds = Array.from(
      new Set(
        (req.avatarIds || [])
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0)
      )
    );

    await dokuDB.exec`
      INSERT INTO doku_participants (
        id,
        doku_id,
        profile_id,
        avatar_ids,
        created_at
      )
      VALUES (
        ${crypto.randomUUID()},
        ${req.id},
        ${targetProfileId},
        ${JSON.stringify(avatarIds)}::jsonb,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (doku_id, profile_id) DO UPDATE
      SET avatar_ids = COALESCE(NULLIF(EXCLUDED.avatar_ids, '[]'::jsonb), doku_participants.avatar_ids)
    `;

    await dokuDB.exec`
      INSERT INTO doku_profile_state (
        profile_id,
        doku_id,
        is_favorite,
        progress_pct,
        completion_state,
        created_at,
        updated_at
      )
      VALUES (
        ${targetProfileId},
        ${req.id},
        FALSE,
        0,
        'not_started',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (profile_id, doku_id) DO NOTHING
    `;

    const participants = await dokuDB.queryAll<{ profile_id: string }>`
      SELECT profile_id
      FROM doku_participants
      WHERE doku_id = ${req.id}
      ORDER BY created_at ASC
    `;

    return {
      dokuId: req.id,
      targetProfileId,
      participantProfileIds: participants.map((entry) => entry.profile_id),
    };
  }
);
