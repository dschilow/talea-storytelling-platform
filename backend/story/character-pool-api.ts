// Character Pool Management API
// Endpoints for managing the character pool

import { api, APIError } from "encore.dev/api";
import { storyDB } from "./db";
import type { CharacterTemplate } from "./types";
import { seedCharacterPool } from "./seed-characters";
import { runwareGenerateImage } from "../ai/image-generation";

let imageColumnEnsured = false;

async function ensureImageUrlColumn(): Promise<void> {
  if (imageColumnEnsured) {
    return;
  }

  try {
    await storyDB.exec`
      ALTER TABLE character_pool
      ADD COLUMN IF NOT EXISTS image_url TEXT
    `;
  } catch (err) {
    console.error("[CharacterPool] Failed ensuring image_url column:", err);
  } finally {
    imageColumnEnsured = true;
  }
}

async function fetchAllCharacters(): Promise<CharacterTemplate[]> {
  await ensureImageUrlColumn();

  const rows = await storyDB.queryAll<{
    id: string;
    name: string;
    role: string;
    archetype: string;
    emotional_nature: string;
    visual_profile: string;
    image_url: string | null;
    max_screen_time: number;
    available_chapters: number[];
    canon_settings: string[];
    recent_usage_count: number;
    total_usage_count: number;
    last_used_at: Date | null;
    created_at: Date;
    updated_at: Date;
    is_active: boolean;
  }>`
    SELECT * FROM character_pool ORDER BY name
  `;

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    role: row.role,
    archetype: row.archetype,
    emotionalNature: JSON.parse(row.emotional_nature),
    visualProfile: JSON.parse(row.visual_profile),
    imageUrl: row.image_url || undefined,
    maxScreenTime: row.max_screen_time,
    availableChapters: row.available_chapters,
    canonSettings: row.canon_settings,
    recentUsageCount: row.recent_usage_count,
    totalUsageCount: row.total_usage_count,
    lastUsedAt: row.last_used_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isActive: row.is_active,
  }));
}

// ===== GET ALL CHARACTERS =====
export const listCharacters = api(
  { expose: true, method: "GET", path: "/story/character-pool", auth: true },
  async (): Promise<{ characters: CharacterTemplate[] }> => {
    console.log("[CharacterPool] Listing all active characters");

    const characters = await fetchAllCharacters();

    console.log(`[CharacterPool] Found ${characters.length} characters (active and inactive)`);

    return { characters };
  }
);

// ===== GET CHARACTER BY ID =====
interface GetCharacterRequest {
  id: string;
}

export const getCharacter = api<GetCharacterRequest, CharacterTemplate>(
  { expose: true, method: "GET", path: "/story/character-pool/:id", auth: true },
  async (req): Promise<CharacterTemplate> => {
    console.log("[CharacterPool] Getting character:", req.id);

    const row = await storyDB.queryRow<{
      id: string;
      name: string;
      role: string;
      archetype: string;
      emotional_nature: string;
      visual_profile: string;
      image_url: string | null;
      max_screen_time: number;
      available_chapters: number[];
      canon_settings: string[];
      recent_usage_count: number;
      total_usage_count: number;
      last_used_at: Date | null;
      created_at: Date;
      updated_at: Date;
      is_active: boolean;
    }>`
      SELECT * FROM character_pool WHERE id = ${req.id}
    `;

    if (!row) {
      throw new Error(`Character ${req.id} not found`);
    }

    return {
      id: row.id,
      name: row.name,
      role: row.role,
      archetype: row.archetype,
      emotionalNature: JSON.parse(row.emotional_nature),
      visualProfile: JSON.parse(row.visual_profile),
      imageUrl: row.image_url || undefined,
      maxScreenTime: row.max_screen_time,
      availableChapters: row.available_chapters,
      canonSettings: row.canon_settings,
      recentUsageCount: row.recent_usage_count,
      totalUsageCount: row.total_usage_count,
      lastUsedAt: row.last_used_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isActive: row.is_active,
    };
  }
);

// ===== ADD CHARACTER TO POOL =====
interface AddCharacterRequest {
  character: Omit<CharacterTemplate, "id" | "createdAt" | "updatedAt" | "recentUsageCount" | "totalUsageCount" | "lastUsedAt">;
}

export const addCharacter = api<AddCharacterRequest, CharacterTemplate>(
  { expose: true, method: "POST", path: "/story/character-pool", auth: true },
  async (req): Promise<CharacterTemplate> => {
    const id = crypto.randomUUID();
    const now = new Date();

    console.log("[CharacterPool] Adding new character:", req.character.name);

    await ensureImageUrlColumn();

    await storyDB.exec`
      INSERT INTO character_pool (
        id, name, role, archetype, emotional_nature, visual_profile, image_url,
        max_screen_time, available_chapters, canon_settings,
        recent_usage_count, total_usage_count, is_active,
        created_at, updated_at
      ) VALUES (
        ${id},
        ${req.character.name},
        ${req.character.role},
        ${req.character.archetype},
        ${JSON.stringify(req.character.emotionalNature)},
        ${JSON.stringify(req.character.visualProfile)},
        ${req.character.imageUrl || null},
        ${req.character.maxScreenTime},
        ${req.character.availableChapters},
        ${req.character.canonSettings || []},
        0,
        0,
        ${req.character.isActive ?? true},
        ${now},
        ${now}
      )
    `;

    console.log("[CharacterPool] Character added:", id);

    return {
      id,
      ...req.character,
      recentUsageCount: 0,
      totalUsageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
  }
);

// ===== UPDATE CHARACTER =====
interface UpdateCharacterRequest {
  id: string;
  updates: Partial<Omit<CharacterTemplate, "id" | "createdAt" | "updatedAt">>;
}

export const updateCharacter = api<UpdateCharacterRequest, CharacterTemplate>(
  { expose: true, method: "PUT", path: "/story/character-pool/:id", auth: true },
  async (req): Promise<CharacterTemplate> => {
    console.log("[CharacterPool] Updating character:", req.id);

    await ensureImageUrlColumn();

    // Simple update approach - update each field separately if provided
    const now = new Date();

    if (req.updates.name) {
      await storyDB.exec`UPDATE character_pool SET name = ${req.updates.name}, updated_at = ${now} WHERE id = ${req.id}`;
    }
    if (req.updates.role) {
      await storyDB.exec`UPDATE character_pool SET role = ${req.updates.role}, updated_at = ${now} WHERE id = ${req.id}`;
    }
    if (req.updates.archetype) {
      await storyDB.exec`UPDATE character_pool SET archetype = ${req.updates.archetype}, updated_at = ${now} WHERE id = ${req.id}`;
    }
    if (req.updates.emotionalNature) {
      await storyDB.exec`UPDATE character_pool SET emotional_nature = ${JSON.stringify(req.updates.emotionalNature)}, updated_at = ${now} WHERE id = ${req.id}`;
    }
    if (req.updates.visualProfile) {
      await storyDB.exec`UPDATE character_pool SET visual_profile = ${JSON.stringify(req.updates.visualProfile)}, updated_at = ${now} WHERE id = ${req.id}`;
    }
    if (req.updates.imageUrl !== undefined) {
      await storyDB.exec`UPDATE character_pool SET image_url = ${req.updates.imageUrl}, updated_at = ${now} WHERE id = ${req.id}`;
    }
    if (req.updates.maxScreenTime !== undefined) {
      await storyDB.exec`UPDATE character_pool SET max_screen_time = ${req.updates.maxScreenTime}, updated_at = ${now} WHERE id = ${req.id}`;
    }
    if (req.updates.availableChapters) {
      await storyDB.exec`UPDATE character_pool SET available_chapters = ${req.updates.availableChapters}, updated_at = ${now} WHERE id = ${req.id}`;
    }
    if (req.updates.canonSettings) {
      await storyDB.exec`UPDATE character_pool SET canon_settings = ${req.updates.canonSettings}, updated_at = ${now} WHERE id = ${req.id}`;
    }
    if (req.updates.isActive !== undefined) {
      await storyDB.exec`UPDATE character_pool SET is_active = ${req.updates.isActive}, updated_at = ${now} WHERE id = ${req.id}`;
    }

    console.log("[CharacterPool] Character updated:", req.id);

    return getCharacter({ id: req.id });
  }
);

// ===== GENERATE CHARACTER IMAGE =====
interface GenerateCharacterImageRequest {
  id: string;
  style?: "storybook" | "watercolor" | "concept";
}

interface GenerateCharacterImageResponse {
  characterId: string;
  imageUrl: string;
  prompt: string;
  debugInfo?: Record<string, unknown>;
}

export const generateCharacterImage = api<GenerateCharacterImageRequest, GenerateCharacterImageResponse>(
  { expose: true, method: "POST", path: "/story/character-pool/:id/generate-image", auth: true },
  async (req): Promise<GenerateCharacterImageResponse> => {
    console.log("[CharacterPool] Generating image for character:", req.id);

    const character = await getCharacter({ id: req.id });
    const prompt = buildCharacterImagePrompt(character, req.style);

    const result = await runwareGenerateImage({
      prompt,
      width: 640,
      height: 640,
      steps: 28,
      CFGScale: 7,
      outputFormat: "WEBP",
      negativePrompt: "photorealistic, horror, grotesque, text, watermark, signature, disfigured, deformed, low quality",
    });

    console.log("[CharacterPool] Character image generation completed:", {
      id: req.id,
      hasUrl: Boolean(result.imageUrl),
      promptLength: prompt.length,
    });

    return {
      characterId: req.id,
      imageUrl: result.imageUrl,
      prompt,
      debugInfo: result.debugInfo,
    };
  }
);

// ===== DELETE CHARACTER (soft delete) =====
interface DeleteCharacterRequest {
  id: string;
}

export const deleteCharacter = api<DeleteCharacterRequest, { success: boolean }>(
  { expose: true, method: "DELETE", path: "/story/character-pool/:id", auth: true },
  async (req): Promise<{ success: boolean }> => {
    console.log("[CharacterPool] Soft deleting character:", req.id);

    await storyDB.exec`
      UPDATE character_pool
      SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${req.id}
    `;

    console.log("[CharacterPool] Character deleted:", req.id);

    return { success: true };
  }
);

// ===== GET CHARACTER USAGE STATISTICS =====
interface GetCharacterStatsRequest {
  id: string;
}

interface CharacterStats {
  character: CharacterTemplate;
  usageStats: {
    totalUsages: number;
    recentUsages: number;
    lastUsed?: Date;
    storiesUsedIn: {
      storyId: string;
      storyTitle: string;
      placeholder: string;
      createdAt: Date;
    }[];
  };
}

export const getCharacterStats = api<GetCharacterStatsRequest, CharacterStats>(
  { expose: true, method: "GET", path: "/story/character-pool/:id/stats", auth: true },
  async (req): Promise<CharacterStats> => {
    console.log("[CharacterPool] Getting stats for character:", req.id);

    const character = await getCharacter({ id: req.id });

    // Get stories where this character was used
    const usageRows = await storyDB.queryAll<{
      story_id: string;
      placeholder: string;
      created_at: Date;
      story_title: string;
    }>`
      SELECT sc.story_id, sc.placeholder, sc.created_at, s.title as story_title
      FROM story_characters sc
      JOIN stories s ON s.id = sc.story_id
      WHERE sc.character_id = ${req.id}
      ORDER BY sc.created_at DESC
      LIMIT 20
    `;

    return {
      character,
      usageStats: {
        totalUsages: character.totalUsageCount || 0,
        recentUsages: character.recentUsageCount || 0,
        lastUsed: character.lastUsedAt,
        storiesUsedIn: usageRows.map(row => ({
          storyId: row.story_id,
          storyTitle: row.story_title,
          placeholder: row.placeholder,
          createdAt: row.created_at,
        })),
      },
    };
  }
);

// ===== RESET RECENT USAGE COUNTS =====
// This should be run periodically (e.g., monthly) to give all characters fresh chances
export const resetRecentUsage = api(
  { expose: true, method: "POST", path: "/story/character-pool/reset-usage", auth: true },
  async (): Promise<{ success: boolean; resetCount: number }> => {
    console.log("[CharacterPool] Resetting recent usage counts");

    const result = await storyDB.exec`
      UPDATE character_pool
      SET recent_usage_count = 0, updated_at = CURRENT_TIMESTAMP
      WHERE recent_usage_count > 0
    `;

    console.log("[CharacterPool] Reset complete");

    return {
      success: true,
      resetCount: 0, // Encore doesn't return affected rows count easily
    };
  }
);

// ===== SEED CHARACTER POOL =====
// Seeds the character pool with 18 pre-built characters
export const seedPool = api(
  { expose: true, method: "POST", path: "/story/character-pool/seed", auth: false },
  async (): Promise<{ success: boolean; count: number }> => {
    console.log("[CharacterPool] Seeding character pool...");

    try {
      const count = await seedCharacterPool();

      return {
        success: true,
        count,
      };
    } catch (error) {
      console.error("[CharacterPool] Seeding failed:", error);
      throw error;
    }
  }
);

// ===== EXPORT CHARACTERS =====
export const exportCharacters = api(
  { expose: true, method: "GET", path: "/story/character-pool/export", auth: true },
  async (): Promise<{ characters: CharacterTemplate[] }> => {
    console.log("[CharacterPool] Exporting all characters");
    const characters = await fetchAllCharacters();
    console.log(`[CharacterPool] Export payload size: ${characters.length} characters`);
    return { characters };
  }
);

// ===== IMPORT CHARACTERS =====
interface ImportCharactersRequest {
  characters: CharacterTemplate[];
}

export const importCharacters = api<ImportCharactersRequest, { success: boolean; imported: number }>(
  { expose: true, method: "POST", path: "/story/character-pool/import", auth: true },
  async (req): Promise<{ success: boolean; imported: number }> => {
    console.log("[CharacterPool] Importing characters");

    if (!Array.isArray(req.characters) || req.characters.length === 0) {
      throw APIError.invalidArgument("Import requires at least one character");
    }

    await ensureImageUrlColumn();

    const now = new Date();
    const sanitized = req.characters.map((character, index) => sanitizeCharacter(character, index, now));

    try {
      await storyDB.exec`BEGIN`;
      await storyDB.exec`DELETE FROM character_pool`;

      for (const character of sanitized) {
        await storyDB.exec`
          INSERT INTO character_pool (
            id, name, role, archetype, emotional_nature, visual_profile, image_url,
            max_screen_time, available_chapters, canon_settings,
            recent_usage_count, total_usage_count, last_used_at,
            is_active, created_at, updated_at
          ) VALUES (
            ${character.id},
            ${character.name},
            ${character.role},
            ${character.archetype},
            ${JSON.stringify(character.emotionalNature)},
            ${JSON.stringify(character.visualProfile)},
            ${character.imageUrl || null},
            ${character.maxScreenTime},
            ${character.availableChapters},
            ${character.canonSettings},
            ${character.recentUsageCount},
            ${character.totalUsageCount},
            ${character.lastUsedAt || null},
            ${character.isActive},
            ${character.createdAt},
            ${character.updatedAt}
          )
        `;
      }

      await storyDB.exec`COMMIT`;
      console.log(`[CharacterPool] Import completed. Inserted ${sanitized.length} characters`);

      return { success: true, imported: sanitized.length };
    } catch (error) {
      console.error("[CharacterPool] Import failed, rolling back:", error);
      await storyDB.exec`ROLLBACK`;
      throw APIError.internal(`Character import failed: ${(error as Error).message}`);
    }
  }
);

function buildCharacterImagePrompt(
  character: CharacterTemplate,
  style: GenerateCharacterImageRequest["style"]
): string {
  const visual = character.visualProfile || { description: "", imagePrompt: "", species: "", colorPalette: [] };
  const emotional = character.emotionalNature || { dominant: "", secondary: [], triggers: [] };

  const sections = [
    "Axel Scheffler inspired watercolor illustration for a children's story",
    visual.description ? `Primary description ${sanitizeSegment(visual.description)}` : "",
    visual.imagePrompt ? `Detailed cues ${sanitizeSegment(visual.imagePrompt)}` : "",
    character.role ? `Narrative role ${sanitizeSegment(character.role)}` : "",
    character.archetype ? `Archetype ${sanitizeSegment(character.archetype)}` : "",
    emotional.dominant ? `Emotional tone ${sanitizeSegment(emotional.dominant)}` : "",
    emotional.secondary?.length ? `Secondary moods ${sanitizeSegment(emotional.secondary.join(", "))}` : "",
    visual.species ? `Species or form ${sanitizeSegment(visual.species)}` : "",
    visual.colorPalette?.length
      ? `Color palette featuring ${sanitizeSegment(visual.colorPalette.join(", "))}`
      : "",
    style ? resolveCharacterStyle(style) : resolveCharacterStyle("storybook"),
    "Composition dynamic three-quarter view, friendly expression, child safe, no text, no watermark"
  ];

  return clampPromptLength(
    sections
      .map((section) => sanitizeSegment(section))
      .filter(Boolean)
      .join(". ")
  );
}

function sanitizeSegment(input: string | undefined | null): string {
  if (!input) {
    return "";
  }
  return String(input)
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveCharacterStyle(style: GenerateCharacterImageRequest["style"] | undefined): string {
  switch (style) {
    case "concept":
      return "Style whimsical concept art, high detail ink lines, layered watercolor washes, gentle fantasy lighting";
    case "watercolor":
      return "Style traditional watercolor storybook painting, soft gradients, textured paper, warm highlights";
    case "storybook":
    default:
      return "Style cozy European picture book, expressive gestures, inviting shapes, vibrant yet balanced colors";
  }
}

function clampPromptLength(prompt: string, max = 900): string {
  if (prompt.length <= max) {
    return prompt;
  }
  const truncated = prompt.slice(0, max);
  const lastPeriod = truncated.lastIndexOf(".");
  if (lastPeriod > max * 0.6) {
    return truncated.slice(0, lastPeriod + 1).trim();
  }
  return truncated.trim();
}

function isValidUuid(value: string | undefined | null): boolean {
  if (!value) {
    return false;
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

function toNumberArray(value: unknown, fallback: number[]): number[] {
  if (!value || !Array.isArray(value)) {
    return fallback;
  }
  const numbers = value
    .map((item) => Number(item))
    .filter((num) => Number.isFinite(num));
  return numbers.length > 0 ? numbers : fallback;
}

function toStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!value || !Array.isArray(value)) {
    return fallback;
  }
  const strings = value
    .map((item) => String(item).trim())
    .filter((str) => str.length > 0);
  return strings.length > 0 ? strings : fallback;
}

function sanitizeCharacter(character: CharacterTemplate, index: number, now: Date) {
  const id = isValidUuid(character.id) ? character.id! : crypto.randomUUID();
  const name = (character.name || `Character ${index + 1}`).trim();
  const role = (character.role || "companion").trim();
  const archetype = (character.archetype || "support").trim();

  const emotionalNature = character.emotionalNature || { dominant: "calm", secondary: [], triggers: [] };
  const visualProfile = character.visualProfile || {
    description: "",
    imagePrompt: "",
    species: "unknown",
    colorPalette: [],
  };

  const createdAt = character.createdAt ? new Date(character.createdAt) : now;
  const updatedAt = character.updatedAt ? new Date(character.updatedAt) : now;
  const lastUsedAt = character.lastUsedAt ? new Date(character.lastUsedAt) : null;

  return {
    id,
    name,
    role,
    archetype,
    emotionalNature,
    visualProfile,
    imageUrl: character.imageUrl || null,
    maxScreenTime: Number.isFinite(character.maxScreenTime) ? character.maxScreenTime : 50,
    availableChapters: toNumberArray(character.availableChapters, [1, 2, 3, 4, 5]),
    canonSettings: toStringArray(character.canonSettings),
    recentUsageCount: character.recentUsageCount ?? 0,
    totalUsageCount: character.totalUsageCount ?? 0,
    lastUsedAt,
    isActive: character.isActive ?? true,
    createdAt,
    updatedAt,
  };
}
