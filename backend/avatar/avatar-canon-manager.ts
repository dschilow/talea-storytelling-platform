/**
 * Avatar Canon Manager
 *
 * Manages avatar canons for visual consistency across story chapters.
 */

import { avatarDB } from "./db";
import type { StandardizedAvatarAnalysis, AvatarCanon } from "./avatar-analysis-schema";
import { convertToAvatarCanon } from "./avatar-analysis-schema";

/**
 * Avatar Canon Manager Class
 */
export class AvatarCanonManager {
  private canons: Map<string, AvatarCanon> = new Map();

  /**
   * Create canon from analysis and save to database
   */
  async createCanonFromAnalysis(
    avatarId: string,
    analysis: StandardizedAvatarAnalysis
  ): Promise<AvatarCanon> {

    const canon: AvatarCanon = convertToAvatarCanon(analysis);

    this.canons.set(avatarId, canon);

    // Save to database
    await avatarDB.exec`
      INSERT INTO avatar_canons (avatar_id, canon_data, version, created_at, updated_at)
      VALUES (${avatarId}, ${JSON.stringify(canon)}, '2.0', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (avatar_id) DO UPDATE SET
        canon_data = EXCLUDED.canon_data,
        version = EXCLUDED.version,
        updated_at = CURRENT_TIMESTAMP
    `;

    return canon;
  }

  /**
   * Load canon from database
   */
  async loadCanonFromDatabase(avatarId: string): Promise<AvatarCanon> {
    const result = await avatarDB.queryOne<{
      canon_data: string;
    }>`
      SELECT canon_data
      FROM avatar_canons
      WHERE avatar_id = ${avatarId}
    `;

    if (!result) {
      throw new Error(`No canon found for avatar ${avatarId}`);
    }

    const canon = JSON.parse(result.canon_data) as AvatarCanon;
    this.canons.set(avatarId, canon);
    return canon;
  }

  /**
   * Get canon for avatar
   */
  getCanon(avatarId: string): AvatarCanon {
    const canon = this.canons.get(avatarId);
    if (!canon) throw new Error(`No canon for avatar ${avatarId}`);
    return canon;
  }

  /**
   * Get all canons for multiple avatars
   */
  async getCanons(avatarIds: string[]): Promise<Map<string, AvatarCanon>> {
    const canons = new Map<string, AvatarCanon>();

    for (const avatarId of avatarIds) {
      try {
        // Try memory first
        let canon = this.canons.get(avatarId);
        if (!canon) {
          // Load from database
          canon = await this.loadCanonFromDatabase(avatarId);
        }
        canons.set(avatarId, canon);
      } catch (error) {
        console.warn(`Failed to load canon for avatar ${avatarId}:`, error);
      }
    }

    return canons;
  }

  /**
   * Validate canon consistency
   */
  validateConsistency(canons: Map<string, AvatarCanon>): {
    isConsistent: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    const avatarList = Array.from(canons.values());

    // Check for visual differences
    for (let i = 0; i < avatarList.length; i++) {
      for (let j = i + 1; j < avatarList.length; j++) {
        const avatar1 = avatarList[i];
        const avatar2 = avatarList[j];

        // Hair color should be different
        if (avatar1.hair.color === avatar2.hair.color) {
          issues.push(`${avatar1.name} and ${avatar2.name} have same hair color: ${avatar1.hair.color}`);
        }

        // Eye color should be different
        if (avatar1.eyes.color === avatar2.eyes.color) {
          issues.push(`${avatar1.name} and ${avatar2.name} have same eye color: ${avatar1.eyes.color}`);
        }

        // Clothing should be different
        if (avatar1.clothing.primary === avatar2.clothing.primary) {
          issues.push(`${avatar1.name} and ${avatar2.name} have same primary clothing: ${avatar1.clothing.primary}`);
        }
      }
    }

    return {
      isConsistent: issues.length === 0,
      issues
    };
  }

  /**
   * Clear memory cache
   */
  clearCache(): void {
    this.canons.clear();
  }
}

/**
 * Singleton instance
 */
export const avatarCanonManager = new AvatarCanonManager();
