/**
 * Migration Script: Translate existing avatars to English
 *
 * This script scans all existing avatars in the database and translates
 * any non-English visual profiles to English.
 *
 * Usage:
 *   encore run avatar.migrateToEnglish
 *
 * IMPORTANT: Run this ONCE after deploying the validateAndNormalize changes
 */

import { api } from "encore.dev/api";
import { avatarDB } from "./db";
import { validateAndNormalizeVisualProfile, detectNonEnglishFields } from "./validateAndNormalize";
import type { AvatarVisualProfile } from "./avatar";

interface MigrationResult {
  totalAvatars: number;
  avatarsWithNonEnglish: number;
  avatarsTranslated: number;
  avatarsFailed: number;
  errors: Array<{ avatarId: string; error: string }>;
}

export const migrateToEnglish = api(
  {
    expose: true,
    auth: true,
    method: "POST",
    path: "/avatar/migrate-to-english",
  },
  async (): Promise<MigrationResult> => {
    console.log('[migrateToEnglish] 🌍 Starting migration of avatars to English...');

    const result: MigrationResult = {
      totalAvatars: 0,
      avatarsWithNonEnglish: 0,
      avatarsTranslated: 0,
      avatarsFailed: 0,
      errors: [],
    };

    try {
      // Fetch all avatars with visual profiles
      const avatars = await avatarDB.query<{
        id: string;
        name: string;
        visual_profile: string | null;
      }>`
        SELECT id, name, visual_profile
        FROM avatars
        WHERE visual_profile IS NOT NULL
        ORDER BY created_at ASC
      `;

      result.totalAvatars = avatars.length;
      console.log(`[migrateToEnglish] Found ${avatars.length} avatars with visual profiles`);

      for (const avatar of avatars) {
        try {
          if (!avatar.visual_profile) continue;

          const visualProfile: AvatarVisualProfile = JSON.parse(avatar.visual_profile);

          // Check if translation is needed
          const nonEnglishFields = detectNonEnglishFields(visualProfile);

          if (nonEnglishFields.length === 0) {
            console.log(`[migrateToEnglish] ✅ Avatar "${avatar.name}" (${avatar.id}) already in English`);
            continue;
          }

          result.avatarsWithNonEnglish++;

          console.log(`[migrateToEnglish] 🌍 Avatar "${avatar.name}" (${avatar.id}) has non-English fields: ${nonEnglishFields.join(', ')}`);
          console.log(`[migrateToEnglish] Translating...`);

          // Translate to English
          const normalizedProfile = await validateAndNormalizeVisualProfile(visualProfile);

          if (!normalizedProfile) {
            throw new Error('Translation returned undefined');
          }

          // Update database
          await avatarDB.exec`
            UPDATE avatars
            SET visual_profile = ${JSON.stringify(normalizedProfile)},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${avatar.id}
          `;

          result.avatarsTranslated++;
          console.log(`[migrateToEnglish] ✅ Avatar "${avatar.name}" (${avatar.id}) translated successfully`);

          // Rate limiting: Wait 500ms between translations to avoid OpenAI rate limits
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          result.avatarsFailed++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[migrateToEnglish] ❌ Failed to translate avatar ${avatar.id}:`, errorMessage);
          result.errors.push({
            avatarId: avatar.id,
            error: errorMessage,
          });
        }
      }

      console.log('[migrateToEnglish] 🎉 Migration completed!');
      console.log(`[migrateToEnglish] Summary:`);
      console.log(`  - Total avatars: ${result.totalAvatars}`);
      console.log(`  - Avatars with non-English text: ${result.avatarsWithNonEnglish}`);
      console.log(`  - Avatars translated: ${result.avatarsTranslated}`);
      console.log(`  - Avatars failed: ${result.avatarsFailed}`);

      if (result.errors.length > 0) {
        console.error(`[migrateToEnglish] Errors:`, result.errors);
      }

      return result;

    } catch (error) {
      console.error('[migrateToEnglish] Migration failed:', error);
      throw error;
    }
  }
);
