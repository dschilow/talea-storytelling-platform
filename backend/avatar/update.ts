import { api, APIError } from "encore.dev/api";
import type { Avatar, PhysicalTraits, PersonalityTraits, AvatarVisualProfile } from "./avatar";
import { getAuthData } from "~encore/auth";
import { avatarDB } from "./db";
import {
  validateAndNormalizeVisualProfile,
  validateAndNormalizePhysicalTraits,
  detectNonEnglishFields
} from "./validateAndNormalize";
import {
  maybeUploadImageUrlToBucket,
  normalizeImageUrlForStorage,
} from "../helpers/bucket-storage";
import { buildAvatarImageUrlForClient } from "../helpers/image-proxy";

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

    let updatedPhysicalTraits = updates.physicalTraits
      ? { ...currentPhysicalTraits, ...updates.physicalTraits }
      : currentPhysicalTraits;

    // VALIDATION & TRANSLATION: Normalize PhysicalTraits to English
    if (updates.physicalTraits) {
      console.log('[update] 🌍 Translating PhysicalTraits to English...');
      const normalizedTraits = await validateAndNormalizePhysicalTraits(updatedPhysicalTraits);
      if (normalizedTraits) {
        updatedPhysicalTraits = normalizedTraits;
      }
      console.log('[update] ✅ PhysicalTraits normalized to English');
    }

    const updatedPersonalityTraits = updates.personalityTraits
      ? { ...currentPersonalityTraits, ...updates.personalityTraits }
      : currentPersonalityTraits;

    let updatedVisualProfile = updates.visualProfile ?? currentVisualProfile;

    // VALIDATION & TRANSLATION: Normalize visual profile to English
    if (updates.visualProfile) {
      const nonEnglishFields = detectNonEnglishFields(updates.visualProfile);

      if (nonEnglishFields.length > 0) {
        console.log(`[update] Detected non-English fields in update: ${nonEnglishFields.join(', ')}`);
        console.log('[update] 🌍 Translating visual profile to English...');
        updatedVisualProfile = await validateAndNormalizeVisualProfile(updates.visualProfile);
        console.log('[update] ✅ Visual profile normalized to English');
      } else {
        console.log('[update] ✅ Visual profile already in English');
      }
    }

    const normalizedImageUrl = updates.imageUrl !== undefined
      ? (updates.imageUrl
          ? await normalizeImageUrlForStorage(updates.imageUrl)
          : null)
      : undefined;
    const uploadedImage = normalizedImageUrl
      ? await maybeUploadImageUrlToBucket(normalizedImageUrl, {
          prefix: "images/avatars",
          filenameHint: `avatar-${id}`,
          uploadMode: "always",
        })
      : null;
    const finalImageUrl = updates.imageUrl === undefined
      ? undefined
      : (uploadedImage?.url ?? normalizedImageUrl);

    const now = new Date();

    await avatarDB.exec`
      UPDATE avatars SET
        name = ${updates.name ?? existingAvatar.name},
        description = ${updates.description ?? existingAvatar.description},
        physical_traits = ${JSON.stringify(updatedPhysicalTraits)},
        personality_traits = ${JSON.stringify(updatedPersonalityTraits)},
        image_url = ${finalImageUrl ?? existingAvatar.image_url},
        visual_profile = ${updatedVisualProfile ? JSON.stringify(updatedVisualProfile) : null},
        is_public = ${typeof updates.isPublic === 'boolean' ? updates.isPublic : existingAvatar.is_public},
        updated_at = ${now}
      WHERE id = ${id}
    `;

    const updated = await avatarDB.queryRow<any>`SELECT * FROM avatars WHERE id = ${id}`;
    const resolvedImageUrl = await buildAvatarImageUrlForClient(updated.id, updated?.image_url || undefined);

    return {
      id: updated.id,
      userId: updated.user_id,
      name: updated.name,
      description: updated.description || undefined,
      physicalTraits: JSON.parse(updated.physical_traits),
      personalityTraits: JSON.parse(updated.personality_traits),
      imageUrl: resolvedImageUrl,
      visualProfile: updated.visual_profile ? JSON.parse(updated.visual_profile) : undefined,
      creationType: updated.creation_type,
      isPublic: updated.is_public,
      originalAvatarId: updated.original_avatar_id || undefined,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };
  }
);
