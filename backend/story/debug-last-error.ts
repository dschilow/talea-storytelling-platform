import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { storyDB } from "./db";

interface DebugStoryErrorRequest {
  storyId?: string;
  onlyErrors?: boolean;
}

interface DebugStoryErrorResponse {
  found: boolean;
  storyId?: string;
  storyStatus?: string;
  storyUpdatedAt?: string;
  storyMetadata?: any;
  storyConfig?: any;
  pipelineStatus?: string | null;
  pipelineError?: string | null;
  pipelineUpdatedAt?: string | null;
}

export const debugLastError = api<DebugStoryErrorRequest, DebugStoryErrorResponse>(
  { expose: true, method: "POST", path: "/story/debug-last-error", auth: true },
  async (req) => {
    const auth = getAuthData();
    if (!auth?.userID) {
      throw APIError.unauthenticated("Missing auth");
    }

    let storyRow: {
      id: string;
      user_id: string;
      status: string;
      metadata: string | null;
      config: string | null;
      updated_at: Date;
    } | null = null;

    if (req.storyId) {
      storyRow = await storyDB.queryRow`
        SELECT id, user_id, status, metadata, config, updated_at
        FROM stories
        WHERE id = ${req.storyId}
      `;
      if (!storyRow) {
        return { found: false };
      }
      if (storyRow.user_id !== auth.userID && auth.role !== "admin") {
        throw APIError.permissionDenied("Not allowed to access this story");
      }
    } else {
      const wantErrors = req.onlyErrors !== false;
      if (wantErrors) {
        storyRow = await storyDB.queryRow`
          SELECT id, user_id, status, metadata, config, updated_at
          FROM stories
          WHERE user_id = ${auth.userID} AND status = 'error'
          ORDER BY updated_at DESC
          LIMIT 1
        `;
      }
      if (!storyRow) {
        storyRow = await storyDB.queryRow`
          SELECT id, user_id, status, metadata, config, updated_at
          FROM stories
          WHERE user_id = ${auth.userID}
          ORDER BY updated_at DESC
          LIMIT 1
        `;
      }
      if (!storyRow) {
        return { found: false };
      }
    }

    const metadata = storyRow.metadata ? safeJson(storyRow.metadata) : null;
    const config = storyRow.config ? safeJson(storyRow.config) : null;

    const pipelineRow = await storyDB.queryRow<{
      status: string | null;
      error: string | null;
      updated_at: Date | null;
    }>`
      SELECT status, error, updated_at
      FROM story_instances
      WHERE id = ${storyRow.id}
    `;

    return {
      found: true,
      storyId: storyRow.id,
      storyStatus: storyRow.status,
      storyUpdatedAt: storyRow.updated_at?.toISOString(),
      storyMetadata: metadata,
      storyConfig: config,
      pipelineStatus: pipelineRow?.status ?? null,
      pipelineError: pipelineRow?.error ?? null,
      pipelineUpdatedAt: pipelineRow?.updated_at ? pipelineRow.updated_at.toISOString() : null,
    };
  }
);

function safeJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
