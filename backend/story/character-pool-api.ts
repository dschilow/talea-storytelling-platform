// Character Pool Management API
// Endpoints for managing the character pool

import { api } from "encore.dev/api";
import { storyDB } from "./db";
import type { CharacterTemplate } from "./types";

// ===== GET ALL CHARACTERS =====
export const listCharacters = api(
  { expose: true, method: "GET", path: "/story/character-pool", auth: true },
  async (): Promise<{ characters: CharacterTemplate[] }> => {
    console.log("[CharacterPool] Listing all active characters");

    const rows = await storyDB.queryAll<{
      id: string;
      name: string;
      role: string;
      archetype: string;
      emotional_nature: string;
      visual_profile: string;
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
      SELECT * FROM character_pool WHERE is_active = TRUE ORDER BY name
    `;

    const characters = rows.map(row => ({
      id: row.id,
      name: row.name,
      role: row.role,
      archetype: row.archetype,
      emotionalNature: JSON.parse(row.emotional_nature),
      visualProfile: JSON.parse(row.visual_profile),
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

    console.log(`[CharacterPool] Found ${characters.length} active characters`);

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
    const id = `char_custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    console.log("[CharacterPool] Adding new character:", req.character.name);

    await storyDB.exec`
      INSERT INTO character_pool (
        id, name, role, archetype, emotional_nature, visual_profile,
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

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];

    if (req.updates.name) {
      updates.push(`name = $${values.length + 1}`);
      values.push(req.updates.name);
    }
    if (req.updates.role) {
      updates.push(`role = $${values.length + 1}`);
      values.push(req.updates.role);
    }
    if (req.updates.archetype) {
      updates.push(`archetype = $${values.length + 1}`);
      values.push(req.updates.archetype);
    }
    if (req.updates.emotionalNature) {
      updates.push(`emotional_nature = $${values.length + 1}`);
      values.push(JSON.stringify(req.updates.emotionalNature));
    }
    if (req.updates.visualProfile) {
      updates.push(`visual_profile = $${values.length + 1}`);
      values.push(JSON.stringify(req.updates.visualProfile));
    }
    if (req.updates.maxScreenTime !== undefined) {
      updates.push(`max_screen_time = $${values.length + 1}`);
      values.push(req.updates.maxScreenTime);
    }
    if (req.updates.availableChapters) {
      updates.push(`available_chapters = $${values.length + 1}`);
      values.push(req.updates.availableChapters);
    }
    if (req.updates.canonSettings) {
      updates.push(`canon_settings = $${values.length + 1}`);
      values.push(req.updates.canonSettings);
    }
    if (req.updates.isActive !== undefined) {
      updates.push(`is_active = $${values.length + 1}`);
      values.push(req.updates.isActive);
    }

    updates.push(`updated_at = $${values.length + 1}`);
    values.push(new Date());

    if (updates.length === 1) {
      // Only updated_at, nothing to update
      return getCharacter({ id: req.id });
    }

    await storyDB.exec`
      UPDATE character_pool
      SET ${updates.join(", ")}
      WHERE id = ${req.id}
    `;

    console.log("[CharacterPool] Character updated:", req.id);

    return getCharacter({ id: req.id });
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
