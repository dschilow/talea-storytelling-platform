import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import type { Doku, DokuSection } from "./generate";
import { getAuthData } from "~encore/auth";
import { resolveImageUrlForClient } from "../helpers/bucket-storage";
import { assertCommunityDokuAccess } from "../helpers/billing";

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
      metadata: string | null;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT * FROM dokus WHERE id = ${id}
    `;

    if (!row) throw APIError.notFound("Doku not found");

    if (row.user_id !== auth.userID && auth.role !== "admin" && !row.is_public) {
      throw APIError.permissionDenied("You do not have permission to view this dossier.");
    }

    if (row.is_public && row.user_id !== auth.userID && auth.role !== "admin") {
      await assertCommunityDokuAccess({
        userId: auth.userID,
        clerkToken: auth.clerkToken,
      });
    }

    const parsed = normalizeContent(row.content);
    const summary = typeof parsed.summary === "string" ? parsed.summary : undefined;
    const metadata = row.metadata ? safeParse(row.metadata) : undefined;
    const coverImageUrl = await resolveImageUrlForClient(row.cover_image_url || undefined);

    // Resolve section image URLs for client (bucket storage -> public URL)
    const rawSections = Array.isArray(parsed.sections) ? parsed.sections : [];
    const resolvedSections = await Promise.all(
      rawSections.map(async (section) => {
        if (section.imageUrl) {
          const resolvedUrl = await resolveImageUrlForClient(section.imageUrl);
          return { ...section, imageUrl: resolvedUrl || section.imageUrl };
        }
        return section;
      })
    );

    return {
      id: row.id,
      userId: row.user_id,
      title: row.title || parsed.title || row.topic,
      topic: row.topic,
      summary: summary ?? "",
      content: { sections: resolvedSections },
      coverImageUrl,
      isPublic: row.is_public,
      status: row.status,
      metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
);

function safeParse(s: string): any | undefined {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}
