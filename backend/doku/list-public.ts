import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import type { DokuSection, Doku } from "./generate";
import { resolveImageUrlForClient } from "../helpers/bucket-storage";

const dokuDB = SQLDatabase.named("doku");

interface ListPublicDokusRequest {
  limit?: number;
  offset?: number;
}

interface ListPublicDokusResponse {
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

// Lists public dokus with pagination.
export const listPublicDokus = api<ListPublicDokusRequest, ListPublicDokusResponse>(
  { expose: true, method: "GET", path: "/dokus/public", auth: true },
  async (req) => {
    const limit = req.limit || 12;
    const offset = req.offset || 0;

    // Get total count
    const countResult = await dokuDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM dokus WHERE is_public = true AND status = 'complete'
    `;
    const total = countResult?.count || 0;

    // Get paginated public dokus
    const rows = await dokuDB.queryAll<{
      id: string;
      user_id: string;
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
      SELECT * FROM dokus
      WHERE is_public = true AND status = 'complete'
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const dokus = await Promise.all(rows.map(async (r) => {
      const parsed = normalizeContent(r.content);
      const summary = extractSummaryFromContent(parsed);
      const metadata = r.metadata ? safeParse(r.metadata) : undefined;
      const coverImageUrl = await resolveImageUrlForClient(r.cover_image_url || undefined);
      return {
        id: r.id,
        userId: r.user_id,
        title: r.title || parsed.title || r.topic,
        topic: r.topic,
        summary,
        coverImageUrl,
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
