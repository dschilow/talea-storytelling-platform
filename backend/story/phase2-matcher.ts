// Phase 2: Intelligent Character Matching
// Matches best characters from pool to story roles
// Token Budget: 0 (Backend Logic only!)

import { storyDB } from "./db";
import type { StorySkeleton, CharacterTemplate, CharacterRequirement, CharacterAssignment } from "./types";

export class Phase2CharacterMatcher {
  /**
   * Main matching function
   * Finds the best character from the pool for each requirement
   */
  async match(
    skeleton: StorySkeleton,
    setting: string,
    recentStoryIds: string[] = [],
    avatarNames: string[] = []
  ): Promise<Map<string, CharacterTemplate>> {
    console.log("[Phase2] Starting character matching...", {
      requirementsCount: skeleton.supportingCharacterRequirements.length,
      setting,
    });

    // Load character pool from database
    const pool = await this.loadCharacterPool();
    console.log("[Phase2] Loaded character pool:", { totalCharacters: pool.length });

    // Load recent story character usage for freshness scoring
    const recentUsage = await this.loadRecentUsage(recentStoryIds);

    const assignments = new Map<string, CharacterTemplate>();
    const usedCharacters = new Set<string>();
    const reservedPlaceholders = new Set(
      avatarNames
        .map(name => name?.trim().toLowerCase())
        .filter((name): name is string => Boolean(name))
    );

    // Match each requirement to best character
    for (const req of skeleton.supportingCharacterRequirements) {
      if (!req.placeholder || typeof req.placeholder !== "string" || req.placeholder.trim().length === 0) {
        console.log(
          "[Phase2] Skipping requirement without placeholder; likely handled by avatars or fixed characters",
          { name: (req as any).name ?? null, role: req.role }
        );
        continue;
      }

      const normalizedPlaceholder = req.placeholder.trim().toLowerCase();
      if (reservedPlaceholders.has(normalizedPlaceholder)) {
        console.log("[Phase2] Skipping avatar placeholder; character already defined by user", {
          placeholder: req.placeholder,
          role: req.role,
        });
        continue;
      }

      console.log("[Phase2] Matching requirement:", {
        placeholder: req.placeholder,
        role: req.role,
        archetype: req.archetype,
      });

      const bestMatch = this.findBestMatch(
        req,
        pool,
        setting,
        usedCharacters,
        recentUsage
      );

      if (!bestMatch) {
        console.warn(`[Phase2] No match found for ${req.placeholder}, generating fallback`);
        const generated = this.generateFallbackCharacter(req);
        assignments.set(req.placeholder, generated);
        usedCharacters.add(generated.id);
      } else {
        console.log(`[Phase2] Matched ${req.placeholder} -> ${bestMatch.name} (score: ${(bestMatch as any)._matchScore})`);
        assignments.set(req.placeholder, bestMatch);
        usedCharacters.add(bestMatch.id);
      }
    }

    console.log("[Phase2] Character matching complete:", {
      assignmentsCount: assignments.size,
    });

    return assignments;
  }

  /**
   * Load all active characters from the pool
   */
  private async loadCharacterPool(): Promise<CharacterTemplate[]> {
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
      SELECT * FROM character_pool WHERE is_active = TRUE
    `;

    return rows.map(row => ({
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
  }

  /**
   * Load recent character usage for freshness scoring
   */
  private async loadRecentUsage(storyIds: string[]): Promise<Map<string, number>> {
    if (storyIds.length === 0) {
      return new Map();
    }

    const rows = await storyDB.queryAll<{
      character_id: string;
      usage_count: number;
    }>`
      SELECT character_id, COUNT(*) as usage_count
      FROM story_characters
      WHERE story_id = ANY(${storyIds})
      GROUP BY character_id
    `;

    const usageMap = new Map<string, number>();
    for (const row of rows) {
      usageMap.set(row.character_id, Number(row.usage_count));
    }

    return usageMap;
  }

  /**
   * INTELLIGENT MATCHING SCORE
   * Evaluates each character with a comprehensive scoring system
   */
  private findBestMatch(
    requirement: CharacterRequirement,
    pool: CharacterTemplate[],
    setting: string,
    alreadyUsed: Set<string>,
    recentUsage: Map<string, number>
  ): CharacterTemplate | null {
    let bestMatch: CharacterTemplate | null = null;
    let bestScore = 0;

    for (const candidate of pool) {
      // Skip already used characters
      if (alreadyUsed.has(candidate.id)) {
        continue;
      }

      let score = 0;

      // ===== SCORING MATRIX (Total: 500 points) =====

      // 1. ROLE MATCH (100 points) - CRITICAL
      if (candidate.role === requirement.role) {
        score += 100;
      } else if (this.isCompatibleRole(candidate.role, requirement.role)) {
        score += 50; // Partial match for compatible roles
      }

      // 2. ARCHETYPE MATCH (80 points)
      if (candidate.archetype === requirement.archetype) {
        score += 80;
      } else if (this.isCompatibleArchetype(candidate.archetype, requirement.archetype)) {
        score += 40; // Partial match
      }

      // 3. EMOTIONAL NATURE (60 points)
      if (candidate.emotionalNature.dominant === requirement.emotionalNature) {
        score += 60;
      } else if (candidate.emotionalNature.secondary?.includes(requirement.emotionalNature)) {
        score += 30;
      }

      // 4. REQUIRED TRAITS (50 points total, 10 per trait)
      const matchingTraits = requirement.requiredTraits.filter(trait =>
        candidate.emotionalNature.dominant === trait ||
        candidate.emotionalNature.secondary?.includes(trait)
      ).length;
      score += Math.min(matchingTraits * 10, 50);

      // 5. IMPORTANCE ALIGNMENT (40 points)
      const screenTimeNeeded = this.importanceToScreenTime(requirement.importance);
      if (candidate.maxScreenTime >= screenTimeNeeded) {
        score += 40;
      } else if (candidate.maxScreenTime >= screenTimeNeeded - 20) {
        score += 20; // Close enough
      }

      // 6. CHAPTER AVAILABILITY (30 points)
      const availableForRequired = requirement.inChapters.every(ch =>
        candidate.availableChapters.includes(ch)
      );
      if (availableForRequired) {
        score += 30;
      }

      // 7. SETTING COMPATIBILITY (40 points)
      if (candidate.canonSettings && candidate.canonSettings.length > 0) {
        if (candidate.canonSettings.includes(setting)) {
          score += 40;
        } else if (candidate.canonSettings.some(s => this.isCompatibleSetting(s, setting))) {
          score += 20; // Partially compatible
        }
      } else {
        score += 30; // Generic character, works anywhere
      }

      // 8. FRESHNESS BONUS (40 points)
      // Prefer characters not used recently
      const usageCount = recentUsage.get(candidate.id) || 0;
      const freshness = Math.max(0, 40 - (usageCount * 15));
      score += freshness;

      // 9. VISUAL DIVERSITY BONUS (20 points)
      // Prefer characters with different species/color palettes
      score += 20; // Simplified - can be enhanced with actual diversity check

      // 10. TOTAL USAGE PENALTY (reduce score for overused characters)
      if (candidate.totalUsageCount && candidate.totalUsageCount > 10) {
        score -= Math.min((candidate.totalUsageCount - 10) * 2, 20);
      }

      // Store score for debugging
      (candidate as any)._matchScore = score;

      // FINAL DECISION
      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    // QUALITY GATE
    // If best score is too low, return null to trigger fallback generation
    if (bestScore < 80) {
      console.warn(`[Phase2] Best match score too low: ${bestScore} for ${requirement.placeholder}`);
      return null;
    }

    return bestMatch;
  }

  private importanceToScreenTime(importance: string): number {
    const mapping: Record<string, number> = {
      high: 70,
      medium: 50,
      low: 30,
    };
    return mapping[importance] || 50;
  }

  private isCompatibleRole(candidateRole: string, requiredRole: string): boolean {
    const compatibilityMap: Record<string, string[]> = {
      guide: ["support", "special"],
      companion: ["support", "discovery"],
      obstacle: ["discovery", "special"],
      support: ["guide", "companion"],
      discovery: ["companion", "special"],
      special: ["guide", "discovery"],
    };

    return compatibilityMap[candidateRole]?.includes(requiredRole) || false;
  }

  private isCompatibleArchetype(candidateArchetype: string, requiredArchetype: string): boolean {
    // Simple string similarity - can be enhanced
    return candidateArchetype.includes(requiredArchetype.split("_")[0]) ||
           requiredArchetype.includes(candidateArchetype.split("_")[0]);
  }

  private isCompatibleSetting(candidateSetting: string, requiredSetting: string): boolean {
    const compatibilityMap: Record<string, string[]> = {
      forest: ["mountain", "village"],
      mountain: ["forest", "castle"],
      village: ["forest", "city", "castle"],
      castle: ["village", "mountain", "city"],
      beach: ["village"],
      city: ["village", "castle"],
    };

    return compatibilityMap[candidateSetting]?.includes(requiredSetting) || false;
  }

  /**
   * Generate a fallback character when no good match exists
   */
  private generateFallbackCharacter(req: CharacterRequirement): CharacterTemplate {
    const id = `generated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const name = this.generateName(req);

    console.log(`[Phase2] Generating fallback character: ${name}`);

    return {
      id,
      name,
      role: req.role,
      archetype: req.archetype,
      emotionalNature: {
        dominant: req.emotionalNature,
        secondary: req.requiredTraits || [],
      },
      visualProfile: {
        description: `${name} - ${req.role} character with ${req.emotionalNature} nature`,
        imagePrompt: `${name}, ${req.archetype} character, ${req.emotionalNature} expression, child-friendly, watercolor illustration`,
        species: this.inferSpecies(req.archetype),
        colorPalette: ["brown", "beige", "green"], // Generic
      },
      maxScreenTime: this.importanceToScreenTime(req.importance),
      availableChapters: req.inChapters,
      canonSettings: [],
      isActive: true,
    };
  }

  private generateName(req: CharacterRequirement): string {
    const namesByRole: Record<string, string[]> = {
      guide: ["Herr Schmidt", "Frau Wagner", "Der Weise", "Die Lehrerin", "Der Ratgeber"],
      companion: ["Freund Max", "Luna", "Der treue Begleiter", "Gefährte Sam", "Buddy"],
      obstacle: ["Der Fremde", "Die Herausforderung", "Das Hindernis", "Der Wächter"],
      discovery: ["Das Geheimnis", "Der Schatz", "Die Entdeckung", "Das Wunder"],
      support: ["Der Helfer", "Die Helferin", "Unterstützer", "Nachbar"],
      special: ["Das besondere Wesen", "Der Magische", "Die Besondere"],
    };

    const options = namesByRole[req.role] || ["Charakter"];
    return options[Math.floor(Math.random() * options.length)];
  }

  private inferSpecies(archetype: string): string {
    if (archetype.includes("animal")) return "animal";
    if (archetype.includes("magical") || archetype.includes("sprite") || archetype.includes("dragon")) return "magical_creature";
    if (archetype.includes("elder") || archetype.includes("villager")) return "human";
    return "human";
  }

  /**
   * Update character usage statistics after a story is generated
   */
  async updateUsageStats(assignments: Map<string, CharacterTemplate>, storyId: string): Promise<void> {
    console.log("[Phase2] Updating character usage statistics...");

    for (const [placeholder, character] of assignments) {
      try {
        // Update character pool stats
        await storyDB.exec`
          UPDATE character_pool
          SET recent_usage_count = recent_usage_count + 1,
              total_usage_count = total_usage_count + 1,
              last_used_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${character.id}
        `;

        // Record story-character relationship
        const relationId = crypto.randomUUID();
        await storyDB.exec`
          INSERT INTO story_characters (id, story_id, character_id, placeholder, chapters_appeared)
          VALUES (
            ${relationId},
            ${storyId},
            ${character.id},
            ${placeholder},
            ${character.availableChapters}
          )
        `;
      } catch (error) {
        console.error(`[Phase2] Failed to update usage for ${character.name}:`, error);
      }
    }

    console.log("[Phase2] Usage statistics updated");
  }
}
