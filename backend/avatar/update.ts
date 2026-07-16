import { api, APIError } from "encore.dev/api";
import type { Avatar, PhysicalTraits, AvatarVisualProfile } from "./avatar";
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
import { ensureDefaultProfileForUser, resolveRequestedProfileId } from "../helpers/profiles";
import { claimMeteredUsage } from "../helpers/billing";
import {
  assertCanAssignChildAvatar,
  clearChildAvatarLink,
  ensureAvatarColumns,
  isHumanAvatarInput,
  normalizeAvatarRole,
  syncChildAvatarLink,
} from "./schema";

interface UpdateAvatarRequest {
  id: string;
  profileId?: string;
  name?: string;
  description?: string;
  physicalTraits?: PhysicalTraits;
  imageUrl?: string;
  visualProfile?: AvatarVisualProfile;
  isPublic?: boolean;
  avatarRole?: "child" | "companion";
}

// Updates an existing avatar.
export const update = api<UpdateAvatarRequest, Avatar>(
  { expose: true, method: "PUT", path: "/avatar/:id", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    await ensureAvatarColumns();
    const { id, ...updates } = req;
    const activeProfileId = await resolveRequestedProfileId({
      userId: auth.userID,
      requestedProfileId: req.profileId,
    });
    const defaultProfile = await ensureDefaultProfileForUser(auth.userID, auth.email ?? undefined);
    
    const existingAvatar = await avatarDB.queryRow<{
      id: string;
      user_id: string;
      profile_id: string | null;
      name: string;
      description: string | null;
      physical_traits: string;
      personality_traits: string;
      image_url: string | null;
      visual_profile: string | null;
      creation_type: "ai-generated" | "photo-upload";
      is_public: boolean;
      source_type: string | null;
      avatar_role: string | null;
      source_avatar_id: string | null;
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

    const ownerProfileId = existingAvatar.profile_id || defaultProfile.id;
    if (existingAvatar.user_id === auth.userID && ownerProfileId !== activeProfileId && auth.role !== "admin") {
      throw APIError.permissionDenied("Avatar belongs to another child profile.");
    }


    if (JSON.stringify(req).length > 100_000) {
      throw APIError.invalidArgument("Avatar update request is too large.");
    }
    if (updates.physicalTraits || updates.visualProfile) {
      await claimMeteredUsage({
        userId: auth.userID,
        kind: "chat",
        units: 1,
        clerkToken: auth.clerkToken,
      });
    }

    const currentPhysicalTraits = JSON.parse(existingAvatar.physical_traits);
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

    const previousAvatarRole = normalizeAvatarRole(existingAvatar.avatar_role);
    const avatarRole = updates.avatarRole
      ? normalizeAvatarRole(updates.avatarRole)
      : previousAvatarRole;

    if (avatarRole === "child" && updates.isPublic === true) {
      throw APIError.invalidArgument(
        "A dedicated child avatar is private and cannot be made public.",
      );
    }
    if (
      avatarRole === "child" &&
      existingAvatar.profile_id &&
      existingAvatar.profile_id !== activeProfileId
    ) {
      throw APIError.failedPrecondition(
        "A child avatar must belong directly to the selected child profile. Create a separate profile copy first."
      );
    }
    if (
      avatarRole === "child" &&
      !isHumanAvatarInput({
        physicalTraits: updatedPhysicalTraits,
        visualProfile: updatedVisualProfile,
      })
    ) {
      throw APIError.invalidArgument("The dedicated child avatar must remain human.");
    }

    if (avatarRole === "child" && previousAvatarRole !== "child") {
      await assertCanAssignChildAvatar({
        userId: auth.userID,
        profileId: existingAvatar.profile_id || activeProfileId,
        avatarId: id,
      });
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
    const avatarProfileId = avatarRole === "child"
      ? existingAvatar.profile_id || activeProfileId
      : existingAvatar.profile_id;

    await avatarDB.exec`
      UPDATE avatars SET
        name = ${updates.name ?? existingAvatar.name},
        profile_id = ${avatarProfileId},
        description = ${updates.description ?? existingAvatar.description},
        physical_traits = ${JSON.stringify(updatedPhysicalTraits)},
        image_url = ${finalImageUrl ?? existingAvatar.image_url},
        visual_profile = ${updatedVisualProfile ? JSON.stringify(updatedVisualProfile) : null},
        is_public = ${avatarRole === "child" ? false : (typeof updates.isPublic === 'boolean' ? updates.isPublic : existingAvatar.is_public)},
        avatar_role = ${avatarRole},
        updated_at = ${now}
      WHERE id = ${id}
    `;

    await syncChildAvatarLink({
      userId: auth.userID,
      profileId: avatarProfileId || activeProfileId,
      avatarId: id,
      role: avatarRole,
    });

    if (previousAvatarRole === "child" && avatarRole !== "child") {
      await clearChildAvatarLink({
        userId: auth.userID,
        avatarId: id,
      });
    }

    const updated = await avatarDB.queryRow<any>`SELECT * FROM avatars WHERE id = ${id}`;
    const resolvedImageUrl = await buildAvatarImageUrlForClient(updated.id, updated?.image_url || undefined);

    return {
      id: updated.id,
      userId: updated.user_id,
      profileId: updated.profile_id || activeProfileId,
      name: updated.name,
      description: updated.description || undefined,
      physicalTraits: JSON.parse(updated.physical_traits),
      personalityTraits: JSON.parse(updated.personality_traits),
      imageUrl: resolvedImageUrl,
      visualProfile: updated.visual_profile ? JSON.parse(updated.visual_profile) : undefined,
      creationType: updated.creation_type,
      isPublic: updated.is_public,
      avatarRole,
      sourceType: (updated.source_type as Avatar["sourceType"]) || "profile",
      sourceAvatarId: updated.source_avatar_id || undefined,
      originalAvatarId: updated.original_avatar_id || undefined,
      createdAt: new Date(updated.created_at).toISOString(),
      updatedAt: new Date(updated.updated_at).toISOString(),
      inventory: updated.inventory ? JSON.parse(updated.inventory) : [],
      skills: updated.skills ? JSON.parse(updated.skills) : [],
    };
  }
);
