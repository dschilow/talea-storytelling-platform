import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const avatarDB = new SQLDatabase("avatar", {
  migrations: "./migrations",
});

export interface PhysicalTraits {
  characterType: string;
  appearance: string;
}

export interface PersonalityTraits {
  courage: number;
  intelligence: number;
  creativity: number;
  empathy: number;
  strength: number;
  humor: number;
  adventure: number;
  patience: number;
  curiosity: number;
  leadership: number;
}

// Canonical, detailed visual profile extracted from an avatar image.
// This is used to ensure consistent appearance across all generated images.
export interface AvatarVisualProfile {
  ageApprox: string;
  gender: string;
  skin: {
    tone: string;
    undertone?: string | null;
    distinctiveFeatures?: string[];
  };
  hair: {
    color: string;
    type: string;
    length: string;
    style: string;
  };
  eyes: {
    color: string;
    shape?: string | null;
    size?: string | null;
  };
  face: {
    shape?: string | null;
    nose?: string | null;
    mouth?: string | null;
    eyebrows?: string | null;
    freckles?: boolean;
    otherFeatures?: string[];
  };
  accessories: string[];
  clothingCanonical?: {
    top?: string | null;
    bottom?: string | null;
    outfit?: string | null;
    colors?: string[];
    patterns?: string[];
  };
  palette?: {
    primary: string[];
    secondary?: string[];
  };
  consistentDescriptors: string[]; // Ready-to-use short tokens for prompts.
}

export interface Avatar {
  id: string;
  userId: string;
  name: string;
  description?: string;
  physicalTraits: PhysicalTraits;
  personalityTraits: PersonalityTraits;
  imageUrl?: string;
  visualProfile?: AvatarVisualProfile;
  creationType: "ai-generated" | "photo-upload";
  isShared: boolean;
  originalAvatarId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateAvatarRequest {
  userId: string;
  name: string;
  description?: string;
  physicalTraits: PhysicalTraits;
  personalityTraits: PersonalityTraits;
  imageUrl?: string;
  visualProfile?: AvatarVisualProfile;
  creationType: "ai-generated" | "photo-upload";
}

// Creates a new avatar.
export const create = api<CreateAvatarRequest, Avatar>(
  { expose: true, method: "POST", path: "/avatar" },
  async (req) => {
    const id = crypto.randomUUID();
    const now = new Date();

    await avatarDB.exec`
      INSERT INTO avatars (
        id, user_id, name, description, physical_traits, personality_traits,
        image_url, visual_profile, creation_type, is_shared, created_at, updated_at
      ) VALUES (
        ${id}, ${req.userId}, ${req.name}, ${req.description},
        ${JSON.stringify(req.physicalTraits)}, ${JSON.stringify(req.personalityTraits)},
        ${req.imageUrl}, ${req.visualProfile ? JSON.stringify(req.visualProfile) : null},
        ${req.creationType}, false, ${now}, ${now}
      )
    `;

    return {
      id,
      userId: req.userId,
      name: req.name,
      description: req.description,
      physicalTraits: req.physicalTraits,
      personalityTraits: req.personalityTraits,
      imageUrl: req.imageUrl,
      visualProfile: req.visualProfile,
      creationType: req.creationType,
      isShared: false,
      createdAt: now,
      updatedAt: now,
    };
  }
);
