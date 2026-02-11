import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { getAuthData } from "~encore/auth";
import { ai } from "~encore/clients";
import { ensureAdmin } from "../admin/authz";
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
  ageGroup?: string;
  category?: string;
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
  ageGroup?: string;
  category?: string;
  coverDescription: string;
  coverImageUrl?: string;
  audioDataUrl?: string;
  audioUrl?: string;
  filename?: string;
  isPublic?: boolean;
}

interface UpdateAudioDokuRequest {
  id: string;
  title?: string;
  description?: string;
  ageGroup?: string | null;
  category?: string | null;
  coverDescription?: string;
  coverImageUrl?: string | null;
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

type AudioDokuRow = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  age_group: string | null;
  category: string | null;
  cover_description: string | null;
  cover_image_url: string | null;
  audio_url: string;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
};

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

const normalizeOptionalText = (value?: string | null): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const normalizePatchText = (value?: string | null): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const normalizeRequiredPatch = (value: string | undefined, fieldName: string): string | undefined => {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) {
    throw APIError.invalidArgument(`${fieldName} cannot be empty.`);
  }
  return trimmed;
};

const buildCoverPrompt = (description: string, title: string): string => {
  const normalized = normalizeLanguage(description || title);
  return `Modern educational cover art for an audio documentary: ${normalized}. Soft gradients, friendly illustration, clean composition, no text in the image.`;
};

const resolveAudioDokuRow = async (row: AudioDokuRow): Promise<AudioDoku> => {
  const coverImageUrl = await resolveImageUrlForClient(row.cover_image_url || undefined);
  const audioUrl = await resolveObjectUrlForClient(row.audio_url);
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    ageGroup: row.age_group ?? undefined,
    category: row.category ?? undefined,
    coverDescription: row.cover_description ?? undefined,
    coverImageUrl: coverImageUrl ?? row.cover_image_url ?? undefined,
    audioUrl: audioUrl ?? row.audio_url,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
    const ageGroup = normalizeOptionalText(req.ageGroup);
    const category = normalizeOptionalText(req.category);
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
        age_group,
        category,
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
        ${ageGroup ?? null},
        ${category ?? null},
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
      ageGroup,
      category,
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

export const getAudioDoku = api<{ id: string }, AudioDoku>(
  { expose: true, method: "GET", path: "/audio-dokus/:id", auth: true },
  async ({ id }) => {
    const auth = getAuthData()!;
    if (auth.role !== "admin") {
      await assertAudioDokuAccess({
        userId: auth.userID,
        clerkToken: auth.clerkToken,
      });
    }

    const row = await dokuDB.queryRow<AudioDokuRow>`
      SELECT * FROM audio_dokus WHERE id = ${id}
    `;
    if (!row) {
      throw APIError.notFound("Audio Doku not found.");
    }

    if (!row.is_public && row.user_id !== auth.userID && auth.role !== "admin") {
      throw APIError.permissionDenied("You do not have permission to access this audio doku.");
    }

    return resolveAudioDokuRow(row);
  }
);

export const updateAudioDoku = api<UpdateAudioDokuRequest, AudioDoku>(
  {
    expose: true,
    method: "PUT",
    path: "/audio-dokus/:id",
    auth: true,
    // Allow fallback updates where audio is sent as data URL.
    bodyLimit: 80 * 1024 * 1024,
  },
  async (req) => {
    ensureAdmin();

    const existing = await dokuDB.queryRow<AudioDokuRow>`
      SELECT * FROM audio_dokus WHERE id = ${req.id}
    `;
    if (!existing) {
      throw APIError.notFound("Audio Doku not found.");
    }

    const titlePatch = normalizeRequiredPatch(req.title, "Title");
    const descriptionPatch = normalizeRequiredPatch(req.description, "Description");
    const coverDescriptionPatch = normalizeRequiredPatch(req.coverDescription, "Cover description");
    let audioUrlPatch = normalizeRequiredPatch(req.audioUrl, "Audio URL");
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
        filenameHint: sanitizeTitle(
          titlePatch ||
            inferTitleFromFilename(req.filename) ||
            existing.title ||
            "audio-doku"
        ),
      });
      if (!uploaded) {
        throw APIError.failedPrecondition("Audio upload failed or bucket not configured.");
      }
      audioUrlPatch = uploaded.url;
    }

    const hasAgeGroupPatch = req.ageGroup !== undefined;
    const ageGroupPatch = normalizePatchText(req.ageGroup);

    const hasCategoryPatch = req.category !== undefined;
    const categoryPatch = normalizePatchText(req.category);

    const hasCoverImagePatch = req.coverImageUrl !== undefined;
    let coverImagePatch = normalizePatchText(req.coverImageUrl);
    if (coverImagePatch && coverImagePatch !== null) {
      const uploadedCover = await maybeUploadImageUrlToBucket(coverImagePatch, {
        prefix: "images/audio-dokus",
        filenameHint: sanitizeTitle(titlePatch || existing.title),
        uploadMode: "always",
      });
      coverImagePatch = uploadedCover?.url ?? coverImagePatch;
    }

    const now = new Date();
    await dokuDB.exec`
      UPDATE audio_dokus
      SET
        title = COALESCE(${titlePatch}, title),
        description = COALESCE(${descriptionPatch}, description),
        age_group = CASE WHEN ${hasAgeGroupPatch} THEN ${ageGroupPatch} ELSE age_group END,
        category = CASE WHEN ${hasCategoryPatch} THEN ${categoryPatch} ELSE category END,
        cover_description = COALESCE(${coverDescriptionPatch}, cover_description),
        cover_image_url = CASE WHEN ${hasCoverImagePatch} THEN ${coverImagePatch} ELSE cover_image_url END,
        audio_url = COALESCE(${audioUrlPatch}, audio_url),
        is_public = COALESCE(${req.isPublic}, is_public),
        updated_at = ${now}
      WHERE id = ${req.id}
    `;

    const updated = await dokuDB.queryRow<AudioDokuRow>`
      SELECT * FROM audio_dokus WHERE id = ${req.id}
    `;
    if (!updated) {
      throw APIError.notFound("Audio Doku not found.");
    }

    return resolveAudioDokuRow(updated);
  }
);

export const deleteAudioDoku = api<{ id: string }, void>(
  { expose: true, method: "DELETE", path: "/audio-dokus/:id", auth: true },
  async ({ id }) => {
    ensureAdmin();

    const existing = await dokuDB.queryRow<{ id: string }>`
      SELECT id FROM audio_dokus WHERE id = ${id}
    `;
    if (!existing) {
      throw APIError.notFound("Audio Doku not found.");
    }

    await dokuDB.exec`
      DELETE FROM audio_dokus WHERE id = ${id}
    `;
  }
);

export const listAudioDokus = api<ListAudioDokusRequest, ListAudioDokusResponse>(
  { expose: true, method: "GET", path: "/audio-dokus", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    const isAdmin = auth.role === "admin";
    if (!isAdmin) {
      await assertAudioDokuAccess({
        userId: auth.userID,
        clerkToken: auth.clerkToken,
      });
    }

    const limit = req.limit || 12;
    const offset = req.offset || 0;

    const countResult = isAdmin
      ? await dokuDB.queryRow<{ count: number }>`
          SELECT COUNT(*) as count FROM audio_dokus
        `
      : await dokuDB.queryRow<{ count: number }>`
          SELECT COUNT(*) as count FROM audio_dokus WHERE is_public = true
        `;
    const total = countResult?.count || 0;

    const rows = isAdmin
      ? await dokuDB.queryAll<AudioDokuRow>`
          SELECT * FROM audio_dokus
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      : await dokuDB.queryAll<AudioDokuRow>`
          SELECT * FROM audio_dokus
          WHERE is_public = true
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;

    const audioDokus = await Promise.all(rows.map((row) => resolveAudioDokuRow(row)));

    const hasMore = offset + limit < total;

    return { audioDokus, total, hasMore };
  }
);
