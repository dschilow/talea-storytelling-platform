import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { storyDB } from "./db";
import { runwareGenerateImage } from "../ai/image-generation";
import {
  maybeUploadImageUrlToBucket,
  resolveImageUrlForClient,
} from "../helpers/bucket-storage";

type StudioSeriesStatus = "draft" | "active" | "archived";
type StudioEpisodeStatus =
  | "draft"
  | "text_ready"
  | "text_approved"
  | "scenes_ready"
  | "images_ready"
  | "composed"
  | "published";
type StudioSceneStatus = "pending" | "ready";

type StudioSeries = {
  id: string;
  userId: string;
  title: string;
  logline?: string;
  description?: string;
  canonicalPrompt?: string;
  status: StudioSeriesStatus;
  createdAt: Date;
  updatedAt: Date;
};

type StudioCharacter = {
  id: string;
  seriesId: string;
  userId: string;
  name: string;
  role?: string;
  description?: string;
  generationPrompt: string;
  imagePrompt: string;
  visualProfile?: Record<string, any>;
  imageUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type StudioEpisode = {
  id: string;
  seriesId: string;
  userId: string;
  episodeNumber: number;
  title: string;
  summary?: string;
  storyText?: string;
  approvedStoryText?: string;
  selectedCharacterIds: string[];
  status: StudioEpisodeStatus;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

type StudioEpisodeScene = {
  id: string;
  episodeId: string;
  seriesId: string;
  sceneOrder: number;
  title: string;
  sceneText: string;
  participantCharacterIds: string[];
  imagePrompt?: string;
  imageUrl?: string;
  status: StudioSceneStatus;
  createdAt: Date;
  updatedAt: Date;
};

let studioTablesEnsured = false;

function requireUserId(): string {
  const auth = getAuthData();
  if (!auth?.userID) {
    throw APIError.unauthenticated("Missing authenticated user");
  }
  return auth.userID;
}

function normalizeIds(ids: string[] | undefined): string[] {
  const unique = new Set<string>();
  for (const raw of ids || []) {
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (!value) continue;
    unique.add(value);
  }
  return Array.from(unique);
}

function parseJsonObject(value: unknown): Record<string, any> | undefined {
  if (!value) return undefined;
  if (typeof value === "object") return value as Record<string, any>;
  if (typeof value !== "string") return undefined;

  try {
    return JSON.parse(value) as Record<string, any>;
  } catch {
    return undefined;
  }
}

async function ensureStudioTables(): Promise<void> {
  if (studioTablesEnsured) return;

  try {
    await storyDB.exec`
      CREATE TABLE IF NOT EXISTS studio_series (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        logline TEXT,
        description TEXT,
        canonical_prompt TEXT,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await storyDB.exec`
      CREATE INDEX IF NOT EXISTS idx_studio_series_user_id
      ON studio_series(user_id)
    `;
    await storyDB.exec`
      CREATE INDEX IF NOT EXISTS idx_studio_series_status
      ON studio_series(status)
    `;

    await storyDB.exec`
      CREATE TABLE IF NOT EXISTS studio_characters (
        id TEXT PRIMARY KEY,
        series_id TEXT NOT NULL REFERENCES studio_series(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT,
        description TEXT,
        generation_prompt TEXT NOT NULL,
        image_prompt TEXT NOT NULL,
        visual_profile JSONB,
        image_url TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await storyDB.exec`
      CREATE INDEX IF NOT EXISTS idx_studio_characters_series_id
      ON studio_characters(series_id)
    `;
    await storyDB.exec`
      CREATE INDEX IF NOT EXISTS idx_studio_characters_user_id
      ON studio_characters(user_id)
    `;
    await storyDB.exec`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_studio_characters_series_name_unique
      ON studio_characters(series_id, lower(name))
    `;

    await storyDB.exec`
      CREATE TABLE IF NOT EXISTS studio_episodes (
        id TEXT PRIMARY KEY,
        series_id TEXT NOT NULL REFERENCES studio_series(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        episode_number INTEGER NOT NULL CHECK (episode_number > 0),
        title TEXT NOT NULL,
        summary TEXT,
        story_text TEXT,
        approved_story_text TEXT,
        selected_character_ids TEXT[] NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'text_ready', 'text_approved', 'scenes_ready', 'images_ready', 'composed', 'published')),
        published_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (id, series_id)
      )
    `;
    await storyDB.exec`
      CREATE INDEX IF NOT EXISTS idx_studio_episodes_series_id
      ON studio_episodes(series_id)
    `;
    await storyDB.exec`
      CREATE INDEX IF NOT EXISTS idx_studio_episodes_user_id
      ON studio_episodes(user_id)
    `;
    await storyDB.exec`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_studio_episodes_series_number_unique
      ON studio_episodes(series_id, episode_number)
    `;

    await storyDB.exec`
      CREATE TABLE IF NOT EXISTS studio_episode_scenes (
        id TEXT PRIMARY KEY,
        episode_id TEXT NOT NULL,
        series_id TEXT NOT NULL,
        scene_order INTEGER NOT NULL CHECK (scene_order > 0),
        title TEXT NOT NULL,
        scene_text TEXT NOT NULL,
        participant_character_ids TEXT[] NOT NULL DEFAULT '{}',
        image_prompt TEXT,
        image_url TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready')),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (episode_id, series_id) REFERENCES studio_episodes(id, series_id) ON DELETE CASCADE
      )
    `;
    await storyDB.exec`
      CREATE INDEX IF NOT EXISTS idx_studio_episode_scenes_episode_id
      ON studio_episode_scenes(episode_id)
    `;
    await storyDB.exec`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_studio_episode_scenes_episode_order_unique
      ON studio_episode_scenes(episode_id, scene_order)
    `;

    studioTablesEnsured = true;
  } catch (error) {
    console.error("[Studio] Failed ensuring studio tables:", error);
    throw APIError.internal("Failed to initialize Talea Studio schema");
  }
}

async function getOwnedSeriesOrThrow(
  seriesId: string,
  userId: string
): Promise<{
  id: string;
  user_id: string;
  title: string;
  logline: string | null;
  description: string | null;
  canonical_prompt: string | null;
  status: StudioSeriesStatus;
  created_at: Date;
  updated_at: Date;
}> {
  const row = await storyDB.queryRow<{
    id: string;
    user_id: string;
    title: string;
    logline: string | null;
    description: string | null;
    canonical_prompt: string | null;
    status: StudioSeriesStatus;
    created_at: Date;
    updated_at: Date;
  }>`
    SELECT id, user_id, title, logline, description, canonical_prompt, status, created_at, updated_at
    FROM studio_series
    WHERE id = ${seriesId}
  `;

  if (!row) {
    throw APIError.notFound("Studio series not found");
  }
  if (row.user_id !== userId) {
    throw APIError.permissionDenied("You do not have access to this studio series");
  }
  return row;
}

async function getOwnedEpisodeOrThrow(
  seriesId: string,
  episodeId: string,
  userId: string
): Promise<{
  id: string;
  series_id: string;
  user_id: string;
  episode_number: number;
  title: string;
  summary: string | null;
  story_text: string | null;
  approved_story_text: string | null;
  selected_character_ids: string[];
  status: StudioEpisodeStatus;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}> {
  const row = await storyDB.queryRow<{
    id: string;
    series_id: string;
    user_id: string;
    episode_number: number;
    title: string;
    summary: string | null;
    story_text: string | null;
    approved_story_text: string | null;
    selected_character_ids: string[];
    status: StudioEpisodeStatus;
    published_at: Date | null;
    created_at: Date;
    updated_at: Date;
  }>`
    SELECT id, series_id, user_id, episode_number, title, summary, story_text, approved_story_text, selected_character_ids, status, published_at, created_at, updated_at
    FROM studio_episodes
    WHERE id = ${episodeId}
  `;

  if (!row) {
    throw APIError.notFound("Studio episode not found");
  }
  if (row.series_id !== seriesId) {
    throw APIError.invalidArgument("Episode does not belong to the requested series");
  }
  if (row.user_id !== userId) {
    throw APIError.permissionDenied("You do not have access to this studio episode");
  }
  return row;
}

async function assertCharactersBelongToSeries(
  seriesId: string,
  characterIds: string[]
): Promise<void> {
  for (const characterId of characterIds) {
    const row = await storyDB.queryRow<{ id: string }>`
      SELECT id
      FROM studio_characters
      WHERE id = ${characterId} AND series_id = ${seriesId} AND is_active = TRUE
    `;

    if (!row) {
      throw APIError.invalidArgument(
        `Character ${characterId} is not available in this Talea Studio series`
      );
    }
  }
}

function mapSeriesRow(row: {
  id: string;
  user_id: string;
  title: string;
  logline: string | null;
  description: string | null;
  canonical_prompt: string | null;
  status: StudioSeriesStatus;
  created_at: Date;
  updated_at: Date;
}): StudioSeries {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    logline: row.logline || undefined,
    description: row.description || undefined,
    canonicalPrompt: row.canonical_prompt || undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function mapCharacterRow(row: {
  id: string;
  series_id: string;
  user_id: string;
  name: string;
  role: string | null;
  description: string | null;
  generation_prompt: string;
  image_prompt: string;
  visual_profile: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}): Promise<StudioCharacter> {
  return {
    id: row.id,
    seriesId: row.series_id,
    userId: row.user_id,
    name: row.name,
    role: row.role || undefined,
    description: row.description || undefined,
    generationPrompt: row.generation_prompt,
    imagePrompt: row.image_prompt,
    visualProfile: parseJsonObject(row.visual_profile),
    imageUrl: (await resolveImageUrlForClient(row.image_url || undefined)) || row.image_url || undefined,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEpisodeRow(row: {
  id: string;
  series_id: string;
  user_id: string;
  episode_number: number;
  title: string;
  summary: string | null;
  story_text: string | null;
  approved_story_text: string | null;
  selected_character_ids: string[];
  status: StudioEpisodeStatus;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}): StudioEpisode {
  return {
    id: row.id,
    seriesId: row.series_id,
    userId: row.user_id,
    episodeNumber: row.episode_number,
    title: row.title,
    summary: row.summary || undefined,
    storyText: row.story_text || undefined,
    approvedStoryText: row.approved_story_text || undefined,
    selectedCharacterIds: row.selected_character_ids || [],
    status: row.status,
    publishedAt: row.published_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function mapSceneRow(row: {
  id: string;
  episode_id: string;
  series_id: string;
  scene_order: number;
  title: string;
  scene_text: string;
  participant_character_ids: string[];
  image_prompt: string | null;
  image_url: string | null;
  status: StudioSceneStatus;
  created_at: Date;
  updated_at: Date;
}): Promise<StudioEpisodeScene> {
  return {
    id: row.id,
    episodeId: row.episode_id,
    seriesId: row.series_id,
    sceneOrder: row.scene_order,
    title: row.title,
    sceneText: row.scene_text,
    participantCharacterIds: row.participant_character_ids || [],
    imagePrompt: row.image_prompt || undefined,
    imageUrl: (await resolveImageUrlForClient(row.image_url || undefined)) || row.image_url || undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface CreateStudioSeriesRequest {
  title: string;
  logline?: string;
  description?: string;
  canonicalPrompt?: string;
  status?: StudioSeriesStatus;
}

interface StudioSeriesPathRequest {
  seriesId: string;
}

interface CreateStudioCharacterRequest extends StudioSeriesPathRequest {
  name: string;
  role?: string;
  description?: string;
  generationPrompt: string;
  imagePrompt?: string;
  visualProfile?: Record<string, any>;
  autoGenerateImage?: boolean;
}

interface CreateStudioEpisodeRequest extends StudioSeriesPathRequest {
  episodeNumber: number;
  title: string;
  summary?: string;
  selectedCharacterIds?: string[];
}

interface StudioEpisodePathRequest extends StudioSeriesPathRequest {
  episodeId: string;
}

interface CreateStudioSceneRequest extends StudioEpisodePathRequest {
  sceneOrder: number;
  title: string;
  sceneText: string;
  participantCharacterIds?: string[];
  imagePrompt?: string;
}

export const listStudioSeries = api<{}, { series: StudioSeries[] }>(
  { expose: true, method: "GET", path: "/story/studio/series", auth: true },
  async () => {
    await ensureStudioTables();
    const userId = requireUserId();

    const rows = await storyDB.queryAll<{
      id: string;
      user_id: string;
      title: string;
      logline: string | null;
      description: string | null;
      canonical_prompt: string | null;
      status: StudioSeriesStatus;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT id, user_id, title, logline, description, canonical_prompt, status, created_at, updated_at
      FROM studio_series
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC
    `;

    return { series: rows.map(mapSeriesRow) };
  }
);

export const createStudioSeries = api<CreateStudioSeriesRequest, StudioSeries>(
  { expose: true, method: "POST", path: "/story/studio/series", auth: true },
  async (req) => {
    await ensureStudioTables();
    const userId = requireUserId();
    const now = new Date();
    const id = crypto.randomUUID();

    const title = req.title?.trim();
    if (!title) {
      throw APIError.invalidArgument("Series title is required");
    }

    const status: StudioSeriesStatus = req.status || "draft";
    if (!["draft", "active", "archived"].includes(status)) {
      throw APIError.invalidArgument("Invalid series status");
    }

    await storyDB.exec`
      INSERT INTO studio_series (
        id, user_id, title, logline, description, canonical_prompt, status, created_at, updated_at
      ) VALUES (
        ${id}, ${userId}, ${title}, ${req.logline?.trim() || null}, ${req.description?.trim() || null}, ${req.canonicalPrompt?.trim() || null}, ${status}, ${now}, ${now}
      )
    `;

    const row = await storyDB.queryRow<{
      id: string;
      user_id: string;
      title: string;
      logline: string | null;
      description: string | null;
      canonical_prompt: string | null;
      status: StudioSeriesStatus;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT id, user_id, title, logline, description, canonical_prompt, status, created_at, updated_at
      FROM studio_series
      WHERE id = ${id}
    `;

    if (!row) {
      throw APIError.internal("Failed to create studio series");
    }

    return mapSeriesRow(row);
  }
);

export const getStudioSeries = api<StudioSeriesPathRequest, StudioSeries>(
  { expose: true, method: "GET", path: "/story/studio/series/:seriesId", auth: true },
  async (req) => {
    await ensureStudioTables();
    const userId = requireUserId();
    const row = await getOwnedSeriesOrThrow(req.seriesId, userId);
    return mapSeriesRow(row);
  }
);

export const listStudioCharacters = api<StudioSeriesPathRequest, { characters: StudioCharacter[] }>(
  { expose: true, method: "GET", path: "/story/studio/series/:seriesId/characters", auth: true },
  async (req) => {
    await ensureStudioTables();
    const userId = requireUserId();
    await getOwnedSeriesOrThrow(req.seriesId, userId);

    const rows = await storyDB.queryAll<{
      id: string;
      series_id: string;
      user_id: string;
      name: string;
      role: string | null;
      description: string | null;
      generation_prompt: string;
      image_prompt: string;
      visual_profile: string | null;
      image_url: string | null;
      is_active: boolean;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT id, series_id, user_id, name, role, description, generation_prompt, image_prompt, visual_profile, image_url, is_active, created_at, updated_at
      FROM studio_characters
      WHERE series_id = ${req.seriesId}
      ORDER BY created_at ASC
    `;

    const characters = await Promise.all(rows.map(mapCharacterRow));
    return { characters };
  }
);

export const createStudioCharacter = api<CreateStudioCharacterRequest, StudioCharacter>(
  { expose: true, method: "POST", path: "/story/studio/series/:seriesId/characters", auth: true },
  async (req) => {
    await ensureStudioTables();
    const userId = requireUserId();
    await getOwnedSeriesOrThrow(req.seriesId, userId);

    const name = req.name?.trim();
    if (!name) {
      throw APIError.invalidArgument("Character name is required");
    }

    const generationPrompt = req.generationPrompt?.trim();
    if (!generationPrompt) {
      throw APIError.invalidArgument("generationPrompt is required");
    }

    const imagePrompt = req.imagePrompt?.trim() || generationPrompt;
    const now = new Date();
    const id = crypto.randomUUID();

    let imageUrl: string | undefined;
    if (req.autoGenerateImage !== false) {
      const generated = await runwareGenerateImage({
        prompt: imagePrompt,
        negativePrompt:
          "text, watermark, logo, blurry, distorted face, extra limbs, duplicate character",
        width: 1024,
        height: 1024,
      });

      const uploaded = await maybeUploadImageUrlToBucket(generated.imageUrl, {
        prefix: "images/studio-characters",
        filenameHint: `studio-character-${id}`,
        uploadMode: "always",
      });
      imageUrl = uploaded?.url || generated.imageUrl;
    }

    const visualProfile = req.visualProfile || {
      description: req.description?.trim() || "",
      imagePrompt,
    };

    try {
      await storyDB.exec`
        INSERT INTO studio_characters (
          id, series_id, user_id, name, role, description, generation_prompt, image_prompt, visual_profile, image_url, is_active, created_at, updated_at
        ) VALUES (
          ${id},
          ${req.seriesId},
          ${userId},
          ${name},
          ${req.role?.trim() || null},
          ${req.description?.trim() || null},
          ${generationPrompt},
          ${imagePrompt},
          ${JSON.stringify(visualProfile)},
          ${imageUrl || null},
          TRUE,
          ${now},
          ${now}
        )
      `;
    } catch (error: any) {
      if (String(error?.message || "").includes("idx_studio_characters_series_name_unique")) {
        throw APIError.invalidArgument("Character name already exists in this series");
      }
      throw error;
    }

    const row = await storyDB.queryRow<{
      id: string;
      series_id: string;
      user_id: string;
      name: string;
      role: string | null;
      description: string | null;
      generation_prompt: string;
      image_prompt: string;
      visual_profile: string | null;
      image_url: string | null;
      is_active: boolean;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT id, series_id, user_id, name, role, description, generation_prompt, image_prompt, visual_profile, image_url, is_active, created_at, updated_at
      FROM studio_characters
      WHERE id = ${id}
    `;

    if (!row) {
      throw APIError.internal("Failed to create studio character");
    }
    return await mapCharacterRow(row);
  }
);

export const listStudioEpisodes = api<StudioSeriesPathRequest, { episodes: StudioEpisode[] }>(
  { expose: true, method: "GET", path: "/story/studio/series/:seriesId/episodes", auth: true },
  async (req) => {
    await ensureStudioTables();
    const userId = requireUserId();
    await getOwnedSeriesOrThrow(req.seriesId, userId);

    const rows = await storyDB.queryAll<{
      id: string;
      series_id: string;
      user_id: string;
      episode_number: number;
      title: string;
      summary: string | null;
      story_text: string | null;
      approved_story_text: string | null;
      selected_character_ids: string[];
      status: StudioEpisodeStatus;
      published_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT id, series_id, user_id, episode_number, title, summary, story_text, approved_story_text, selected_character_ids, status, published_at, created_at, updated_at
      FROM studio_episodes
      WHERE series_id = ${req.seriesId}
      ORDER BY episode_number ASC
    `;

    return { episodes: rows.map(mapEpisodeRow) };
  }
);

export const createStudioEpisode = api<CreateStudioEpisodeRequest, StudioEpisode>(
  { expose: true, method: "POST", path: "/story/studio/series/:seriesId/episodes", auth: true },
  async (req) => {
    await ensureStudioTables();
    const userId = requireUserId();
    await getOwnedSeriesOrThrow(req.seriesId, userId);

    const title = req.title?.trim();
    if (!title) {
      throw APIError.invalidArgument("Episode title is required");
    }
    if (!Number.isInteger(req.episodeNumber) || req.episodeNumber <= 0) {
      throw APIError.invalidArgument("episodeNumber must be a positive integer");
    }

    const selectedCharacterIds = normalizeIds(req.selectedCharacterIds);
    await assertCharactersBelongToSeries(req.seriesId, selectedCharacterIds);

    const id = crypto.randomUUID();
    const now = new Date();

    try {
      await storyDB.exec`
        INSERT INTO studio_episodes (
          id, series_id, user_id, episode_number, title, summary, selected_character_ids, status, created_at, updated_at
        ) VALUES (
          ${id},
          ${req.seriesId},
          ${userId},
          ${req.episodeNumber},
          ${title},
          ${req.summary?.trim() || null},
          ${selectedCharacterIds},
          'draft',
          ${now},
          ${now}
        )
      `;
    } catch (error: any) {
      if (String(error?.message || "").includes("idx_studio_episodes_series_number_unique")) {
        throw APIError.invalidArgument("Episode number already exists in this series");
      }
      throw error;
    }

    const row = await storyDB.queryRow<{
      id: string;
      series_id: string;
      user_id: string;
      episode_number: number;
      title: string;
      summary: string | null;
      story_text: string | null;
      approved_story_text: string | null;
      selected_character_ids: string[];
      status: StudioEpisodeStatus;
      published_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT id, series_id, user_id, episode_number, title, summary, story_text, approved_story_text, selected_character_ids, status, published_at, created_at, updated_at
      FROM studio_episodes
      WHERE id = ${id}
    `;

    if (!row) {
      throw APIError.internal("Failed to create studio episode");
    }
    return mapEpisodeRow(row);
  }
);

export const listStudioEpisodeScenes = api<StudioEpisodePathRequest, { scenes: StudioEpisodeScene[] }>(
  { expose: true, method: "GET", path: "/story/studio/series/:seriesId/episodes/:episodeId/scenes", auth: true },
  async (req) => {
    await ensureStudioTables();
    const userId = requireUserId();
    await getOwnedSeriesOrThrow(req.seriesId, userId);
    await getOwnedEpisodeOrThrow(req.seriesId, req.episodeId, userId);

    const rows = await storyDB.queryAll<{
      id: string;
      episode_id: string;
      series_id: string;
      scene_order: number;
      title: string;
      scene_text: string;
      participant_character_ids: string[];
      image_prompt: string | null;
      image_url: string | null;
      status: StudioSceneStatus;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT id, episode_id, series_id, scene_order, title, scene_text, participant_character_ids, image_prompt, image_url, status, created_at, updated_at
      FROM studio_episode_scenes
      WHERE episode_id = ${req.episodeId}
      ORDER BY scene_order ASC
    `;

    return { scenes: await Promise.all(rows.map(mapSceneRow)) };
  }
);

export const createStudioEpisodeScene = api<CreateStudioSceneRequest, StudioEpisodeScene>(
  { expose: true, method: "POST", path: "/story/studio/series/:seriesId/episodes/:episodeId/scenes", auth: true },
  async (req) => {
    await ensureStudioTables();
    const userId = requireUserId();
    await getOwnedSeriesOrThrow(req.seriesId, userId);
    await getOwnedEpisodeOrThrow(req.seriesId, req.episodeId, userId);

    if (!Number.isInteger(req.sceneOrder) || req.sceneOrder <= 0) {
      throw APIError.invalidArgument("sceneOrder must be a positive integer");
    }

    const title = req.title?.trim();
    const sceneText = req.sceneText?.trim();
    if (!title) {
      throw APIError.invalidArgument("Scene title is required");
    }
    if (!sceneText) {
      throw APIError.invalidArgument("sceneText is required");
    }

    const participantCharacterIds = normalizeIds(req.participantCharacterIds);
    await assertCharactersBelongToSeries(req.seriesId, participantCharacterIds);

    const now = new Date();
    const id = crypto.randomUUID();

    try {
      await storyDB.exec`
        INSERT INTO studio_episode_scenes (
          id, episode_id, series_id, scene_order, title, scene_text, participant_character_ids, image_prompt, status, created_at, updated_at
        ) VALUES (
          ${id},
          ${req.episodeId},
          ${req.seriesId},
          ${req.sceneOrder},
          ${title},
          ${sceneText},
          ${participantCharacterIds},
          ${req.imagePrompt?.trim() || null},
          'pending',
          ${now},
          ${now}
        )
      `;
    } catch (error: any) {
      if (String(error?.message || "").includes("idx_studio_episode_scenes_episode_order_unique")) {
        throw APIError.invalidArgument("Scene order already exists in this episode");
      }
      throw error;
    }

    const row = await storyDB.queryRow<{
      id: string;
      episode_id: string;
      series_id: string;
      scene_order: number;
      title: string;
      scene_text: string;
      participant_character_ids: string[];
      image_prompt: string | null;
      image_url: string | null;
      status: StudioSceneStatus;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT id, episode_id, series_id, scene_order, title, scene_text, participant_character_ids, image_prompt, image_url, status, created_at, updated_at
      FROM studio_episode_scenes
      WHERE id = ${id}
    `;

    if (!row) {
      throw APIError.internal("Failed to create studio scene");
    }
    return await mapSceneRow(row);
  }
);
