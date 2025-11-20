import { api, APIError } from "encore.dev/api";
import type { Avatar, AvatarVisualProfile } from "./avatar";
import { getAuthData } from "~encore/auth";
import { upgradePersonalityTraits } from "./upgradePersonalityTraits";
import { avatarDB } from "./db";

interface GetAvatarParams {
  id: string;
}

// Retrieves a specific avatar by ID.
export const get = api<GetAvatarParams, Avatar>(
  { expose: true, method: "GET", path: "/avatar/:id", auth: true },
  async ({ id }) => {
    try {
      console.log(`[avatar.get] Loading avatar: ${id}`);
      const auth = getAuthData()!;
      const row = await avatarDB.queryRow<{
        id: string;
        user_id: string;
        name: string;
        description: string | null;
        physical_traits: string;
        personality_traits: string;
        image_url: string | null;
        visual_profile: string | null;
        creation_type: "ai-generated" | "photo-upload";
        is_public: boolean;
        original_avatar_id: string | null;
        created_at: Date;
        updated_at: Date;
        inventory: string;
        skills: string;
      }>`
        SELECT * FROM avatars WHERE id = ${id}
      `;

      if (!row) {
        console.error(`[avatar.get] Avatar not found: ${id}`);
        throw APIError.notFound("Avatar not found");
      }

      console.log(`[avatar.get] Avatar found: ${row.name}`);

      if (row.user_id !== auth.userID && auth.role !== 'admin' && !row.is_public) {
        console.error(`[avatar.get] Permission denied for user ${auth.userID} to access avatar ${id}`);
        throw APIError.permissionDenied("You do not have permission to view this avatar.");
      }

      // Upgrade personality traits to include new knowledge categories
      let rawPersonalityTraits;
      try {
        rawPersonalityTraits = JSON.parse(row.personality_traits);
      } catch (parseError) {
        console.error(`[avatar.get] Failed to parse personality_traits for avatar ${id}:`, parseError);
        console.error(`[avatar.get] Raw personality_traits:`, row.personality_traits);
        throw APIError.internal("Failed to parse avatar personality traits");
      }

      // Check if all base traits exist (all 9 should be there)
      const baseTraits = ['knowledge', 'creativity', 'vocabulary', 'courage', 'curiosity', 'teamwork', 'empathy', 'persistence', 'logic'];
      const needsUpgrade = !baseTraits.every(trait => trait in rawPersonalityTraits);

      let upgradedPersonalityTraits = rawPersonalityTraits;

      if (needsUpgrade) {
        console.log(`🔄 Upgrading personality traits for avatar ${row.id}`);
        try {
          upgradedPersonalityTraits = upgradePersonalityTraits(rawPersonalityTraits);

          await avatarDB.exec`
            UPDATE avatars
            SET personality_traits = ${JSON.stringify(upgradedPersonalityTraits)},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${id}
          `;
          console.log(`✅ Successfully upgraded traits for avatar ${row.id}`);
        } catch (upgradeError) {
          console.error(`❌ Failed to upgrade traits for avatar ${row.id}:`, upgradeError);
          // Continue with raw traits if upgrade fails
          upgradedPersonalityTraits = rawPersonalityTraits;
        }
      }

      let parsedPhysicalTraits;
      let parsedVisualProfile;

      try {
        parsedPhysicalTraits = JSON.parse(row.physical_traits);
      } catch (parseError) {
        console.error(`[avatar.get] Failed to parse physical_traits for avatar ${id}:`, parseError);
        throw APIError.internal("Failed to parse avatar physical traits");
      }

      try {
        parsedVisualProfile = row.visual_profile ? (JSON.parse(row.visual_profile) as AvatarVisualProfile) : undefined;
      } catch (parseError) {
        console.error(`[avatar.get] Failed to parse visual_profile for avatar ${id}:`, parseError);
        console.warn(`[avatar.get] Continuing without visual profile`);
        parsedVisualProfile = undefined;
      }

      console.log(`[avatar.get] Successfully loaded avatar ${id}`);

      return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        description: row.description || undefined,
        physicalTraits: parsedPhysicalTraits,
        personalityTraits: upgradedPersonalityTraits,
        imageUrl: row.image_url || undefined,
        visualProfile: parsedVisualProfile,
        creationType: row.creation_type,
        isPublic: row.is_public,
        originalAvatarId: row.original_avatar_id || undefined,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        inventory: row.inventory ? JSON.parse(row.inventory) : [],
        skills: row.skills ? JSON.parse(row.skills) : [],
      };
    } catch (error) {
      console.error(`[avatar.get] ERROR loading avatar ${id}:`, error);

      // Re-throw APIErrors as-is
      if (error instanceof APIError) {
        throw error;
      }

      // Wrap other errors
      throw APIError.internal(`Failed to load avatar: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
