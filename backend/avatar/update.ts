import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import type { Avatar, PhysicalTraits, PersonalityTraits, AvatarVisualProfile } from "./create";

const avatarDB = SQLDatabase.named("avatar");

interface UpdateAvatarRequest {
  id: string;
  name?: string;
  description?: string;
  physicalTraits?: PhysicalTraits;
  personalityTraits?: PersonalityTraits;
  imageUrl?: string;
  visualProfile?: AvatarVisualProfile;
}

// Updates an existing avatar.
export const update = api<UpdateAvatarRequest, Avatar>(
  { expose: true, method: "PUT", path: "/avatar/:id" },
  async (req) => {
    const { id, ...updates } = req;
    
    // Check if avatar exists
    const existingAvatar = await avatarDB.queryRow<{
      id: string;
      user_id: string;
      name: string;
      description: string | null;
      physical_traits: string;
      personality_traits: string;
      image_url: string | null;
      visual_profile: string | null;
      creation_type: "ai-generated" | "photo-upload";
      is_shared: boolean;
      original_avatar_id: string | null;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT * FROM avatars WHERE id = ${id}
    `;

    if (!existingAvatar) {
      throw APIError.notFound("Avatar not found");
    }

    const currentPhysicalTraits = JSON.parse(existingAvatar.physical_traits);
    const currentPersonalityTraits = JSON.parse(existingAvatar.personality_traits);
    const currentVisualProfile: AvatarVisualProfile | undefined = existingAvatar.visual_profile ? JSON.parse(existingAvatar.visual_profile) : undefined;
    
    // Merge updates with existing data
    const updatedPhysicalTraits = updates.physicalTraits 
      ? { ...currentPhysicalTraits, ...updates.physicalTraits }
      : currentPhysicalTraits;
    
    const updatedPersonalityTraits = updates.personalityTraits
      ? { ...currentPersonalityTraits, ...updates.personalityTraits }
      : currentPersonalityTraits;

    const updatedVisualProfile = updates.visualProfile ?? currentVisualProfile;

    const now = new Date();

    await avatarDB.exec`
      UPDATE avatars SET
        name = ${updates.name ?? existingAvatar.name},
        description = ${updates.description ?? existingAvatar.description},
        physical_traits = ${JSON.stringify(updatedPhysicalTraits)},
        personality_traits = ${JSON.stringify(updatedPersonalityTraits)},
        image_url = ${updates.imageUrl ?? existingAvatar.image_url},
        visual_profile = ${updatedVisualProfile ? JSON.stringify(updatedVisualProfile) : null},
        updated_at = ${now}
      WHERE id = ${id}
    `;

    return {
      id: existingAvatar.id,
      userId: existingAvatar.user_id,
      name: updates.name ?? existingAvatar.name,
      description: updates.description ?? existingAvatar.description ?? undefined,
      physicalTraits: updatedPhysicalTraits,
      personalityTraits: updatedPersonalityTraits,
      imageUrl: updates.imageUrl ?? existingAvatar.image_url ?? undefined,
      visualProfile: updatedVisualProfile,
      creationType: existingAvatar.creation_type,
      isShared: existingAvatar.is_shared,
      originalAvatarId: existingAvatar.original_avatar_id || undefined,
      createdAt: existingAvatar.created_at,
      updatedAt: now,
    };
  }
);
