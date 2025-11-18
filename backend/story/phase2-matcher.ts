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
    avatarNames: string[] = [],
    useFairyTaleTemplate: boolean = false,
    selectedFairyTale?: any  // NEW: If provided, load roles from fairy_tale_roles instead of skeleton
  ): Promise<Map<string, CharacterTemplate>> {
    console.log("[Phase2] Starting character matching...", {
      requirementsCount: skeleton.supportingCharacterRequirements.length,
      fairyTaleMode: !!selectedFairyTale,
      fairyTaleTitle: selectedFairyTale?.tale.title,
      setting,
    });

    // Load character pool from database
    const pool = await this.loadCharacterPool();
    console.log("[Phase2] Loaded character pool:", { totalCharacters: pool.length });

    // Load recent story character usage for freshness scoring
    const recentUsage = await this.loadRecentUsage(recentStoryIds);

    const assignments = new Map<string, CharacterTemplate>();
    const usedCharacters = new Set<string>();
    const usedSpecies = new Set<string>(); // Track species diversity
    const reservedPlaceholders = new Set(
      avatarNames
        .map(name => name?.trim().toLowerCase())
        .filter((name): name is string => Boolean(name))
    );
    const avatarQueue = [...reservedPlaceholders];

    // Prefer skeleton requirements; only fall back to fairy tale roles if skeleton is empty
    let characterRequirements: any[] = skeleton.supportingCharacterRequirements;

    if ((!characterRequirements || characterRequirements.length === 0) && selectedFairyTale && selectedFairyTale.roles) {
      console.log(`[Phase2] ðŸŽ­ Fairy Tale Mode: Loading ${selectedFairyTale.roles.length} roles from "${selectedFairyTale.tale.title}"`);

      // Convert fairy tale roles to character requirements format
      // Skip protagonist roles (those are for user avatars)
      characterRequirements = selectedFairyTale.roles
        .filter((role: any) => role.roleType !== 'protagonist')  // Only supporting characters
        .map((role: any) => ({
          placeholder: `{{${role.roleName.toUpperCase().replace(/\s+/g, '_')}}}`,
          role: role.roleType,
          archetype: role.archetypePreference || 'neutral',
          emotionalNature: role.description || 'neutral',
          visualHints: role.professionPreference?.join(', ') || '',
          requiredTraits: [],  // CRITICAL FIX: Add empty array for requiredTraits
          importance: role.required ? 'high' : 'medium',
          inChapters: [1, 2, 3, 4, 5]  // Available in all chapters by default
        }));

      console.log(`[Phase2] Converted ${characterRequirements.length} fairy tale roles to requirements:`,
        characterRequirements.map((r: any) => `${r.placeholder} (${r.role})`)
      );
    }

    // Normalize placeholders/traits and enforce conflict presence
    characterRequirements = characterRequirements
      .map(req => this.normalizeRequirement(req))
      .filter((req): req is CharacterRequirement => Boolean(req));

    // Validate placeholder set matches skeleton expectations (prevent drift)
    const skeletonPlaceholders = new Set(
      (skeleton.supportingCharacterRequirements || []).map(req => this.normalizePlaceholder(req.placeholder))
    );
    const requirementPlaceholders = new Set(characterRequirements.map(req => req.placeholder));

    // Remove placeholders not present in skeleton
    characterRequirements = characterRequirements.filter(req => skeletonPlaceholders.has(req.placeholder));
    // Add missing placeholders as neutral fallback requirements
    for (const ph of skeletonPlaceholders) {
      if (ph && !requirementPlaceholders.has(ph)) {
        characterRequirements.push({
          placeholder: ph,
          role: "support",
          archetype: "neutral",
          emotionalNature: "neutral",
          requiredTraits: [],
          visualHints: "",
          importance: "medium",
          inChapters: [1, 2, 3, 4, 5],
        });
      }
    }

    if (characterRequirements.length !== skeletonPlaceholders.size) {
      console.warn(`[Phase2] Placeholder mismatch detected (skeleton=${skeletonPlaceholders.size} reqs=${characterRequirements.length}) - regenerating requirements from skeleton to keep run alive`);
      characterRequirements = (skeleton.supportingCharacterRequirements || [])
        .map(req => this.normalizeRequirement(req))
        .filter((req): req is CharacterRequirement => Boolean(req));
    }

    // Guardrail: if requirements drifted (e.g. overwritten placeholders), warn/adjust
    const expectedReqCount = skeleton.supportingCharacterRequirements?.length || 0;
    if (expectedReqCount > 0 && characterRequirements.length !== expectedReqCount) {
      console.warn(`[Phase2] Requirement count drift: expected ${expectedReqCount}, got ${characterRequirements.length}`);
    }

    // Ensure protagonist/antagonist slots exist so avatars can be mapped deterministically
    if (avatarQueue.length > 0 && !characterRequirements.some(req => req.role === "protagonist")) {
      characterRequirements.unshift({
        placeholder: "{{PROTAGONIST_AVATAR}}",
        role: "protagonist",
        archetype: "hero",
        emotionalNature: "brave",
        visualHints: "Avatar-Hauptfigur",
        requiredTraits: [],
        importance: "high",
        inChapters: [1, 2, 3, 4, 5],
      } as any);
    }
    if (avatarQueue.length > 1 && !characterRequirements.some(req => this.isAntagonistRole(req.role, req.archetype))) {
      characterRequirements.unshift({
        placeholder: "{{ANTAGONIST_AVATAR}}",
        role: "antagonist",
        archetype: "villain",
        emotionalNature: "cunning",
        visualHints: "Avatar-Gegenspieler",
        requiredTraits: ["cunning"],
        importance: "high",
        inChapters: [1, 2, 3, 4, 5],
      } as any);
    }

    const hasAntagonistRequirement = characterRequirements.some(req => this.isAntagonistRole(req.role, req.archetype));
    if (!hasAntagonistRequirement) {
      console.log("[Phase2] Adding synthetic antagonist requirement to guarantee conflict/twist");
      characterRequirements.push({
        placeholder: "{{ANTAGONIST}}",
        role: "antagonist",
        archetype: "trickster_villain",
        emotionalNature: "cunning",
        requiredTraits: ["cunning", "oppositional"],
        visualHints: "Memorable obstacle or villain silhouette",
        importance: "high",
        inChapters: [1, 2, 3, 4, 5],
      });
    }

    // Match each requirement to best character
    for (const req of characterRequirements) {
      if (!req.placeholder || typeof req.placeholder !== "string" || req.placeholder.trim().length === 0) {
        console.log(
          "[Phase2] Skipping requirement without placeholder; likely handled by avatars or fixed characters",
          { name: (req as any).name ?? null, role: req.role }
        );
        continue;
      }

      const normalizedPlaceholder = req.placeholder.trim().toLowerCase();
      // Assign user avatars first when a protagonist/antagonist slot is available
      if ((req.role === "protagonist" || req.role === "antagonist") && avatarQueue.length > 0) {
        const avatarName = avatarQueue.shift();
        if (avatarName) {
          console.log("[Phase2] Assigning avatar to main slot", { placeholder: req.placeholder, avatarName });
          // Build a synthetic character template for avatar assignment
          const avatarChar: CharacterTemplate = {
            id: `avatar_${avatarName}`,
            name: avatarName,
            role: req.role,
            archetype: req.archetype,
            emotionalNature: {
              dominant: req.emotionalNature,
              secondary: req.requiredTraits || [],
            },
            visualProfile: {
              description: avatarName,
              imagePrompt: avatarName,
              species: "human",
              colorPalette: [],
            },
            maxScreenTime: this.importanceToScreenTime(req.importance),
            availableChapters: req.inChapters,
            canonSettings: [],
          };
          assignments.set(req.placeholder, avatarChar);
          usedCharacters.add(avatarChar.id);
          usedSpecies.add(avatarChar.visualProfile.species || "human");
          continue;
        }
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
        recentUsage,
        usedSpecies,
        useFairyTaleTemplate
      );

      if (!bestMatch) {
        console.warn(`[Phase2] No match found for ${req.placeholder}, generating fallback`);
        const generated = this.generateFallbackCharacter(req);
        assignments.set(req.placeholder, generated);
        usedCharacters.add(generated.id);
        if (generated.visualProfile.species) {
          usedSpecies.add(generated.visualProfile.species);
        }
      } else {
        console.log(`[Phase2] Matched ${req.placeholder} -> ${bestMatch.name} (score: ${(bestMatch as any)._matchScore})`);
        assignments.set(req.placeholder, bestMatch);
        usedCharacters.add(bestMatch.id);
        if (bestMatch.visualProfile.species) {
          usedSpecies.add(bestMatch.visualProfile.species);
        }
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
   * Normalize a raw requirement into a consistent structure
   */
  private normalizeRequirement(req: any): CharacterRequirement | null {
    const placeholderRaw = typeof req.placeholder === "string" ? req.placeholder : (req.name ?? "");
    const placeholder = this.normalizePlaceholder(placeholderRaw);
    if (!placeholder) {
      return null;
    }

    const inChapters = Array.isArray(req.inChapters) && req.inChapters.length > 0 ? req.inChapters : [1, 2, 3, 4, 5];
    const requiredTraits = Array.isArray(req.requiredTraits) ? req.requiredTraits : [];

    return {
      ...req,
      placeholder,
      role: req.role || "support",
      archetype: req.archetype || "neutral",
      emotionalNature: req.emotionalNature || "neutral",
      visualHints: req.visualHints || "",
      requiredTraits,
      importance: (req.importance as any) || "medium",
      inChapters,
    };
  }

  /**
   * Normalize placeholder to ASCII-safe {{NAME}}
   */
  private normalizePlaceholder(raw: string): string {
    if (!raw) return "";
    const stripped = raw.replace(/^{+|}+$/g, "");
    const ascii = stripped
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase();
    if (!ascii) return "";
    return `{{${ascii}}}`;
  }

  /**
   * INTELLIGENT MATCHING SCORE V2 - Enhanced with Visual Hints
   * Evaluates each character with a comprehensive scoring system
   */
  private findBestMatch(
    requirement: CharacterRequirement,
    pool: CharacterTemplate[],
    setting: string,
    alreadyUsed: Set<string>,
    recentUsage: Map<string, number>,
    usedSpecies: Set<string>,
    useFairyTaleTemplate: boolean = false
  ): CharacterTemplate | null {
    let bestMatch: CharacterTemplate | null = null;
    let bestScore = 0;

    // Extract visual hints from requirement for better matching
    const visualHints = (requirement as any).visualHints || "";
    const visualKeywords = this.extractVisualKeywords(visualHints);

    for (const candidate of pool) {
      // Skip already used characters
      if (alreadyUsed.has(candidate.id)) {
        continue;
      }

      // Hard filters to prevent mismatch drift
      const requirementIsAntagonist = this.isAntagonistRole(requirement.role, requirement.archetype);
      const candidateIsAntagonist = this.isAntagonistRole(candidate.role, candidate.archetype);
      if (requirementIsAntagonist && !candidateIsAntagonist) {
        continue;
      }
      if (!requirementIsAntagonist && candidateIsAntagonist && requirement.role !== "obstacle") {
        continue; // avoid villains in helper slots
      }

      if (this.isAnimalRequirement(requirement)) {
        const species = (candidate.visualProfile.species || "").toLowerCase();
        if (species.startsWith("human")) {
          continue; // animal required, skip humans
        }
      }
      if (requirement.role === "guide" && !(candidate.role === "guide" || candidate.role === "support")) {
        continue;
      }
      if (requirement.role === "helper" && !(candidate.role === "helper" || candidate.role === "support" || candidate.role === "companion")) {
        continue;
      }
      if (requirement.role === "antagonist" && !(candidate.role === "antagonist" || candidate.role === "obstacle" || candidate.role === "villain" || candidate.role === "trickster")) {
        continue;
      }

      let score = 0;
      const debugScores: Record<string, number> = {};

      // ===== SCORING MATRIX V2 (Total: 600 points) =====

      // 1. ROLE MATCH (100 points) - CRITICAL
      if (candidate.role === requirement.role) {
        score += 100;
        debugScores.roleExact = 100;
      } else if (this.isCompatibleRole(candidate.role, requirement.role)) {
        score += 50;
        debugScores.roleCompatible = 50;
      }

      // 2. ARCHETYPE MATCH (80 points)
      if (candidate.archetype === requirement.archetype) {
        score += 80;
        debugScores.archetypeExact = 80;
      } else if (this.isCompatibleArchetype(candidate.archetype, requirement.archetype)) {
        score += 40;
        debugScores.archetypeCompatible = 40;
      }

      // 3. EMOTIONAL NATURE (60 points)
      if (candidate.emotionalNature.dominant === requirement.emotionalNature) {
        score += 60;
        debugScores.emotionalDominant = 60;
      } else if (candidate.emotionalNature.secondary?.includes(requirement.emotionalNature)) {
        score += 30;
        debugScores.emotionalSecondary = 30;
      }

      // 4. REQUIRED TRAITS (50 points total, 10 per trait)
      const matchingTraits = requirement.requiredTraits.filter(trait =>
        candidate.emotionalNature.dominant === trait ||
        candidate.emotionalNature.secondary?.includes(trait)
      ).length;
      const traitsScore = Math.min(matchingTraits * 10, 50);
      score += traitsScore;
      debugScores.traits = traitsScore;

      // 5. VISUAL HINTS MATCHING (100 points) - NEW & CRITICAL!
      const visualScore = this.scoreVisualMatch(candidate, visualKeywords);
      score += visualScore;
      debugScores.visual = visualScore;

      // 5b. AGE/GENDER PREFERENCES (40 points total)
      const ageGenderScore = this.scoreAgeGenderMatch(candidate, requirement);
      score += ageGenderScore;
      debugScores.ageGender = ageGenderScore;

      // 6. IMPORTANCE ALIGNMENT (40 points)
      const screenTimeNeeded = this.importanceToScreenTime(requirement.importance);
      if (candidate.maxScreenTime >= screenTimeNeeded) {
        score += 40;
        debugScores.screenTime = 40;
      } else if (candidate.maxScreenTime >= screenTimeNeeded - 20) {
        score += 20;
        debugScores.screenTime = 20;
      }

      // 7. CHAPTER AVAILABILITY (30 points)
      const availableForRequired = requirement.inChapters.every(ch =>
        candidate.availableChapters.includes(ch)
      );
      if (availableForRequired) {
        score += 30;
        debugScores.chapters = 30;
      }

      // 8. SETTING COMPATIBILITY (40 points)
      if (candidate.canonSettings && candidate.canonSettings.length > 0) {
        if (candidate.canonSettings.includes(setting)) {
          score += 40;
          debugScores.setting = 40;
        } else if (candidate.canonSettings.some(s => this.isCompatibleSetting(s, setting))) {
          score += 20;
          debugScores.setting = 20;
        }
      } else {
        score += 30;
        debugScores.setting = 30;
      }

      // 9. FRESHNESS BONUS (50 points) - Increased weight
      const usageCount = recentUsage.get(candidate.id) || 0;
      const freshness = Math.max(0, 50 - (usageCount * 20));
      score += freshness;
      debugScores.freshness = freshness;

      // 10. SPECIES DIVERSITY BONUS (30 points)
      // Encourage variety in species/types
      const species = candidate.visualProfile.species || "unknown";
      if (!usedSpecies.has(species)) {
        score += 30; // New species - bonus!
        debugScores.diversity = 30;
      } else {
        score += 10; // Already used species - small bonus
        debugScores.diversity = 10;
      }

      // 11. TOTAL USAGE PENALTY (reduce score for overused characters)
      let usagePenalty = 0;
      if (candidate.totalUsageCount && candidate.totalUsageCount > 10) {
        usagePenalty = Math.min((candidate.totalUsageCount - 10) * 3, 30);
        score -= usagePenalty;
        debugScores.usagePenalty = -usagePenalty;
      }

      // 12. FAIRY TALE BONUS/PENALTY (CRITICAL for MÃ¤rchen stories)
      if (useFairyTaleTemplate) {
        // MASSIVE BONUS for fairy-tale archetypes
        const fairyTaleArchetypes = ['witch', 'wolf', 'fairy', 'magical_being', 'helper', 'wise_elder', 'trickster'];
        if (fairyTaleArchetypes.includes(candidate.archetype)) {
          score += 150;
          debugScores.fairyTaleBonus = 150;
        }

        // PENALTY for modern professions in fairy tales
        const modernKeywords = ['police', 'polizist', 'doctor', 'arzt', 'mechanic', 'mechaniker', 'teacher', 'lehrer'];
        const candidateDescLower = (candidate.visualProfile.description || '').toLowerCase();
        const hasModernProfession = modernKeywords.some(keyword => candidateDescLower.includes(keyword));
        
        if (hasModernProfession) {
          score -= 100;
          debugScores.modernPenalty = -100;
        }
      }

      // Store score and details for debugging
      (candidate as any)._matchScore = score;
      (candidate as any)._debugScores = debugScores;

      // FINAL DECISION
      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    // QUALITY GATE - Lowered threshold for more flexibility
    if (bestScore < 100) {
      console.warn(`[Phase2] Best match score too low: ${bestScore} for ${requirement.placeholder}`);
      console.warn(`[Phase2] Visual hints: ${visualHints}`);
      return null;
    }

    if (bestMatch) {
      console.log(`[Phase2] Match details for ${requirement.placeholder}:`, {
        character: bestMatch.name,
        totalScore: bestScore,
        breakdown: (bestMatch as any)._debugScores,
        visualHints,
      });
    }

    return bestMatch;
  }

  /**
   * Extract visual keywords from hints text
   */
  private extractVisualKeywords(hints: string): string[] {
    if (!hints || typeof hints !== "string") return [];
    
    const normalized = hints.toLowerCase();
    const keywords: string[] = [];

    // Animal types
    const animals = ["hund", "katze", "vogel", "hirsch", "reh", "fuchs", "baer", "hase", "maus", "eichhoernchen", "wolf", "drache", "einhorn"];
    animals.forEach(animal => {
      if (normalized.includes(animal)) keywords.push(animal);
    });

    // Professions
    const professions = ["arzt", "doktor", "lehrer", "baecker", "polizist", "verkaeuferin", "gaertner", "koch", "mechaniker"];
    professions.forEach(prof => {
      if (normalized.includes(prof)) keywords.push(prof);
    });

    // Age indicators
    if (normalized.includes("alt") || normalized.includes("aelter") || normalized.includes("weise")) {
      keywords.push("elder");
    }
    if (normalized.includes("jung") || normalized.includes("kind")) {
      keywords.push("young");
    }

    // Physical attributes
    if (normalized.includes("gross")) keywords.push("large");
    if (normalized.includes("klein")) keywords.push("small");
    if (normalized.includes("brille")) keywords.push("glasses");

    // Materials/Tech
    if (normalized.includes("blech") || normalized.includes("metall") || normalized.includes("roboter")) {
      keywords.push("mechanical");
    }

    return keywords;
  }

  /**
   * Score visual match between character and requirements
   */
  private scoreVisualMatch(candidate: CharacterTemplate, keywords: string[]): number {
    if (keywords.length === 0) return 50; // No visual hints, give neutral score

    let score = 0;
    const candidateDesc = (candidate.visualProfile.description || "").toLowerCase();
    const candidateSpecies = (candidate.visualProfile.species || "").toLowerCase();

    // Check each keyword
    for (const keyword of keywords) {
      if (candidateDesc.includes(keyword) || candidateSpecies.includes(keyword)) {
        score += 20; // Strong match per keyword
      } else if (this.isRelatedVisual(keyword, candidateSpecies)) {
        score += 10; // Related match
      }
    }

    return Math.min(score, 100); // Cap at 100 points
  }

  /**
   * Check if visual concepts are related
   */
  private isRelatedVisual(keyword: string, species: string): boolean {
    const relations: Record<string, string[]> = {
      "mechanical": ["robot", "machine", "tech"],
      "elder": ["human", "wise"],
      "hund": ["animal", "dog", "canine"],
      "katze": ["animal", "cat", "feline"],
      "vogel": ["animal", "bird", "avian"],
      "hirsch": ["animal", "deer", "stag"],
      "baer": ["animal", "bear"],
      "arzt": ["human", "doctor", "healer"],
      "polizist": ["human", "police", "officer"],
    };

    const related = relations[keyword] || [];
    return related.some(rel => species.includes(rel));
  }

  private importanceToScreenTime(importance: string): number {
    const mapping: Record<string, number> = {
      high: 70,
      medium: 50,
      low: 30,
    };
    return mapping[importance] || 50;
  }

  private isAntagonistRole(role: string, archetype: string): boolean {
    const roleLc = (role || "").toLowerCase();
    const archetypeLc = (archetype || "").toLowerCase();
    const antagonisticKeywords = ["antagonist", "villain", "enemy", "obstacle", "opponent", "witch", "wizard", "monster", "ogre"];
    return antagonisticKeywords.some(keyword => roleLc.includes(keyword) || archetypeLc.includes(keyword));
  }

  private isCompatibleRole(candidateRole: string, requiredRole: string): boolean {
    const compatibilityMap: Record<string, string[]> = {
      guide: ["support", "special"],
      companion: ["support", "discovery"],
      obstacle: ["discovery", "special"],
      support: ["guide", "companion"],
      discovery: ["companion", "special"],
      special: ["guide", "discovery"],
      helper: ["support", "guide", "companion"],
      antagonist: ["obstacle", "villain", "special"],
    };

    return compatibilityMap[candidateRole]?.includes(requiredRole) || false;
  }

  private isCompatibleArchetype(candidateArchetype: string, requiredArchetype: string): boolean {
    // Simple string similarity - can be enhanced
    return candidateArchetype.includes(requiredArchetype.split("_")[0]) ||
           requiredArchetype.includes(candidateArchetype.split("_")[0]);
  }

  private isHumanSpecies(species: string | undefined): boolean {
    return typeof species === "string" && species.toLowerCase().startsWith("human");
  }

  private isAnimalRequirement(req: CharacterRequirement): boolean {
    const ph = (req.placeholder || "").toLowerCase();
    const hints = (req.visualHints || "").toLowerCase();
    return ph.includes("animal") || /cat|dog|fox|bird|duck|horse|squirrel|mouse|bunny|rabbit|owl/i.test(hints);
  }

  /**
   * Age/Gender scoring based on visual hints in requirement vs candidate description/species
   */
  private scoreAgeGenderMatch(candidate: CharacterTemplate, requirement: CharacterRequirement): number {
    const hints = (requirement.visualHints || "").toLowerCase();
    if (!hints) return 0;

    const desc = (candidate.visualProfile.description || "").toLowerCase();
    let score = 0;

    // Simple age buckets
    const wantsElder = hints.includes("alt") || hints.includes("älter") || hints.includes("aelter") || hints.includes("weise");
    const wantsYoung = hints.includes("jung") || hints.includes("kind") || hints.includes("klein");
    if (wantsElder && (desc.includes("old") || desc.includes("elder") || desc.includes("grosseltern") || desc.includes("oma") || desc.includes("opa") || desc.includes("years"))) {
      score += 20;
    }
    if (wantsYoung && (desc.includes("young") || desc.includes("child") || desc.includes("kid") || desc.includes("teen"))) {
      score += 20;
    }

    // Gender cues
    const wantsFemale = hints.includes("frau") || hints.includes("weib");
    const wantsMale = hints.includes("mann") || hints.includes("herr") || hints.includes("male");

    if (wantsFemale && (desc.includes("frau") || desc.includes("female") || desc.includes("she"))) score += 20;
    if (wantsMale && (desc.includes("herr") || desc.includes("male") || desc.includes("he"))) score += 20;

    return Math.min(score, 40);
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

    const species = this.inferSpecies(req);

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
        species,
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
      companion: ["Freund Max", "Luna", "Der treue Begleiter", "GefÃ¤hrte Sam", "Buddy"],
      obstacle: ["Der Fremde", "Die Herausforderung", "Das Hindernis", "Der WÃ¤chter"],
      discovery: ["Das Geheimnis", "Der Schatz", "Die Entdeckung", "Das Wunder"],
      support: ["Der Helfer", "Die Helferin", "UnterstÃ¼tzer", "Nachbar"],
      special: ["Das besondere Wesen", "Der Magische", "Die Besondere"],
    };

    const options = namesByRole[req.role] || ["Charakter"];
    return options[Math.floor(Math.random() * options.length)];
  }

  private inferSpecies(req: CharacterRequirement): string {
    const ph = (req.placeholder || "").toLowerCase();
    const hints = (req.visualHints || "").toLowerCase();
    const archetype = (req.archetype || "").toLowerCase();

    if (ph.includes("duck")) return "duck";
    if (ph.includes("fox") || hints.includes("fuchs")) return "fox";
    if (ph.includes("animal")) return "animal";
    if (/katze|cat/.test(hints)) return "cat";
    if (/vogel|bird|ente/.test(hints)) return "bird";
    if (/eichhoernchen|squirrel/.test(hints)) return "squirrel";
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

