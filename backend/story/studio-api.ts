import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { getAuthData } from "~encore/auth";
import { storyDB } from "./db";
import { runwareGenerateImage } from "../ai/image-generation";
import {
  maybeUploadImageUrlToBucket,
  resolveImageUrlForClient,
} from "../helpers/bucket-storage";

const openAIKey = secret("OpenAIKey");

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

interface OpenAIChatResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
}

type StudioSceneRow = {
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
};

type StudioSelectedCharacter = {
  id: string;
  name: string;
  role: string | null;
  description: string | null;
  image_prompt: string;
};

type GeneratedSceneDraft = {
  title: string;
  sceneText: string;
  imagePrompt: string;
  participantCharacterNames: string[];
  participantCharacterIds: string[];
};

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeNameKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function toCleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseJsonObjectFromModelText(content: string): Record<string, any> {
  const direct = content.trim();
  if (direct) {
    try {
      const parsed = JSON.parse(direct);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, any>;
      }
    } catch {
      // continue with fallback extraction
    }
  }

  const match = direct.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Model did not return a JSON object");
  }

  try {
    const parsed = JSON.parse(match[0]);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, any>;
    }
  } catch {
    // handled below
  }

  throw new Error("Model returned invalid JSON");
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

async function getOwnedCharacterOrThrow(
  seriesId: string,
  characterId: string,
  userId: string
): Promise<{
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
}> {
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
    WHERE id = ${characterId}
  `;

  if (!row) {
    throw APIError.notFound("Studio character not found");
  }
  if (row.series_id !== seriesId) {
    throw APIError.invalidArgument("Character does not belong to the requested series");
  }
  if (row.user_id !== userId) {
    throw APIError.permissionDenied("You do not have access to this studio character");
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

async function listSceneRowsForEpisode(episodeId: string): Promise<StudioSceneRow[]> {
  return await storyDB.queryAll<StudioSceneRow>`
    SELECT id, episode_id, series_id, scene_order, title, scene_text, participant_character_ids, image_prompt, image_url, status, created_at, updated_at
    FROM studio_episode_scenes
    WHERE episode_id = ${episodeId}
    ORDER BY scene_order ASC
  `;
}

async function listMappedScenesForEpisode(episodeId: string): Promise<StudioEpisodeScene[]> {
  const rows = await listSceneRowsForEpisode(episodeId);
  return await Promise.all(rows.map(mapSceneRow));
}

async function getOwnedSceneOrThrow(
  seriesId: string,
  episodeId: string,
  sceneId: string,
  userId: string
): Promise<StudioSceneRow> {
  await getOwnedEpisodeOrThrow(seriesId, episodeId, userId);

  const row = await storyDB.queryRow<StudioSceneRow>`
    SELECT id, episode_id, series_id, scene_order, title, scene_text, participant_character_ids, image_prompt, image_url, status, created_at, updated_at
    FROM studio_episode_scenes
    WHERE id = ${sceneId}
      AND episode_id = ${episodeId}
      AND series_id = ${seriesId}
  `;

  if (!row) {
    throw APIError.notFound("Studio scene not found");
  }

  return row;
}

async function getSelectedCharactersForEpisode(
  seriesId: string,
  selectedCharacterIds: string[]
): Promise<StudioSelectedCharacter[]> {
  const characterIds = normalizeIds(selectedCharacterIds);
  const selected: StudioSelectedCharacter[] = [];

  for (const characterId of characterIds) {
    const row = await storyDB.queryRow<StudioSelectedCharacter>`
      SELECT id, name, role, description, image_prompt
      FROM studio_characters
      WHERE id = ${characterId}
        AND series_id = ${seriesId}
        AND is_active = TRUE
    `;
    if (row) {
      selected.push(row);
    }
  }

  return selected;
}

function resolveSceneParticipantIds(input: {
  participantCharacterNames: string[];
  participantCharacterIds: string[];
  availableCharacters: StudioSelectedCharacter[];
  fallbackParticipantIds: string[];
}): string[] {
  const availableById = new Map(input.availableCharacters.map((character) => [character.id, character]));
  const explicitIds = normalizeIds(input.participantCharacterIds).filter((id) => availableById.has(id));
  if (explicitIds.length > 0) {
    return explicitIds;
  }

  const names = input.participantCharacterNames
    .map(normalizeNameKey)
    .filter(Boolean);

  const matched: string[] = [];
  for (const name of names) {
    const character = input.availableCharacters.find((item) => {
      const key = normalizeNameKey(item.name);
      return key === name || key.includes(name) || name.includes(key);
    });
    if (character) {
      matched.push(character.id);
    }
  }

  const uniqueMatched = normalizeIds(matched);
  if (uniqueMatched.length > 0) {
    return uniqueMatched;
  }

  return normalizeIds(input.fallbackParticipantIds).filter((id) => availableById.has(id));
}

function buildFallbackSceneImagePrompt(input: {
  sceneTitle: string;
  sceneText: string;
  participantCharacterIds: string[];
  selectedCharacters: StudioSelectedCharacter[];
}): string {
  const participants = input.participantCharacterIds
    .map((characterId) => input.selectedCharacters.find((character) => character.id === characterId))
    .filter((character): character is StudioSelectedCharacter => Boolean(character))
    .map((character) => {
      const role = character.role?.trim() ? ` (${character.role.trim()})` : "";
      return `${character.name}${role}`;
    })
    .join(", ");

  const compactSceneText = input.sceneText.replace(/\s+/g, " ").trim();
  const snippet = compactSceneText.length > 420 ? `${compactSceneText.slice(0, 420)}...` : compactSceneText;

  return [
    "Kinderbuch-Illustration, hochwertige digitale Malerei, konsistenter Talea-Stil.",
    `Szene: ${input.sceneTitle}.`,
    participants ? `Teilnehmende Charaktere: ${participants}.` : "",
    `Handlungs-Moment: ${snippet}`,
    "Kein Text, kein Logo, keine Wasserzeichen.",
  ]
    .filter(Boolean)
    .join(" ");
}

function normalizeGeneratedSceneDrafts(input: {
  parsedObject: Record<string, any>;
  selectedCharacters: StudioSelectedCharacter[];
  fallbackParticipantIds: string[];
  minSceneCount: number;
  maxSceneCount: number;
  targetSceneCount: number;
}): GeneratedSceneDraft[] {
  const rawScenes = Array.isArray(input.parsedObject?.scenes) ? input.parsedObject.scenes : [];
  if (!rawScenes.length) {
    throw new Error("No scenes returned by model");
  }

  const drafts = rawScenes
    .map((rawScene, index) => {
      const title = toCleanString(rawScene?.title) || `Szene ${index + 1}`;
      const sceneText = toCleanString(rawScene?.sceneText || rawScene?.text);
      if (!sceneText) {
        return null;
      }

      const participantCharacterNames = Array.isArray(rawScene?.participantCharacterNames)
        ? rawScene.participantCharacterNames.map((value: unknown) => toCleanString(value)).filter(Boolean)
        : [];
      const participantCharacterIds = Array.isArray(rawScene?.participantCharacterIds)
        ? rawScene.participantCharacterIds.map((value: unknown) => toCleanString(value)).filter(Boolean)
        : [];

      const resolvedParticipantIds = resolveSceneParticipantIds({
        participantCharacterNames,
        participantCharacterIds,
        availableCharacters: input.selectedCharacters,
        fallbackParticipantIds: input.fallbackParticipantIds,
      });

      const fallbackPrompt = buildFallbackSceneImagePrompt({
        sceneTitle: title,
        sceneText,
        participantCharacterIds: resolvedParticipantIds,
        selectedCharacters: input.selectedCharacters,
      });

      return {
        title,
        sceneText,
        imagePrompt: toCleanString(rawScene?.imagePrompt) || fallbackPrompt,
        participantCharacterNames,
        participantCharacterIds: resolvedParticipantIds,
      } satisfies GeneratedSceneDraft;
    })
    .filter((draft): draft is GeneratedSceneDraft => Boolean(draft));

  if (!drafts.length) {
    throw new Error("No usable scenes in model output");
  }

  const boundedTarget = clamp(
    Number.isFinite(input.targetSceneCount) ? Math.floor(input.targetSceneCount) : 10,
    input.minSceneCount,
    input.maxSceneCount
  );
  const boundedMax = Math.max(input.minSceneCount, Math.min(input.maxSceneCount, boundedTarget + 2));
  const clipped = drafts.slice(0, boundedMax);

  if (clipped.length < input.minSceneCount) {
    throw new Error(`Model returned only ${clipped.length} scenes, minimum is ${input.minSceneCount}`);
  }

  return clipped;
}

async function generateEpisodeScenesWithOpenAI(input: {
  series: {
    title: string;
    logline?: string | null;
    description?: string | null;
    canonicalPrompt?: string | null;
  };
  episode: {
    episodeNumber: number;
    title: string;
    summary?: string | null;
    approvedStoryText: string;
  };
  selectedCharacters: StudioSelectedCharacter[];
  fallbackParticipantIds: string[];
  targetSceneCount: number;
  minSceneCount: number;
  maxSceneCount: number;
  userPrompt?: string;
}): Promise<GeneratedSceneDraft[]> {
  const systemPrompt = [
    "Du bist Story-Editor und Visual-Director fuer eine Serienepisode.",
    "Zerlege den Episodentext in visuell starke, aufeinanderfolgende Szenen.",
    "Antworte ausschliesslich als JSON-Objekt mit dem Feld scenes.",
  ].join(" ");

  const castBlock = input.selectedCharacters.length
    ? input.selectedCharacters
        .map((character, index) => {
          const role = character.role?.trim() ? `Rolle: ${character.role.trim()}. ` : "";
          const description = character.description?.trim()
            ? `Beschreibung: ${character.description.trim()}. `
            : "";
          const visual = character.image_prompt?.trim()
            ? `Bildstil-Hinweis: ${character.image_prompt.trim()}.`
            : "";
          return `${index + 1}. ${character.name}. ${role}${description}${visual}`.trim();
        })
        .join("\n")
    : "Keine ausgewaehlten Charaktere.";

  const userPrompt = [
    `SERIE: ${input.series.title}`,
    input.series.logline ? `LOGLINE: ${input.series.logline}` : "",
    input.series.description ? `SERIEN-BESCHREIBUNG: ${input.series.description}` : "",
    input.series.canonicalPrompt ? `SERIEN-CANON: ${input.series.canonicalPrompt}` : "",
    "",
    `EPISODE ${input.episode.episodeNumber}: ${input.episode.title}`,
    input.episode.summary ? `EPISODEN-SUMMARY: ${input.episode.summary}` : "",
    "",
    "VERFUEGBARE CHARAKTERE (nur diese verwenden):",
    castBlock,
    "",
    `AUFGABE: Teile den folgenden Episodentext in ${input.minSceneCount}-${input.maxSceneCount} Szenen (Ziel ${input.targetSceneCount}).`,
    "Regeln:",
    "- Jede Szene braucht: title, sceneText, imagePrompt, participantCharacterNames.",
    "- sceneText muss konkrete Handlung enthalten und in zeitlicher Reihenfolge bleiben.",
    "- imagePrompt muss die Szene bildlich klar beschreiben und die teilnehmenden Charaktere nennen.",
    "- participantCharacterNames muss nur Namen aus der Charakterliste enthalten.",
    "- Keine Markdown-Ausgabe, nur JSON.",
    "",
    'JSON-SCHEMA:',
    '{',
    '  "scenes": [',
    "    {",
    '      "title": "string",',
    '      "sceneText": "string",',
    '      "imagePrompt": "string",',
    '      "participantCharacterNames": ["string"]',
    "    }",
    "  ]",
    "}",
    "",
    input.userPrompt?.trim() ? `ZUSATZANWEISUNG: ${input.userPrompt.trim()}` : "",
    "EPISODENTEXT:",
    input.episode.approvedStoryText,
  ]
    .filter(Boolean)
    .join("\n");

  const payload = {
    model: "gpt-5.2",
    max_completion_tokens: 7000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAIKey()}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI scene split error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as OpenAIChatResponse;
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenAI returned empty scene split");
  }

  const parsedObject = parseJsonObjectFromModelText(content);
  return normalizeGeneratedSceneDrafts({
    parsedObject,
    selectedCharacters: input.selectedCharacters,
    fallbackParticipantIds: input.fallbackParticipantIds,
    minSceneCount: input.minSceneCount,
    maxSceneCount: input.maxSceneCount,
    targetSceneCount: input.targetSceneCount,
  });
}

async function updateEpisodeStatus(
  episodeId: string,
  status: StudioEpisodeStatus,
  publishedAt?: Date | null
): Promise<void> {
  const now = new Date();
  if (publishedAt === undefined) {
    await storyDB.exec`
      UPDATE studio_episodes
      SET status = ${status},
          updated_at = ${now}
      WHERE id = ${episodeId}
    `;
    return;
  }

  await storyDB.exec`
    UPDATE studio_episodes
    SET status = ${status},
        published_at = ${publishedAt},
        updated_at = ${now}
    WHERE id = ${episodeId}
  `;
}

async function syncEpisodeStatusFromSceneImages(episodeId: string): Promise<StudioEpisodeStatus> {
  const counts = await storyDB.queryRow<{ total: number; with_images: number }>`
    SELECT
      COUNT(*)::INT AS total,
      COUNT(*) FILTER (WHERE image_url IS NOT NULL AND image_url <> '')::INT AS with_images
    FROM studio_episode_scenes
    WHERE episode_id = ${episodeId}
  `;

  const total = counts?.total || 0;
  const withImages = counts?.with_images || 0;
  const nextStatus: StudioEpisodeStatus = total > 0 && withImages === total ? "images_ready" : "scenes_ready";
  await updateEpisodeStatus(episodeId, nextStatus);
  return nextStatus;
}

async function generateEpisodeTextWithOpenAI(input: {
  series: {
    title: string;
    logline?: string | null;
    description?: string | null;
    canonicalPrompt?: string | null;
  };
  episode: {
    episodeNumber: number;
    title: string;
    summary?: string | null;
  };
  characters: Array<{ name: string; role?: string | null; description?: string | null }>;
  userPrompt?: string;
  minWords: number;
  maxWords: number;
}): Promise<string> {
  const systemPrompt = [
    "Du bist ein preisgekroenter Serienautor fuer kindgerechte Erzaehlungen.",
    "Schreibe eine zusammenhaengende Episode in gutem Deutsch.",
    "Nutze keine Markdown-Formatierung und keine Listen.",
    "Liefere nur den finalen Fliesstext.",
  ].join(" ");

  const castBlock = input.characters.length
    ? input.characters
        .map((char, index) => {
          const role = char.role?.trim() ? `Rolle: ${char.role.trim()}. ` : "";
          const description = char.description?.trim() ? `Beschreibung: ${char.description.trim()}.` : "";
          return `${index + 1}. ${char.name}. ${role}${description}`.trim();
        })
        .join("\n")
    : "Keine Serien-Charaktere gesetzt.";

  const userPrompt = [
    `SERIE: ${input.series.title}`,
    input.series.logline ? `LOGLINE: ${input.series.logline}` : "",
    input.series.description ? `SERIEN-BESCHREIBUNG: ${input.series.description}` : "",
    input.series.canonicalPrompt ? `SERIEN-CANON: ${input.series.canonicalPrompt}` : "",
    "",
    `EPISODE ${input.episode.episodeNumber}: ${input.episode.title}`,
    input.episode.summary ? `EPISODEN-IDEE: ${input.episode.summary}` : "",
    "",
    "CHARAKTERE (nur diese nutzen):",
    castBlock,
    "",
    `ZIEL: Schreibe ca. ${input.minWords}-${input.maxWords} Woerter, dramaturgisch klar, lebendig, kindgerecht.`,
    "Achte auf kohaerente Handlung, starke Szenenuebergaenge und wiedererkennbare Figurenstimmen.",
    input.userPrompt?.trim() ? `ZUSATZWUNSCH: ${input.userPrompt.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const payload = {
    model: "gpt-5.2",
    temperature: 0.85,
    max_completion_tokens: 5000,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAIKey()}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as OpenAIChatResponse;
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenAI returned no episode text");
  }
  return content;
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

interface UpdateStudioSeriesRequest extends StudioSeriesPathRequest {
  title?: string;
  logline?: string;
  description?: string;
  canonicalPrompt?: string;
  status?: StudioSeriesStatus;
}

interface StudioCharacterPathRequest extends StudioSeriesPathRequest {
  characterId: string;
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

interface UpdateStudioCharacterRequest extends StudioCharacterPathRequest {
  name?: string;
  role?: string;
  description?: string;
  generationPrompt?: string;
  imagePrompt?: string;
  visualProfile?: Record<string, any>;
  regenerateImage?: boolean;
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

interface GenerateStudioEpisodeTextRequest extends StudioEpisodePathRequest {
  userPrompt?: string;
  minWords?: number;
  maxWords?: number;
}

interface UpdateStudioEpisodeTextRequest extends StudioEpisodePathRequest {
  storyText: string;
  summary?: string;
  approve?: boolean;
}

interface SplitStudioEpisodeScenesRequest extends StudioEpisodePathRequest {
  targetSceneCount?: number;
  minSceneCount?: number;
  maxSceneCount?: number;
  userPrompt?: string;
}

interface StudioScenePathRequest extends StudioEpisodePathRequest {
  sceneId: string;
}

interface UpdateStudioSceneRequest extends StudioScenePathRequest {
  title?: string;
  sceneText?: string;
  imagePrompt?: string;
  participantCharacterIds?: string[];
}

interface GenerateStudioSceneImageRequest extends StudioScenePathRequest {
  imagePrompt?: string;
}

interface GenerateStudioEpisodeImagesRequest extends StudioEpisodePathRequest {
  forceRegenerate?: boolean;
}

interface StudioEpisodeWithScenesResponse {
  episode: StudioEpisode;
  scenes: StudioEpisodeScene[];
}

interface ComposeStudioEpisodeResponse extends StudioEpisodeWithScenesResponse {
  combinedText: string;
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

export const updateStudioSeries = api<UpdateStudioSeriesRequest, StudioSeries>(
  { expose: true, method: "PUT", path: "/story/studio/series/:seriesId", auth: true },
  async (req) => {
    await ensureStudioTables();
    const userId = requireUserId();
    const existing = await getOwnedSeriesOrThrow(req.seriesId, userId);

    const nextTitle = req.title !== undefined ? req.title.trim() : existing.title;
    if (!nextTitle) {
      throw APIError.invalidArgument("Series title is required");
    }

    const nextStatus = req.status ?? existing.status;
    if (!["draft", "active", "archived"].includes(nextStatus)) {
      throw APIError.invalidArgument("Invalid series status");
    }

    const nextLogline =
      req.logline !== undefined ? req.logline.trim() || null : existing.logline;
    const nextDescription =
      req.description !== undefined ? req.description.trim() || null : existing.description;
    const nextCanonicalPrompt =
      req.canonicalPrompt !== undefined
        ? req.canonicalPrompt.trim() || null
        : existing.canonical_prompt;

    await storyDB.exec`
      UPDATE studio_series
      SET title = ${nextTitle},
          logline = ${nextLogline},
          description = ${nextDescription},
          canonical_prompt = ${nextCanonicalPrompt},
          status = ${nextStatus},
          updated_at = ${new Date()}
      WHERE id = ${req.seriesId}
    `;

    const updated = await getOwnedSeriesOrThrow(req.seriesId, userId);
    return mapSeriesRow(updated);
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

export const updateStudioCharacter = api<UpdateStudioCharacterRequest, StudioCharacter>(
  { expose: true, method: "PUT", path: "/story/studio/series/:seriesId/characters/:characterId", auth: true },
  async (req) => {
    await ensureStudioTables();
    const userId = requireUserId();
    const existing = await getOwnedCharacterOrThrow(req.seriesId, req.characterId, userId);

    const nextName = req.name !== undefined ? req.name.trim() : existing.name;
    if (!nextName) {
      throw APIError.invalidArgument("Character name is required");
    }

    const nextRole = req.role !== undefined ? req.role.trim() || null : existing.role;
    const nextDescription =
      req.description !== undefined ? req.description.trim() || null : existing.description;
    const nextGenerationPrompt =
      req.generationPrompt !== undefined
        ? req.generationPrompt.trim()
        : existing.generation_prompt;
    if (!nextGenerationPrompt) {
      throw APIError.invalidArgument("generationPrompt is required");
    }

    const nextImagePrompt =
      req.imagePrompt !== undefined ? req.imagePrompt.trim() || null : existing.image_prompt;

    let nextImageUrl = existing.image_url;
    if (req.regenerateImage) {
      const regeneratedPrompt = nextImagePrompt || nextGenerationPrompt;
      const generated = await runwareGenerateImage({
        prompt: regeneratedPrompt,
        negativePrompt:
          "text, watermark, logo, blurry, distorted face, extra limbs, duplicate character",
        width: 1024,
        height: 1024,
      });

      const uploaded = await maybeUploadImageUrlToBucket(generated.imageUrl, {
        prefix: "images/studio-characters",
        filenameHint: `studio-character-${existing.id}`,
        uploadMode: "always",
      });
      nextImageUrl = uploaded?.url || generated.imageUrl;
    }

    const visualProfile =
      req.visualProfile ??
      ({
        ...(parseJsonObject(existing.visual_profile) || {}),
        description: nextDescription || "",
        imagePrompt: nextImagePrompt || nextGenerationPrompt,
      } as Record<string, any>);

    try {
      await storyDB.exec`
        UPDATE studio_characters
        SET name = ${nextName},
            role = ${nextRole},
            description = ${nextDescription},
            generation_prompt = ${nextGenerationPrompt},
            image_prompt = ${nextImagePrompt || nextGenerationPrompt},
            visual_profile = ${JSON.stringify(visualProfile)},
            image_url = ${nextImageUrl},
            updated_at = ${new Date()}
        WHERE id = ${existing.id}
      `;
    } catch (error: any) {
      if (String(error?.message || "").includes("idx_studio_characters_series_name_unique")) {
        throw APIError.invalidArgument("Character name already exists in this series");
      }
      throw error;
    }

    const updated = await getOwnedCharacterOrThrow(req.seriesId, req.characterId, userId);
    return await mapCharacterRow(updated);
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

export const getStudioEpisode = api<StudioEpisodePathRequest, StudioEpisode>(
  { expose: true, method: "GET", path: "/story/studio/series/:seriesId/episodes/:episodeId", auth: true },
  async (req) => {
    await ensureStudioTables();
    const userId = requireUserId();
    const episode = await getOwnedEpisodeOrThrow(req.seriesId, req.episodeId, userId);
    return mapEpisodeRow(episode);
  }
);

export const generateStudioEpisodeText = api<GenerateStudioEpisodeTextRequest, StudioEpisode>(
  { expose: true, method: "POST", path: "/story/studio/series/:seriesId/episodes/:episodeId/generate-text", auth: true },
  async (req) => {
    await ensureStudioTables();
    const userId = requireUserId();
    const series = await getOwnedSeriesOrThrow(req.seriesId, userId);
    const episode = await getOwnedEpisodeOrThrow(req.seriesId, req.episodeId, userId);

    const minWords = clamp(Math.floor(req.minWords ?? 1200), 500, 3000);
    const maxWords = clamp(Math.floor(req.maxWords ?? 1500), minWords, 3500);

    const selectedCharacterIds = normalizeIds(episode.selected_character_ids);
    await assertCharactersBelongToSeries(req.seriesId, selectedCharacterIds);

    const selectedCharacters = await getSelectedCharactersForEpisode(req.seriesId, selectedCharacterIds);

    let generatedText: string;
    try {
      generatedText = await generateEpisodeTextWithOpenAI({
        series: {
          title: series.title,
          logline: series.logline,
          description: series.description,
          canonicalPrompt: series.canonical_prompt,
        },
        episode: {
          episodeNumber: episode.episode_number,
          title: episode.title,
          summary: episode.summary,
        },
        characters: selectedCharacters.map((character) => ({
          name: character.name,
          role: character.role,
          description: character.description,
        })),
        userPrompt: req.userPrompt,
        minWords,
        maxWords,
      });
    } catch (error) {
      console.error("[Studio] Failed generating episode text:", error);
      throw APIError.internal("Episode text generation failed");
    }

    const words = countWords(generatedText);
    console.log("[Studio] Generated episode text", {
      seriesId: req.seriesId,
      episodeId: req.episodeId,
      words,
      model: "gpt-5.2",
    });

    const now = new Date();
    await storyDB.exec`
      UPDATE studio_episodes
      SET story_text = ${generatedText},
          status = 'text_ready',
          updated_at = ${now}
      WHERE id = ${req.episodeId}
    `;

    const updatedEpisode = await getOwnedEpisodeOrThrow(req.seriesId, req.episodeId, userId);
    return mapEpisodeRow(updatedEpisode);
  }
);

export const updateStudioEpisodeText = api<UpdateStudioEpisodeTextRequest, StudioEpisode>(
  { expose: true, method: "PUT", path: "/story/studio/series/:seriesId/episodes/:episodeId/text", auth: true },
  async (req) => {
    await ensureStudioTables();
    const userId = requireUserId();
    await getOwnedEpisodeOrThrow(req.seriesId, req.episodeId, userId);

    const storyText = req.storyText?.trim();
    if (!storyText) {
      throw APIError.invalidArgument("storyText is required");
    }

    const approve = Boolean(req.approve);
    const nextStatus: StudioEpisodeStatus = approve ? "text_approved" : "text_ready";
    const now = new Date();

    await storyDB.exec`
      UPDATE studio_episodes
      SET story_text = ${storyText},
          summary = COALESCE(${req.summary?.trim() || null}, summary),
          approved_story_text = CASE WHEN ${approve} THEN ${storyText} ELSE approved_story_text END,
          status = ${nextStatus},
          updated_at = ${now}
      WHERE id = ${req.episodeId}
    `;

    const updatedEpisode = await getOwnedEpisodeOrThrow(req.seriesId, req.episodeId, userId);
    return mapEpisodeRow(updatedEpisode);
  }
);

export const splitStudioEpisodeScenes = api<
  SplitStudioEpisodeScenesRequest,
  StudioEpisodeWithScenesResponse
>(
  { expose: true, method: "POST", path: "/story/studio/series/:seriesId/episodes/:episodeId/split-scenes", auth: true },
  async (req) => {
    await ensureStudioTables();
    const userId = requireUserId();
    const series = await getOwnedSeriesOrThrow(req.seriesId, userId);
    const episode = await getOwnedEpisodeOrThrow(req.seriesId, req.episodeId, userId);

    if (episode.status === "published") {
      throw APIError.invalidArgument("Published episodes cannot be edited");
    }

    const approvedStoryText = (episode.approved_story_text || episode.story_text || "").trim();
    if (!approvedStoryText) {
      throw APIError.invalidArgument("Please save or approve an episode text first");
    }

    const selectedCharacterIds = normalizeIds(episode.selected_character_ids);
    await assertCharactersBelongToSeries(req.seriesId, selectedCharacterIds);
    const selectedCharacters = await getSelectedCharactersForEpisode(req.seriesId, selectedCharacterIds);

    const minSceneCount = clamp(Math.floor(req.minSceneCount ?? 10), 4, 20);
    const maxSceneCount = clamp(Math.floor(req.maxSceneCount ?? 12), minSceneCount, 24);
    const targetSceneCount = clamp(Math.floor(req.targetSceneCount ?? 10), minSceneCount, maxSceneCount);

    let drafts: GeneratedSceneDraft[];
    try {
      drafts = await generateEpisodeScenesWithOpenAI({
        series: {
          title: series.title,
          logline: series.logline,
          description: series.description,
          canonicalPrompt: series.canonical_prompt,
        },
        episode: {
          episodeNumber: episode.episode_number,
          title: episode.title,
          summary: episode.summary,
          approvedStoryText,
        },
        selectedCharacters,
        fallbackParticipantIds: selectedCharacterIds,
        targetSceneCount,
        minSceneCount,
        maxSceneCount,
        userPrompt: req.userPrompt,
      });
    } catch (error) {
      console.error("[Studio] Failed splitting episode scenes:", error);
      throw APIError.internal("Scene splitting failed");
    }

    await storyDB.exec`
      DELETE FROM studio_episode_scenes
      WHERE episode_id = ${req.episodeId}
    `;

    const now = new Date();
    for (let i = 0; i < drafts.length; i += 1) {
      const draft = drafts[i];
      const participantCharacterIds = normalizeIds(
        draft.participantCharacterIds.length > 0
          ? draft.participantCharacterIds
          : selectedCharacterIds
      );
      await assertCharactersBelongToSeries(req.seriesId, participantCharacterIds);

      await storyDB.exec`
        INSERT INTO studio_episode_scenes (
          id, episode_id, series_id, scene_order, title, scene_text, participant_character_ids, image_prompt, status, created_at, updated_at
        ) VALUES (
          ${crypto.randomUUID()},
          ${req.episodeId},
          ${req.seriesId},
          ${i + 1},
          ${draft.title},
          ${draft.sceneText},
          ${participantCharacterIds},
          ${draft.imagePrompt},
          'pending',
          ${now},
          ${now}
        )
      `;
    }

    await updateEpisodeStatus(req.episodeId, "scenes_ready");
    const updatedEpisode = await getOwnedEpisodeOrThrow(req.seriesId, req.episodeId, userId);
    const scenes = await listMappedScenesForEpisode(req.episodeId);
    return { episode: mapEpisodeRow(updatedEpisode), scenes };
  }
);

export const updateStudioEpisodeScene = api<UpdateStudioSceneRequest, StudioEpisodeScene>(
  { expose: true, method: "PUT", path: "/story/studio/series/:seriesId/episodes/:episodeId/scenes/:sceneId", auth: true },
  async (req) => {
    await ensureStudioTables();
    const userId = requireUserId();
    const episode = await getOwnedEpisodeOrThrow(req.seriesId, req.episodeId, userId);
    if (episode.status === "published") {
      throw APIError.invalidArgument("Published episodes cannot be edited");
    }

    const scene = await getOwnedSceneOrThrow(req.seriesId, req.episodeId, req.sceneId, userId);

    const title = req.title !== undefined ? req.title.trim() : scene.title;
    const sceneText = req.sceneText !== undefined ? req.sceneText.trim() : scene.scene_text;
    if (!title) {
      throw APIError.invalidArgument("Scene title is required");
    }
    if (!sceneText) {
      throw APIError.invalidArgument("sceneText is required");
    }

    const participantCharacterIds =
      req.participantCharacterIds !== undefined
        ? normalizeIds(req.participantCharacterIds)
        : normalizeIds(scene.participant_character_ids);
    await assertCharactersBelongToSeries(req.seriesId, participantCharacterIds);

    const nextImagePrompt =
      req.imagePrompt !== undefined ? (req.imagePrompt.trim() || null) : scene.image_prompt;
    const promptChanged =
      req.imagePrompt !== undefined && (scene.image_prompt || null) !== nextImagePrompt;
    const nextImageUrl = promptChanged ? null : scene.image_url;
    const nextSceneStatus: StudioSceneStatus = nextImageUrl ? "ready" : "pending";

    const now = new Date();
    await storyDB.exec`
      UPDATE studio_episode_scenes
      SET title = ${title},
          scene_text = ${sceneText},
          participant_character_ids = ${participantCharacterIds},
          image_prompt = ${nextImagePrompt},
          image_url = ${nextImageUrl},
          status = ${nextSceneStatus},
          updated_at = ${now}
      WHERE id = ${req.sceneId}
    `;

    await syncEpisodeStatusFromSceneImages(req.episodeId);

    const updated = await getOwnedSceneOrThrow(req.seriesId, req.episodeId, req.sceneId, userId);
    return await mapSceneRow(updated);
  }
);

export const generateStudioEpisodeSceneImage = api<
  GenerateStudioSceneImageRequest,
  { episode: StudioEpisode; scene: StudioEpisodeScene }
>(
  {
    expose: true,
    method: "POST",
    path: "/story/studio/series/:seriesId/episodes/:episodeId/scenes/:sceneId/generate-image",
    auth: true,
  },
  async (req) => {
    await ensureStudioTables();
    const userId = requireUserId();
    const episode = await getOwnedEpisodeOrThrow(req.seriesId, req.episodeId, userId);
    if (episode.status === "published") {
      throw APIError.invalidArgument("Published episodes cannot be edited");
    }

    const scene = await getOwnedSceneOrThrow(req.seriesId, req.episodeId, req.sceneId, userId);
    const selectedCharacterIds = normalizeIds(episode.selected_character_ids);
    const selectedCharacters = await getSelectedCharactersForEpisode(req.seriesId, selectedCharacterIds);

    const participantCharacterIds = normalizeIds(scene.participant_character_ids);
    const fallbackPrompt = buildFallbackSceneImagePrompt({
      sceneTitle: scene.title,
      sceneText: scene.scene_text,
      participantCharacterIds,
      selectedCharacters,
    });

    const participantDetails = participantCharacterIds
      .map((characterId) => selectedCharacters.find((character) => character.id === characterId))
      .filter((character): character is StudioSelectedCharacter => Boolean(character))
      .map((character) => {
        const role = character.role?.trim() ? ` (${character.role.trim()})` : "";
        return `${character.name}${role}`;
      })
      .join(", ");

    const basePrompt = req.imagePrompt?.trim() || scene.image_prompt?.trim() || fallbackPrompt;
    const finalPrompt = [
      basePrompt,
      participantDetails ? `Nutze diese Charaktere: ${participantDetails}.` : "",
      "Kinderfreundliche Illustration, konsistenter Stil, ausdrucksstarke Szene, kein Text im Bild.",
    ]
      .filter(Boolean)
      .join(" ");

    let imageUrl: string;
    try {
      const generated = await runwareGenerateImage({
        prompt: finalPrompt,
        negativePrompt:
          "text, watermark, logo, blurry, distorted face, extra limbs, duplicate character, low quality",
        width: 1024,
        height: 1024,
      });

      const uploaded = await maybeUploadImageUrlToBucket(generated.imageUrl, {
        prefix: "images/studio-scenes",
        filenameHint: `studio-scene-${scene.id}`,
        uploadMode: "always",
      });
      imageUrl = uploaded?.url || generated.imageUrl;
    } catch (error) {
      console.error("[Studio] Failed generating scene image:", error);
      throw APIError.internal("Scene image generation failed");
    }

    const now = new Date();
    await storyDB.exec`
      UPDATE studio_episode_scenes
      SET image_prompt = ${basePrompt},
          image_url = ${imageUrl},
          status = 'ready',
          updated_at = ${now}
      WHERE id = ${scene.id}
    `;

    await syncEpisodeStatusFromSceneImages(req.episodeId);

    const updatedScene = await getOwnedSceneOrThrow(req.seriesId, req.episodeId, req.sceneId, userId);
    const updatedEpisode = await getOwnedEpisodeOrThrow(req.seriesId, req.episodeId, userId);
    return {
      episode: mapEpisodeRow(updatedEpisode),
      scene: await mapSceneRow(updatedScene),
    };
  }
);

export const generateStudioEpisodeImages = api<
  GenerateStudioEpisodeImagesRequest,
  StudioEpisodeWithScenesResponse
>(
  { expose: true, method: "POST", path: "/story/studio/series/:seriesId/episodes/:episodeId/generate-images", auth: true },
  async (req) => {
    await ensureStudioTables();
    const userId = requireUserId();
    const episode = await getOwnedEpisodeOrThrow(req.seriesId, req.episodeId, userId);
    if (episode.status === "published") {
      throw APIError.invalidArgument("Published episodes cannot be edited");
    }

    const sceneRows = await listSceneRowsForEpisode(req.episodeId);
    if (sceneRows.length === 0) {
      throw APIError.invalidArgument("Create or split scenes before generating images");
    }

    const selectedCharacters = await getSelectedCharactersForEpisode(
      req.seriesId,
      normalizeIds(episode.selected_character_ids)
    );

    for (const scene of sceneRows) {
      if (!req.forceRegenerate && scene.image_url) {
        continue;
      }

      const participantCharacterIds = normalizeIds(scene.participant_character_ids);
      const fallbackPrompt = buildFallbackSceneImagePrompt({
        sceneTitle: scene.title,
        sceneText: scene.scene_text,
        participantCharacterIds,
        selectedCharacters,
      });
      const prompt = scene.image_prompt?.trim() || fallbackPrompt;

      try {
        const generated = await runwareGenerateImage({
          prompt,
          negativePrompt:
            "text, watermark, logo, blurry, distorted face, extra limbs, duplicate character, low quality",
          width: 1024,
          height: 1024,
        });

        const uploaded = await maybeUploadImageUrlToBucket(generated.imageUrl, {
          prefix: "images/studio-scenes",
          filenameHint: `studio-scene-${scene.id}`,
          uploadMode: "always",
        });

        await storyDB.exec`
          UPDATE studio_episode_scenes
          SET image_prompt = ${prompt},
              image_url = ${uploaded?.url || generated.imageUrl},
              status = 'ready',
              updated_at = ${new Date()}
          WHERE id = ${scene.id}
        `;
      } catch (error) {
        console.error("[Studio] Failed generating image for scene", { sceneId: scene.id, error });
      }
    }

    await syncEpisodeStatusFromSceneImages(req.episodeId);
    const updatedEpisode = await getOwnedEpisodeOrThrow(req.seriesId, req.episodeId, userId);
    const scenes = await listMappedScenesForEpisode(req.episodeId);
    return { episode: mapEpisodeRow(updatedEpisode), scenes };
  }
);

export const composeStudioEpisode = api<StudioEpisodePathRequest, ComposeStudioEpisodeResponse>(
  { expose: true, method: "POST", path: "/story/studio/series/:seriesId/episodes/:episodeId/compose", auth: true },
  async (req) => {
    await ensureStudioTables();
    const userId = requireUserId();
    const episode = await getOwnedEpisodeOrThrow(req.seriesId, req.episodeId, userId);
    if (episode.status === "published") {
      throw APIError.invalidArgument("Published episodes cannot be recomposed");
    }

    const sceneRows = await listSceneRowsForEpisode(req.episodeId);
    if (sceneRows.length === 0) {
      throw APIError.invalidArgument("No scenes available for composition");
    }

    const missingImages = sceneRows.filter((scene) => !(scene.image_url || "").trim());
    if (missingImages.length > 0) {
      throw APIError.invalidArgument("Generate all scene images before composing");
    }

    await updateEpisodeStatus(req.episodeId, "composed");
    const updatedEpisode = await getOwnedEpisodeOrThrow(req.seriesId, req.episodeId, userId);
    const scenes = await Promise.all(sceneRows.map(mapSceneRow));
    const combinedText = scenes
      .map((scene) => `Szene ${scene.sceneOrder}: ${scene.title}\n\n${scene.sceneText}`)
      .join("\n\n");

    return {
      episode: mapEpisodeRow(updatedEpisode),
      scenes,
      combinedText,
    };
  }
);

export const publishStudioEpisode = api<StudioEpisodePathRequest, StudioEpisode>(
  { expose: true, method: "POST", path: "/story/studio/series/:seriesId/episodes/:episodeId/publish", auth: true },
  async (req) => {
    await ensureStudioTables();
    const userId = requireUserId();
    const episode = await getOwnedEpisodeOrThrow(req.seriesId, req.episodeId, userId);

    if (episode.status === "published") {
      return mapEpisodeRow(episode);
    }
    if (episode.status !== "composed") {
      throw APIError.invalidArgument("Compose the episode before publishing");
    }

    await updateEpisodeStatus(req.episodeId, "published", new Date());
    const updatedEpisode = await getOwnedEpisodeOrThrow(req.seriesId, req.episodeId, userId);
    return mapEpisodeRow(updatedEpisode);
  }
);

export const listStudioEpisodeScenes = api<StudioEpisodePathRequest, { scenes: StudioEpisodeScene[] }>(
  { expose: true, method: "GET", path: "/story/studio/series/:seriesId/episodes/:episodeId/scenes", auth: true },
  async (req) => {
    await ensureStudioTables();
    const userId = requireUserId();
    await getOwnedSeriesOrThrow(req.seriesId, userId);
    await getOwnedEpisodeOrThrow(req.seriesId, req.episodeId, userId);
    const scenes = await listMappedScenesForEpisode(req.episodeId);
    return { scenes };
  }
);

export const createStudioEpisodeScene = api<CreateStudioSceneRequest, StudioEpisodeScene>(
  { expose: true, method: "POST", path: "/story/studio/series/:seriesId/episodes/:episodeId/scenes", auth: true },
  async (req) => {
    await ensureStudioTables();
    const userId = requireUserId();
    await getOwnedSeriesOrThrow(req.seriesId, userId);
    const episode = await getOwnedEpisodeOrThrow(req.seriesId, req.episodeId, userId);
    if (episode.status === "published") {
      throw APIError.invalidArgument("Published episodes cannot be edited");
    }

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

    await updateEpisodeStatus(req.episodeId, "scenes_ready");

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
