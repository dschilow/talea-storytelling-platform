import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import type { DokuSection, Doku } from "./generate";
import { getAuthData } from "~encore/auth";

const dokuDB = SQLDatabase.named("doku");

interface ListDokusResponse {
  dokus: (Omit<Doku, "content" | "summary"> & { summary?: string })[];
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

// Lists all dokus for the authenticated user.
export const listDokus = api<void, ListDokusResponse>(
  { expose: true, method: "GET", path: "/dokus", auth: true },
  async () => {
    const auth = getAuthData()!;
    const rows = await dokuDB.queryAll<{
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
      SELECT * FROM dokus WHERE user_id = ${auth.userID} ORDER BY created_at DESC
    `;

    const dokus = rows.map((r) => {
      const parsed = normalizeContent(r.content);
      const summary = extractSummaryFromContent(parsed);
      return {
        id: r.id,
        userId: r.user_id,
        title: r.title || parsed.title || r.topic,
        topic: r.topic,
        summary,
        coverImageUrl: r.cover_image_url || undefined,
        isPublic: r.is_public,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });

    return { dokus };
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
