import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const avatarDB = new SQLDatabase("avatar", {
  migrations: "./migrations",
});

export interface PhysicalTraits {
  age: number;
  height: number;
  gender: "male" | "female" | "non-binary";
  skinTone: string;
  hairColor: string;
  hairType: string;
  eyeColor: string;
  bodyType: number;
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

export interface Avatar {
  id: string;
  userId: string;
  name: string;
  description?: string;
  physicalTraits: PhysicalTraits;
  personalityTraits: PersonalityTraits;
  imageUrl?: string;
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
        image_url, creation_type, is_shared, created_at, updated_at
      ) VALUES (
        ${id}, ${req.userId}, ${req.name}, ${req.description},
        ${JSON.stringify(req.physicalTraits)}, ${JSON.stringify(req.personalityTraits)},
        ${req.imageUrl}, ${req.creationType}, false, ${now}, ${now}
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
      creationType: req.creationType,
      isShared: false,
      createdAt: now,
      updatedAt: now,
    };
  }
);
