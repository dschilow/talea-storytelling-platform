import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import type { DokuSection, Doku } from "./generate";
import { getAuthData } from "~encore/auth";
import { resolveImageUrlForClient } from "../helpers/bucket-storage";
import { ensureDefaultProfileForUser, resolveRequestedProfileId } from "../helpers/profiles";

const dokuDB = SQLDatabase.named("doku");

interface ListDokusRequest {
  limit?: number;
  offset?: number;
  profileId?: string;
  includeFamily?: boolean;
}

interface ListDokusResponse {
  dokus: (Omit<Doku, "content" | "summary"> & { summary?: string })[];
  total: number;
  hasMore: boolean;
}

// Safely normalize JSONB/text content coming from the DB into an object.
function normalizeContent(raw: unknown): { sections: DokuSection[]; summary?: string; title?: string } {
  if (raw == null) return { sections: [] };
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return { sections: [] };
    }
  }
  if (typeof raw === "object") {
    return raw as any;
  }
  return { sections: [] };
}

// Lists dokus for the authenticated user with pagination.
export const listDokus = api<ListDokusRequest, ListDokusResponse>(
  { expose: true, method: "GET", path: "/dokus", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    const limit = req.limit || 10;
    const offset = req.offset || 0;
    const includeFamily = req.includeFamily === true;
    const activeProfileId = await resolveRequestedProfileId({
      userId: auth.userID,
      requestedProfileId: req.profileId,
      fallbackName: auth.email ?? undefined,
    });
    const defaultProfile = await ensureDefaultProfileForUser(auth.userID, auth.email ?? undefined);
    const includeLegacyUnscoped = activeProfileId === defaultProfile.id;

    // Get total count
    const countResult = await dokuDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM dokus d
      WHERE d.user_id = ${auth.userID}
        AND (
          ${includeFamily}
          OR d.primary_profile_id = ${activeProfileId}
          OR EXISTS (
            SELECT 1
            FROM doku_participants dp
            WHERE dp.doku_id = d.id
              AND dp.profile_id = ${activeProfileId}
          )
          OR (
            ${includeLegacyUnscoped}
            AND d.primary_profile_id IS NULL
            AND NOT EXISTS (
              SELECT 1
              FROM doku_participants dp_legacy
              WHERE dp_legacy.doku_id = d.id
            )
          )
        )
    `;
    const total = countResult?.count || 0;

    // Get paginated dokus
    const rows = await dokuDB.queryAll<{
      id: string;
      user_id: string;
      primary_profile_id: string | null;
      title: string;
      topic: string;
      content: any;
      cover_image_url: string | null;
      is_public: boolean;
      status: "generating" | "complete" | "error";
      metadata: string | null;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT *
      FROM dokus d
      WHERE d.user_id = ${auth.userID}
        AND (
          ${includeFamily}
          OR d.primary_profile_id = ${activeProfileId}
          OR EXISTS (
            SELECT 1
            FROM doku_participants dp
            WHERE dp.doku_id = d.id
              AND dp.profile_id = ${activeProfileId}
          )
          OR (
            ${includeLegacyUnscoped}
            AND d.primary_profile_id IS NULL
            AND NOT EXISTS (
              SELECT 1
              FROM doku_participants dp_legacy
              WHERE dp_legacy.doku_id = d.id
            )
          )
        )
      ORDER BY d.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const dokuIds = rows.map((row) => row.id);
    const participantRows = dokuIds.length > 0
      ? await dokuDB.queryAll<{
          doku_id: string;
          profile_id: string;
        }>`
          SELECT doku_id, profile_id
          FROM doku_participants
          WHERE doku_id = ANY(${dokuIds})
        `
      : [];
    const participantsByDokuId = new Map<string, string[]>();
    for (const row of participantRows) {
      const entries = participantsByDokuId.get(row.doku_id) || [];
      entries.push(row.profile_id);
      participantsByDokuId.set(row.doku_id, entries);
    }

    const stateRows = dokuIds.length > 0
      ? await dokuDB.queryAll<{
          doku_id: string;
          is_favorite: boolean;
          progress_pct: number;
          completion_state: "not_started" | "in_progress" | "completed";
          last_position_sec: number | null;
          last_played_at: Date | null;
        }>`
          SELECT
            doku_id,
            is_favorite,
            progress_pct,
            completion_state,
            last_position_sec,
            last_played_at
          FROM doku_profile_state
          WHERE profile_id = ${activeProfileId}
            AND doku_id = ANY(${dokuIds})
        `
      : [];
    const stateByDokuId = new Map<string, (typeof stateRows)[number]>(
      stateRows.map((row) => [row.doku_id, row])
    );

    const dokus = await Promise.all(rows.map(async (r) => {
      const parsed = normalizeContent(r.content);
      const summary = extractSummaryFromContent(parsed);
      const metadata = r.metadata ? safeParse(r.metadata) : undefined;
      const coverImageUrl = await resolveImageUrlForClient(r.cover_image_url || undefined);
      const profileState = stateByDokuId.get(r.id);
      return {
        id: r.id,
        userId: r.user_id,
        primaryProfileId: r.primary_profile_id || undefined,
        participantProfileIds: participantsByDokuId.get(r.id) || [],
        title: r.title || parsed.title || r.topic,
        topic: r.topic,
        summary,
        coverImageUrl,
        profileState: profileState
          ? {
              profileId: activeProfileId,
              isFavorite: profileState.is_favorite,
              progressPct: Number(profileState.progress_pct || 0),
              completionState: profileState.completion_state,
              lastPositionSec: profileState.last_position_sec ?? undefined,
              lastPlayedAt: profileState.last_played_at ?? undefined,
            }
          : undefined,
        isPublic: r.is_public,
        status: r.status,
        metadata,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    }));

    const hasMore = offset + limit < total;

    return { dokus, total, hasMore };
  }
);

function extractSummaryFromContent(content: any): string | undefined {
  const parsed = normalizeContent(content);
  if (typeof parsed.summary === "string") return parsed.summary;
  if (Array.isArray(parsed.sections) && parsed.sections.length > 0) {
    const s = parsed.sections[0];
    if (typeof s?.content === "string") {
      const firstSent = s.content.split(".")[0];
      return firstSent ? `${firstSent}.` : undefined;
    }
  }
  return undefined;
}

function safeParse(s: string): any | undefined {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}
