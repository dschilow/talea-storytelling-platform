// Artifact Matching System
// Matches best artifact from pool to story requirements
// Analog to Phase2CharacterMatcher for characters

import { storyDB } from "./db";
import type { ArtifactTemplate, ArtifactRequirement, ArtifactCategory, ArtifactRarity } from "./types";
import { extractPendingArtifactReference } from "./artifact-reward-utils";

/**
 * Converts database row to ArtifactTemplate
 */
export function rowToArtifactTemplate(row: any): ArtifactTemplate {
  return {
    id: row.id,
    name: {
      de: row.name_de,
      en: row.name_en,
    },
    description: {
      de: row.description_de,
      en: row.description_en,
    },
    category: row.category as ArtifactCategory,
    rarity: row.rarity as ArtifactRarity,
    storyRole: row.story_role,
    discoveryScenarios: row.discovery_scenarios || [],
    usageScenarios: row.usage_scenarios || [],
    emoji: row.emoji,
    visualKeywords: row.visual_keywords || [],
    imageUrl: row.image_url || undefined,
    genreAffinity: {
      adventure: parseFloat(row.genre_adventure) || 0.5,
      fantasy: parseFloat(row.genre_fantasy) || 0.5,
      mystery: parseFloat(row.genre_mystery) || 0.5,
      nature: parseFloat(row.genre_nature) || 0.5,
      friendship: parseFloat(row.genre_friendship) || 0.5,
      courage: parseFloat(row.genre_courage) || 0.5,
      learning: parseFloat(row.genre_learning) || 0.5,
    },
    recentUsageCount: row.recent_usage_count || 0,
    totalUsageCount: row.total_usage_count || 0,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
    lastUsedInStoryId: row.last_used_in_story_id,
    isActive: row.is_active ?? true,
    createdAt: row.created_at ? new Date(row.created_at) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
  };
}

/**
 * ArtifactMatcher - Finds the best artifact for a story's requirements
 * Uses a scoring system similar to EnhancedCharacterMatcher
 */
export class ArtifactMatcher {
  /**
   * Main matching function
   * Finds the best artifact from the pool for the requirement
   */
  async match(
    requirement: ArtifactRequirement,
    genre: string,
    recentStoryIds: string[] = [],
    userLanguage: string = 'de',
    options: { excludeArtifactIds?: Set<string> } = {}
  ): Promise<ArtifactTemplate> {
    console.log("[ArtifactMatcher] Starting artifact matching...", {
      preferredCategory: requirement.preferredCategory,
      requiredAbility: requirement.requiredAbility,
      genre,
      discoveryChapter: requirement.discoveryChapter,
      usageChapter: requirement.usageChapter,
      excludedCount: options.excludeArtifactIds?.size || 0,
    });

    // 1. Load artifact pool from database
    let pool = await this.loadArtifactPool();
    console.log("[ArtifactMatcher] Loaded artifact pool:", { totalArtifacts: pool.length });

    // Treasury rules: artifacts the participating avatars already own (no
    // duplicates) and set-crown rewards (only earned via set completion)
    // never get cast as a story reward. If exclusion would empty the pool,
    // fall back to the unfiltered pool rather than failing generation.
    const exclude = options.excludeArtifactIds;
    if (exclude && exclude.size > 0) {
      const filtered = pool.filter(artifact => !exclude.has(artifact.id));
      if (filtered.length > 0) {
        pool = filtered;
      } else {
        console.warn("[ArtifactMatcher] Exclusion list would empty the pool; ignoring exclusions.");
      }
    }

    if (pool.length === 0) {
      console.warn("[ArtifactMatcher] No artifacts in pool! Using fallback...");
      return this.generateFallbackArtifact(requirement, genre);
    }

    // 2. Load recent artifact usage for freshness scoring
    const recentUsage = await this.loadRecentArtifactUsage(recentStoryIds);

    // 3. Score each artifact
    const scoredCandidates = pool.map(artifact => ({
      artifact,
      score: this.calculateMatchScore(artifact, requirement, genre, recentUsage),
    }));

    // 4. Sort by score (highest first)
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Log top 5 candidates for debugging
    console.log("[ArtifactMatcher] Top 5 candidates:",
      scoredCandidates.slice(0, 5).map(c => ({
        id: c.artifact.id,
        name: c.artifact.name.de,
        score: c.score,
        category: c.artifact.category,
        rarity: c.artifact.rarity,
        recentUsageCount: c.artifact.recentUsageCount,
        totalUsageCount: c.artifact.totalUsageCount,
        userRecentUsage: recentUsage.get(c.artifact.id) || 0,
      }))
    );

    // 5. Quality Gate - minimum score threshold
    const qualityThreshold = 50; // Artifact matching is simpler than character matching
    const validCandidates = scoredCandidates.filter(c => c.score >= qualityThreshold);

    if (validCandidates.length === 0) {
      console.warn("[ArtifactMatcher] No artifacts above quality threshold! Using best available...");
      // Just use the top one even if below threshold
      const best = scoredCandidates[0];
      if (best) {
        await this.incrementUsageCounter(best.artifact.id);
        return best.artifact;
      }
      return this.generateFallbackArtifact(requirement, genre);
    }

    // 6. Tiered Random Selection for variety
    const topScore = validCandidates[0].score;
    const varianceThreshold = 12; // Keep quality tight, then diversify inside that band
    const topTier = validCandidates
      .filter(c => c.score >= topScore - varianceThreshold)
      .slice(0, 12);
    const userFreshPool = topTier.filter(c => (recentUsage.get(c.artifact.id) || 0) === 0);
    const selectionPool = userFreshPool.length >= 3 ? userFreshPool : topTier;
    const selectedEntry = this.selectCandidateWithDiversity(selectionPool, topScore - varianceThreshold, recentUsage);
    const selected = selectedEntry.artifact;

    console.log("[ArtifactMatcher] Selected artifact:", {
      id: selected.id,
      name: selected.name.de,
      category: selected.category,
      rarity: selected.rarity,
      score: selectedEntry.score,
      topTierSize: topTier.length,
      selectionPoolSize: selectionPool.length,
    });

    // 7. Update usage counter
    await this.incrementUsageCounter(selected.id);

    return selected;
  }

  /**
   * Scoring Algorithm
   * Returns a score from 0-100+ based on how well the artifact matches requirements
   */
  private calculateMatchScore(
    artifact: ArtifactTemplate,
    requirement: ArtifactRequirement,
    genre: string,
    recentUsage: Map<string, number>
  ): number {
    let score = 0;

    // ===== CATEGORY MATCHING (30 points max) =====
    if (requirement.preferredCategory) {
      if (artifact.category === requirement.preferredCategory) {
        score += 30; // Perfect match
      } else if (this.areCompatibleCategories(artifact.category, requirement.preferredCategory)) {
        score += 15; // Compatible category
      }
    } else {
      score += 15; // No category preference = neutral bonus
    }

    // ===== GENRE AFFINITY (40 points max) =====
    const genreKey = this.normalizeGenreKey(genre);
    const genreScore = artifact.genreAffinity[genreKey] ?? 0.5;
    score += genreScore * 40; // 0.0 = 0 points, 1.0 = 40 points

    // ===== ABILITY MATCHING (20 points max) =====
    if (requirement.requiredAbility) {
      const abilityMatch = this.matchAbility(artifact, requirement.requiredAbility);
      score += abilityMatch * 20; // 0.0 - 1.0 → 0 - 20 points
    } else {
      score += 10; // No ability requirement = neutral bonus
    }

    // ===== FRESHNESS SCORING (±30 points) =====
    const usageCount = recentUsage.get(artifact.id) || 0;
    score += this.calculateFreshnessAdjustment(artifact, usageCount);

    // ===== RARITY BONUS (10 points max) =====
    // Rare artifacts get a small bonus for variety
    const rarityBonus: Record<ArtifactRarity, number> = {
      'common': 0,
      'uncommon': 3,
      'rare': 7,
      'legendary': 10,
    };
    score += rarityBonus[artifact.rarity] || 0;

    // Child-book quality adjustment:
    // Prefer graspable helper objects over combat/power artifacts. The artifact
    // should create a rule or choice for the child, not solve the plot alone.
    score += this.calculateChildStoryQualityAdjustment(artifact);

    return Math.max(0, score); // Never negative
  }

  private calculateChildStoryQualityAdjustment(artifact: ArtifactTemplate): number {
    const text = [
      artifact.name.de,
      artifact.name.en,
      artifact.description.de,
      artifact.description.en,
      artifact.storyRole,
      ...artifact.usageScenarios,
      ...artifact.visualKeywords,
    ].join(" ").toLowerCase();

    let adjustment = 0;
    const childReadableCategories: ArtifactCategory[] = ["map", "book", "tool", "jewelry", "nature"];
    if (childReadableCategories.includes(artifact.category)) adjustment += 8;
    if (artifact.category === "weapon") adjustment -= 18;

    if (/\b(sword|dagger|blade|lance|hammer|weapon|fight|battle|attack|monster|schwert|dolch|klinge|lanze|hammer|waffe|kampf|angriff|monster|besiegen|zerstoer|zerstör)\b/i.test(text)) {
      adjustment -= 12;
    }
    if (/\b(any curse|everything|anywhere|future|read minds|revive|jeden fluch|alles|ueberall|überall|zukunft|gedanken liest|wiederbeleb)\b/i.test(text)) {
      adjustment -= 10;
    }
    if (/\b(map|compass|key|book|bell|thread|button|coin|lantern|karte|kompass|schluessel|schlüssel|buch|glocke|faden|knopf|muenze|münze|laterne)\b/i.test(text)) {
      adjustment += 8;
    }
    if (/\b(shows|points|reminds|glows|opens|only|zeigt|weist|erinnert|leuchtet|oeffnet|öffnet|nur)\b/i.test(text)) {
      adjustment += 6;
    }

    return Math.max(-24, Math.min(18, adjustment));
  }

  private calculateFreshnessAdjustment(artifact: ArtifactTemplate, userRecentUsage: number): number {
    let adjustment = 0;

    if (userRecentUsage === 0) adjustment += 12;
    else if (userRecentUsage === 1) adjustment -= 18;
    else adjustment -= 30;

    if (artifact.recentUsageCount === 0) adjustment += 10;
    else adjustment -= Math.min(18, artifact.recentUsageCount * 1.8);

    if (artifact.totalUsageCount === 0) adjustment += 6;
    else adjustment -= Math.min(12, artifact.totalUsageCount * 0.22);

    const daysSinceLastUse = this.daysSince(artifact.lastUsedAt);
    if (daysSinceLastUse !== null) {
      if (daysSinceLastUse < 1) adjustment -= 10;
      else if (daysSinceLastUse < 3) adjustment -= 7;
      else if (daysSinceLastUse < 7) adjustment -= 4;
      else if (daysSinceLastUse > 45) adjustment += 2;
    }

    return Math.max(-30, Math.min(24, adjustment));
  }

  private selectCandidateWithDiversity(
    candidates: Array<{ artifact: ArtifactTemplate; score: number }>,
    floorScore: number,
    recentUsage: Map<string, number>
  ): { artifact: ArtifactTemplate; score: number } {
    if (candidates.length === 1) return candidates[0];

    const weighted = candidates.map(candidate => {
      const userRecentUsage = recentUsage.get(candidate.artifact.id) || 0;
      const scoreWeight = Math.max(1, candidate.score - floorScore + 1);
      const freshnessWeight = this.calculateSelectionFreshnessWeight(candidate.artifact, userRecentUsage);
      return {
        ...candidate,
        weight: Math.max(0.05, scoreWeight * freshnessWeight),
      };
    });

    const totalWeight = weighted.reduce((sum, candidate) => sum + candidate.weight, 0);
    if (totalWeight <= 0) return weighted[0];

    let roll = Math.random() * totalWeight;
    for (const candidate of weighted) {
      roll -= candidate.weight;
      if (roll <= 0) {
        return { artifact: candidate.artifact, score: candidate.score };
      }
    }

    const fallback = weighted[weighted.length - 1];
    return { artifact: fallback.artifact, score: fallback.score };
  }

  private calculateSelectionFreshnessWeight(artifact: ArtifactTemplate, userRecentUsage: number): number {
    let weight = 1;

    if (userRecentUsage > 0) weight *= 0.08;
    weight *= 1 / (1 + artifact.recentUsageCount * 0.45);
    weight *= 1 / (1 + artifact.totalUsageCount * 0.03);

    const daysSinceLastUse = this.daysSince(artifact.lastUsedAt);
    if (daysSinceLastUse !== null) {
      if (daysSinceLastUse < 1) weight *= 0.35;
      else if (daysSinceLastUse < 7) weight *= 0.65;
      else if (daysSinceLastUse > 30) weight *= 1.1;
    }

    return Math.max(0.05, Math.min(2.5, weight));
  }

  private daysSince(date?: Date): number | null {
    if (!date) return null;
    const diff = Date.now() - date.getTime();
    if (!Number.isFinite(diff) || diff < 0) return 0;
    return diff / (1000 * 60 * 60 * 24);
  }

  /**
   * Checks if two categories are compatible
   */
  private areCompatibleCategories(actual: ArtifactCategory, required: ArtifactCategory): boolean {
    const compatibilityMap: Record<ArtifactCategory, ArtifactCategory[]> = {
      'weapon': ['armor', 'tool'],
      'clothing': ['armor', 'jewelry'],
      'magic': ['potion', 'book', 'jewelry'],
      'book': ['magic', 'map'],
      'tool': ['weapon', 'tech'],
      'tech': ['tool'],
      'nature': ['potion', 'magic'],
      'potion': ['magic', 'nature'],
      'jewelry': ['magic', 'clothing'],
      'armor': ['weapon', 'clothing'],
      'map': ['book', 'tool'],
    };
    return compatibilityMap[actual]?.includes(required) || false;
  }

  /**
   * Matches artifact abilities to required ability
   * Returns a score from 0.0 to 1.0
   */
  private matchAbility(artifact: ArtifactTemplate, ability: string): number {
    const abilityKeywords: Record<string, string[]> = {
      'navigation': ['compass', 'map', 'path', 'way', 'direction', 'guide', 'weg', 'führt', 'zeigt'],
      'protection': ['shield', 'guard', 'protect', 'safe', 'defend', 'schutz', 'schützt', 'verteidigt'],
      'communication': ['speak', 'language', 'talk', 'understand', 'voice', 'sprache', 'spricht', 'versteht'],
      'healing': ['heal', 'cure', 'mend', 'restore', 'health', 'heilt', 'heilung', 'wunden'],
      'courage': ['brave', 'courage', 'fear', 'strength', 'hero', 'mut', 'tapfer', 'angst'],
      'wisdom': ['wise', 'knowledge', 'learn', 'understand', 'answer', 'wissen', 'weisheit', 'lernen'],
      'discovery': ['find', 'discover', 'reveal', 'hidden', 'secret', 'entdeckt', 'findet', 'geheim'],
      'stealth': ['invisible', 'shadow', 'hide', 'stealth', 'unsichtbar', 'schatten', 'versteckt'],
      'combat': ['sword', 'weapon', 'fight', 'battle', 'attack', 'schwert', 'waffe', 'kampf'],
      'magic': ['magic', 'spell', 'enchant', 'wand', 'magie', 'zauber', 'magisch'],
      'light': ['light', 'glow', 'bright', 'illuminate', 'licht', 'leuchtet', 'hell'],
      'time': ['time', 'slow', 'fast', 'moment', 'zeit', 'verlangsamt'],
    };

    const keywords = abilityKeywords[ability.toLowerCase()] || [];
    if (keywords.length === 0) return 0.3; // Unknown ability = partial match

    // Build text to search in
    const artifactText = [
      artifact.storyRole,
      artifact.description.de,
      artifact.description.en,
      ...artifact.usageScenarios,
      ...artifact.visualKeywords,
    ].join(' ').toLowerCase();

    // Count keyword matches
    const matches = keywords.filter(kw => artifactText.includes(kw.toLowerCase())).length;
    return Math.min(1.0, matches / 2); // 2+ matches = 1.0
  }

  /**
   * Normalizes genre string to genreAffinity key
   */
  private normalizeGenreKey(genre: string): keyof ArtifactTemplate['genreAffinity'] {
    const genreMap: Record<string, keyof ArtifactTemplate['genreAffinity']> = {
      'adventure': 'adventure',
      'abenteuer': 'adventure',
      'fantasy': 'fantasy',
      'mystery': 'mystery',
      'geheimnis': 'mystery',
      'rätsel': 'mystery',
      'nature': 'nature',
      'natur': 'nature',
      'friendship': 'friendship',
      'freundschaft': 'friendship',
      'courage': 'courage',
      'mut': 'courage',
      'learning': 'learning',
      'lernen': 'learning',
      'bildung': 'learning',
    };
    return genreMap[genre.toLowerCase()] || 'adventure';
  }

  /**
   * Loads all active artifacts from the database
   */
  private async loadArtifactPool(): Promise<ArtifactTemplate[]> {
    try {
      const rows = await storyDB.queryAll<any>`
        SELECT * FROM artifact_pool
        WHERE is_active = TRUE
        ORDER BY rarity DESC, total_usage_count ASC
      `;
      return rows.map(rowToArtifactTemplate);
    } catch (error) {
      console.error("[ArtifactMatcher] Error loading artifact pool:", error);
      return [];
    }
  }

  /**
   * Loads artifact usage from recent stories for freshness scoring
   */
  private async loadRecentArtifactUsage(recentStoryIds: string[]): Promise<Map<string, number>> {
    const usageMap = new Map<string, number>();

    if (recentStoryIds.length === 0) return usageMap;

    try {
      const rows = await storyDB.queryAll<{ artifact_id: string; usage_count: string }>`
        SELECT artifact_id, COUNT(*) as usage_count
        FROM story_artifacts
        WHERE story_id = ANY(${recentStoryIds})
        GROUP BY artifact_id
      `;

      for (const row of rows) {
        usageMap.set(row.artifact_id, parseInt(row.usage_count, 10));
      }
    } catch (error) {
      // Table might not exist yet - that's okay
      console.warn("[ArtifactMatcher] Could not load recent usage:", error);
    }

    return usageMap;
  }

  /**
   * Increments the usage counter for an artifact
   */
  private async incrementUsageCounter(artifactId: string): Promise<void> {
    try {
      await storyDB.exec`
        UPDATE artifact_pool
        SET
          recent_usage_count = recent_usage_count + 1,
          total_usage_count = total_usage_count + 1,
          last_used_at = NOW(),
          updated_at = NOW()
        WHERE id = ${artifactId}
      `;
    } catch (error) {
      console.error("[ArtifactMatcher] Error updating usage counter:", error);
    }
  }

  /**
   * Generates a fallback artifact when pool is empty or no match found
   */
  private async generateFallbackArtifact(requirement: ArtifactRequirement, genre: string): Promise<ArtifactTemplate> {
    console.log("[ArtifactMatcher] Generating fallback artifact...");

    const category: ArtifactCategory = 'magic';
    const id = 'fallback_lucky_charm';

    const fallback: ArtifactTemplate = {
      id,
      name: {
        de: 'Magischer Glücksbringer',
        en: 'Magical Lucky Charm',
      },
      description: {
        de: 'Ein mysteriöser Gegenstand, der auf magische Weise hilft.',
        en: 'A mysterious item that helps in magical ways.',
      },
      category,
      rarity: 'uncommon',
      storyRole: requirement.contextHint || 'Hilft dem Protagonisten bei seinem Abenteuer.',
      discoveryScenarios: ['In einer geheimnisvollen Truhe', 'Als Geschenk eines Fremden'],
      usageScenarios: ['Zum Lösen eines Problems', 'In einer schwierigen Situation'],
      emoji: '✨',
      visualKeywords: ['magical artifact', 'glowing gem', 'ancient relic'],
      genreAffinity: {
        adventure: 0.7,
        fantasy: 0.9,
        mystery: 0.6,
        nature: 0.5,
        friendship: 0.5,
        courage: 0.6,
        learning: 0.5,
      },
      recentUsageCount: 0,
      totalUsageCount: 0,
      isActive: true,
    };

    // story_artifacts has a foreign key to artifact_pool. A transient fallback
    // could be shown in the story but could never be unlocked. Keep one stable,
    // idempotent pool row so even an empty seed database still awards a treasure.
    await storyDB.exec`
      INSERT INTO artifact_pool (
        id,
        name_de,
        name_en,
        description_de,
        description_en,
        category,
        rarity,
        story_role,
        discovery_scenarios,
        usage_scenarios,
        emoji,
        visual_keywords,
        genre_adventure,
        genre_fantasy,
        genre_mystery,
        genre_nature,
        genre_friendship,
        genre_courage,
        genre_learning,
        is_active
      ) VALUES (
        ${id}, ${fallback.name.de}, ${fallback.name.en},
        ${fallback.description.de}, ${fallback.description.en},
        ${fallback.category}, ${fallback.rarity}, ${fallback.storyRole},
        ${fallback.discoveryScenarios}, ${fallback.usageScenarios},
        ${fallback.emoji || null}, ${fallback.visualKeywords},
        0.7, 0.9, 0.6, 0.5, 0.5, 0.6, 0.5, TRUE
      )
      ON CONFLICT (id) DO UPDATE
      SET is_active = TRUE,
          updated_at = CURRENT_TIMESTAMP
    `;
    await this.incrementUsageCounter(id);
    return fallback;
  }
}

// Export singleton instance
export const artifactMatcher = new ArtifactMatcher();

/**
 * Records the artifact assignment to a story
 */
export async function recordStoryArtifact(
  storyId: string,
  artifactId: string,
  discoveryChapter: number,
  usageChapter: number
): Promise<void> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const id = `sa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await storyDB.exec`
        INSERT INTO story_artifacts (id, story_id, artifact_id, discovery_chapter, usage_chapter, is_unlocked, created_at)
        VALUES (${id}, ${storyId}, ${artifactId}, ${discoveryChapter}, ${usageChapter}, FALSE, NOW())
        ON CONFLICT (story_id, artifact_id) DO UPDATE SET
          discovery_chapter = EXCLUDED.discovery_chapter,
          usage_chapter = EXCLUDED.usage_chapter
      `;
      console.log(`[ArtifactMatcher] ✅ Story artifact recorded: ${storyId} + ${artifactId}`);
      return;
    } catch (error) {
      const message = String((error as any)?.message || error);
      const isForeignKey =
        message.includes("E23503") ||
        message.includes("story_artifacts_story_id_fkey") ||
        message.toLowerCase().includes("foreign key");

      if (isForeignKey && attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 150 * attempt));
        continue;
      }

      console.error("[ArtifactMatcher] Error recording story artifact:", {
        attempt,
        storyId,
        artifactId,
        isForeignKey,
        error,
      });
      return;
    }
  }
}

/**
 * Unlocks an artifact for a story (called when user finishes reading)
 */
export async function unlockStoryArtifact(storyId: string): Promise<ArtifactTemplate | null> {
  try {
    // The assignment belongs to the story, while ownership belongs to an avatar.
    // Return the artifact even if another reader already unlocked the story marker;
    // markRead performs the per-avatar duplicate check.
    let rows = await storyDB.queryAll<any>`
      SELECT ap.*, sa.discovery_chapter, sa.usage_chapter
      FROM story_artifacts sa
      JOIN artifact_pool ap ON sa.artifact_id = ap.id
      WHERE sa.story_id = ${storyId}
      ORDER BY sa.created_at ASC
      LIMIT 1
    `;

    if (rows.length === 0) {
      // Assignment persistence is best-effort during generation. If that write
      // failed while the story succeeded, metadata still contains the server-
      // generated pending reward. Repair the junction on first completion.
      const story = await storyDB.queryRow<{ metadata: unknown }>`
        SELECT metadata
        FROM stories
        WHERE id = ${storyId}
        LIMIT 1
      `;
      const pending = extractPendingArtifactReference(story?.metadata);
      if (!pending) {
        console.log("[ArtifactMatcher] No artifact assignment or pending reward found for story:", storyId);
        return null;
      }

      const recovered = await storyDB.queryRow<any>`
        SELECT *
        FROM artifact_pool
        WHERE id = ${pending.artifactId}
        LIMIT 1
      `;
      if (!recovered) {
        console.warn("[ArtifactMatcher] Pending artifact is missing:", {
          storyId,
          artifactId: pending.artifactId,
        });
        return null;
      }

      await recordStoryArtifact(
        storyId,
        pending.artifactId,
        pending.discoveryChapter,
        pending.usageChapter
      );
      rows = [{
        ...recovered,
        discovery_chapter: pending.discoveryChapter,
        usage_chapter: pending.usageChapter,
      }];
      console.log("[ArtifactMatcher] Recovered missing story artifact assignment:", {
        storyId,
        artifactId: pending.artifactId,
      });
    }

    const row = rows[0];

    // Mark as unlocked
    await storyDB.exec`
      UPDATE story_artifacts
      SET is_unlocked = TRUE, unlocked_at = NOW()
      WHERE story_id = ${storyId} AND is_unlocked = FALSE
    `;

    return rowToArtifactTemplate(row);
  } catch (error) {
    console.error("[ArtifactMatcher] Error unlocking artifact:", error);
    return null;
  }
}
