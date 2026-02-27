import crypto from "crypto";
import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import {
  deleteFromBucket,
  resolveImageUrlForClient,
  resolveObjectUrlForClient,
  uploadBufferToBucket,
} from "../helpers/bucket-storage";
import { storyDB } from "./db";

type AudioSourceType = "story" | "doku";

interface SaveGeneratedAudioRequest {
  sourceType: AudioSourceType;
  sourceId: string;
  sourceTitle: string;
  itemId: string;
  itemTitle: string;
  itemSubtitle?: string;
  itemOrder?: number;
  cacheKey: string;
  audioDataUrl: string;
  coverImageUrl?: string;
}

interface GeneratedAudioLibraryEntry {
  id: string;
  sourceType: AudioSourceType;
  sourceId: string;
  sourceTitle: string;
  itemId: string;
  itemTitle: string;
  itemSubtitle?: string;
  itemOrder?: number;
  cacheKey: string;
  audioUrl: string;
  mimeType: string;
  coverImageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ListGeneratedAudioRequest {
  sourceType?: "all" | AudioSourceType;
  query?: string;
  sort?: "newest" | "oldest";
  limit?: number;
  offset?: number;
}

interface ListGeneratedAudioResponse {
  items: GeneratedAudioLibraryEntry[];
  total: number;
  hasMore: boolean;
}

interface ResolveGeneratedAudioRequest {
  cacheKeys: string[];
}

interface ResolveGeneratedAudioResponse {
  items: Array<{
    cacheKey: string;
    audioUrl: string;
    mimeType: string;
  }>;
}

type LibraryRow = {
  id: string;
  user_id: string;
  source_type: AudioSourceType;
  source_id: string;
  source_title: string;
  item_id: string;
  item_title: string;
  item_subtitle: string | null;
  item_order: number | null;
  cache_key: string;
  audio_url: string;
  mime_type: string;
  cover_image_url: string | null;
  created_at: Date;
  updated_at: Date;
};

function parseDataUrl(dataUrl: string): { contentType: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const contentType = match[1].trim();
  const base64 = match[2];
  if (!contentType || !base64) return null;
  return { contentType, buffer: Buffer.from(base64, "base64") };
}

function cleanText(value: string, field: string): string {
  const next = String(value || "").trim();
  if (!next) {
    throw APIError.invalidArgument(`${field} is required.`);
  }
  return next;
}

function sanitizeFilePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "item";
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

async function mapRowToEntry(row: LibraryRow): Promise<GeneratedAudioLibraryEntry> {
  const audioUrl = await resolveObjectUrlForClient(row.audio_url);
  const coverImageUrl = await resolveImageUrlForClient(row.cover_image_url || undefined);
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceTitle: row.source_title,
    itemId: row.item_id,
    itemTitle: row.item_title,
    itemSubtitle: row.item_subtitle || undefined,
    itemOrder: row.item_order ?? undefined,
    cacheKey: row.cache_key,
    audioUrl: audioUrl || row.audio_url,
    mimeType: row.mime_type || "audio/mpeg",
    coverImageUrl: coverImageUrl || row.cover_image_url || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const saveGeneratedAudio = api<SaveGeneratedAudioRequest, GeneratedAudioLibraryEntry>(
  {
    expose: true,
    method: "POST",
    path: "/story/audio-library/save",
    auth: true,
    bodyLimit: 15 * 1024 * 1024,
  },
  async (req) => {
    const auth = getAuthData();
    if (!auth?.userID) {
      throw APIError.unauthenticated("Authentication required.");
    }

    const sourceType = req.sourceType === "doku" ? "doku" : "story";
    const sourceId = cleanText(req.sourceId, "sourceId");
    const sourceTitle = cleanText(req.sourceTitle, "sourceTitle");
    const itemId = cleanText(req.itemId, "itemId");
    const itemTitle = cleanText(req.itemTitle, "itemTitle");
    const cacheKey = cleanText(req.cacheKey, "cacheKey");
    const audioDataUrl = cleanText(req.audioDataUrl, "audioDataUrl");
    const itemSubtitle = req.itemSubtitle?.trim() || null;
    const coverImageUrl = req.coverImageUrl?.trim() || null;
    const itemOrder = Number.isFinite(req.itemOrder) ? Math.floor(req.itemOrder as number) : null;

    const parsedAudio = parseDataUrl(audioDataUrl);
    if (!parsedAudio) {
      throw APIError.invalidArgument("Invalid audioDataUrl format.");
    }
    if (!parsedAudio.contentType.toLowerCase().startsWith("audio/")) {
      throw APIError.invalidArgument("audioDataUrl must be an audio data URL.");
    }

    const filenameHint = `${sanitizeFilePart(sourceTitle)}-${sanitizeFilePart(itemTitle)}`;
    const upload = await uploadBufferToBucket(parsedAudio.buffer, parsedAudio.contentType, {
      prefix: `audio/generated/${sanitizeFilePart(auth.userID)}/${sourceType}/${sanitizeFilePart(sourceId)}`,
      filenameHint,
    });

    if (!upload?.url) {
      throw APIError.failedPrecondition("Bucket upload unavailable.");
    }

    const existing = await storyDB.queryRow<LibraryRow>`
      SELECT *
      FROM generated_audio_library
      WHERE user_id = ${auth.userID}
        AND cache_key = ${cacheKey}
    `;

    const now = new Date();

    if (existing) {
      await storyDB.exec`
        UPDATE generated_audio_library
        SET source_type = ${sourceType},
            source_id = ${sourceId},
            source_title = ${sourceTitle},
            item_id = ${itemId},
            item_title = ${itemTitle},
            item_subtitle = ${itemSubtitle},
            item_order = ${itemOrder},
            audio_url = ${upload.url},
            mime_type = ${parsedAudio.contentType},
            cover_image_url = ${coverImageUrl},
            updated_at = ${now}
        WHERE id = ${existing.id}
      `;

      if (existing.audio_url && existing.audio_url !== upload.url) {
        await deleteFromBucket(existing.audio_url).catch(() => false);
      }

      const updated = await storyDB.queryRow<LibraryRow>`
        SELECT *
        FROM generated_audio_library
        WHERE id = ${existing.id}
      `;
      if (!updated) {
        throw APIError.internal("Failed to persist generated audio.");
      }
      return await mapRowToEntry(updated);
    }

    const id = crypto.randomUUID();
    await storyDB.exec`
      INSERT INTO generated_audio_library (
        id,
        user_id,
        source_type,
        source_id,
        source_title,
        item_id,
        item_title,
        item_subtitle,
        item_order,
        cache_key,
        audio_url,
        mime_type,
        cover_image_url,
        created_at,
        updated_at
      )
      VALUES (
        ${id},
        ${auth.userID},
        ${sourceType},
        ${sourceId},
        ${sourceTitle},
        ${itemId},
        ${itemTitle},
        ${itemSubtitle},
        ${itemOrder},
        ${cacheKey},
        ${upload.url},
        ${parsedAudio.contentType},
        ${coverImageUrl},
        ${now},
        ${now}
      )
    `;

    const inserted = await storyDB.queryRow<LibraryRow>`
      SELECT *
      FROM generated_audio_library
      WHERE id = ${id}
    `;
    if (!inserted) {
      throw APIError.internal("Failed to store generated audio entry.");
    }

    return await mapRowToEntry(inserted);
  }
);

export const listGeneratedAudio = api<ListGeneratedAudioRequest, ListGeneratedAudioResponse>(
  {
    expose: true,
    method: "GET",
    path: "/story/audio-library",
    auth: true,
  },
  async (req) => {
    const auth = getAuthData();
    if (!auth?.userID) {
      throw APIError.unauthenticated("Authentication required.");
    }

    const sourceType = req.sourceType === "story" || req.sourceType === "doku" ? req.sourceType : "all";
    const query = (req.query || "").trim().toLowerCase();
    const sort = req.sort === "oldest" ? "oldest" : "newest";
    const limit = clamp(req.limit ?? 100, 1, 200);
    const offset = clamp(req.offset ?? 0, 0, 10_000);

    const rows = await storyDB.queryAll<LibraryRow>`
      SELECT *
      FROM generated_audio_library
      WHERE user_id = ${auth.userID}
      ORDER BY created_at DESC
    `;

    let filtered = rows;
    if (sourceType !== "all") {
      filtered = filtered.filter((row) => row.source_type === sourceType);
    }
    if (query) {
      filtered = filtered.filter((row) => {
        const haystack = `${row.source_title} ${row.item_title} ${row.item_subtitle || ""}`.toLowerCase();
        return haystack.includes(query);
      });
    }
    if (sort === "oldest") {
      filtered = [...filtered].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    const total = filtered.length;
    const paged = filtered.slice(offset, offset + limit);
    const items = await Promise.all(paged.map((row) => mapRowToEntry(row)));
    const hasMore = offset + limit < total;

    return { items, total, hasMore };
  }
);

export const resolveGeneratedAudioByCacheKeys = api<
  ResolveGeneratedAudioRequest,
  ResolveGeneratedAudioResponse
>(
  {
    expose: true,
    method: "POST",
    path: "/story/audio-library/resolve",
    auth: true,
  },
  async (req) => {
    const auth = getAuthData();
    if (!auth?.userID) {
      throw APIError.unauthenticated("Authentication required.");
    }

    const normalizedKeys = Array.from(
      new Set((req.cacheKeys || []).map((key) => String(key || "").trim()).filter(Boolean))
    ).slice(0, 200);

    if (normalizedKeys.length === 0) {
      return { items: [] };
    }

    const resolvedItems: ResolveGeneratedAudioResponse["items"] = [];
    for (const cacheKey of normalizedKeys) {
      const row = await storyDB.queryRow<{
        cache_key: string;
        audio_url: string;
        mime_type: string;
      }>`
        SELECT cache_key, audio_url, mime_type
        FROM generated_audio_library
        WHERE user_id = ${auth.userID}
          AND cache_key = ${cacheKey}
      `;

      if (!row) continue;

      const resolvedUrl = await resolveObjectUrlForClient(row.audio_url);
      resolvedItems.push({
        cacheKey: row.cache_key,
        audioUrl: resolvedUrl || row.audio_url,
        mimeType: row.mime_type || "audio/mpeg",
      });
    }

    return { items: resolvedItems };
  }
);

export const deleteGeneratedAudio = api<{ entryId: string }, { deleted: boolean }>(
  {
    expose: true,
    method: "DELETE",
    path: "/story/audio-library/:entryId",
    auth: true,
  },
  async ({ entryId }) => {
    const auth = getAuthData();
    if (!auth?.userID) {
      throw APIError.unauthenticated("Authentication required.");
    }

    const id = cleanText(entryId, "entryId");
    const existing = await storyDB.queryRow<LibraryRow>`
      SELECT *
      FROM generated_audio_library
      WHERE id = ${id}
        AND user_id = ${auth.userID}
    `;

    if (!existing) {
      throw APIError.notFound("Audio entry not found.");
    }

    await storyDB.exec`
      DELETE FROM generated_audio_library
      WHERE id = ${id}
        AND user_id = ${auth.userID}
    `;

    if (existing.audio_url) {
      await deleteFromBucket(existing.audio_url).catch(() => false);
    }

    return { deleted: true };
  }
);
