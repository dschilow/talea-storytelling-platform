import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import type { Avatar, AvatarVisualProfile } from "./avatar";
import { getAuthData } from "~encore/auth";
import { upgradePersonalityTraits } from "./upgradePersonalityTraits";

const avatarDB = SQLDatabase.named("avatar");

interface GetAvatarParams {
  id: string;
}

// Retrieves a specific avatar by ID.
export const get = api<GetAvatarParams, Avatar>(
  { expose: true, method: "GET", path: "/avatar/:id", auth: true },
  async ({ id }) => {
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
    }>`
      SELECT * FROM avatars WHERE id = ${id}
    `;

    if (!row) {
      throw APIError.notFound("Avatar not found");
    }

    if (row.user_id !== auth.userID && auth.role !== 'admin' && !row.is_public) {
      throw APIError.permissionDenied("You do not have permission to view this avatar.");
    }

    // Upgrade personality traits to include new knowledge categories
    const rawPersonalityTraits = JSON.parse(row.personality_traits);
    console.log(`🔍 Raw personality traits from DB for avatar ${row.id}:`, JSON.stringify(rawPersonalityTraits, null, 2));
    const upgradedPersonalityTraits = upgradePersonalityTraits(rawPersonalityTraits);
    console.log(`🔧 Upgraded personality traits for avatar ${row.id}:`, JSON.stringify(upgradedPersonalityTraits, null, 2));

    // If traits were upgraded, save them back to database
    const hasNewTraits = Object.keys(upgradedPersonalityTraits).length > Object.keys(rawPersonalityTraits).length;
    if (hasNewTraits) {
      console.log(`🔄 Upgrading personality traits for avatar ${row.id}: added ${Object.keys(upgradedPersonalityTraits).length - Object.keys(rawPersonalityTraits).length} new traits`);
      try {
        await avatarDB.exec`
          UPDATE avatars
          SET personality_traits = ${JSON.stringify(upgradedPersonalityTraits)},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ${id}
        `;
      } catch (error) {
        console.warn(`⚠️ Failed to save upgraded traits for avatar ${row.id}:`, error);
      }
    }

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description || undefined,
      physicalTraits: JSON.parse(row.physical_traits),
      personalityTraits: upgradedPersonalityTraits,
      imageUrl: row.image_url || undefined,
      visualProfile: row.visual_profile ? (JSON.parse(row.visual_profile) as AvatarVisualProfile) : undefined,
      creationType: row.creation_type,
      isPublic: row.is_public,
      originalAvatarId: row.original_avatar_id || undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
);
