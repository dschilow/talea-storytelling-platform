import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import type { Avatar, PhysicalTraits, PersonalityTraits, AvatarVisualProfile } from "./create";
import { getAuthData } from "~encore/auth";

const avatarDB = SQLDatabase.named("avatar");

interface UpdateAvatarRequest {
  id: string;
  name?: string;
  description?: string;
  physicalTraits?: PhysicalTraits;
  personalityTraits?: PersonalityTraits;
  imageUrl?: string;
  visualProfile?: AvatarVisualProfile;
  isPublic?: boolean;
}

// Updates an existing avatar.
export const update = api<UpdateAvatarRequest, Avatar>(
  { expose: true, method: "PUT", path: "/avatar/:id", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    const { id, ...updates } = req;
    
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
      is_public: boolean;
      original_avatar_id: string | null;
      created_at: Date;
      updated_at: Date;
    }>`
      SELECT * FROM avatars WHERE id = ${id}
    `;

    if (!existingAvatar) {
      throw APIError.notFound("Avatar not found");
    }

    if (existingAvatar.user_id !== auth.userID && auth.role !== 'admin') {
      throw APIError.permissionDenied("You do not have permission to update this avatar.");
    }

    const currentPhysicalTraits = JSON.parse(existingAvatar.physical_traits);
    const currentPersonalityTraits = JSON.parse(existingAvatar.personality_traits);
    const currentVisualProfile: AvatarVisualProfile | undefined = existingAvatar.visual_profile ? JSON.parse(existingAvatar.visual_profile) : undefined;
    
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
        is_public = ${typeof updates.isPublic === 'boolean' ? updates.isPublic : existingAvatar.is_public},
        updated_at = ${now}
      WHERE id = ${id}
    `;

    const updated = await avatarDB.queryRow<any>`SELECT * FROM avatars WHERE id = ${id}`;

    return {
      id: updated.id,
      userId: updated.user_id,
      name: updated.name,
      description: updated.description || undefined,
      physicalTraits: JSON.parse(updated.physical_traits),
      personalityTraits: JSON.parse(updated.personality_traits),
      imageUrl: updated.image_url || undefined,
      visualProfile: updated.visual_profile ? JSON.parse(updated.visual_profile) : undefined,
      creationType: updated.creation_type,
      isPublic: updated.is_public,
      originalAvatarId: updated.original_avatar_id || undefined,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };
  }
);
