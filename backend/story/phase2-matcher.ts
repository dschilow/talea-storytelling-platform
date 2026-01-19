// Phase 2: Intelligent Character Matching
// Matches best characters from pool to story roles
// Token Budget: 0 (Backend Logic only!)

import { storyDB } from "./db";
import type { StorySkeleton, CharacterTemplate, CharacterRequirement, CharacterAssignment } from "./types";
import { EnhancedCharacterMatcher } from "./enhanced-character-matcher";
import type { FairyTaleRoleRequirement } from "./enhanced-character-matcher";
import { saveGeneratedCharacterToPool } from "./save-generated-character";
import crypto from "crypto";

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
    selectedFairyTale?: any,  // NEW: If provided, load roles from fairy_tale_roles instead of skeleton
    avatarDetails?: any[]  // NEW: Full avatar details with visualProfile
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
    const avatarNameSource = (avatarDetails && avatarDetails.length > 0)
      ? avatarDetails.map(a => a?.name)
      : avatarNames;
    const seenAvatarNames = new Set<string>();
    const avatarQueue = avatarNameSource
      .map(name => name?.trim())
      .filter((name): name is string => Boolean(name))
      .map(name => ({ name, key: this.normalizeNameKey(name) }))
      .filter((entry) => {
        if (!entry.key) return false;
        if (seenAvatarNames.has(entry.key)) return false;
        seenAvatarNames.add(entry.key);
        return true;
      });

    // Prefer skeleton requirements; only fall back to fairy tale roles if skeleton is empty
    let characterRequirements: any[] = skeleton.supportingCharacterRequirements;

    if ((!characterRequirements || characterRequirements.length === 0) && selectedFairyTale && selectedFairyTale.roles) {
      console.log(`[Phase2] ðŸŽ­ Fairy Tale Mode: Loading ${selectedFairyTale.roles.length} roles from "${selectedFairyTale.tale.title}"`);

      // Convert fairy tale roles to character requirements format
      // Skip protagonist roles (those are for user avatars)
      characterRequirements = selectedFairyTale.roles
        .filter((role: any) => role.roleType !== 'protagonist')  // Only supporting characters
        .map((role: any) => {
          // 🔧 CRITICAL: Log what requirements we're getting from DB
          if (role.speciesRequirement || role.genderRequirement || role.ageRequirement) {
            console.log(`[Phase2] ✅ Role "${role.roleName}" has requirements:`, {
              species: role.speciesRequirement,
              gender: role.genderRequirement,
              age: role.ageRequirement,
              social: role.socialClassRequirement
            });
          } else {
            console.warn(`[Phase2] ⚠️ Role "${role.roleName}" has NO requirements - will infer from name`);
          }

          return {
            placeholder: `{{${role.roleName.toUpperCase().replace(/\s+/g, '_')}}}`,
            role: role.roleType,
            archetype: role.archetypePreference || 'neutral',
            emotionalNature: role.description || 'neutral',
            visualHints: role.professionPreference?.join(', ') || '',
            requiredTraits: [],
            importance: role.required ? 'high' : 'medium',
            inChapters: [1, 2, 3, 4, 5],
            // 🔧 CRITICAL: Pass through requirements for EnhancedCharacterMatcher
            fairyTaleRoleRequirement: {
              roleName: role.roleName,
              roleType: role.roleType,
              archetypePreference: role.archetypePreference || 'neutral',
              speciesRequirement: role.speciesRequirement || 'any',
              genderRequirement: role.genderRequirement || 'any',
              ageRequirement: role.ageRequirement || 'any',
              sizeRequirement: role.sizeRequirement || 'any',
              socialClassRequirement: role.socialClassRequirement || 'any',
              professionPreference: role.professionPreference || []
            }
          };
        });

      console.log(`[Phase2] Converted ${characterRequirements.length} fairy tale roles to requirements:`,
        characterRequirements.map((r: any) => `${r.placeholder} (${r.role})`)
      );
    }

    // Normalize placeholders/traits and enforce conflict presence
    characterRequirements = characterRequirements
      .map(req => this.normalizeRequirement(req))
      .filter((req): req is CharacterRequirement => Boolean(req));

    // Validate placeholder set matches skeleton expectations (prevent drift)
    // CRITICAL FIX: When using fairy tale mode, skeleton.supportingCharacterRequirements is empty
    // so we MUST skip this validation to prevent all requirements from being filtered out
    const skeletonPlaceholders = new Set(
      (skeleton.supportingCharacterRequirements || []).map(req => this.normalizePlaceholder(req.placeholder))
    );
    const requirementPlaceholders = new Set(characterRequirements.map(req => req.placeholder));

    // ONLY validate when NOT in fairy tale mode (skeleton has actual requirements)
    if (!useFairyTaleTemplate || skeleton.supportingCharacterRequirements.length > 0) {
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
    } else {
      console.log("[Phase2] Skipping skeleton placeholder validation in fairy tale mode");
    }

    // CRITICAL FIX: Skip validation in fairy tale mode (skeleton is empty by design)
    if (!useFairyTaleTemplate && characterRequirements.length !== skeletonPlaceholders.size) {
      console.warn(`[Phase2] Placeholder mismatch detected (skeleton=${skeletonPlaceholders.size} reqs=${characterRequirements.length}) - regenerating requirements from skeleton to keep run alive`);
      characterRequirements = (skeleton.supportingCharacterRequirements || [])
        .map(req => this.normalizeRequirement(req))
        .filter((req): req is CharacterRequirement => Boolean(req));
    }

    // Guardrail: if requirements drifted (e.g. overwritten placeholders), warn/adjust
    // CRITICAL FIX: Skip in fairy tale mode
    const expectedReqCount = skeleton.supportingCharacterRequirements?.length || 0;
    if (!useFairyTaleTemplate && expectedReqCount > 0 && characterRequirements.length !== expectedReqCount) {
      console.warn(`[Phase2] Requirement count drift: expected ${expectedReqCount}, got ${characterRequirements.length}`);
    }

    // 🔧 CRITICAL FIX: User avatars should ALWAYS be protagonists/sidekicks, NEVER villains
    // Ensure protagonist/sidekick slots exist so avatars can be mapped deterministically
    // The FIRST avatar is always the main protagonist (hero)
    // The SECOND avatar is always the sidekick/companion (not antagonist!)
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
      console.log("[Phase2] Added protagonist slot for first user avatar");
    }

    // 🔧 CRITICAL FIX: Second avatar should be sidekick, NOT antagonist
    const hasSidekickSlot = characterRequirements.some(req => {
      const role = req.role;
      const placeholder = String(req.placeholder || "").toUpperCase();
      return role === "sidekick" ||
        placeholder.includes("SIDEKICK_AVATAR") ||
        (placeholder.includes("AVATAR") && role === "companion");
    });
    if (avatarQueue.length > 1 && !hasSidekickSlot) {
      characterRequirements.splice(1, 0, {  // Insert at position 1 (after protagonist)
        placeholder: "{{SIDEKICK_AVATAR}}",
        role: "sidekick",
        archetype: "loyal_friend",
        emotionalNature: "supportive",
        visualHints: "Avatar-Begleiter",
        requiredTraits: ["loyal", "helpful"],
        importance: "high",
        inChapters: [1, 2, 3, 4, 5],
      } as any);
      console.log("[Phase2] Added sidekick slot for second user avatar");
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

      // 🔧 CRITICAL FIX: Assign user avatars to protagonist/sidekick/helper roles ONLY
      // Never assign avatars to antagonist roles - those should be filled by character pool
      // "helper" is used in fairy tale templates (e.g., Kind in "Des Kaisers neue Kleider")
      const placeholderUpper = String(req.placeholder || "").toUpperCase();
      const isExplicitAvatarPlaceholder = placeholderUpper.includes("AVATAR");
      const isAvatarRole = isExplicitAvatarPlaceholder || req.role === "protagonist" || req.role === "sidekick";

      if (isAvatarRole && avatarQueue.length > 0) {
        const avatarEntry = avatarQueue.shift();
        if (avatarEntry) {
          const avatarName = avatarEntry.name;
          const avatarKey = avatarEntry.key;
          // 🔧 SPECIES-AWARENESS CHECK: Verify avatar species matches placeholder expectations
          // Load avatar details first to check species
          const fullAvatarData = avatarDetails?.find(
            a => this.normalizeNameKey(a.name) === avatarKey
          );

          const avatarSpecies = fullAvatarData?.visualProfile?.species || "human";
          const placeholderUpper = req.placeholder.toUpperCase();
          
          // Check if placeholder suggests animal/creature species but avatar is human (or vice versa)
          const placeholderSuggestsAnimal = placeholderUpper.includes("ANIMAL") || placeholderUpper.includes("CREATURE") || placeholderUpper.includes("PET");
          const avatarIsHuman = avatarSpecies === "human";
          
          if (placeholderSuggestsAnimal && avatarIsHuman) {
            // SPECIES MISMATCH: Human avatar cannot be animal helper!
            console.warn(`[Phase2] ⚠️ SPECIES MISMATCH: Avatar "${avatarName}" (human) cannot fill animal-themed placeholder "${req.placeholder}". Skipping avatar assignment - will use character pool instead.`);
            
            // Put avatar back in queue for next role
            avatarQueue.unshift(avatarEntry);
            
            // Fall through to character pool matching logic below
          } else {
            // Species matches or no conflict - proceed with avatar assignment
            console.log("[Phase2] ✅ Assigning user avatar to hero role", {
              placeholder: req.placeholder,
              avatarName,
              role: req.role,
              archetype: req.archetype,
              species: avatarSpecies
            });

            // Build enriched visual profile with full data
            let visualProfile: any = {
              description: avatarName,
              imagePrompt: avatarName,
              species: avatarSpecies,
              colorPalette: [],
            };

            if (fullAvatarData?.visualProfile) {
              // Use the full visual profile from the database
              visualProfile = {
                description: this.visualProfileToEnglishDescription(fullAvatarData.visualProfile),
                imagePrompt: this.visualProfileToEnglishDescription(fullAvatarData.visualProfile),
                species: avatarSpecies,
                colorPalette: this.extractColorPalette(fullAvatarData.visualProfile),
              };
              console.log("[Phase2] ✅ Loaded full visual profile for", avatarName, {
                age: fullAvatarData.visualProfile.ageApprox,
                gender: fullAvatarData.visualProfile.gender,
                species: avatarSpecies
              });
            } else {
              console.warn("[Phase2] ⚠️ No visual profile found for avatar:", avatarName);
            }

            // Build character template with enriched data
            const avatarChar: CharacterTemplate = {
              id: fullAvatarData?.id || `avatar_${avatarName}`,
              name: avatarName,
              role: req.role,  // Will be protagonist or sidekick/helper, NEVER antagonist
              archetype: req.archetype,  // Will be hero or loyal_friend, NEVER villain
              emotionalNature: {
                dominant: req.emotionalNature,
                secondary: req.requiredTraits || [],
              },
              visualProfile,
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
      }

      console.log("[Phase2] Matching requirement:", {
        placeholder: req.placeholder,
        role: req.role,
        archetype: req.archetype,
        requirements: (req as any).fairyTaleRoleRequirement ? {
          species: (req as any).fairyTaleRoleRequirement.speciesRequirement,
          gender: (req as any).fairyTaleRoleRequirement.genderRequirement,
          age: (req as any).fairyTaleRoleRequirement.ageRequirement
        } : 'none'
      });

      // 🔧 CRITICAL FIX: Use fairy tale role requirements from req (already loaded above)
      // instead of searching again in selectedFairyTale.roles
      const fairyTaleRole: FairyTaleRoleRequirement | undefined = (req as any).fairyTaleRoleRequirement;

      const bestMatch = this.findBestMatch(
        req,
        pool,
        setting,
        usedCharacters,
        recentUsage,
        usedSpecies,
        useFairyTaleTemplate,
        fairyTaleRole
      );

      if (!bestMatch) {
        console.warn(`[Phase2] No match found for ${req.placeholder}, generating SMART fallback`);

        // SMART CHARACTER GENERATION
        // Instead of generic fallback, we create a tailored character that fits the role perfectly
        const generated = this.generateSmartCharacter(req, fairyTaleRole);

        // Mark as newly generated so we can notify the user later
        (generated as any).isNew = true;

        // Save to pool for future use!
        // We do this asynchronously to not block the request flow too much, 
        // but we await it here to ensure ID integrity if needed immediately.
        await saveGeneratedCharacterToPool(generated);

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
      // NEW: Enhanced matching attributes (Migration 7)
      gender: string | null;
      age_category: string | null;
      species_category: string | null;
      profession_tags: string[] | null;
      size_category: string | null;
      social_class: string | null;
      personality_keywords: string[] | null;
      physical_description: string | null;
      backstory: string | null;
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
      // NEW: Enhanced matching attributes
      gender: row.gender || undefined,
      age_category: row.age_category || undefined,
      species_category: row.species_category || undefined,
      profession_tags: row.profession_tags || undefined,
      size_category: row.size_category || undefined,
      social_class: row.social_class || undefined,
      personality_keywords: row.personality_keywords || undefined,
      physical_description: row.physical_description || undefined,
      backstory: row.backstory || undefined,
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

  private normalizeNameKey(name?: string): string {
    if (!name) return "";
    return String(name)
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
  }

  /**
   * INTELLIGENT MATCHING SCORE V3 - Enhanced with Species/Gender/Age/Profession
   * Uses EnhancedCharacterMatcher for comprehensive role-based matching
   */
  private findBestMatch(
    requirement: CharacterRequirement,
    pool: CharacterTemplate[],
    setting: string,
    alreadyUsed: Set<string>,
    recentUsage: Map<string, number>,
    usedSpecies: Set<string>,
    useFairyTaleTemplate: boolean = false,
    fairyTaleRole?: FairyTaleRoleRequirement
  ): CharacterTemplate | null {
    let bestMatch: CharacterTemplate | null = null;
    let bestScore = 0;

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

      if (!this.satisfiesFairyTaleHardRequirements(candidate, fairyTaleRole)) {
        continue;
      }

      // 🔧 CRITICAL OPTIMIZATION: Strict Species Matching for Fairy Tales
      // If the role requires a specific species (e.g. "Wolf"), we MUST NOT match a human.
      // This forces the system to generate a new character (Smart Gen) which is exactly what we want.
      if (useFairyTaleTemplate && fairyTaleRole?.speciesRequirement && fairyTaleRole.speciesRequirement !== 'any') {
        const candidateSpecies = (candidate.visualProfile.species || 'human').toLowerCase();
        const requiredSpecies = fairyTaleRole.speciesRequirement.toLowerCase();

        // If requirement is NOT human, but candidate IS human -> REJECT
        if (requiredSpecies !== 'human' && candidateSpecies.includes('human')) {
          // console.log(`[Phase2] 🚫 Strict Species Mismatch: Needed ${requiredSpecies}, got Human (${candidate.name})`);
          continue;
        }

        // If requirement is specific animal (e.g. "wolf"), candidate must match
        if (requiredSpecies !== 'human' && !candidateSpecies.includes(requiredSpecies)) {
          // Allow some fuzzy matching (e.g. "canine" for "wolf")
          const isRelated = this.isRelatedVisual(requiredSpecies, candidateSpecies);
          if (!isRelated) {
            continue;
          }
        }
      }

      const debugScores: Record<string, number> = {};

      // ===== SCORING MATRIX V3 (Enhanced Character Matcher) =====
      // Use EnhancedCharacterMatcher for comprehensive species/gender/age/profession matching (0-100 base score)
      const enhancedScore = EnhancedCharacterMatcher.calculateEnhancedMatchScore(
        candidate,
        requirement,
        fairyTaleRole
      );
      let score = enhancedScore;
      debugScores.enhancedMatchScore = enhancedScore;

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
      // OPTIMIZATION v2.3: Strict Freshness Policy
      // Characters used in the last 5 stories get a MASSIVE penalty (-50)
      // Characters used > 10 times total get a usage penalty (-30 max)
      const usageCount = recentUsage.get(candidate.id) || 0;

      let freshness = 0;
      if (usageCount > 0) {
        // HEAVY PENALTY for recently used characters
        freshness = -50 * usageCount;
        debugScores.freshnessPenalty = freshness;
      } else {
        // BONUS for unused characters
        freshness = 50;
        debugScores.freshnessBonus = 50;
      }
      score += freshness;

      // 10. SPECIES DIVERSITY BONUS (30 points)
      // Encourage variety in species/types
      const species = candidate.visualProfile.species || "unknown";
      if (!usedSpecies.has(species)) {
        score += 30; // New species - bonus!
        debugScores.diversity = 30;
      } else {
        // Penalty for same species (except humans)
        if (species !== 'human') {
          score -= 20;
          debugScores.diversityPenalty = -20;
        }
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

        // OPTIMIZATION v2.4: Aggressive Penalty for modern professions in fairy tales
        // Erweiterte Liste: Busfahrer, Mechaniker, Polizist, etc.
        const modernKeywords = [
          'police', 'polizist', 'doctor', 'arzt', 'mechanic', 'mechaniker',
          'teacher', 'lehrer', 'busfahrer', 'bus driver', 'driver', 'fahrer',
          'engineer', 'ingenieur', 'nurse', 'krankenschwester', 'pilot', 'pilot',
          'chef', 'koch', 'waiter', 'kellner', 'cashier', 'kassierer'
        ];
        const candidateDescLower = (candidate.visualProfile.description || '').toLowerCase();
        const candidateNameLower = (candidate.name || '').toLowerCase();
        const hasModernProfession = modernKeywords.some(keyword =>
          candidateDescLower.includes(keyword) || candidateNameLower.includes(keyword)
        );

        if (hasModernProfession) {
          score -= 150; // Erhöht von -100 auf -150 für stärkere Abneigung
          debugScores.modernPenalty = -150;
          console.log(`[Phase2] 🚫 Modern profession penalty applied to ${candidate.name} in fantasy setting`);
        }
      }

      // Store score and details for debugging
      (candidate as any)._matchScore = score;
      (candidate as any)._debugScores = debugScores;

      // Track best score
      if (score > bestScore) {
        bestScore = score;
      }
    }

    // QUALITY GATE - Require minimum score for match quality
    // OPTIMIZATION v3.0: Revolutionary Thresholds
    // If we are in Fairy Tale mode, we DEMAND excellence. Mediocre matches are rejected.
    // This forces the system to generate new characters that fit perfectly.

    let qualityThreshold = 60; // Standard mode
    if (useFairyTaleTemplate) {
      qualityThreshold = 180; // 🔥 ULTRA STRICT THRESHOLD for Fairy Tales (needs bonus to pass)
      // Explanation: Base (~80) + Setting (40) + Freshness (50) = 170. 
      // So without the Fairy Tale Bonus (150), it's almost impossible to pass.
      // This ensures only TRULY fitting characters (archetype match) are selected.
      console.log(`[Phase2] 🏰 Fairy Tale Mode Active: Ultra Strict Quality Threshold (180)`);
    }

    if (bestScore < qualityThreshold) {
      console.warn(`[Phase2] 📉 Best match score too low: ${bestScore} (<${qualityThreshold}) for ${requirement.placeholder} -> Triggering Smart Gen`);
      return null;
    }

    // OPTIMIZATION v2.4: Random Selection bei gleichen Scores
    // Sammle alle Kandidaten mit ähnlichen Scores (innerhalb von 3 Punkten)
    // und wähle dann zufällig aus dieser Gruppe
    const scoreThreshold = 3; // Alle innerhalb von 3 Punkten gelten als "gleich gut"
    const candidatesWithEqualScore = pool.filter(c => {
      const score = (c as any)._matchScore || 0;
      return score >= 60 && Math.abs(bestScore - score) <= scoreThreshold;
    });

    if (candidatesWithEqualScore.length > 1) {
      // Zufällige Auswahl aus gleichwertigen Kandidaten
      const randomIndex = Math.floor(Math.random() * candidatesWithEqualScore.length);
      bestMatch = candidatesWithEqualScore[randomIndex];
      console.log(`[Phase2] 🎲 Random selection from ${candidatesWithEqualScore.length} equal-score candidates (score: ${bestScore}±${scoreThreshold})`);
    } else if (candidatesWithEqualScore.length === 1) {
      bestMatch = candidatesWithEqualScore[0];
    } else {
      // Fallback: Finde den besten Match (sollte nicht passieren, aber sicherheitshalber)
      for (const candidate of pool) {
        const score = (candidate as any)._matchScore || 0;
        if (score === bestScore) {
          bestMatch = candidate;
          break;
        }
      }
    }

    if (bestMatch) {
      console.log(`[Phase2] Match details for ${requirement.placeholder}:`, {
        character: bestMatch.name,
        totalScore: (bestMatch as any)._matchScore,
        breakdown: (bestMatch as any)._debugScores,
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

  private satisfiesFairyTaleHardRequirements(candidate: CharacterTemplate, role?: FairyTaleRoleRequirement): boolean {
    if (!role) return true;

    const species = (candidate.species_category || candidate.visualProfile.species || "any").toLowerCase();
    const gender = (candidate.gender || "any").toLowerCase();
    const ageCategory = (candidate.age_category || "adult").toLowerCase();

    if (role.speciesRequirement && role.speciesRequirement !== 'any') {
      const expected = role.speciesRequirement.toLowerCase();
      const speciesMatches = species === expected || species.includes(expected) || expected.includes(species);
      if (!speciesMatches) {
        return false;
      }
    }

    if (role.genderRequirement && role.genderRequirement !== 'any') {
      const expectedGender = role.genderRequirement.toLowerCase();
      if (gender !== expectedGender) {
        return false;
      }
    }

    if (role.ageRequirement && role.ageRequirement !== 'any') {
      const expectedAge = role.ageRequirement.toLowerCase();
      if (!this.areAgeCategoriesCompatible(expectedAge, ageCategory)) {
        return false;
      }
    }

    return true;
  }

  private areAgeCategoriesCompatible(expected: string, actual: string): boolean {
    if (expected === actual) {
      return true;
    }

    const order = ['child', 'teenager', 'young_adult', 'adult', 'elder'];
    const expectedIdx = order.indexOf(expected);
    const actualIdx = order.indexOf(actual);

    if (expectedIdx === -1 || actualIdx === -1) {
      return false;
    }

    return Math.abs(expectedIdx - actualIdx) <= 1;
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
   * Generate a SMART character when no good match exists
   * Creates a high-quality character that fits the specific role requirements
   */
  private generateSmartCharacter(req: CharacterRequirement, ftRole?: FairyTaleRoleRequirement): CharacterTemplate {
    const id = `auto_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    console.log(`[Phase2] 🧠 Starting Smart Generation for ${req.placeholder}...`);
    if (ftRole) console.log(`[Phase2] 📜 Using Fairy Tale Template requirements:`, ftRole);

    // 1. Determine Species (Strict adherence to Fairy Tale Role)
    let species = 'human';
    if (ftRole?.speciesRequirement && ftRole.speciesRequirement !== 'any') {
      species = ftRole.speciesRequirement;
    } else {
      species = this.inferSpecies(req);
    }
    if (species === 'any') species = 'human';

    // 2. Determine Gender
    let gender = 'neutral';
    if (ftRole?.genderRequirement && ftRole.genderRequirement !== 'any') {
      gender = ftRole.genderRequirement;
    } else {
      gender = Math.random() > 0.5 ? 'male' : 'female';
    }

    // 3. Generate Name based on role/species
    const name = this.generateSmartName(req, species, gender, ftRole?.roleName);

    console.log(`[Phase2] ✨ Generated SMART character: ${name} (${species}, ${gender})`);

    // 4. Build Visual Profile
    const visualProfile = this.generateSmartVisualProfile(name, req, species, gender, ftRole);

    // 5. Determine Enhanced Attributes
    const ageCategory = ftRole?.ageRequirement && ftRole.ageRequirement !== 'any'
      ? ftRole.ageRequirement
      : (req.visualHints?.includes('kind') ? 'child' : 'adult');

    const profession = ftRole?.professionPreference?.[0]
      || (ftRole?.roleName ? ftRole.roleName.toLowerCase() : undefined)
      || (req.role === 'guide' ? 'mentor' : undefined);

    const socialClass = ftRole?.socialClassRequirement || 'commoner';

    // Size logic: Animals usually small, unless "Giant" is in name
    let sizeCategory = ftRole?.sizeRequirement || 'medium';
    if (species === 'animal' && !name.includes('Giant') && !name.includes('Riese')) {
      sizeCategory = 'small';
    }

    const dominantEmotion = (typeof req.emotionalNature === 'string' ? req.emotionalNature : (req.emotionalNature as any)?.dominant) || 'balanced';

    return {
      id,
      name,
      role: req.role,
      archetype: ftRole?.archetypePreference || req.archetype,
      emotionalNature: {
        dominant: dominantEmotion,
        secondary: req.requiredTraits || [],
      },
      visualProfile,
      maxScreenTime: this.importanceToScreenTime(req.importance),
      availableChapters: req.inChapters,
      canonSettings: [],
      isActive: true,
      recentUsageCount: 0,
      totalUsageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),

      // Enhanced attributes for future matching
      gender,
      species_category: species,
      age_category: ageCategory,
      profession_tags: profession ? [profession] : [],
      social_class: socialClass,
      size_category: sizeCategory,
      personality_keywords: req.requiredTraits,
      physical_description: visualProfile.description
    };
  }

  private generateSmartName(req: CharacterRequirement, species: string, gender: string, roleNameHint?: string): string {
    // If we have a specific role name from the fairy tale (e.g. "The Frog Prince"), use a variation of it
    if (roleNameHint && roleNameHint.length > 3 && !roleNameHint.includes('{')) {
      // Clean up the role name
      return roleNameHint;
    }

    const prefixes = {
      human: {
        male: ['Hans', 'Fritz', 'Klaus', 'Wilhelm', 'Karl', 'Heinrich', 'Friedrich', 'Jakob'],
        female: ['Greta', 'Marie', 'Anna', 'Sophie', 'Clara', 'Marta', 'Lotte', 'Elsa'],
        neutral: ['Alex', 'Sam', 'Kim', 'Mika']
      },
      animal: {
        male: ['Bello', 'Rex', 'Hoppel', 'Meister', 'Brummbär'],
        female: ['Mimi', 'Luna', 'Susi', 'Mausi', 'Goldie'],
        neutral: ['Flauschi', 'Knopf', 'Schnuffel', 'Pieps']
      },
      magical_creature: {
        male: ['Groll', 'Zottel', 'Funkel', 'Knarz'],
        female: ['Glitzer', 'Schimmer', 'Funkel', 'Nebel'],
        neutral: ['Wusel', 'Lichtlein', 'Schatten', 'Echo']
      }
    };

    const roles = {
      king: ['König', 'King', 'Herrscher'],
      queen: ['Königin', 'Queen', 'Herrscherin'],
      prince: ['Prinz'],
      princess: ['Prinzessin'],
      witch: ['Hexe', 'Zauberin'],
      wizard: ['Zauberer', 'Magier'],
      knight: ['Ritter'],
    };

    // Try to use a title if the placeholder suggests it
    const ph = req.placeholder.toLowerCase();
    if (ph.includes('king') || ph.includes('könig')) return `König ${this.pickRandom(prefixes.human.male)}`;
    if (ph.includes('queen') || ph.includes('königin')) return `Königin ${this.pickRandom(prefixes.human.female)}`;
    if (ph.includes('prince') && !ph.includes('princess')) return `Prinz ${this.pickRandom(prefixes.human.male)}`;
    if (ph.includes('princess')) return `Prinzessin ${this.pickRandom(prefixes.human.female)}`;
    if (ph.includes('witch') || ph.includes('hexe')) return `Hexe ${this.pickRandom(prefixes.human.female)}`;
    if (ph.includes('wolf')) return `Wolf ${this.pickRandom(prefixes.animal.male)}`;
    if (ph.includes('frosch') || ph.includes('frog')) return `Frosch ${this.pickRandom(prefixes.animal.male)}`;

    // Default random name based on species/gender
    const speciesKey = (species === 'human' || species === 'animal' || species === 'magical_creature') ? species : 'human';
    const genderKey = (gender === 'male' || gender === 'female') ? gender : 'neutral';

    return this.pickRandom((prefixes as any)[speciesKey][genderKey] || prefixes.human.neutral);
  }

  private generateSmartVisualProfile(name: string, req: CharacterRequirement, species: string, gender: string, ftRole?: FairyTaleRoleRequirement): any {
    const adjectives = (typeof req.emotionalNature === 'string' ? req.emotionalNature : (req.emotionalNature as any)?.dominant) || 'friendly';
    const archetype = req.archetype || 'helper';

    let description = `${name} is a ${adjectives} ${species} (${gender}) who acts as a ${archetype}. `;
    if (ftRole?.roleName) {
      description += `Role inspiration: ${ftRole.roleName}. `;
    }

    if (ftRole?.professionPreference) {
      description += `Profession: ${ftRole.professionPreference.join(', ')}. `;
    }

    if (species === 'human') {
      description += gender === 'female' ? 'She wears a dress suited for her role.' : 'He wears clothes suited for his role.';
    } else if (species === 'animal') {
      description += 'Has soft fur and bright eyes.';
    }

    // Determine color palette
    const colors = ['brown', 'green', 'blue'];
    if (archetype === 'villain') colors[2] = 'black';
    if (archetype === 'hero') colors[2] = 'gold';
    if (species === 'magical_creature') colors[0] = 'purple';

    const fairyTaleAccents = ftRole
      ? `ornate fairy-tale costume, glowing particles, ${ftRole.roleType} symbolism`
      : 'storybook outfit';

    return {
      description,
      imagePrompt: `Portrait of ${name}, a ${species} ${archetype}, ${adjectives} expression, ${fairyTaleAccents}, watercolor illustration, German fairy tale style. STRICTLY NO TEXT.`,
      species,
      colorPalette: colors,
      gender,
      ageApprox: ftRole?.ageRequirement === 'child' ? 8 : 30
    };
  }

  private pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Generate a fallback character when no good match exists
   */
  private generateFallbackCharacter(req: CharacterRequirement): CharacterTemplate {
    const id = `generated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const name = this.generateName(req);

    console.log(`[Phase2] Generating fallback character: ${name}`);

    const species = this.inferSpecies(req);
    const dominantEmotion = (typeof req.emotionalNature === 'string' ? req.emotionalNature : (req.emotionalNature as any)?.dominant) || 'balanced';

    return {
      id,
      name,
      role: req.role,
      archetype: req.archetype,
      emotionalNature: {
        dominant: dominantEmotion,
        secondary: req.requiredTraits || [],
      },
      visualProfile: {
        description: `${name} - ${req.role} character with ${dominantEmotion} nature`,
        imagePrompt: `${name}, ${req.archetype} character, ${dominantEmotion} expression, child-friendly, watercolor illustration`,
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

  /**
   * Convert structured visual profile to English description for image generation
   * Reuses logic from orchestrator to maintain consistency
   */
  private extractNumericAge(vp: any): number | null {
    if (!vp) return null;
    if (typeof vp.ageNumeric === "number") return vp.ageNumeric;
    if (typeof vp.ageApprox === "number") return vp.ageApprox;
    const match = String(vp.ageApprox || "").match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  }

  private visualProfileToEnglishDescription(vp: any): string {
    if (!vp) return 'no visual details available';

    const parts: string[] = [];

    // AGE FIRST (critical for size relationships)
    const numericAge = this.extractNumericAge(vp);
    if (numericAge !== null) {
      parts.push(`${numericAge} years old`);

      // Add explicit size constraints based on age
      if (numericAge <= 7) {
        parts.push('small child size');
      } else if (numericAge <= 10) {
        parts.push('child-sized');
      }
    } else if (vp.ageApprox) {
      parts.push(String(vp.ageApprox));
    }

    if (vp.gender) parts.push(vp.gender);

    if (vp.hair) {
      const hairParts = [];
      if (vp.hair.color) hairParts.push(vp.hair.color);
      if (vp.hair.length) hairParts.push(vp.hair.length);
      if (vp.hair.type) hairParts.push(vp.hair.type);
      if (vp.hair.style) hairParts.push(vp.hair.style);
      if (hairParts.length > 0) parts.push(`${hairParts.join(' ')} hair`);
    }

    if (vp.eyes?.color) parts.push(`${vp.eyes.color} eyes`);

    if (vp.skin?.tone) parts.push(`${vp.skin.tone} skin`);

    if (vp.clothingCanonical) {
      const clothingParts = [];
      if (vp.clothingCanonical.outfit) clothingParts.push(vp.clothingCanonical.outfit);
      else {
        if (vp.clothingCanonical.top) clothingParts.push(vp.clothingCanonical.top);
        if (vp.clothingCanonical.bottom) clothingParts.push(vp.clothingCanonical.bottom);
      }
      if (vp.clothingCanonical.footwear) clothingParts.push(vp.clothingCanonical.footwear);
      if (clothingParts.length > 0) parts.push(`wearing ${clothingParts.join(', ')}`);
    }

    if (vp.accessories && vp.accessories.length > 0) {
      parts.push(`with ${vp.accessories.join(', ')}`);
    }

    if (vp.consistentDescriptors && vp.consistentDescriptors.length > 0) {
      parts.push(vp.consistentDescriptors.join(', '));
    }

    return parts.join(', ');
  }

  /**
   * Extract color palette from visual profile for character consistency
   */
  private extractColorPalette(vp: any): string[] {
    const colors: string[] = [];

    if (vp.hair?.color) colors.push(vp.hair.color);
    if (vp.eyes?.color) colors.push(vp.eyes.color);
    if (vp.skin?.tone) colors.push(vp.skin.tone);

    // Extract clothing colors if available
    if (vp.clothingCanonical) {
      const clothing = vp.clothingCanonical;
      // Try to extract color keywords from outfit/top/bottom
      const colorKeywords = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'black', 'white', 'brown', 'grey', 'gray'];
      const clothingText = [clothing.outfit, clothing.top, clothing.bottom].filter(Boolean).join(' ').toLowerCase();

      colorKeywords.forEach(color => {
        if (clothingText.includes(color) && !colors.includes(color)) {
          colors.push(color);
        }
      });
    }

    return colors.slice(0, 5); // Limit to 5 main colors
  }
}
