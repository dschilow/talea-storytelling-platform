import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { fairytalesDB } from "./db";
import type {
  FairyTale,
  FairyTaleRole,
  FairyTaleScene,
  GetFairyTaleResponse,
} from "./types";

// =====================================================
// FAIRY TALES MANAGEMENT APIs (Admin Only)
// =====================================================

export interface ExportFairyTalesRequest {
  taleIds?: string[]; // If empty, export all
}

export interface ExportFairyTalesResponse {
  tales: CompleteFairyTaleExport[];
  exportedAt: string;
  version: string;
}

export interface CompleteFairyTaleExport {
  tale: FairyTale;
  roles: FairyTaleRole[];
  scenes: FairyTaleScene[];
}

export interface ImportFairyTalesRequest {
  tales: CompleteFairyTaleExport[];
  overwriteExisting?: boolean;
}

export interface ImportFairyTalesResponse {
  imported: number;
  updated: number;
  skipped: number;
  errors: { taleId: string; error: string }[];
}

export interface UpdateFairyTaleRequest {
  id: string;
  updates: Partial<Omit<FairyTale, 'id' | 'createdAt' | 'updatedAt'>>;
}

export interface DeleteFairyTaleRequest {
  id: string;
}

export interface UpdateRoleRequest {
  taleId: string;
  roleId: number;
  updates: Partial<Omit<FairyTaleRole, 'id' | 'taleId' | 'createdAt'>>;
}

export interface DeleteRoleRequest {
  taleId: string;
  roleId: number;
}

export interface UpdateSceneRequest {
  taleId: string;
  sceneId: number;
  updates: Partial<Omit<FairyTaleScene, 'id' | 'taleId' | 'createdAt' | 'updatedAt'>>;
}

export interface DeleteSceneRequest {
  taleId: string;
  sceneId: number;
}

/**
 * Export fairy tales with all their roles and scenes in JSON format
 */
export const exportFairyTales = api<ExportFairyTalesRequest, ExportFairyTalesResponse>(
  { expose: true, method: "POST", path: "/fairytales/export", auth: true },
  async (req) => {
    console.log("[FairyTales] Exporting fairy tales");

    const auth = getAuthData()!;

    if (auth.role !== 'admin') {
      throw APIError.permissionDenied("Only admins can export fairy tales");
    }

    // Get tales
    let taleRows;
    if (req.taleIds && req.taleIds.length > 0) {
      taleRows = await fairytalesDB.queryAll<any>`
        SELECT
          id, title, source, original_language, english_translation,
          culture_region, age_recommendation, duration_minutes,
          genre_tags, moral_lesson, summary, is_active,
          created_at, updated_at
        FROM fairy_tales
        WHERE id = ANY(${req.taleIds})
        ORDER BY age_recommendation ASC, title ASC
      `;
    } else {
      taleRows = await fairytalesDB.queryAll<any>`
        SELECT
          id, title, source, original_language, english_translation,
          culture_region, age_recommendation, duration_minutes,
          genre_tags, moral_lesson, summary, is_active,
          created_at, updated_at
        FROM fairy_tales
        ORDER BY age_recommendation ASC, title ASC
      `;
    }

    const exports: CompleteFairyTaleExport[] = [];

    for (const taleRow of taleRows) {
      const tale: FairyTale = {
        id: taleRow.id,
        title: taleRow.title,
        source: taleRow.source,
        originalLanguage: taleRow.original_language,
        englishTranslation: taleRow.english_translation,
        cultureRegion: taleRow.culture_region,
        ageRecommendation: taleRow.age_recommendation,
        durationMinutes: taleRow.duration_minutes,
        genreTags: Array.isArray(taleRow.genre_tags) ? taleRow.genre_tags : [],
        moralLesson: taleRow.moral_lesson,
        summary: taleRow.summary,
        isActive: taleRow.is_active,
        createdAt: taleRow.created_at.toISOString(),
        updatedAt: taleRow.updated_at.toISOString(),
      };

      // Get roles
      const roleRows = await fairytalesDB.queryAll<any>`
        SELECT
          id, tale_id, role_type, role_name, role_count, description,
          required, archetype_preference, age_range_min, age_range_max,
          profession_preference, created_at
        FROM fairy_tale_roles
        WHERE tale_id = ${taleRow.id}
        ORDER BY
          CASE role_type
            WHEN 'protagonist' THEN 1
            WHEN 'antagonist' THEN 2
            WHEN 'helper' THEN 3
            WHEN 'love_interest' THEN 4
            ELSE 5
          END
      `;

      const roles: FairyTaleRole[] = roleRows.map((row) => ({
        id: row.id,
        taleId: row.tale_id,
        roleType: row.role_type,
        roleName: row.role_name,
        roleCount: row.role_count,
        description: row.description,
        required: row.required,
        archetypePreference: row.archetype_preference,
        ageRangeMin: row.age_range_min,
        ageRangeMax: row.age_range_max,
        professionPreference: Array.isArray(row.profession_preference) ? row.profession_preference : [],
        createdAt: row.created_at.toISOString(),
      }));

      // Get scenes
      const sceneRows = await fairytalesDB.queryAll<any>`
        SELECT
          id, tale_id, scene_number, scene_title, scene_description,
          dialogue_template, character_variables, setting, mood,
          illustration_prompt_template, duration_seconds,
          created_at, updated_at
        FROM fairy_tale_scenes
        WHERE tale_id = ${taleRow.id}
        ORDER BY scene_number ASC
      `;

      const scenes: FairyTaleScene[] = sceneRows.map((row) => ({
        id: row.id,
        taleId: row.tale_id,
        sceneNumber: row.scene_number,
        sceneTitle: row.scene_title,
        sceneDescription: row.scene_description,
        dialogueTemplate: row.dialogue_template,
        characterVariables: row.character_variables || {},
        setting: row.setting,
        mood: row.mood,
        illustrationPromptTemplate: row.illustration_prompt_template,
        durationSeconds: row.duration_seconds,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      }));

      exports.push({ tale, roles, scenes });
    }

    console.log(`[FairyTales] Exported ${exports.length} fairy tales`);

    return {
      tales: exports,
      exportedAt: new Date().toISOString(),
      version: "1.0",
    };
  }
);

/**
 * Import fairy tales from JSON export
 */
export const importFairyTales = api<ImportFairyTalesRequest, ImportFairyTalesResponse>(
  { expose: true, method: "POST", path: "/fairytales/import", auth: true },
  async (req) => {
    console.log("[FairyTales] Importing fairy tales");

    const auth = getAuthData()!;

    if (auth.role !== 'admin') {
      throw APIError.permissionDenied("Only admins can import fairy tales");
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: { taleId: string; error: string }[] = [];

    for (const item of req.tales) {
      try {
        // Check if tale exists
        const existingTale = await fairytalesDB.queryRow<any>`
          SELECT id FROM fairy_tales WHERE id = ${item.tale.id}
        `;

        if (existingTale && !req.overwriteExisting) {
          skipped++;
          continue;
        }

        if (existingTale && req.overwriteExisting) {
          // Update existing tale
          await fairytalesDB.exec`
            UPDATE fairy_tales SET
              title = ${item.tale.title},
              source = ${item.tale.source},
              original_language = ${item.tale.originalLanguage},
              english_translation = ${item.tale.englishTranslation},
              culture_region = ${item.tale.cultureRegion},
              age_recommendation = ${item.tale.ageRecommendation},
              duration_minutes = ${item.tale.durationMinutes},
              genre_tags = ${JSON.stringify(item.tale.genreTags)},
              moral_lesson = ${item.tale.moralLesson},
              summary = ${item.tale.summary},
              is_active = ${item.tale.isActive},
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ${item.tale.id}
          `;

          // Delete existing roles and scenes
          await fairytalesDB.exec`
            DELETE FROM fairy_tale_roles WHERE tale_id = ${item.tale.id}
          `;
          await fairytalesDB.exec`
            DELETE FROM fairy_tale_scenes WHERE tale_id = ${item.tale.id}
          `;

          updated++;
        } else {
          // Insert new tale
          await fairytalesDB.exec`
            INSERT INTO fairy_tales (
              id, title, source, original_language, english_translation,
              culture_region, age_recommendation, duration_minutes,
              genre_tags, moral_lesson, summary, is_active
            ) VALUES (
              ${item.tale.id}, ${item.tale.title}, ${item.tale.source},
              ${item.tale.originalLanguage}, ${item.tale.englishTranslation},
              ${item.tale.cultureRegion}, ${item.tale.ageRecommendation},
              ${item.tale.durationMinutes}, ${JSON.stringify(item.tale.genreTags)},
              ${item.tale.moralLesson}, ${item.tale.summary}, ${item.tale.isActive}
            )
          `;

          imported++;
        }

        // Insert roles
        for (const role of item.roles) {
          await fairytalesDB.exec`
            INSERT INTO fairy_tale_roles (
              tale_id, role_type, role_name, role_count, description,
              required, archetype_preference, age_range_min, age_range_max,
              profession_preference
            ) VALUES (
              ${item.tale.id}, ${role.roleType}, ${role.roleName}, ${role.roleCount},
              ${role.description}, ${role.required}, ${role.archetypePreference},
              ${role.ageRangeMin}, ${role.ageRangeMax}, ${JSON.stringify(role.professionPreference)}
            )
          `;
        }

        // Insert scenes
        for (const scene of item.scenes) {
          await fairytalesDB.exec`
            INSERT INTO fairy_tale_scenes (
              tale_id, scene_number, scene_title, scene_description,
              dialogue_template, character_variables, setting, mood,
              illustration_prompt_template, duration_seconds
            ) VALUES (
              ${item.tale.id}, ${scene.sceneNumber}, ${scene.sceneTitle},
              ${scene.sceneDescription}, ${scene.dialogueTemplate},
              ${JSON.stringify(scene.characterVariables)}, ${scene.setting},
              ${scene.mood}, ${scene.illustrationPromptTemplate}, ${scene.durationSeconds}
            )
          `;
        }

        // Initialize usage stats if not exists
        const statsExists = await fairytalesDB.queryRow<any>`
          SELECT tale_id FROM fairy_tale_usage_stats WHERE tale_id = ${item.tale.id}
        `;

        if (!statsExists) {
          await fairytalesDB.exec`
            INSERT INTO fairy_tale_usage_stats (tale_id, total_generations, successful_generations)
            VALUES (${item.tale.id}, 0, 0)
          `;
        }

      } catch (error: any) {
        console.error(`[FairyTales] Error importing tale ${item.tale.id}:`, error);
        errors.push({
          taleId: item.tale.id,
          error: error.message || "Unknown error",
        });
      }
    }

    console.log(`[FairyTales] Import complete: ${imported} imported, ${updated} updated, ${skipped} skipped, ${errors.length} errors`);

    return {
      imported,
      updated,
      skipped,
      errors,
    };
  }
);

/**
 * Update a fairy tale
 */
export const updateFairyTale = api<UpdateFairyTaleRequest, FairyTale>(
  { expose: true, method: "PATCH", path: "/fairytales/:id", auth: true },
  async (req) => {
    console.log("[FairyTales] Updating fairy tale:", req.id);

    const auth = getAuthData()!;

    if (auth.role !== 'admin') {
      throw APIError.permissionDenied("Only admins can update fairy tales");
    }

    // Get current tale first
    const currentTale = await fairytalesDB.queryRow<any>`
      SELECT
        id, title, source, original_language, english_translation,
        culture_region, age_recommendation, duration_minutes,
        genre_tags, moral_lesson, summary, is_active,
        created_at, updated_at
      FROM fairy_tales
      WHERE id = ${req.id}
    `;

    if (!currentTale) {
      throw APIError.notFound(`Fairy tale ${req.id} not found`);
    }

    const updates = req.updates;

    // Use current values for fields not being updated
    const title = updates.title ?? currentTale.title;
    const source = updates.source ?? currentTale.source;
    const originalLanguage = updates.originalLanguage ?? currentTale.original_language;
    const englishTranslation = updates.englishTranslation ?? currentTale.english_translation;
    const cultureRegion = updates.cultureRegion ?? currentTale.culture_region;
    const ageRecommendation = updates.ageRecommendation ?? currentTale.age_recommendation;
    const durationMinutes = updates.durationMinutes ?? currentTale.duration_minutes;
    const genreTags = updates.genreTags !== undefined ? JSON.stringify(updates.genreTags) : currentTale.genre_tags;
    const moralLesson = updates.moralLesson ?? currentTale.moral_lesson;
    const summary = updates.summary ?? currentTale.summary;
    const isActive = updates.isActive ?? currentTale.is_active;

    await fairytalesDB.exec`
      UPDATE fairy_tales
      SET
        title = ${title},
        source = ${source},
        original_language = ${originalLanguage},
        english_translation = ${englishTranslation},
        culture_region = ${cultureRegion},
        age_recommendation = ${ageRecommendation},
        duration_minutes = ${durationMinutes},
        genre_tags = ${genreTags},
        moral_lesson = ${moralLesson},
        summary = ${summary},
        is_active = ${isActive},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${req.id}
    `;

    // Fetch and return updated tale
    const taleRow = await fairytalesDB.queryRow<any>`
      SELECT
        id, title, source, original_language, english_translation,
        culture_region, age_recommendation, duration_minutes,
        genre_tags, moral_lesson, summary, is_active,
        created_at, updated_at
      FROM fairy_tales
      WHERE id = ${req.id}
    `;

    console.log(`[FairyTales] Updated fairy tale ${req.id}`);

    return {
      id: taleRow!.id,
      title: taleRow!.title,
      source: taleRow!.source,
      originalLanguage: taleRow!.original_language,
      englishTranslation: taleRow!.english_translation,
      cultureRegion: taleRow!.culture_region,
      ageRecommendation: taleRow!.age_recommendation,
      durationMinutes: taleRow!.duration_minutes,
      genreTags: Array.isArray(taleRow!.genre_tags) ? taleRow!.genre_tags : [],
      moralLesson: taleRow!.moral_lesson,
      summary: taleRow!.summary,
      isActive: taleRow!.is_active,
      createdAt: taleRow!.created_at.toISOString(),
      updatedAt: taleRow!.updated_at.toISOString(),
    };
  }
);

/**
 * Delete a fairy tale (soft delete - sets is_active to false)
 */
export const deleteFairyTale = api<DeleteFairyTaleRequest, { success: boolean }>(
  { expose: true, method: "DELETE", path: "/fairytales/:id", auth: true },
  async (req) => {
    console.log("[FairyTales] Deleting fairy tale:", req.id);

    const auth = getAuthData()!;

    if (auth.role !== 'admin') {
      throw APIError.permissionDenied("Only admins can delete fairy tales");
    }

    // Soft delete
    await fairytalesDB.exec`
      UPDATE fairy_tales
      SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${req.id}
    `;

    console.log(`[FairyTales] Deleted fairy tale ${req.id}`);

    return { success: true };
  }
);

// =====================================================
// ROLE MANAGEMENT APIs
// =====================================================
// Note: Create role API is in catalog.ts (addFairyTaleRole)

/**
 * Update a role
 */
export const updateRole = api<UpdateRoleRequest, FairyTaleRole>(
  { expose: true, method: "PATCH", path: "/fairytales/:taleId/roles/:roleId", auth: true },
  async (req) => {
    console.log("[FairyTales] Updating role:", req.roleId);

    const auth = getAuthData()!;

    if (auth.role !== 'admin') {
      throw APIError.permissionDenied("Only admins can update roles");
    }

    // Get current role
    const currentRole = await fairytalesDB.queryRow<any>`
      SELECT
        id, tale_id, role_type, role_name, role_count, description,
        required, archetype_preference, age_range_min, age_range_max,
        profession_preference, created_at
      FROM fairy_tale_roles
      WHERE id = ${req.roleId} AND tale_id = ${req.taleId}
    `;

    if (!currentRole) {
      throw APIError.notFound(`Role ${req.roleId} not found`);
    }

    const updates = req.updates;

    // Use current values for fields not being updated
    const roleType = updates.roleType ?? currentRole.role_type;
    const roleName = updates.roleName ?? currentRole.role_name;
    const roleCount = updates.roleCount ?? currentRole.role_count;
    const description = updates.description ?? currentRole.description;
    const required = updates.required ?? currentRole.required;
    const archetypePreference = updates.archetypePreference ?? currentRole.archetype_preference;
    const ageRangeMin = updates.ageRangeMin ?? currentRole.age_range_min;
    const ageRangeMax = updates.ageRangeMax ?? currentRole.age_range_max;
    const professionPreference = updates.professionPreference !== undefined
      ? JSON.stringify(updates.professionPreference)
      : currentRole.profession_preference;

    await fairytalesDB.exec`
      UPDATE fairy_tale_roles
      SET
        role_type = ${roleType},
        role_name = ${roleName},
        role_count = ${roleCount},
        description = ${description},
        required = ${required},
        archetype_preference = ${archetypePreference},
        age_range_min = ${ageRangeMin},
        age_range_max = ${ageRangeMax},
        profession_preference = ${professionPreference}
      WHERE id = ${req.roleId}
    `;

    // Fetch and return updated role
    const roleRow = await fairytalesDB.queryRow<any>`
      SELECT
        id, tale_id, role_type, role_name, role_count, description,
        required, archetype_preference, age_range_min, age_range_max,
        profession_preference, created_at
      FROM fairy_tale_roles
      WHERE id = ${req.roleId}
    `;

    console.log(`[FairyTales] Updated role ${req.roleId}`);

    return {
      id: roleRow!.id,
      taleId: roleRow!.tale_id,
      roleType: roleRow!.role_type,
      roleName: roleRow!.role_name,
      roleCount: roleRow!.role_count,
      description: roleRow!.description,
      required: roleRow!.required,
      archetypePreference: roleRow!.archetype_preference,
      ageRangeMin: roleRow!.age_range_min,
      ageRangeMax: roleRow!.age_range_max,
      professionPreference: Array.isArray(roleRow!.profession_preference) ? roleRow!.profession_preference : [],
      createdAt: roleRow!.created_at.toISOString(),
    };
  }
);

/**
 * Delete a role
 */
export const deleteRole = api<DeleteRoleRequest, { success: boolean }>(
  { expose: true, method: "DELETE", path: "/fairytales/:taleId/roles/:roleId", auth: true },
  async (req) => {
    console.log("[FairyTales] Deleting role:", req.roleId);

    const auth = getAuthData()!;

    if (auth.role !== 'admin') {
      throw APIError.permissionDenied("Only admins can delete roles");
    }

    await fairytalesDB.exec`
      DELETE FROM fairy_tale_roles
      WHERE id = ${req.roleId} AND tale_id = ${req.taleId}
    `;

    console.log(`[FairyTales] Deleted role ${req.roleId}`);

    return { success: true };
  }
);

// =====================================================
// SCENE MANAGEMENT APIs
// =====================================================
// Note: Create scene API is in catalog.ts (addFairyTaleScene)

/**
 * Update a scene
 */
export const updateScene = api<UpdateSceneRequest, FairyTaleScene>(
  { expose: true, method: "PATCH", path: "/fairytales/:taleId/scenes/:sceneId", auth: true },
  async (req) => {
    console.log("[FairyTales] Updating scene:", req.sceneId);

    const auth = getAuthData()!;

    if (auth.role !== 'admin') {
      throw APIError.permissionDenied("Only admins can update scenes");
    }

    // Get current scene
    const currentScene = await fairytalesDB.queryRow<any>`
      SELECT
        id, tale_id, scene_number, scene_title, scene_description,
        dialogue_template, character_variables, setting, mood,
        illustration_prompt_template, duration_seconds,
        created_at, updated_at
      FROM fairy_tale_scenes
      WHERE id = ${req.sceneId} AND tale_id = ${req.taleId}
    `;

    if (!currentScene) {
      throw APIError.notFound(`Scene ${req.sceneId} not found`);
    }

    const updates = req.updates;

    // Use current values for fields not being updated
    const sceneNumber = updates.sceneNumber ?? currentScene.scene_number;
    const sceneTitle = updates.sceneTitle ?? currentScene.scene_title;
    const sceneDescription = updates.sceneDescription ?? currentScene.scene_description;
    const dialogueTemplate = updates.dialogueTemplate ?? currentScene.dialogue_template;
    const characterVariables = updates.characterVariables !== undefined
      ? JSON.stringify(updates.characterVariables)
      : currentScene.character_variables;
    const setting = updates.setting ?? currentScene.setting;
    const mood = updates.mood ?? currentScene.mood;
    const illustrationPromptTemplate = updates.illustrationPromptTemplate ?? currentScene.illustration_prompt_template;
    const durationSeconds = updates.durationSeconds ?? currentScene.duration_seconds;

    await fairytalesDB.exec`
      UPDATE fairy_tale_scenes
      SET
        scene_number = ${sceneNumber},
        scene_title = ${sceneTitle},
        scene_description = ${sceneDescription},
        dialogue_template = ${dialogueTemplate},
        character_variables = ${characterVariables},
        setting = ${setting},
        mood = ${mood},
        illustration_prompt_template = ${illustrationPromptTemplate},
        duration_seconds = ${durationSeconds},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${req.sceneId}
    `;

    // Fetch and return updated scene
    const sceneRow = await fairytalesDB.queryRow<any>`
      SELECT
        id, tale_id, scene_number, scene_title, scene_description,
        dialogue_template, character_variables, setting, mood,
        illustration_prompt_template, duration_seconds,
        created_at, updated_at
      FROM fairy_tale_scenes
      WHERE id = ${req.sceneId}
    `;

    console.log(`[FairyTales] Updated scene ${req.sceneId}`);

    return {
      id: sceneRow!.id,
      taleId: sceneRow!.tale_id,
      sceneNumber: sceneRow!.scene_number,
      sceneTitle: sceneRow!.scene_title,
      sceneDescription: sceneRow!.scene_description,
      dialogueTemplate: sceneRow!.dialogue_template,
      characterVariables: sceneRow!.character_variables || {},
      setting: sceneRow!.setting,
      mood: sceneRow!.mood,
      illustrationPromptTemplate: sceneRow!.illustration_prompt_template,
      durationSeconds: sceneRow!.duration_seconds,
      createdAt: sceneRow!.created_at.toISOString(),
      updatedAt: sceneRow!.updated_at.toISOString(),
    };
  }
);

/**
 * Delete a scene
 */
export const deleteScene = api<DeleteSceneRequest, { success: boolean }>(
  { expose: true, method: "DELETE", path: "/fairytales/:taleId/scenes/:sceneId", auth: true },
  async (req) => {
    console.log("[FairyTales] Deleting scene:", req.sceneId);

    const auth = getAuthData()!;

    if (auth.role !== 'admin') {
      throw APIError.permissionDenied("Only admins can delete scenes");
    }

    await fairytalesDB.exec`
      DELETE FROM fairy_tale_scenes
      WHERE id = ${req.sceneId} AND tale_id = ${req.taleId}
    `;

    console.log(`[FairyTales] Deleted scene ${req.sceneId}`);

    return { success: true };
  }
);

/**
 * Reorder scenes in a tale
 */
export interface ReorderScenesRequest {
  taleId: string;
  sceneOrdering: { sceneId: number; newSceneNumber: number }[];
}

export const reorderScenes = api<ReorderScenesRequest, { success: boolean }>(
  { expose: true, method: "POST", path: "/fairytales/:taleId/scenes/reorder", auth: true },
  async (req) => {
    console.log("[FairyTales] Reordering scenes for tale:", req.taleId);

    const auth = getAuthData()!;

    if (auth.role !== 'admin') {
      throw APIError.permissionDenied("Only admins can reorder scenes");
    }

    // Update scene numbers
    for (const { sceneId, newSceneNumber } of req.sceneOrdering) {
      await fairytalesDB.exec`
        UPDATE fairy_tale_scenes
        SET scene_number = ${newSceneNumber}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${sceneId} AND tale_id = ${req.taleId}
      `;
    }

    console.log(`[FairyTales] Reordered ${req.sceneOrdering.length} scenes for tale ${req.taleId}`);

    return { success: true };
  }
);

