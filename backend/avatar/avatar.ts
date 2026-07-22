import type { AvatarProgressionSummary } from "./progression";

export interface PhysicalTraits {
  characterType: string;
  appearance: string;
}

// Single trait entry in the hierarchical personality system
export interface PersonalityTrait {
  value: number;
  subcategories?: Record<string, number>;
}

// Hierarchical personality trait structure
export interface PersonalityTraits {
  // Base traits - each starts at 0 and can have subcategories
  knowledge: PersonalityTrait;
  creativity: PersonalityTrait;
  vocabulary: PersonalityTrait;
  courage: PersonalityTrait;
  curiosity: PersonalityTrait;
  teamwork: PersonalityTrait;
  empathy: PersonalityTrait;
  persistence: PersonalityTrait;
  logic: PersonalityTrait;
}

/**
 * Invariant Feature - A feature that MUST appear consistently across all images
 * @see character-invariants.ts for full implementation
 */
export interface InvariantFeature {
  /** Unique identifier for the feature */
  id: string;
  /** Category of the feature */
  category: 'facial' | 'body' | 'accessory' | 'clothing' | 'distinctive';
  /** English description for image prompts */
  promptDescription: string;
  /** Short token for MUST INCLUDE list */
  mustIncludeToken: string;
  /** What happens if this feature is missing */
  forbiddenAlternative?: string;
  /** Priority level (1 = highest, 3 = lowest) */
  priority: 1 | 2 | 3;
  /** German label for UI display */
  labelDe?: string;
}

export interface AvatarVisualProfile {
  characterType?: string;
  speciesCategory?: string;
  locomotion?: string;

  // ===== NEW: Explicit Measurements for Image Consistency =====
  /** Explicit numeric age in years (e.g., 5 for a 5-year-old) */
  ageNumeric?: number;
  /** Explicit height in centimeters (e.g., 120 for 120cm) */
  heightCm?: number;
  heightDescription?: string;
  ageDescription?: string;
  bodyBuild?: string;
  bodyFeatures?: string[];

  // ===== NEW: Character Invariants for Feature Consistency =====
  /** Features that MUST appear in every generated image */
  mustIncludeFeatures?: InvariantFeature[];
  /** Features that MUST NEVER appear (e.g., "complete teeth" if tooth gap required) */
  forbiddenFeatures?: string[];

  // ===== Existing Fields =====
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
    footwear?: string | null;
    colors?: string[];
    patterns?: string[];
  };
  palette?: {
    primary: string[];
    secondary?: string[];
  };
  consistentDescriptors: string[];
}

/**
 * Creator-defined story identity. This deliberately stays separate from the
 * visual profile (image consistency) and the progression traits (earned).
 */
export interface AvatarNarrativeProfile {
  dominantPersonality?: string;
  traits?: string[];
  quirk?: string;
  catchphrase?: string;
  backstory?: string;
}

const NARRATIVE_PROFILE_LIMITS = {
  dominantPersonality: 48,
  trait: 32,
  traits: 5,
  quirk: 180,
  catchphrase: 120,
  backstory: 520,
} as const;

function trimNarrativeText(value: unknown, maximum: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/\s+/g, " ").trim().slice(0, maximum);
  return trimmed || undefined;
}

export function normalizeAvatarNarrativeProfile(
  profile?: AvatarNarrativeProfile | null,
): AvatarNarrativeProfile | undefined {
  if (!profile || typeof profile !== "object") return undefined;

  const dominantPersonality = trimNarrativeText(profile.dominantPersonality, NARRATIVE_PROFILE_LIMITS.dominantPersonality);
  const traits = Array.from(
    new Set(
      (Array.isArray(profile.traits) ? profile.traits : [])
        .map((trait) => trimNarrativeText(trait, NARRATIVE_PROFILE_LIMITS.trait))
        .filter((trait): trait is string => Boolean(trait))
        .map((trait) => trait.toLocaleLowerCase("de-DE")),
    ),
  ).slice(0, NARRATIVE_PROFILE_LIMITS.traits);
  const quirk = trimNarrativeText(profile.quirk, NARRATIVE_PROFILE_LIMITS.quirk);
  const catchphrase = trimNarrativeText(profile.catchphrase, NARRATIVE_PROFILE_LIMITS.catchphrase);
  const backstory = trimNarrativeText(profile.backstory, NARRATIVE_PROFILE_LIMITS.backstory);

  const normalized = {
    ...(dominantPersonality ? { dominantPersonality } : {}),
    ...(traits.length > 0 ? { traits } : {}),
    ...(quirk ? { quirk } : {}),
    ...(catchphrase ? { catchphrase } : {}),
    ...(backstory ? { backstory } : {}),
  };

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export interface AvatarSharedBy {
  userId: string;
  name?: string;
  email?: string;
  sharedAt?: string;
}

export interface AvatarShareRecipient {
  contactId: string;
  contactEmail: string;
  contactLabel: string;
  trusted: boolean;
  sharedAt: string;
}

export interface Avatar {
  id: string;
  userId: string;
  profileId?: string;
  name: string;
  description?: string;
  physicalTraits: PhysicalTraits;
  personalityTraits: PersonalityTraits;
  imageUrl?: string;
  visualProfile?: AvatarVisualProfile;
  narrativeProfile?: AvatarNarrativeProfile;
  creationType: "ai-generated" | "photo-upload";
  isPublic: boolean;
  isShared?: boolean;
  isOwnedByCurrentUser?: boolean;
  sharedBy?: AvatarSharedBy;
  sharedWithCount?: number;
  activeShareRecipients?: AvatarShareRecipient[];
  avatarRole?: "child" | "companion";
  sourceType?: "profile" | "pool" | "family" | "clone";
  sourceAvatarId?: string;
  originalAvatarId?: string;
  createdAt: string;
  updatedAt: string;
  inventory: InventoryItem[];
  skills: Skill[];
  progression?: AvatarProgressionSummary;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: 'TOOL' | 'WEAPON' | 'KNOWLEDGE' | 'COMPANION';
  level: number;
  sourceStoryId: string;
  description: string;
  visualPrompt: string;
  tags: string[];
  acquiredAt: string;
  imageUrl?: string;       // URL des generierten Artefakt-Bildes
  storyEffect?: string;    // Beschreibung, was das Artefakt in Geschichten bewirken kann
}

export interface Skill {
  id: string;
  name: string;
  level: number;
  progress: number;
  description?: string;
}

export interface CreateAvatarRequest {
  profileId?: string;
  name: string;
  description?: string;
  physicalTraits: PhysicalTraits;
  personalityTraits: PersonalityTraits;
  imageUrl?: string;
  visualProfile?: AvatarVisualProfile;
  narrativeProfile?: AvatarNarrativeProfile;
  creationType: "ai-generated" | "photo-upload";
  avatarRole?: "child" | "companion";
  sourceType?: "profile" | "pool" | "family" | "clone";
  sourceAvatarId?: string;
}
