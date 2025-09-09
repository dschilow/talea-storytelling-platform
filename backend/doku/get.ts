import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import type { Doku, DokuSection } from "./generate";
import { getAuthData } from "~encore/auth";

const dokuDB = SQLDatabase.named("doku");

interface GetDokuParams {
  id: string;
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

// Retrieves a specific doku (only owner or admin or if public).
export const getDoku = api<GetDokuParams, Doku>(
  { expose: true, method: "GET", path: "/doku/:id", auth: true },
  async ({ id }) => {
    const auth = getAuthData()!;
    const row = await dokuDB.queryRow<{
      id: string;
      user_id: string;
      title: string;
      topic: string;
      content: any;
      cover_image_url: string | null;
      is_public: boolean;
      status: "generating" | "complete" | "error";
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT * FROM dokus WHERE id = ${id}
    `;

    if (!row) throw APIError.notFound("Doku not found");

    if (row.user_id !== auth.userID && auth.role !== "admin" && !row.is_public) {
      throw APIError.permissionDenied("You do not have permission to view this dossier.");
    }

    const parsed = normalizeContent(row.content);
    const summary = typeof parsed.summary === "string" ? parsed.summary : undefined;

    return {
      id: row.id,
      userId: row.user_id,
      title: row.title || parsed.title || row.topic,
      topic: row.topic,
      summary: summary ?? "",
      content: { sections: Array.isArray(parsed.sections) ? parsed.sections : [] },
      coverImageUrl: row.cover_image_url || undefined,
      isPublic: row.is_public,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
);
