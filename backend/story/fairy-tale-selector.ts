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
  // NEW: Enhanced matching requirements (Migration 14)
  speciesRequirement?: string;
  genderRequirement?: string;
  ageRequirement?: string;
  sizeRequirement?: string;
  socialClassRequirement?: string;
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
   * @param excludeRecentlyUsed - Optional: Exclude tales used in last N stories (default: 3)
   */
  async selectBestMatch(
    config: StoryConfig,
    availableAvatarCount: number,
    excludeRecentlyUsed: number = 5
  ): Promise<SelectedFairyTale | null> {
    console.log("[FairyTaleSelector] Selecting fairy tale for:", {
      ageGroup: config.ageGroup,
      genre: config.genre,
      avatars: availableAvatarCount,
      excludeRecent: excludeRecentlyUsed,
    });

    try {
      // Get recently used fairy tales for this user (for diversity)
      let recentlyUsedIds: string[] = [];
      if (excludeRecentlyUsed > 0) {
        console.log(`[FairyTaleSelector] Checking last ${excludeRecentlyUsed} used tales...`);
        const recentUsage = await fairytalesDB.queryAll<any>`
          SELECT tale_id, MAX(last_used_at) as last_used
          FROM fairy_tale_usage_stats
          GROUP BY tale_id
          ORDER BY last_used DESC
          LIMIT ${excludeRecentlyUsed}
        `;
        recentlyUsedIds = recentUsage.map(r => r.tale_id);
        if (recentlyUsedIds.length > 0) {
          console.log(`[FairyTaleSelector] 🔄 Excluding recently used: ${recentlyUsedIds.join(', ')}`);
        }
      }

      // Get all active fairy tales (excluding recently used)
      console.log("[FairyTaleSelector] Querying fairy_tales table...");
      let tales: any[];
      
      if (recentlyUsedIds.length > 0) {
        // Query with exclusion using != ALL syntax (PostgreSQL array)
        tales = await fairytalesDB.queryAll<any>`
          SELECT 
            id, title, source, original_language, english_translation,
            culture_region, age_recommendation, duration_minutes,
            genre_tags, moral_lesson, summary, is_active
          FROM fairy_tales
          WHERE is_active = true
            AND id != ALL(${recentlyUsedIds})
          ORDER BY age_recommendation ASC
        `;
      } else {
        // Query without exclusion
        tales = await fairytalesDB.queryAll<any>`
          SELECT 
            id, title, source, original_language, english_translation,
            culture_region, age_recommendation, duration_minutes,
            genre_tags, moral_lesson, summary, is_active
          FROM fairy_tales
          WHERE is_active = true
          ORDER BY age_recommendation ASC
        `;
      }

      if (!tales || tales.length === 0) {
        console.warn("[FairyTaleSelector] ❌ No active fairy tales found in database!");
        console.warn("[FairyTaleSelector] Check: 1) Are migrations run? 2) Are tales seeded? 3) Is is_active=true?");
        return null;
      }

      console.log(`[FairyTaleSelector] ✅ Found ${tales.length} active fairy tales`);

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

      // DEBUG: Log all scores for analysis
      console.log("[FairyTaleSelector] Scoring results:", 
        scoredTales.slice(0, 5).map(st => ({
          title: st.tale.title,
          score: st.score.total,
          breakdown: st.score.breakdown,
          reason: st.score.reason
        }))
      );

      // ==================== VARIANCE SYSTEM ====================
      // Instead of always picking #1, rotate through top matches based on usage
      // This prevents same fairy tale for same parameters!
      
      // LOWERED THRESHOLD: 50pt was too high (required all 3 categories to match)
      // 25pt allows for 1 perfect category (age=40pt or genre=30pt + role=15pt)
      const topMatches = scoredTales.filter(st => st.score.total >= 25);
      
      if (topMatches.length === 0) {
        console.warn("[FairyTaleSelector] No suitable fairy tale found (all scores < 25pt):", {
          totalTales: scoredTales.length,
          bestScore: scoredTales[0]?.score.total,
          bestTitle: scoredTales[0]?.tale.title,
        });
        return null;
      }

      console.log(`[FairyTaleSelector] Found ${topMatches.length} good matches (score >= 25pt)`);

      // Get usage stats for top matches
      const topIds = topMatches.map(t => t.tale.id);
      const usageStats = await fairytalesDB.queryAll<any>`
        SELECT tale_id, usage_count, last_used_at
        FROM fairy_tale_usage_stats
        WHERE tale_id = ANY(${topIds})
        ORDER BY usage_count ASC, last_used_at ASC NULLS FIRST
      `;

      // Map usage to tales
      const usageMap = new Map(usageStats.map(u => [u.tale_id, { count: u.usage_count, last: u.last_used_at }]));

      // Sort top matches by: 1) score, 2) usage count (least used first), 3) last used (oldest first)
      topMatches.sort((a, b) => {
        const usageA = usageMap.get(a.tale.id) || { count: 0, last: null };
        const usageB = usageMap.get(b.tale.id) || { count: 0, last: null };

        // First: prefer high scores
        const scoreDiff = b.score.total - a.score.total;
        if (Math.abs(scoreDiff) > 10) return scoreDiff; // Significant score difference

        // Second: prefer least used
        if (usageA.count !== usageB.count) {
          return usageA.count - usageB.count;
        }

        // Third: prefer oldest last_used (or never used)
        if (!usageA.last && !usageB.last) return 0;
        if (!usageA.last) return -1; // Never used comes first
        if (!usageB.last) return 1;
        return new Date(usageA.last).getTime() - new Date(usageB.last).getTime();
      });

      // Pick from top 3 (or all within 10pts of best) to add diversity and avoid repeats
      const bestScore = topMatches[0].score.total;
      const diversePool = topMatches
        .filter((m, idx) => idx < 3 || (bestScore - m.score.total) <= 10);
      const pickIndex = Math.floor(Math.random() * diversePool.length);
      const selectedMatch = diversePool[pickIndex];

      console.log(`[FairyTaleSelector] Selected: ${selectedMatch.tale.title} (score: ${selectedMatch.score.total})`);
      console.log(`[FairyTaleSelector] Match reason: ${selectedMatch.score.reason}`);
      console.log(`[FairyTaleSelector] Usage count: ${usageMap.get(selectedMatch.tale.id)?.count || 0}`);

      // Update usage stats
      await fairytalesDB.exec`
        UPDATE fairy_tale_usage_stats
        SET usage_count = usage_count + 1, last_used_at = NOW()
        WHERE tale_id = ${selectedMatch.tale.id}
      `;

      // Load scenes for the selected match
      const scenes = await this.loadScenes(selectedMatch.tale.id);

      return {
        tale: this.mapTale(selectedMatch.tale),
        roles: selectedMatch.roles,
        scenes,
        matchScore: selectedMatch.score.total,
        matchReason: `${selectedMatch.score.reason} | Usage: ${usageMap.get(selectedMatch.tale.id)?.count || 0}x`,
      };
    } catch (error) {
      console.error("[FairyTaleSelector] ❌ FATAL ERROR selecting fairy tale:");
      console.error("[FairyTaleSelector] Error type:", (error as any)?.name);
      console.error("[FairyTaleSelector] Error message:", (error as any)?.message);
      console.error("[FairyTaleSelector] Stack:", (error as any)?.stack?.slice(0, 500));
      console.error("[FairyTaleSelector] Possible causes:");
      console.error("  1. Database 'fairytales' does not exist");
      console.error("  2. Table 'fairy_tales' not created (migrations not run)");
      console.error("  3. Database connection failed");
      console.error("  4. SQL syntax error");
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
        age_range_min, age_range_max, profession_preference,
        species_requirement, gender_requirement, age_requirement,
        size_requirement, social_class_requirement
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
      // NEW: Enhanced matching requirements (Migration 14)
      speciesRequirement: row.species_requirement || 'any',
      genderRequirement: row.gender_requirement || 'any',
      ageRequirement: row.age_requirement || 'any',
      sizeRequirement: row.size_requirement || 'any',
      socialClassRequirement: row.social_class_requirement || 'any',
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

    // Genre match (0-30 points) with fuzzy matching
    const genreTags = this.parseJsonArray(tale.genre_tags);
    const exactMatch = genreTags.includes(config.genre);
    
    // Genre mapping: Story genres (from Frontend) → Fairy tale genre_tags (in DB)
    const genreAliases: Record<string, string[]> = {
      // Frontend category IDs → DB genre_tags
      "fairy-tales": ["fantasy", "adventure", "magic", "moral", "dark"],  // ✅ Klassische Märchen
      "adventure": ["adventure", "quest", "journey", "treasure"],          // ✅ Abenteuer & Schätze
      "magic": ["magic", "fantasy", "mystery", "enchanted"],              // ✅ Märchenwelten & Magie
      "animals": ["animals", "nature", "forest", "creatures"],            // ✅ Tierwelten
      "scifi": ["scifi", "future", "space", "technology"],                // ✅ Sci-Fi & Zukunft
      "modern": ["modern", "realistic", "contemporary", "family"],        // ✅ Modern & Realität
      
      // Backwards compatibility for internal genre names
      "fantasy": ["fantasy", "adventure", "magic", "mystery", "dark"],
      "friendship": ["moral", "teamwork", "family", "love"],
      "educational": ["moral", "learning", "wisdom"],
      "mystery": ["mystery", "puzzle", "riddle", "detective"],
    };
    
    const aliases = genreAliases[config.genre.toLowerCase()] || [];
    const fuzzyMatch = aliases.some(alias => genreTags.includes(alias));
    
    let genreScore = 0;
    if (exactMatch) {
      genreScore = 30; // Perfect match
      reasons.push(`Perfektes Genre (${config.genre})`);
    } else if (fuzzyMatch) {
      genreScore = 28; // Very close match via aliases (increased from 25pt)
      const matchedTag = genreTags.find(tag => aliases.includes(tag));
      reasons.push(`Sehr passendes Genre (${matchedTag} für ${config.genre})`);
    } else {
      genreScore = 10; // No match but still usable
    }
    breakdown.genre = genreScore;

    // Character role match (0-30 points)
    // Count protagonist roles (main characters) - these are most important
    const protagonistRoles = roles.filter((r) => r.roleType === 'protagonist').length;
    const requiredRoles = roles.filter((r) => r.required).length;
    const totalRoles = roles.length;
    let roleScore = 0;

    // Strategy: Avatars should match protagonist count (most fairy tales have 1-2 protagonists)
    // Supporting characters can be filled from character pool
    if (avatarCount >= protagonistRoles && avatarCount <= totalRoles) {
      // Perfect: avatars match protagonist count, pool can provide rest
      roleScore = 30;
      reasons.push(`Perfekte Besetzung (${avatarCount} Avatare für ${protagonistRoles} Protagonisten)`);
    } else if (avatarCount >= requiredRoles) {
      // Good: enough avatars for all required roles
      roleScore = 25;
      reasons.push(`Genug Charaktere (${avatarCount}/${requiredRoles} benötigt)`);
    } else if (avatarCount >= Math.ceil(protagonistRoles * 0.5)) {
      // Acceptable: at least half of protagonists covered
      roleScore = 15;
      reasons.push(`Akzeptabel (${avatarCount}/${protagonistRoles} Protagonisten)`);
    } else {
      // Possible but not ideal
      roleScore = 5;
      reasons.push(`Wenig Charaktere (${avatarCount}, erwartet ${protagonistRoles})`);
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
