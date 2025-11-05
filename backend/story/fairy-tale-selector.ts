// Fairy Tale Selector - Matches user preferences to best fairy tale template
// Selects from public domain fairy tales based on age, genre, and character needs

import { fairytalesDB } from "../fairytales/db";
import type { StoryConfig } from "./generate";

export interface FairyTale {
  id: string;
  title: string;
  source: string;
  originalLanguage: string;
  englishTranslation: string;
  cultureRegion: string;
  ageRecommendation: number;
  durationMinutes: number;
  genreTags: string[];
  moralLesson: string;
  summary: string;
  isActive: boolean;
}

export interface FairyTaleRole {
  id: number;
  taleId: string;
  roleType: string; // protagonist, antagonist, supporting, helper
  roleName: string;
  roleCount: number;
  description: string;
  required: boolean;
  archetypePreference: string;
  ageRangeMin: number;
  ageRangeMax: number;
  professionPreference: string[];
}

export interface FairyTaleScene {
  id: number;
  taleId: string;
  sceneNumber: number;
  sceneTitle: string;
  sceneDescription: string;
  dialogueTemplate?: string;
  characterVariables: Record<string, string>;
  setting: string;
  mood: string;
  illustrationPromptTemplate: string;
  durationSeconds: number;
}

export interface SelectedFairyTale {
  tale: FairyTale;
  roles: FairyTaleRole[];
  scenes: FairyTaleScene[];
  matchScore: number;
  matchReason: string;
}

export class FairyTaleSelector {
  /**
   * Selects the best matching fairy tale for the story generation
   */
  async selectBestMatch(
    config: StoryConfig,
    availableAvatarCount: number
  ): Promise<SelectedFairyTale | null> {
    console.log("[FairyTaleSelector] Selecting fairy tale for:", {
      ageGroup: config.ageGroup,
      genre: config.genre,
      avatars: availableAvatarCount,
    });

    try {
      // Get all active fairy tales
      const tales = await fairytalesDB.queryAll<any>`
        SELECT 
          id, title, source, original_language, english_translation,
          culture_region, age_recommendation, duration_minutes,
          genre_tags, moral_lesson, summary, is_active
        FROM fairy_tales
        WHERE is_active = true
        ORDER BY age_recommendation ASC
      `;

      if (!tales || tales.length === 0) {
        console.log("[FairyTaleSelector] No active fairy tales found in database");
        return null;
      }

      console.log(`[FairyTaleSelector] Found ${tales.length} active fairy tales`);

      // Score each fairy tale
      const scoredTales = await Promise.all(
        tales.map(async (tale) => {
          const roles = await this.loadRoles(tale.id);
          const score = this.calculateMatchScore(tale, roles, config, availableAvatarCount);
          return { tale, roles, score };
        })
      );

      // Sort by score (highest first)
      scoredTales.sort((a, b) => b.score.total - a.score.total);

      const bestMatch = scoredTales[0];

      if (!bestMatch || bestMatch.score.total === 0) {
        console.log("[FairyTaleSelector] No suitable fairy tale found");
        return null;
      }

      console.log(`[FairyTaleSelector] Best match: ${bestMatch.tale.title} (score: ${bestMatch.score.total})`);
      console.log(`[FairyTaleSelector] Match reason: ${bestMatch.score.reason}`);

      // Load scenes for the best match
      const scenes = await this.loadScenes(bestMatch.tale.id);

      return {
        tale: this.mapTale(bestMatch.tale),
        roles: bestMatch.roles,
        scenes,
        matchScore: bestMatch.score.total,
        matchReason: bestMatch.score.reason,
      };
    } catch (error) {
      console.error("[FairyTaleSelector] Error selecting fairy tale:", error);
      return null;
    }
  }

  /**
   * Load roles for a fairy tale
   */
  private async loadRoles(taleId: string): Promise<FairyTaleRole[]> {
    const rows = await fairytalesDB.queryAll<any>`
      SELECT 
        id, tale_id, role_type, role_name, role_count,
        description, required, archetype_preference,
        age_range_min, age_range_max, profession_preference
      FROM fairy_tale_roles
      WHERE tale_id = ${taleId}
      ORDER BY 
        CASE role_type
          WHEN 'protagonist' THEN 1
          WHEN 'antagonist' THEN 2
          WHEN 'supporting' THEN 3
          WHEN 'helper' THEN 4
          ELSE 5
        END,
        id ASC
    `;

    return rows.map((row) => ({
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
      professionPreference: this.parseJsonArray(row.profession_preference),
    }));
  }

  /**
   * Load scenes for a fairy tale
   */
  private async loadScenes(taleId: string): Promise<FairyTaleScene[]> {
    const rows = await fairytalesDB.queryAll<any>`
      SELECT 
        id, tale_id, scene_number, scene_title, scene_description,
        dialogue_template, character_variables, setting, mood,
        illustration_prompt_template, duration_seconds
      FROM fairy_tale_scenes
      WHERE tale_id = ${taleId}
      ORDER BY scene_number ASC
    `;

    return rows.map((row) => ({
      id: row.id,
      taleId: row.tale_id,
      sceneNumber: row.scene_number,
      sceneTitle: row.scene_title,
      sceneDescription: row.scene_description,
      dialogueTemplate: row.dialogue_template,
      characterVariables: this.parseJsonObject(row.character_variables),
      setting: row.setting,
      mood: row.mood,
      illustrationPromptTemplate: row.illustration_prompt_template,
      durationSeconds: row.duration_seconds,
    }));
  }

  /**
   * Calculate match score for a fairy tale
   */
  private calculateMatchScore(
    tale: any,
    roles: FairyTaleRole[],
    config: StoryConfig,
    avatarCount: number
  ): { total: number; reason: string; breakdown: Record<string, number> } {
    const breakdown: Record<string, number> = {};
    const reasons: string[] = [];

    // Age match (0-40 points)
    const ageGroupMap: Record<string, number> = {
      "3-5": 4,
      "6-8": 7,
      "9-12": 10,
      "13+": 14,
    };
    const targetAge = ageGroupMap[config.ageGroup] || 7;
    const ageDiff = Math.abs(tale.age_recommendation - targetAge);
    const ageScore = Math.max(0, 40 - ageDiff * 5);
    breakdown.age = ageScore;
    if (ageScore > 30) {
      reasons.push(`Perfekte Altersgruppe (${tale.age_recommendation} Jahre)`);
    }

    // Genre match (0-30 points)
    const genreTags = this.parseJsonArray(tale.genre_tags);
    const genreMatch = genreTags.includes(config.genre);
    const genreScore = genreMatch ? 30 : 10;
    breakdown.genre = genreScore;
    if (genreMatch) {
      reasons.push(`Passendes Genre (${config.genre})`);
    }

    // Character role match (0-30 points)
    const requiredRoles = roles.filter((r) => r.required).length;
    const totalRoles = roles.length;
    let roleScore = 0;

    if (avatarCount >= requiredRoles) {
      // Perfect: user has enough avatars for required roles
      roleScore = 30;
      reasons.push(`Genug Charaktere (${avatarCount}/${requiredRoles} benötigt)`);
    } else if (avatarCount >= Math.ceil(requiredRoles * 0.5)) {
      // Acceptable: user has at least half of required roles
      roleScore = 15;
      reasons.push(`Akzeptable Charakteranzahl (${avatarCount}/${requiredRoles})`);
    } else {
      // Not enough avatars
      roleScore = 0;
      reasons.push(`Zu wenige Charaktere (${avatarCount}/${requiredRoles})`);
    }
    breakdown.roles = roleScore;

    const total = ageScore + genreScore + roleScore;
    const reason = reasons.join(", ");

    return { total, reason, breakdown };
  }

  /**
   * Map database row to FairyTale interface
   */
  private mapTale(row: any): FairyTale {
    return {
      id: row.id,
      title: row.title,
      source: row.source,
      originalLanguage: row.original_language,
      englishTranslation: row.english_translation,
      cultureRegion: row.culture_region,
      ageRecommendation: row.age_recommendation,
      durationMinutes: row.duration_minutes,
      genreTags: this.parseJsonArray(row.genre_tags),
      moralLesson: row.moral_lesson,
      summary: row.summary,
      isActive: row.is_active,
    };
  }

  /**
   * Parse JSON array safely
   */
  private parseJsonArray(value: any): string[] {
    if (!value) return [];
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    }
    if (Array.isArray(value)) return value;
    return [];
  }

  /**
   * Parse JSON object safely
   */
  private parseJsonObject(value: any): Record<string, string> {
    if (!value) return {};
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    }
    if (typeof value === "object" && !Array.isArray(value)) return value;
    return {};
  }
}
