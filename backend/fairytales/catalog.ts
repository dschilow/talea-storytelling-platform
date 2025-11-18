import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { fairytalesDB } from "./db";
import type {
  ListFairyTalesRequest,
  ListFairyTalesResponse,
  GetFairyTaleRequest,
  GetFairyTaleResponse,
  FairyTale,
  FairyTaleRole,
  FairyTaleScene,
} from "./types";

// =====================================================
// FAIRY TALES CATALOG APIs
// =====================================================

/**
 * List all available fairy tales with optional filtering
 */
export const listFairyTales = api<ListFairyTalesRequest, ListFairyTalesResponse>(
  { expose: true, method: "GET", path: "/fairytales", auth: true },
  async (req) => {
    console.log("[FairyTales] Listing fairy tales with filters:", req);

    const auth = getAuthData()!;
    const limit = req.limit || 50;
    const offset = req.offset || 0;

    // For now, get all tales and filter in memory
    // TODO: Optimize with proper WHERE clause once Encore supports dynamic queries better
    const allRows = await fairytalesDB.queryAll<any>`
      SELECT 
        id, title, source, original_language, english_translation,
        culture_region, age_recommendation, duration_minutes,
        genre_tags, moral_lesson, summary, is_active,
        created_at, updated_at
      FROM fairy_tales
      WHERE is_active = TRUE
      ORDER BY age_recommendation ASC, title ASC
    `;

    // Filter in memory
    let filteredRows = allRows;

    if (req.source) {
      filteredRows = filteredRows.filter(row => row.source === req.source);
    }

    if (req.minAge !== undefined) {
      filteredRows = filteredRows.filter(row => row.age_recommendation >= req.minAge!);
    }

    if (req.maxAge !== undefined) {
      filteredRows = filteredRows.filter(row => row.age_recommendation <= req.maxAge!);
    }

    if (req.genres && req.genres.length > 0) {
      filteredRows = filteredRows.filter(row => {
        const genres = Array.isArray(row.genre_tags) ? row.genre_tags : [];
        return req.genres!.some(g => genres.includes(g));
      });
    }

    const total = filteredRows.length;
    const rows = filteredRows.slice(offset, offset + limit);

    const tales: FairyTale[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      source: row.source,
      originalLanguage: row.original_language,
      englishTranslation: row.english_translation,
      cultureRegion: row.culture_region,
      ageRecommendation: row.age_recommendation,
      durationMinutes: row.duration_minutes,
      genreTags: Array.isArray(row.genre_tags) ? row.genre_tags : [],
      moralLesson: row.moral_lesson,
      summary: row.summary,
      isActive: row.is_active,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));

    console.log(`[FairyTales] Found ${tales.length} tales (total: ${total})`);

    return {
      tales,
      total,
    };
  }
);

/**
 * Get detailed information about a specific fairy tale
 */
export const getFairyTale = api<GetFairyTaleRequest, GetFairyTaleResponse>(
  { expose: true, method: "GET", path: "/fairytales/:id", auth: true },
  async (req) => {
    console.log("[FairyTales] Getting fairy tale:", req.id);

    const auth = getAuthData()!;

    // Get tale
    const taleRow = await fairytalesDB.queryRow<any>`
      SELECT 
        id, title, source, original_language, english_translation,
        culture_region, age_recommendation, duration_minutes,
        genre_tags, moral_lesson, summary, is_active,
        created_at, updated_at
      FROM fairy_tales
      WHERE id = ${req.id} AND is_active = TRUE
    `;

    if (!taleRow) {
      throw APIError.notFound(`Fairy tale ${req.id} not found`);
    }

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

    const response: GetFairyTaleResponse = { tale };

    // Optionally include roles
    if (req.includeRoles) {
      const roleRows = await fairytalesDB.queryAll<any>`
        SELECT
          id, tale_id, role_type, role_name, role_count, description,
          required, archetype_preference, age_range_min, age_range_max,
          profession_preference, created_at,
          species_requirement, gender_requirement, age_requirement,
          size_requirement, social_class_requirement
        FROM fairy_tale_roles
        WHERE tale_id = ${req.id}
        ORDER BY
          CASE role_type
            WHEN 'protagonist' THEN 1
            WHEN 'antagonist' THEN 2
            WHEN 'helper' THEN 3
            WHEN 'love_interest' THEN 4
            ELSE 5
          END
      `;

      response.roles = roleRows.map((row) => ({
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
        // NEW: Enhanced matching requirements (Migration 14)
        speciesRequirement: row.species_requirement || 'any',
        genderRequirement: row.gender_requirement || 'any',
        ageRequirement: row.age_requirement || 'any',
        sizeRequirement: row.size_requirement || 'any',
        socialClassRequirement: row.social_class_requirement || 'any',
        createdAt: row.created_at.toISOString(),
      }));
    }

    // Optionally include scenes
    if (req.includeScenes) {
      const sceneRows = await fairytalesDB.queryAll<any>`
        SELECT 
          id, tale_id, scene_number, scene_title, scene_description,
          dialogue_template, character_variables, setting, mood,
          illustration_prompt_template, duration_seconds,
          created_at, updated_at
        FROM fairy_tale_scenes
        WHERE tale_id = ${req.id}
        ORDER BY scene_number ASC
      `;

      response.scenes = sceneRows.map((row) => ({
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
    }

    console.log(`[FairyTales] Retrieved tale ${req.id} with ${response.roles?.length || 0} roles and ${response.scenes?.length || 0} scenes`);

    return response;
  }
);

// =====================================================
// ADMIN APIs (for adding/managing fairy tales)
// =====================================================

/**
 * Create a new fairy tale (admin only)
 */
export const createFairyTale = api<{ tale: Omit<FairyTale, 'createdAt' | 'updatedAt'> }, FairyTale>(
  { expose: true, method: "POST", path: "/fairytales", auth: true },
  async (req) => {
    console.log("[FairyTales] Creating new fairy tale:", req.tale.id);

    const auth = getAuthData()!;
    
    // Check admin permission
    if (auth.role !== 'admin') {
      throw APIError.permissionDenied("Only admins can create fairy tales");
    }

    const tale = req.tale;

    await fairytalesDB.exec`
      INSERT INTO fairy_tales (
        id, title, source, original_language, english_translation,
        culture_region, age_recommendation, duration_minutes,
        genre_tags, moral_lesson, summary, is_active
      ) VALUES (
        ${tale.id}, ${tale.title}, ${tale.source}, ${tale.originalLanguage},
        ${tale.englishTranslation}, ${tale.cultureRegion}, ${tale.ageRecommendation},
        ${tale.durationMinutes}, ${JSON.stringify(tale.genreTags)}, ${tale.moralLesson},
        ${tale.summary}, ${tale.isActive}
      )
    `;

    console.log(`[FairyTales] Created fairy tale ${tale.id}`);

    return {
      ...tale,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
);

/**
 * Add a role to a fairy tale (admin only)
 */
export const addFairyTaleRole = api<{ taleId: string; role: Omit<FairyTaleRole, 'id' | 'createdAt' | 'taleId'> }, FairyTaleRole>(
  { expose: true, method: "POST", path: "/fairytales/:taleId/roles", auth: true },
  async (req) => {
    console.log("[FairyTales] Adding role to tale:", req.taleId);

    const auth = getAuthData()!;
    
    if (auth.role !== 'admin') {
      throw APIError.permissionDenied("Only admins can add fairy tale roles");
    }

    const role = req.role;

    const result = await fairytalesDB.queryRow<{ id: number }>`
      INSERT INTO fairy_tale_roles (
        tale_id, role_type, role_name, role_count, description,
        required, archetype_preference, age_range_min, age_range_max,
        profession_preference
      ) VALUES (
        ${req.taleId}, ${role.roleType}, ${role.roleName}, ${role.roleCount},
        ${role.description}, ${role.required}, ${role.archetypePreference},
        ${role.ageRangeMin}, ${role.ageRangeMax}, ${JSON.stringify(role.professionPreference)}
      )
      RETURNING id
    `;

    console.log(`[FairyTales] Added role ${result!.id} to tale ${req.taleId}`);

    return {
      ...role,
      id: result!.id,
      taleId: req.taleId,
      createdAt: new Date().toISOString(),
    };
  }
);

/**
 * Add a scene to a fairy tale (admin only)
 */
export const addFairyTaleScene = api<{ taleId: string; scene: Omit<FairyTaleScene, 'id' | 'createdAt' | 'updatedAt' | 'taleId'> }, FairyTaleScene>(
  { expose: true, method: "POST", path: "/fairytales/:taleId/scenes", auth: true },
  async (req) => {
    console.log("[FairyTales] Adding scene to tale:", req.taleId);

    const auth = getAuthData()!;
    
    if (auth.role !== 'admin') {
      throw APIError.permissionDenied("Only admins can add fairy tale scenes");
    }

    const scene = req.scene;

    const result = await fairytalesDB.queryRow<{ id: number }>`
      INSERT INTO fairy_tale_scenes (
        tale_id, scene_number, scene_title, scene_description,
        dialogue_template, character_variables, setting, mood,
        illustration_prompt_template, duration_seconds
      ) VALUES (
        ${req.taleId}, ${scene.sceneNumber}, ${scene.sceneTitle}, ${scene.sceneDescription},
        ${scene.dialogueTemplate}, ${JSON.stringify(scene.characterVariables)}, ${scene.setting},
        ${scene.mood}, ${scene.illustrationPromptTemplate}, ${scene.durationSeconds}
      )
      RETURNING id
    `;

    console.log(`[FairyTales] Added scene ${result!.id} to tale ${req.taleId}`);

    return {
      ...scene,
      id: result!.id,
      taleId: req.taleId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
);
