import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { Avatar, CreateAvatarRequest } from "./avatar";
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
  resolveImageUrlForClient,
} from "../helpers/bucket-storage";

export const create = api(
  {
    expose: true,
    auth: true,
    method: "POST",
    path: "/avatar",
  },
  async (req: CreateAvatarRequest): Promise<Avatar> => {
    console.log("Received request to create avatar:", req);

    const auth = getAuthData()!;
    const userId = auth.userID;
    const avatarId = crypto.randomUUID();

    console.log(`Generated avatarId: ${avatarId} for userId: ${userId}`);

    // Überschreibe personality traits mit Standardwerten (alle beginnen bei 0)
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

    const resolvedImageUrl = await resolveImageUrlForClient(finalImageUrl);

    const avatar: Avatar = {
      id: avatarId,
      userId: userId,
      name: req.name,
      description: req.description,
      physicalTraits: normalizedPhysicalTraits || req.physicalTraits, // Use normalized (English) traits
      personalityTraits: defaultPersonalityTraits, // Standardwerte mit allen 0
      imageUrl: resolvedImageUrl,
      visualProfile: normalizedVisualProfile, // Use normalized (English) profile
      creationType: req.creationType,
      isPublic: false,
      originalAvatarId: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      inventory: [],
      skills: []
    };

    const physicalTraitsJson = JSON.stringify(normalizedPhysicalTraits || req.physicalTraits);
    const personalityTraitsJson = JSON.stringify(defaultPersonalityTraits);
    const visualProfileJson = normalizedVisualProfile ? JSON.stringify(normalizedVisualProfile) : null;

    console.log("Data for DB insert:");
    console.log(`- id: ${avatarId}`);
    console.log(`- user_id: ${userId}`);
    console.log(`- name: ${req.name}`);
    console.log(`- description: ${req.description || null}`);
    console.log(`- physical_traits: ${physicalTraitsJson}`);
    console.log(`- personality_traits: ${personalityTraitsJson}`);
    console.log(`- image_url: ${finalImageUrl || null}`);
    console.log(`- visual_profile: ${visualProfileJson}`);
    console.log(`- creation_type: ${req.creationType}`);

    try {
      // INSERT including visual_profile column
      await avatarDB.exec`
        INSERT INTO avatars (
          id, user_id, name, description,
          physical_traits, personality_traits, image_url,
          visual_profile,
          creation_type, is_public, original_avatar_id,
          created_at, updated_at,
          inventory, skills
        ) VALUES (
          ${avatarId},
          ${userId},
          ${req.name},
          ${req.description || null},
          ${physicalTraitsJson},
          ${personalityTraitsJson},
          ${finalImageUrl || null},
          ${visualProfileJson},
          ${req.creationType},
          false,
          null,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP,
          '[]',
          '[]'
        )
      `;
      console.log("Avatar created successfully in DB");
      console.log(`- visual_profile saved: ${visualProfileJson ? 'YES' : 'NO'}`);
    } catch (e) {
      console.error("Error inserting avatar into DB:", e);
      throw e; // re-throw the error to let encore handle it
    }

    return avatar;
  }
);
