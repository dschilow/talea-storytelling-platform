import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { getAuthData } from "~encore/auth";
import { ai } from "~encore/clients";
import { normalizeLanguage } from "../story/avatar-image-optimization";
import {
  maybeUploadImageUrlToBucket,
  resolveImageUrlForClient,
  resolveObjectUrlForClient,
  createPresignedUploadUrl,
  uploadBufferToBucket,
} from "../helpers/bucket-storage";
import { assertAudioDokuAccess, claimGenerationUsage } from "../helpers/billing";

const dokuDB = SQLDatabase.named("doku");

export interface AudioDoku {
  id: string;
  userId: string;
  title: string;
  description: string;
  coverDescription?: string;
  coverImageUrl?: string;
  audioUrl: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateAudioDokuRequest {
  title?: string;
  description: string;
  coverDescription: string;
  coverImageUrl?: string;
  audioDataUrl?: string;
  audioUrl?: string;
  filename?: string;
  isPublic?: boolean;
}

interface ListAudioDokusRequest {
  limit?: number;
  offset?: number;
}

interface ListAudioDokusResponse {
  audioDokus: AudioDoku[];
  total: number;
  hasMore: boolean;
}

interface CreateAudioUploadUrlRequest {
  filename: string;
  contentType: string;
}

interface CreateAudioUploadUrlResponse {
  uploadUrl: string;
  audioUrl: string;
}

interface GenerateAudioCoverRequest {
  title?: string;
  coverDescription: string;
}

interface GenerateAudioCoverResponse {
  coverImageUrl: string;
}

const parseDataUrl = (dataUrl: string): { contentType: string; buffer: Buffer } | null => {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const contentType = match[1].trim();
  const base64 = match[2];
  if (!contentType || !base64) return null;
  return { contentType, buffer: Buffer.from(base64, "base64") };
};

const sanitizeTitle = (value: string): string => {
  return value.replace(/\s+/g, " ").replace(/[^\w\s-]/g, "").trim();
};

const inferTitleFromFilename = (filename?: string): string | undefined => {
  if (!filename) return undefined;
  const cleaned = filename.replace(/\.[^/.]+$/, "");
  const trimmed = cleaned.trim();
  return trimmed || undefined;
};

const buildCoverPrompt = (description: string, title: string): string => {
  const normalized = normalizeLanguage(description || title);
  return `Modern educational cover art for an audio documentary: ${normalized}. Soft gradients, friendly illustration, clean composition, no text in the image.`;
};

export const createAudioUploadUrl = api<CreateAudioUploadUrlRequest, CreateAudioUploadUrlResponse>(
  { expose: true, method: "POST", path: "/audio-dokus/upload-url", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    await assertAudioDokuAccess({
      userId: auth.userID,
      clerkToken: auth.clerkToken,
    });

    const contentType = req.contentType?.trim();
    const filename = req.filename?.trim();

    if (!filename) {
      throw APIError.invalidArgument("Filename is required.");
    }
    if (!contentType || !contentType.startsWith("audio/")) {
      throw APIError.invalidArgument("Invalid audio content type.");
    }

    const presigned = await createPresignedUploadUrl(contentType, {
      prefix: "audio/dokus",
      filenameHint: sanitizeTitle(inferTitleFromFilename(filename) || filename),
    });

    if (!presigned) {
      throw APIError.failedPrecondition("Audio upload not available (bucket not configured).");
    }

    return {
      uploadUrl: presigned.uploadUrl,
      audioUrl: presigned.storedUrl,
    };
  }
);

export const createAudioDoku = api<CreateAudioDokuRequest, AudioDoku>(
  {
    expose: true,
    method: "POST",
    path: "/audio-dokus",
    auth: true,
    // Audio uploads may exceed Encore's default 2MiB body limit (esp. if sent as data URLs).
    bodyLimit: 80 * 1024 * 1024,
  },
  async (req) => {
    const auth = getAuthData()!;
    await assertAudioDokuAccess({
      userId: auth.userID,
      clerkToken: auth.clerkToken,
    });

    const description = req.description?.trim();
    const coverDescription = req.coverDescription?.trim();

    if (!description) {
      throw APIError.invalidArgument("Description is required.");
    }
    if (!coverDescription) {
      throw APIError.invalidArgument("Cover description is required.");
    }

    let audioUrl = req.audioUrl?.trim();
    if (req.audioDataUrl) {
      const parsed = parseDataUrl(req.audioDataUrl);
      if (!parsed) {
        throw APIError.invalidArgument("Invalid audio data format.");
      }
      if (!parsed.contentType.startsWith("audio/")) {
        throw APIError.invalidArgument("Uploaded file is not an audio file.");
      }
      const uploaded = await uploadBufferToBucket(parsed.buffer, parsed.contentType, {
        prefix: "audio/dokus",
        filenameHint: sanitizeTitle(req.title || inferTitleFromFilename(req.filename) || "audio-doku"),
      });
      if (!uploaded) {
        throw APIError.failedPrecondition("Audio upload failed or bucket not configured.");
      }
      audioUrl = uploaded.url;
    }

    if (!audioUrl) {
      throw APIError.invalidArgument("Audio file is required.");
    }

    await claimGenerationUsage({
      userId: auth.userID,
      kind: "audio",
      clerkToken: auth.clerkToken,
    });

    const title =
      (req.title && req.title.trim()) ||
      inferTitleFromFilename(req.filename) ||
      "Audio Doku";

    let coverImageUrl: string | undefined = req.coverImageUrl?.trim() || undefined;
    if (!coverImageUrl) {
      try {
        const prompt = buildCoverPrompt(coverDescription, title);
        const img = await ai.generateImage({
          prompt,
          width: 1024,
          height: 1024,
          steps: 4,
          CFGScale: 4,
          outputFormat: "JPEG",
        });
        coverImageUrl = img.imageUrl;
      } catch (error) {
        console.warn("[AudioDoku] Cover generation failed:", error);
      }
    }

    if (coverImageUrl) {
      const uploadedCover = await maybeUploadImageUrlToBucket(coverImageUrl, {
        prefix: "images/audio-dokus",
        filenameHint: sanitizeTitle(title),
        uploadMode: "always",
      });
      coverImageUrl = uploadedCover?.url ?? coverImageUrl;
    }

    const now = new Date();
    const id = crypto.randomUUID();
    const isPublic = req.isPublic ?? true;

    await dokuDB.exec`
      INSERT INTO audio_dokus (
        id,
        user_id,
        title,
        description,
        cover_description,
        cover_image_url,
        audio_url,
        is_public,
        created_at,
        updated_at
      )
      VALUES (
        ${id},
        ${auth.userID},
        ${title},
        ${description},
        ${coverDescription},
        ${coverImageUrl ?? null},
        ${audioUrl},
        ${isPublic},
        ${now},
        ${now}
      )
    `;

    const resolvedCoverImageUrl = await resolveImageUrlForClient(coverImageUrl);
    const resolvedAudioUrl = await resolveObjectUrlForClient(audioUrl);

    return {
      id,
      userId: auth.userID,
      title,
      description,
      coverDescription,
      coverImageUrl: resolvedCoverImageUrl ?? coverImageUrl,
      audioUrl: resolvedAudioUrl ?? audioUrl,
      isPublic,
      createdAt: now,
      updatedAt: now,
    };
  }
);

export const generateAudioCover = api<GenerateAudioCoverRequest, GenerateAudioCoverResponse>(
  { expose: true, method: "POST", path: "/audio-dokus/generate-cover", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    await assertAudioDokuAccess({
      userId: auth.userID,
      clerkToken: auth.clerkToken,
    });

    const coverDescription = req.coverDescription?.trim();
    if (!coverDescription) {
      throw APIError.invalidArgument("Cover description is required.");
    }

    const title = req.title?.trim() || "Audio Doku";
    const prompt = buildCoverPrompt(coverDescription, title);

    try {
      const img = await ai.generateImage({
        prompt,
        width: 1024,
        height: 1024,
        steps: 4,
        CFGScale: 4,
        outputFormat: "JPEG",
      });

      let coverImageUrl = img.imageUrl;
      const uploadedCover = await maybeUploadImageUrlToBucket(coverImageUrl, {
        prefix: "images/audio-dokus",
        filenameHint: sanitizeTitle(title),
        uploadMode: "always",
      });
      coverImageUrl = uploadedCover?.url ?? coverImageUrl;

      const resolvedCover = await resolveImageUrlForClient(coverImageUrl);
      return { coverImageUrl: resolvedCover ?? coverImageUrl };
    } catch (error) {
      console.warn("[AudioDoku] Cover generation failed:", error);
      throw APIError.failedPrecondition("Cover generation failed.");
    }
  }
);

export const listAudioDokus = api<ListAudioDokusRequest, ListAudioDokusResponse>(
  { expose: true, method: "GET", path: "/audio-dokus", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    await assertAudioDokuAccess({
      userId: auth.userID,
      clerkToken: auth.clerkToken,
    });

    const limit = req.limit || 12;
    const offset = req.offset || 0;

    const countResult = await dokuDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM audio_dokus WHERE is_public = true
    `;
    const total = countResult?.count || 0;

    const rows = await dokuDB.queryAll<{
      id: string;
      user_id: string;
      title: string;
      description: string;
      cover_description: string | null;
      cover_image_url: string | null;
      audio_url: string;
      is_public: boolean;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT * FROM audio_dokus
      WHERE is_public = true
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const audioDokus = await Promise.all(
      rows.map(async (row) => {
        const coverImageUrl = await resolveImageUrlForClient(row.cover_image_url || undefined);
        const audioUrl = await resolveObjectUrlForClient(row.audio_url);
        return {
          id: row.id,
          userId: row.user_id,
          title: row.title,
          description: row.description,
          coverDescription: row.cover_description ?? undefined,
          coverImageUrl: coverImageUrl ?? row.cover_image_url ?? undefined,
          audioUrl: audioUrl ?? row.audio_url,
          isPublic: row.is_public,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      })
    );

    const hasMore = offset + limit < total;

    return { audioDokus, total, hasMore };
  }
);
