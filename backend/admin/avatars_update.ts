import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import type { PhysicalTraits, PersonalityTraits, AvatarVisualProfile, Avatar } from "../avatar/avatar";
import { ensureAdmin } from "./authz";

const avatarDB = SQLDatabase.named("avatar");

interface AdminUpdateAvatarRequest {
  id: string;
  name?: string;
  description?: string;
  physicalTraits?: PhysicalTraits;
  personalityTraits?: PersonalityTraits;
  imageUrl?: string;
  visualProfile?: AvatarVisualProfile;
  isPublic?: boolean;
  originalAvatarId?: string | null;
}

// Updates any avatar fields (admin only).
export const updateAvatarAdmin = api<AdminUpdateAvatarRequest, Avatar>(
  { expose: true, method: "PUT", path: "/admin/avatars/:id", auth: true },
  async (req) => {
    ensureAdmin();

    const existing = await avatarDB.queryRow<any>`SELECT * FROM avatars WHERE id = ${req.id}`;
    if (!existing) {
      throw APIError.notFound("avatar not found");
    }

    const now = new Date();

    const physicalTraits = req.physicalTraits ? JSON.stringify(req.physicalTraits) : existing.physical_traits;
    const personalityTraits = req.personalityTraits ? JSON.stringify(req.personalityTraits ?? req.personalityTraits) : existing.personality_traits;
    const visualProfile = req.visualProfile ? JSON.stringify(req.visualProfile) : existing.visual_profile;

    await avatarDB.exec`
      UPDATE avatars SET
        name = ${req.name ?? existing.name},
        description = ${req.description ?? existing.description},
        physical_traits = ${physicalTraits},
        personality_traits = ${personalityTraits},
        image_url = ${req.imageUrl ?? existing.image_url},
        visual_profile = ${visualProfile ?? null},
        is_public = ${typeof req.isPublic === "boolean" ? req.isPublic : existing.is_public},
        original_avatar_id = ${req.originalAvatarId === undefined ? existing.original_avatar_id : req.originalAvatarId},
        updated_at = ${now}
      WHERE id = ${req.id}
    `;

    const updated = await avatarDB.queryRow<any>`SELECT * FROM avatars WHERE id = ${req.id}`;
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
