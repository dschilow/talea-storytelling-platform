import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import type { Doku } from "./generate";
import { getAuthData } from "~encore/auth";

const dokuDB = SQLDatabase.named("doku");

interface ListDokusResponse {
  dokus: (Omit<Doku, "content" | "summary"> & { summary?: string })[];
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
      content: string;
      cover_image_url: string | null;
      is_public: boolean;
      status: "generating" | "complete" | "error";
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT * FROM dokus WHERE user_id = ${auth.userID} ORDER BY created_at DESC
    `;

    const dokus = rows.map((r) => {
      const parsed = JSON.parse(r.content);
      const summary = extractSummaryFromContent(parsed);
      return {
        id: r.id,
        userId: r.user_id,
        title: r.title,
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
  // We did not store summary explicitly in DB schema, but OpenAI returns it.
  // Attempt to find it either top-level or from first section.
  if (typeof content?.summary === "string") return content.summary;
  if (Array.isArray(content?.sections) && content.sections.length > 0) {
    const s = content.sections[0];
    if (typeof s?.content === "string") {
      const firstSent = s.content.split(".")[0];
      return firstSent ? `${firstSent}.` : undefined;
    }
  }
  return undefined;
}
