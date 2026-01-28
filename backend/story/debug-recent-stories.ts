import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { storyDB } from "./db";

interface DebugRecentStoriesRequest {
  limit?: number;
}

interface DebugRecentStoriesResponse {
  stories: Array<{
    id: string;
    status: string;
    updatedAt: string;
    hasErrorMetadata: boolean;
    errorMessage?: string | null;
  }>;
}

export const debugRecentStories = api<DebugRecentStoriesRequest, DebugRecentStoriesResponse>(
  { expose: true, method: "POST", path: "/story/debug-recent-stories", auth: true },
  async (req) => {
    const auth = getAuthData();
    if (!auth?.userID) {
      throw APIError.unauthenticated("Missing auth");
    }

    const limit = Math.min(Math.max(req.limit ?? 5, 1), 20);

    const rows = await storyDB.queryAll<{
      id: string;
      status: string;
      updated_at: Date;
      metadata: string | null;
    }>`
      SELECT id, status, updated_at, metadata
      FROM stories
      WHERE user_id = ${auth.userID}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `;

    const stories = rows.map((row) => {
      const metadata = row.metadata ? safeJson(row.metadata) : null;
      const errorMessage = metadata?.error?.message ?? null;
      return {
        id: row.id,
        status: row.status,
        updatedAt: row.updated_at?.toISOString(),
        hasErrorMetadata: Boolean(metadata?.error),
        errorMessage,
      };
    });

    return { stories };
  }
);

function safeJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
