// Character Pool Management API
// Endpoints for managing the character pool

import { api, APIError } from "encore.dev/api";
import { ensureAdmin } from "../admin/authz";
import { storyDB } from "./db";
import { bibleFromRow } from "./character-bible-core";
import { sanitizeCharacter } from "./character-pool-import";
import type { CharacterTemplate } from "./types";
import { seedCharacterPool } from "./seed-characters";
import { runwareGenerateImage } from "../ai/image-generation";
import { FLUX2_KLEIN_9B_KV_MODEL } from "../ai/runware-image-model-options";
import { TALEA_IMAGE_STYLE } from "../ai/image-style";
import {
  maybeUploadImageUrlToBucket,
  normalizeImageUrlForStorage,
  resolveImageUrlForClient,
} from "../helpers/bucket-storage";

let characterPoolColumnsEnsured = false;

/**
 * PostgreSQL JSONB values may arrive as decoded objects or JSON strings,
 * depending on the database driver version.
 */
function parseCharacterJson<T>(value: unknown, field: string): T {
  if (typeof value === "string") {
    return JSON.parse(value) as T;
  }

  if (value !== null && typeof value === "object") {
    return value as T;
  }

  throw new Error(`Character pool field ${field} has an invalid JSON value`);
}

async function ensureImageUrlColumn(): Promise<void> {
  if (characterPoolColumnsEnsured) {
    return;
  }

  try {
    await storyDB.exec`
      ALTER TABLE character_pool
        ADD COLUMN IF NOT EXISTS image_url TEXT,
        ADD COLUMN IF NOT EXISTS gender TEXT CHECK(gender IN ('male', 'female', 'neutral', 'any')) DEFAULT 'any',
        ADD COLUMN IF NOT EXISTS age_category TEXT CHECK(age_category IN ('child', 'teenager', 'young_adult', 'adult', 'elder', 'ageless', 'any')) DEFAULT 'any',
        ADD COLUMN IF NOT EXISTS species_category TEXT CHECK(species_category IN ('human', 'humanoid', 'animal', 'magical_creature', 'mythical', 'elemental', 'any')) DEFAULT 'any',
        ADD COLUMN IF NOT EXISTS profession_tags TEXT[] DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS size_category TEXT CHECK(size_category IN ('tiny', 'small', 'medium', 'large', 'giant', 'any')) DEFAULT 'medium',
        ADD COLUMN IF NOT EXISTS social_class TEXT CHECK(social_class IN ('royalty', 'nobility', 'merchant', 'craftsman', 'commoner', 'outcast', 'any')) DEFAULT 'any',
        ADD COLUMN IF NOT EXISTS personality_keywords TEXT[] DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS physical_description TEXT,
        ADD COLUMN IF NOT EXISTS backstory TEXT,
        ADD COLUMN IF NOT EXISTS dominant_personality TEXT,
        ADD COLUMN IF NOT EXISTS secondary_traits TEXT[] DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS catchphrase TEXT,
        ADD COLUMN IF NOT EXISTS catchphrase_context TEXT,
        ADD COLUMN IF NOT EXISTS speech_style TEXT[] DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS emotional_triggers TEXT[] DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS quirk TEXT,
        ADD COLUMN IF NOT EXISTS want TEXT,
        ADD COLUMN IF NOT EXISTS fear TEXT,
        ADD COLUMN IF NOT EXISTS secret TEXT,
        ADD COLUMN IF NOT EXISTS running_gag TEXT,
        ADD COLUMN IF NOT EXISTS gesture TEXT,
        ADD COLUMN IF NOT EXISTS comic_role TEXT,
        ADD COLUMN IF NOT EXISTS can_lead BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS can_oppose BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS villain_style TEXT,
        ADD COLUMN IF NOT EXISTS intro_line TEXT,
        ADD COLUMN IF NOT EXISTS signature_visual TEXT,
        ADD COLUMN IF NOT EXISTS bible_version INTEGER NOT NULL DEFAULT 0
    `;
    characterPoolColumnsEnsured = true;
  } catch (err) {
    console.error("[CharacterPool] Failed ensuring character_pool columns:", err);
    throw err;
  }
}

async function fetchAllCharacters(): Promise<CharacterTemplate[]> {
  await ensureImageUrlColumn();

  const rows = await storyDB.queryAll<{
    id: string;
    name: string;
    role: string;
    archetype: string;
    emotional_nature: unknown;
    visual_profile: unknown;
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
    gender: string | null;
    age_category: string | null;
    species_category: string | null;
    profession_tags: string[] | null;
    size_category: string | null;
    social_class: string | null;
    personality_keywords: string[] | null;
    physical_description: string | null;
    backstory: string | null;
    // V2 personality fields (Migration 19)
    dominant_personality: string | null;
    secondary_traits: string[] | null;
    catchphrase: string | null;
    catchphrase_context: string | null;
    speech_style: string[] | null;
    emotional_triggers: string[] | null;
    quirk: string | null;
  } & Record<string, unknown>>`
    SELECT * FROM character_pool ORDER BY name
  `;

  return rows.map(row => ({
    // The character bible (migration 44); absent columns leave the fields undefined.
    ...bibleFromRow(row),
    id: row.id,
    name: row.name,
    role: row.role,
    archetype: row.archetype,
    emotionalNature: parseCharacterJson(row.emotional_nature, "emotional_nature"),
    visualProfile: parseCharacterJson(row.visual_profile, "visual_profile"),
    imageUrl: row.image_url || undefined,
    maxScreenTime: row.max_screen_time,
    availableChapters: row.available_chapters,
    canonSettings: row.canon_settings,
    recentUsageCount: row.recent_usage_count,
    totalUsageCount: row.total_usage_count,
    lastUsedAt: row.last_used_at || undefined,
    gender: row.gender || undefined,
    age_category: row.age_category || undefined,
    species_category: row.species_category || undefined,
    profession_tags: row.profession_tags || undefined,
    size_category: row.size_category || undefined,
    social_class: row.social_class || undefined,
    personality_keywords: row.personality_keywords || undefined,
    physical_description: row.physical_description || undefined,
    backstory: row.backstory || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isActive: row.is_active,
    // V2 personality fields
    dominantPersonality: row.dominant_personality || undefined,
    secondaryTraits: row.secondary_traits || undefined,
    catchphrase: row.catchphrase || undefined,
    catchphraseContext: row.catchphrase_context || undefined,
    speechStyle: row.speech_style || undefined,
    emotionalTriggers: row.emotional_triggers || undefined,
    quirk: row.quirk || undefined,
  }));
}

async function resolveCharacterForClient(character: CharacterTemplate): Promise<CharacterTemplate> {
  const resolvedImageUrl = await resolveImageUrlForClient(character.imageUrl);
  return {
    ...character,
    imageUrl: resolvedImageUrl ?? character.imageUrl,
  };
}

// ===== GET ALL CHARACTERS =====
export const listCharacters = api(
  { expose: true, method: "GET", path: "/story/character-pool", auth: true },
  async (): Promise<{ characters: CharacterTemplate[] }> => {
    console.log("[CharacterPool] Listing all active characters");

    const characters = await fetchAllCharacters();
    const resolvedCharacters = await Promise.all(characters.map(resolveCharacterForClient));

    console.log(`[CharacterPool] Found ${characters.length} characters (active and inactive)`);

    return { characters: resolvedCharacters };
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
      emotional_nature: unknown;
      visual_profile: unknown;
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
      gender: string | null;
      age_category: string | null;
      species_category: string | null;
      profession_tags: string[] | null;
      size_category: string | null;
      social_class: string | null;
      personality_keywords: string[] | null;
      physical_description: string | null;
      backstory: string | null;
      // V2 personality fields
      dominant_personality: string | null;
      secondary_traits: string[] | null;
      catchphrase: string | null;
      catchphrase_context: string | null;
      speech_style: string[] | null;
      emotional_triggers: string[] | null;
      quirk: string | null;
    } & Record<string, unknown>>`
      SELECT * FROM character_pool WHERE id = ${req.id}
    `;

    if (!row) {
      throw new Error(`Character ${req.id} not found`);
    }

    const character: CharacterTemplate = {
      ...bibleFromRow(row),
      id: row.id,
      name: row.name,
      role: row.role,
      archetype: row.archetype,
      emotionalNature: parseCharacterJson(row.emotional_nature, "emotional_nature"),
      visualProfile: parseCharacterJson(row.visual_profile, "visual_profile"),
      imageUrl: row.image_url || undefined,
      maxScreenTime: row.max_screen_time,
      availableChapters: row.available_chapters,
      canonSettings: row.canon_settings,
      recentUsageCount: row.recent_usage_count,
      totalUsageCount: row.total_usage_count,
      lastUsedAt: row.last_used_at || undefined,
      gender: row.gender || undefined,
      age_category: row.age_category || undefined,
      species_category: row.species_category || undefined,
      profession_tags: row.profession_tags || undefined,
      size_category: row.size_category || undefined,
      social_class: row.social_class || undefined,
      personality_keywords: row.personality_keywords || undefined,
      physical_description: row.physical_description || undefined,
      backstory: row.backstory || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isActive: row.is_active,
      // V2 personality fields
      dominantPersonality: row.dominant_personality || undefined,
      secondaryTraits: row.secondary_traits || undefined,
      catchphrase: row.catchphrase || undefined,
      catchphraseContext: row.catchphrase_context || undefined,
      speechStyle: row.speech_style || undefined,
      emotionalTriggers: row.emotional_triggers || undefined,
      quirk: row.quirk || undefined,
    };

    return await resolveCharacterForClient(character);
  }
);

// ===== ADD CHARACTER TO POOL =====
interface AddCharacterRequest {
  character: Omit<CharacterTemplate, "id" | "createdAt" | "updatedAt" | "recentUsageCount" | "totalUsageCount" | "lastUsedAt">;
}

export const addCharacter = api<AddCharacterRequest, CharacterTemplate>(
  { expose: true, method: "POST", path: "/story/character-pool", auth: true },
  async (req): Promise<CharacterTemplate> => {
    ensureAdmin();
    const id = crypto.randomUUID();
    const now = new Date();

    console.log("[CharacterPool] Adding new character:", req.character.name);

    await ensureImageUrlColumn();

    const normalizedImageUrl = req.character.imageUrl
      ? await normalizeImageUrlForStorage(req.character.imageUrl)
      : undefined;
    const uploadedImage = normalizedImageUrl
      ? await maybeUploadImageUrlToBucket(normalizedImageUrl, {
          prefix: "images/characters",
          filenameHint: `character-${id}`,
          uploadMode: "always",
        })
      : null;
    const finalImageUrl = uploadedImage?.url ?? normalizedImageUrl;

    await storyDB.exec`
      INSERT INTO character_pool (
        id, name, role, archetype, emotional_nature, visual_profile, image_url,
        max_screen_time, available_chapters, canon_settings,
        recent_usage_count, total_usage_count, is_active,
        created_at, updated_at,
        dominant_personality, secondary_traits, catchphrase, catchphrase_context,
        speech_style, emotional_triggers, quirk,
        want, fear, secret, running_gag, gesture, comic_role, can_lead, can_oppose, villain_style, intro_line, signature_visual, bible_version
      ) VALUES (
        ${id},
        ${req.character.name},
        ${req.character.role},
        ${req.character.archetype},
        ${JSON.stringify(req.character.emotionalNature)},
        ${JSON.stringify(req.character.visualProfile)},
        ${finalImageUrl || null},
        ${req.character.maxScreenTime},
        ${req.character.availableChapters},
        ${req.character.canonSettings || []},
        0,
        0,
        ${req.character.isActive ?? true},
        ${now},
        ${now},
        ${req.character.dominantPersonality || null},
        ${req.character.secondaryTraits || []},
        ${req.character.catchphrase || null},
        ${req.character.catchphraseContext || null},
        ${req.character.speechStyle || []},
        ${req.character.emotionalTriggers || []},
        ${req.character.quirk || null},
        ${req.character.want || null},
        ${req.character.fear || null},
        ${req.character.secret || null},
        ${req.character.runningGag || null},
        ${req.character.gesture || null},
        ${req.character.comicRole || null},
        ${req.character.canLead ?? false},
        ${req.character.canOppose ?? false},
        ${req.character.villainStyle || null},
        ${req.character.introLine || null},
        ${req.character.signatureVisual || null},
        ${req.character.want && req.character.runningGag ? 1 : 0}
      )
    `;

    console.log("[CharacterPool] Character added:", id);

    const resolvedImageUrl = await resolveImageUrlForClient(finalImageUrl);

    return {
      id,
      ...req.character,
      imageUrl: resolvedImageUrl ?? finalImageUrl,
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
    ensureAdmin();
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
      const normalizedImageUrl = req.updates.imageUrl
        ? await normalizeImageUrlForStorage(req.updates.imageUrl)
        : null;
      const uploadedImage = normalizedImageUrl
        ? await maybeUploadImageUrlToBucket(normalizedImageUrl, {
            prefix: "images/characters",
            filenameHint: `character-${req.id}`,
            uploadMode: "always",
          })
        : null;
      const finalImageUrl = uploadedImage?.url ?? normalizedImageUrl;

      await storyDB.exec`UPDATE character_pool SET image_url = ${finalImageUrl}, updated_at = ${now} WHERE id = ${req.id}`;
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
    // V2 personality fields
    if (req.updates.dominantPersonality !== undefined) {
      await storyDB.exec`UPDATE character_pool SET dominant_personality = ${req.updates.dominantPersonality || null}, updated_at = ${now} WHERE id = ${req.id}`;
    }
    if (req.updates.secondaryTraits !== undefined) {
      await storyDB.exec`UPDATE character_pool SET secondary_traits = ${req.updates.secondaryTraits || []}, updated_at = ${now} WHERE id = ${req.id}`;
    }
    if (req.updates.catchphrase !== undefined) {
      await storyDB.exec`UPDATE character_pool SET catchphrase = ${req.updates.catchphrase || null}, updated_at = ${now} WHERE id = ${req.id}`;
    }
    if (req.updates.catchphraseContext !== undefined) {
      await storyDB.exec`UPDATE character_pool SET catchphrase_context = ${req.updates.catchphraseContext || null}, updated_at = ${now} WHERE id = ${req.id}`;
    }
    if (req.updates.speechStyle !== undefined) {
      await storyDB.exec`UPDATE character_pool SET speech_style = ${req.updates.speechStyle || []}, updated_at = ${now} WHERE id = ${req.id}`;
    }
    if (req.updates.emotionalTriggers !== undefined) {
      await storyDB.exec`UPDATE character_pool SET emotional_triggers = ${req.updates.emotionalTriggers || []}, updated_at = ${now} WHERE id = ${req.id}`;
    }
    if (req.updates.quirk !== undefined) {
      await storyDB.exec`UPDATE character_pool SET quirk = ${req.updates.quirk || null}, updated_at = ${now} WHERE id = ${req.id}`;
    }
    if (req.updates.backstory !== undefined) {
      await storyDB.exec`UPDATE character_pool SET backstory = ${req.updates.backstory || null}, updated_at = ${now} WHERE id = ${req.id}`;
    }
    // The character bible (migration 44). A hand-edited bible counts as filled.
    const bible = req.updates;
    if (bible.want !== undefined) await storyDB.exec`UPDATE character_pool SET want = ${bible.want || null}, updated_at = ${now} WHERE id = ${req.id}`;
    if (bible.fear !== undefined) await storyDB.exec`UPDATE character_pool SET fear = ${bible.fear || null}, updated_at = ${now} WHERE id = ${req.id}`;
    if (bible.secret !== undefined) await storyDB.exec`UPDATE character_pool SET secret = ${bible.secret || null}, updated_at = ${now} WHERE id = ${req.id}`;
    if (bible.runningGag !== undefined) await storyDB.exec`UPDATE character_pool SET running_gag = ${bible.runningGag || null}, updated_at = ${now} WHERE id = ${req.id}`;
    if (bible.gesture !== undefined) await storyDB.exec`UPDATE character_pool SET gesture = ${bible.gesture || null}, updated_at = ${now} WHERE id = ${req.id}`;
    if (bible.comicRole !== undefined) await storyDB.exec`UPDATE character_pool SET comic_role = ${bible.comicRole || null}, updated_at = ${now} WHERE id = ${req.id}`;
    if (bible.canLead !== undefined) await storyDB.exec`UPDATE character_pool SET can_lead = ${Boolean(bible.canLead)}, updated_at = ${now} WHERE id = ${req.id}`;
    if (bible.canOppose !== undefined) await storyDB.exec`UPDATE character_pool SET can_oppose = ${Boolean(bible.canOppose)}, updated_at = ${now} WHERE id = ${req.id}`;
    if (bible.villainStyle !== undefined) await storyDB.exec`UPDATE character_pool SET villain_style = ${bible.villainStyle || null}, updated_at = ${now} WHERE id = ${req.id}`;
    if (bible.introLine !== undefined) await storyDB.exec`UPDATE character_pool SET intro_line = ${bible.introLine || null}, updated_at = ${now} WHERE id = ${req.id}`;
    if (bible.signatureVisual !== undefined) await storyDB.exec`UPDATE character_pool SET signature_visual = ${bible.signatureVisual || null}, updated_at = ${now} WHERE id = ${req.id}`;
    if (bible.want !== undefined || bible.runningGag !== undefined) {
      await storyDB.exec`UPDATE character_pool SET bible_version = CASE WHEN want IS NOT NULL AND running_gag IS NOT NULL THEN GREATEST(bible_version, 1) ELSE 0 END WHERE id = ${req.id}`;
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
    ensureAdmin();
    console.log("[CharacterPool] Generating image for character:", req.id);

    const character = await getCharacter({ id: req.id });
    const prompt = buildCharacterImagePrompt(character, req.style);

    const result = await runwareGenerateImage({
      prompt,
      model: FLUX2_KLEIN_9B_KV_MODEL,
      width: 1024,
      height: 1024,
      steps: 4,
      outputFormat: "WEBP",
    });

    console.log("[CharacterPool] Character image generation completed:", {
      id: req.id,
      hasUrl: Boolean(result.imageUrl),
      promptLength: prompt.length,
    });

    let finalImageUrl = result.imageUrl;
    if (finalImageUrl) {
      const uploaded = await maybeUploadImageUrlToBucket(finalImageUrl, {
        prefix: "images/characters",
        filenameHint: `character-${req.id}`,
        uploadMode: "always",
      });
      finalImageUrl = uploaded?.url ?? finalImageUrl;
    }
    const resolvedImageUrl = await resolveImageUrlForClient(finalImageUrl);

    return {
      characterId: req.id,
      imageUrl: resolvedImageUrl ?? finalImageUrl ?? result.imageUrl,
      prompt,
      debugInfo: result.debugInfo as unknown as Record<string, unknown>,
    };
  }
);

// ===== BATCH REGENERATE ALL CHARACTER IMAGES =====
interface BatchRegenerateImagesResponse {
  success: boolean;
  total: number;
  generated: number;
  failed: number;
  results: Array<{
    characterId: string;
    characterName: string;
    success: boolean;
    imageUrl?: string;
    error?: string;
  }>;
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  handler: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const workerCount = Math.min(limit, items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await handler(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

export const batchRegenerateCharacterImages = api<{}, BatchRegenerateImagesResponse>(
  { expose: true, method: "POST", path: "/story/character-pool/batch-regenerate-images", auth: true },
  async (): Promise<BatchRegenerateImagesResponse> => {
    ensureAdmin();
    console.log("[CharacterPool] Starting batch regeneration of all character images");

    const characters = await fetchAllCharacters();
    const activeCharacters = characters.filter(c => c.isActive);

    console.log(`[CharacterPool] Found ${activeCharacters.length} active characters to regenerate`);

    const rawLimit = Number(process.env.IMAGE_BATCH_CONCURRENCY || "3");
    const concurrency = Math.max(1, Math.min(rawLimit, 6));
    console.log(`[CharacterPool] Using parallel generation (concurrency=${concurrency})`);

    const results = await runWithConcurrency(
      activeCharacters,
      concurrency,
      async (character): Promise<BatchRegenerateImagesResponse['results'][number]> => {
        try {
          console.log(`[CharacterPool] Generating image for: ${character.name}`);

          const prompt = buildCharacterImagePrompt(character, "storybook");
          const result = await runwareGenerateImage({
            prompt,
            model: FLUX2_KLEIN_9B_KV_MODEL,
            width: 1024,
            height: 1024,
            steps: 4,
            outputFormat: "WEBP",
          });

          if (result.imageUrl) {
            let finalImageUrl = result.imageUrl;
            const uploaded = await maybeUploadImageUrlToBucket(finalImageUrl, {
              prefix: "images/characters",
              filenameHint: `character-${character.id}`,
              uploadMode: "always",
            });
            finalImageUrl = uploaded?.url ?? finalImageUrl;

            await storyDB.exec`
              UPDATE character_pool
              SET image_url = ${finalImageUrl}, updated_at = ${new Date()}
              WHERE id = ${character.id}
            `;

            console.log(`[CharacterPool] Generated image for ${character.name}`);
            return {
              characterId: character.id,
              characterName: character.name,
              success: true,
              imageUrl: finalImageUrl,
            };
          }

          console.warn(`[CharacterPool] No image URL for ${character.name}`);
          return {
            characterId: character.id,
            characterName: character.name,
            success: false,
            error: "No image URL returned",
          };
        } catch (error) {
          console.error(`[CharacterPool] Failed to generate image for ${character.name}:`, error);
          return {
            characterId: character.id,
            characterName: character.name,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
    );

    const generated = results.filter(r => r.success).length;
    const failed = results.length - generated;

    console.log(`[CharacterPool] Batch regeneration completed: ${generated} generated, ${failed} failed`);

    return {
      success: failed === 0,
      total: activeCharacters.length,
      generated,
      failed,
      results,
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
    ensureAdmin();
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
    ensureAdmin();
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
  { expose: true, method: "POST", path: "/story/character-pool/seed", auth: true },
  async (): Promise<{ success: boolean; count: number }> => {
    ensureAdmin();
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
    ensureAdmin();
    console.log("[CharacterPool] Exporting all characters");
    const characters = await fetchAllCharacters();
    console.log(`[CharacterPool] Export payload size: ${characters.length} characters`);
    return { characters };
  }
);

// ===== IMPORT CHARACTERS =====
interface ImportCharactersRequest {
  characters: any[];
}

export const importCharacters = api<ImportCharactersRequest, { success: boolean; imported: number }>(
  { expose: true, method: "POST", path: "/story/character-pool/import", auth: true },
  async (req): Promise<{ success: boolean; imported: number }> => {
    ensureAdmin();
    console.log("[CharacterPool] Importing characters");

    if (!Array.isArray(req.characters) || req.characters.length === 0) {
      throw APIError.invalidArgument("Import requires at least one character");
    }

    await ensureImageUrlColumn();

    const now = new Date();
    let sanitized: ReturnType<typeof sanitizeCharacter>[];
    try {
      sanitized = req.characters.map((character, index) => sanitizeCharacter(character, index, now));
      if (new Set(sanitized.map(character => character.id)).size !== sanitized.length) {
        throw new Error("Import contains duplicate character ids");
      }
    } catch (error) {
      throw APIError.invalidArgument((error as Error).message);
    }

    try {
      await using tx = await storyDB.begin();
      // Retain originals and story links. Deleting a pool row also cascades to
      // its life story and chapters; omission from an import only archives it.
      const importedIds = sanitized.map(character => character.id);
      await tx.exec`
        UPDATE character_pool SET is_active = FALSE, updated_at = ${now}
        WHERE is_active = TRUE AND NOT (id = ANY(${importedIds}))
      `;

      for (const character of sanitized) {
        await tx.exec`
          INSERT INTO character_pool (
            id, name, role, archetype, emotional_nature, visual_profile, image_url,
            max_screen_time, available_chapters, canon_settings,
            recent_usage_count, total_usage_count, last_used_at,
            is_active, created_at, updated_at,
            gender, age_category, species_category, profession_tags,
            size_category, social_class, personality_keywords,
            physical_description, backstory,
            dominant_personality, secondary_traits, catchphrase, catchphrase_context,
            speech_style, emotional_triggers, quirk,
            want, fear, secret, running_gag, gesture, comic_role,
            can_lead, can_oppose, villain_style, intro_line, signature_visual, bible_version
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
            ${character.updatedAt},
            ${character.gender},
            ${character.age_category},
            ${character.species_category},
            ${character.profession_tags},
            ${character.size_category},
            ${character.social_class},
            ${character.personality_keywords},
            ${character.physical_description || null},
            ${character.backstory || null},
            ${character.dominantPersonality || null},
            ${character.secondaryTraits || []},
            ${character.catchphrase || null},
            ${character.catchphraseContext || null},
            ${character.speechStyle || []},
            ${character.emotionalTriggers || []},
            ${character.quirk || null},
            ${character.want ?? null}, ${character.fear ?? null}, ${character.secret ?? null},
            ${character.runningGag ?? null}, ${character.gesture ?? null}, ${character.comicRole ?? null},
            ${character.canLead ?? false}, ${character.canOppose ?? false}, ${character.villainStyle ?? null},
            ${character.introLine ?? null}, ${character.signatureVisual ?? null}, ${character.bibleVersion ?? 0}
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name, role = EXCLUDED.role, archetype = EXCLUDED.archetype,
            emotional_nature = EXCLUDED.emotional_nature, visual_profile = EXCLUDED.visual_profile,
            image_url = COALESCE(EXCLUDED.image_url, character_pool.image_url), max_screen_time = EXCLUDED.max_screen_time,
            available_chapters = EXCLUDED.available_chapters, canon_settings = EXCLUDED.canon_settings,
            recent_usage_count = GREATEST(character_pool.recent_usage_count, EXCLUDED.recent_usage_count),
            total_usage_count = GREATEST(character_pool.total_usage_count, EXCLUDED.total_usage_count),
            last_used_at = GREATEST(character_pool.last_used_at, EXCLUDED.last_used_at),
            is_active = EXCLUDED.is_active, updated_at = ${now},
            gender = EXCLUDED.gender, age_category = EXCLUDED.age_category,
            species_category = EXCLUDED.species_category, profession_tags = EXCLUDED.profession_tags,
            size_category = EXCLUDED.size_category, social_class = EXCLUDED.social_class,
            personality_keywords = EXCLUDED.personality_keywords,
            physical_description = EXCLUDED.physical_description, backstory = EXCLUDED.backstory,
            dominant_personality = EXCLUDED.dominant_personality, secondary_traits = EXCLUDED.secondary_traits,
            catchphrase = EXCLUDED.catchphrase, catchphrase_context = EXCLUDED.catchphrase_context,
            speech_style = EXCLUDED.speech_style, emotional_triggers = EXCLUDED.emotional_triggers,
            quirk = EXCLUDED.quirk,
            want = COALESCE(EXCLUDED.want, character_pool.want),
            fear = COALESCE(EXCLUDED.fear, character_pool.fear),
            secret = COALESCE(EXCLUDED.secret, character_pool.secret),
            running_gag = COALESCE(EXCLUDED.running_gag, character_pool.running_gag),
            gesture = COALESCE(EXCLUDED.gesture, character_pool.gesture),
            comic_role = COALESCE(EXCLUDED.comic_role, character_pool.comic_role),
            can_lead = CASE WHEN ${character.canLead !== undefined} THEN EXCLUDED.can_lead ELSE character_pool.can_lead END,
            can_oppose = CASE WHEN ${character.canOppose !== undefined} THEN EXCLUDED.can_oppose ELSE character_pool.can_oppose END,
            villain_style = CASE WHEN ${character.canOppose === false} THEN NULL ELSE COALESCE(EXCLUDED.villain_style, character_pool.villain_style) END,
            intro_line = COALESCE(EXCLUDED.intro_line, character_pool.intro_line),
            signature_visual = COALESCE(EXCLUDED.signature_visual, character_pool.signature_visual),
            bible_version = GREATEST(character_pool.bible_version, EXCLUDED.bible_version)
        `;
      }

      await tx.commit();
      console.log(`[CharacterPool] Import completed. Inserted ${sanitized.length} characters`);

      return { success: true, imported: sanitized.length };
    } catch (error) {
      console.error("[CharacterPool] Import failed, rolling back:", error);
      throw APIError.internal(`Character import failed: ${(error as Error).message}`);
    }
  }
);

function buildCharacterImagePrompt(
  character: CharacterTemplate,
  _style: GenerateCharacterImageRequest["style"]
): string {
  const visual = character.visualProfile || { description: "", imagePrompt: "", species: "", colorPalette: [] };
  const emotional = character.emotionalNature || { dominant: "", secondary: [], triggers: [] };

  const sections = [
    "A single isolated full-body character reference, complete figure from head to feet or natural body extremities, centered with generous empty margin, plain white background, no scenery or props unless part of the character itself.",
    TALEA_IMAGE_STYLE,
    // Use only the imagePrompt field for image generation (dedicated for this purpose)
    visual.imagePrompt ? sanitizeSegment(visual.imagePrompt) : sanitizeSegment(visual.description || character.physical_description || ""),
    character.role ? `Narrative role ${sanitizeSegment(character.role)}` : "",
    character.archetype ? `Archetype ${sanitizeSegment(character.archetype)}` : "",
    emotional.dominant ? `Emotional tone ${sanitizeSegment(emotional.dominant)}` : "",
    emotional.secondary?.length ? `Secondary moods ${sanitizeSegment(emotional.secondary.join(", "))}` : "",
    visual.species ? `Species or form ${sanitizeSegment(visual.species)}` : "",
    visual.colorPalette?.length
      ? `Color palette featuring ${sanitizeSegment(visual.colorPalette.join(", "))}`
      : "",
    "Final composition: one complete character, head to feet or body extremities fully visible with space around them, isolated against a plain white background with no setting or unrelated props, child safe, no text, no watermark"
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
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampPromptLength(prompt: string, max = 4000): string {
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
