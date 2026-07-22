import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { Avatar, CreateAvatarRequest, normalizeAvatarNarrativeProfile } from "./avatar";
import { getDefaultPersonalityTraits } from "../constants/personalityTraits";
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
import { resolveRequestedProfileId } from "../helpers/profiles";
import { claimMeteredUsage } from "../helpers/billing";
import {
  assertCanAssignChildAvatar,
  ensureAvatarColumns,
  isHumanAvatarInput,
  normalizeAvatarRole,
  syncChildAvatarLink,
} from "./schema";

export const create = api(
  {
    expose: true,
    auth: true,
    method: "POST",
    path: "/avatar",
  },
  async (req: CreateAvatarRequest): Promise<Avatar> => {
    const auth = getAuthData()!;
    const userId = auth.userID;
    if (JSON.stringify(req).length > 100_000) {
      throw APIError.invalidArgument("Avatar request is too large.");
    }
    await claimMeteredUsage({
      userId,
      kind: "chat",
      units: 1,
      clerkToken: auth.clerkToken,
    });
    const avatarId = crypto.randomUUID();
    await ensureAvatarColumns();
    const profileId = await resolveRequestedProfileId({
      userId,
      requestedProfileId: req.profileId,
    });
    const avatarRole = normalizeAvatarRole(req.avatarRole);

    // Überschreibe personality traits mit Standardwerten (alle beginnen bei 0)
    const narrativeProfile = normalizeAvatarNarrativeProfile(req.narrativeProfile);
    const defaultPersonalityTraits = getDefaultPersonalityTraits();

    // VALIDATION & TRANSLATION: Normalize PhysicalTraits to English
    console.log('[create] 🌍 Translating PhysicalTraits to English...');
    const normalizedPhysicalTraits = await validateAndNormalizePhysicalTraits(req.physicalTraits);
    console.log('[create] ✅ PhysicalTraits normalized to English');

    // VALIDATION & TRANSLATION: Normalize visual profile to English
    let normalizedVisualProfile = req.visualProfile;

    if (req.visualProfile) {
      const nonEnglishFields = detectNonEnglishFields(req.visualProfile);

      if (nonEnglishFields.length > 0) {
        console.log(`[create] Detected non-English fields: ${nonEnglishFields.join(', ')}`);
        console.log('[create] 🌍 Translating visual profile to English...');
        normalizedVisualProfile = await validateAndNormalizeVisualProfile(req.visualProfile);
        console.log('[create] ✅ Visual profile normalized to English');
      } else {
        console.log('[create] ✅ Visual profile already in English');
      }
    }

    const normalizedImageUrl = req.imageUrl
      ? await normalizeImageUrlForStorage(req.imageUrl)
      : undefined;
    const uploadedImage = normalizedImageUrl
      ? await maybeUploadImageUrlToBucket(normalizedImageUrl, {
          prefix: "images/avatars",
          filenameHint: `avatar-${avatarId}`,
          uploadMode: "always",
        })
      : null;
    const finalImageUrl = uploadedImage?.url ?? normalizedImageUrl;

    const resolvedImageUrl = await buildAvatarImageUrlForClient(avatarId, finalImageUrl);

    if (avatarRole === "child") {
      if (!isHumanAvatarInput(req)) {
        throw APIError.invalidArgument("The dedicated child avatar must be human.");
      }
      await assertCanAssignChildAvatar({
        userId,
        profileId,
      });
    }

    const avatar: Avatar = {
      id: avatarId,
      userId: userId,
      profileId,
      name: req.name,
      description: req.description,
      physicalTraits: normalizedPhysicalTraits || req.physicalTraits, // Use normalized (English) traits
      personalityTraits: defaultPersonalityTraits, // Standardwerte mit allen 0
      imageUrl: resolvedImageUrl,
      visualProfile: normalizedVisualProfile, // Use normalized (English) profile
      narrativeProfile,
      creationType: req.creationType,
      isPublic: false,
      avatarRole,
      sourceType: req.sourceType || "profile",
      sourceAvatarId: req.sourceAvatarId,
      originalAvatarId: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      inventory: [],
      skills: []
    };

    const physicalTraitsJson = JSON.stringify(normalizedPhysicalTraits || req.physicalTraits);
    const personalityTraitsJson = JSON.stringify(defaultPersonalityTraits);
    const visualProfileJson = normalizedVisualProfile ? JSON.stringify(normalizedVisualProfile) : null;
    const narrativeProfileJson = narrativeProfile ? JSON.stringify(narrativeProfile) : null;

    console.info("[avatar.create] Persisting avatar", {
      avatarId,
      profileId,
      avatarRole,
      creationType: req.creationType,
      hasImage: Boolean(finalImageUrl),
      hasVisualProfile: Boolean(visualProfileJson),
    });

    try {
      // INSERT including visual_profile column
      await avatarDB.exec`
        INSERT INTO avatars (
          id, user_id, name, description,
          profile_id, avatar_role, source_type, source_avatar_id,
          physical_traits, personality_traits, image_url,
          visual_profile, narrative_profile,
          creation_type, is_public, original_avatar_id,
          created_at, updated_at,
          inventory, skills
        ) VALUES (
          ${avatarId},
          ${userId},
          ${req.name},
          ${req.description || null},
          ${profileId},
          ${avatarRole},
          ${req.sourceType || "profile"},
          ${req.sourceAvatarId || null},
          ${physicalTraitsJson},
          ${personalityTraitsJson},
          ${finalImageUrl || null},
          ${visualProfileJson}, ${narrativeProfileJson},
          ${req.creationType},
          false,
          null,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP,
          '[]',
          '[]'
        )
      `;
      console.info("[avatar.create] Avatar persisted", { avatarId, profileId, avatarRole });
      await syncChildAvatarLink({
        userId,
        profileId,
        avatarId,
        role: avatarRole,
      });
    } catch (e: any) {
      console.error("[avatar.create] Database insert failed", {
        avatarId,
        errorName: e?.name,
      });
      throw e; // re-throw the error to let encore handle it
    }

    return avatar;
  }
);
