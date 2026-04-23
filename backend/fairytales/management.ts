import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { fairytalesDB } from "./db";
import type {
  FairyTale,
  FairyTaleRole,
  FairyTaleScene,
  GetFairyTaleResponse,
  RoleType,
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
  tales: any[];
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

let roleMatchingColumnsEnsured = false;

async function ensureRoleMatchingColumns(): Promise<void> {
  if (roleMatchingColumnsEnsured) {
    return;
  }

  await fairytalesDB.exec`
    ALTER TABLE fairy_tale_roles
      ADD COLUMN IF NOT EXISTS species_requirement TEXT CHECK(species_requirement IN ('human', 'humanoid', 'animal', 'magical_creature', 'mythical', 'elemental', 'any')) DEFAULT 'any',
      ADD COLUMN IF NOT EXISTS gender_requirement TEXT CHECK(gender_requirement IN ('male', 'female', 'neutral', 'any')) DEFAULT 'any',
      ADD COLUMN IF NOT EXISTS age_requirement TEXT CHECK(age_requirement IN ('child', 'teenager', 'young_adult', 'adult', 'elder', 'ageless', 'any')) DEFAULT 'any',
      ADD COLUMN IF NOT EXISTS size_requirement TEXT CHECK(size_requirement IN ('tiny', 'small', 'medium', 'large', 'giant', 'any')) DEFAULT 'any',
      ADD COLUMN IF NOT EXISTS social_class_requirement TEXT CHECK(social_class_requirement IN ('royalty', 'nobility', 'merchant', 'craftsman', 'commoner', 'outcast', 'any')) DEFAULT 'any'
  `;

  roleMatchingColumnsEnsured = true;
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function toStringWithFallback(value: unknown, fallback: string): string {
  return toStringOrNull(value) ?? fallback;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toNumberWithFallback(value: unknown, fallback: number): number {
  return toNumberOrNull(value) ?? fallback;
}

function toBooleanWithFallback(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map(toStringOrNull)
      .filter((entry): entry is string => Boolean(entry));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return toStringArray(parsed);
      }
    } catch {
      // Fall back to comma-separated values below.
    }

    return trimmed
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function toStringRecord(value: unknown): Record<string, string> {
  const source = typeof value === "string" ? parseJson(value) : value;
  if (!isRecord(source)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(source)
      .map(([key, entry]) => [key, toStringOrNull(entry)])
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toIsoString(value: unknown): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) {
      return date.toISOString();
    }
  }
  return new Date().toISOString();
}

function normalizeEnum(value: unknown, allowed: readonly string[], fallback: string): string {
  const normalized = toStringOrNull(value)?.toLowerCase();
  return normalized && allowed.includes(normalized) ? normalized : fallback;
}

function normalizeArchetypePreference(value: unknown): string | null {
  if (Array.isArray(value)) {
    const entries = toStringArray(value);
    return entries.length > 0 ? entries.join(", ") : null;
  }
  return toStringOrNull(value);
}

function normalizeFairyTaleImportItem(value: unknown, index: number): CompleteFairyTaleExport {
  if (!isRecord(value)) {
    throw new Error(`Entry ${index + 1} is not an object`);
  }

  const taleSource = value.tale;
  if (!isRecord(taleSource)) {
    throw new Error(`Entry ${index + 1} is missing tale data`);
  }

  const taleId = toStringOrNull(taleSource.id);
  const title = toStringOrNull(taleSource.title);
  if (!taleId || !title) {
    throw new Error(`Entry ${index + 1} is missing tale id or title`);
  }

  const tale: FairyTale = {
    id: taleId,
    title,
    source: toStringWithFallback(taleSource.source, "import"),
    originalLanguage: toStringOrNull(taleSource.originalLanguage),
    englishTranslation: toStringOrNull(taleSource.englishTranslation),
    cultureRegion: toStringWithFallback(taleSource.cultureRegion, "unknown"),
    ageRecommendation: toNumberWithFallback(taleSource.ageRecommendation, 6),
    durationMinutes: toNumberWithFallback(taleSource.durationMinutes, 10),
    genreTags: toStringArray(taleSource.genreTags),
    moralLesson: toStringOrNull(taleSource.moralLesson),
    summary: toStringOrNull(taleSource.summary),
    isActive: toBooleanWithFallback(taleSource.isActive, true),
    createdAt: toIsoString(taleSource.createdAt),
    updatedAt: toIsoString(taleSource.updatedAt),
  };

  const roles: FairyTaleRole[] = (Array.isArray(value.roles) ? value.roles : []).map((rawRole, roleIndex) => {
    const roleSource = isRecord(rawRole) ? rawRole : {};
    return {
      id: toNumberWithFallback(roleSource.id, roleIndex + 1),
      taleId: toStringWithFallback(roleSource.taleId, taleId),
      roleType: toStringWithFallback(roleSource.roleType, "supporting") as RoleType,
      roleName: toStringOrNull(roleSource.roleName),
      roleCount: toNumberWithFallback(roleSource.roleCount, 1),
      description: toStringOrNull(roleSource.description),
      required: toBooleanWithFallback(roleSource.required, true),
      archetypePreference: normalizeArchetypePreference(roleSource.archetypePreference),
      ageRangeMin: toNumberOrNull(roleSource.ageRangeMin),
      ageRangeMax: toNumberOrNull(roleSource.ageRangeMax),
      professionPreference: toStringArray(roleSource.professionPreference),
      speciesRequirement: normalizeEnum(
        roleSource.speciesRequirement,
        ["human", "humanoid", "animal", "magical_creature", "mythical", "elemental", "any"],
        "any"
      ),
      genderRequirement: normalizeEnum(roleSource.genderRequirement, ["male", "female", "neutral", "any"], "any"),
      ageRequirement: normalizeEnum(
        roleSource.ageRequirement,
        ["child", "teenager", "young_adult", "adult", "elder", "ageless", "any"],
        "any"
      ),
      sizeRequirement: normalizeEnum(roleSource.sizeRequirement, ["tiny", "small", "medium", "large", "giant", "any"], "any"),
      socialClassRequirement: normalizeEnum(
        roleSource.socialClassRequirement,
        ["royalty", "nobility", "merchant", "craftsman", "commoner", "outcast", "any"],
        "any"
      ),
      createdAt: toIsoString(roleSource.createdAt),
    };
  });

  const scenes: FairyTaleScene[] = (Array.isArray(value.scenes) ? value.scenes : []).map((rawScene, sceneIndex) => {
    const sceneSource = isRecord(rawScene) ? rawScene : {};
    return {
      id: toNumberWithFallback(sceneSource.id, sceneIndex + 1),
      taleId: toStringWithFallback(sceneSource.taleId, taleId),
      sceneNumber: toNumberWithFallback(sceneSource.sceneNumber, sceneIndex + 1),
      sceneTitle: toStringOrNull(sceneSource.sceneTitle),
      sceneDescription: toStringWithFallback(sceneSource.sceneDescription, ""),
      dialogueTemplate: toStringOrNull(sceneSource.dialogueTemplate),
      characterVariables: toStringRecord(sceneSource.characterVariables),
      setting: toStringOrNull(sceneSource.setting),
      mood: toStringOrNull(sceneSource.mood),
      illustrationPromptTemplate: toStringOrNull(sceneSource.illustrationPromptTemplate),
      durationSeconds: toNumberWithFallback(sceneSource.durationSeconds, 60),
      createdAt: toIsoString(sceneSource.createdAt),
      updatedAt: toIsoString(sceneSource.updatedAt),
    };
  });

  return { tale, roles, scenes };
}

function getImportTaleId(value: unknown, fallbackIndex: number): string {
  if (isRecord(value) && isRecord(value.tale)) {
    return toStringOrNull(value.tale.id) ?? `entry-${fallbackIndex + 1}`;
  }
  return `entry-${fallbackIndex + 1}`;
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

    await ensureRoleMatchingColumns();

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
          profession_preference, species_requirement, gender_requirement,
          age_requirement, size_requirement, social_class_requirement,
          created_at
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
        speciesRequirement: row.species_requirement,
        genderRequirement: row.gender_requirement,
        ageRequirement: row.age_requirement,
        sizeRequirement: row.size_requirement,
        socialClassRequirement: row.social_class_requirement,
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

    if (!Array.isArray(req.tales) || req.tales.length === 0) {
      throw APIError.invalidArgument("Import requires at least one fairy tale");
    }

    await ensureRoleMatchingColumns();

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: { taleId: string; error: string }[] = [];

    for (let index = 0; index < req.tales.length; index++) {
      const rawItem = req.tales[index];
      const taleId = getImportTaleId(rawItem, index);

      try {
        const item = normalizeFairyTaleImportItem(rawItem, index);
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
              original_language = ${item.tale.originalLanguage ?? null},
              english_translation = ${item.tale.englishTranslation ?? null},
              culture_region = ${item.tale.cultureRegion},
              age_recommendation = ${item.tale.ageRecommendation},
              duration_minutes = ${item.tale.durationMinutes},
              genre_tags = ${JSON.stringify(item.tale.genreTags)},
              moral_lesson = ${item.tale.moralLesson ?? null},
              summary = ${item.tale.summary ?? null},
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
              ${item.tale.originalLanguage ?? null}, ${item.tale.englishTranslation ?? null},
              ${item.tale.cultureRegion}, ${item.tale.ageRecommendation},
              ${item.tale.durationMinutes}, ${JSON.stringify(item.tale.genreTags)},
              ${item.tale.moralLesson ?? null}, ${item.tale.summary ?? null}, ${item.tale.isActive}
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
              profession_preference, species_requirement, gender_requirement,
              age_requirement, size_requirement, social_class_requirement
            ) VALUES (
              ${item.tale.id}, ${role.roleType}, ${role.roleName ?? null}, ${role.roleCount},
              ${role.description ?? null}, ${role.required}, ${role.archetypePreference ?? null},
              ${role.ageRangeMin ?? null}, ${role.ageRangeMax ?? null}, ${JSON.stringify(role.professionPreference)},
              ${role.speciesRequirement ?? 'any'}, ${role.genderRequirement ?? 'any'},
              ${role.ageRequirement ?? 'any'}, ${role.sizeRequirement ?? 'any'},
              ${role.socialClassRequirement ?? 'any'}
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
              ${item.tale.id}, ${scene.sceneNumber}, ${scene.sceneTitle ?? null},
              ${scene.sceneDescription}, ${scene.dialogueTemplate},
              ${JSON.stringify(scene.characterVariables)}, ${scene.setting ?? null},
              ${scene.mood ?? null}, ${scene.illustrationPromptTemplate ?? null}, ${scene.durationSeconds}
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
        console.error(`[FairyTales] Error importing tale ${taleId}:`, error);
        errors.push({
          taleId,
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

