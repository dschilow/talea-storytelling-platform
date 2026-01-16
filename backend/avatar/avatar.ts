export interface PhysicalTraits {
  characterType: string;
  appearance: string;
}

// Hierarchical personality trait structure
export interface PersonalityTraits {
  // Base traits - each starts at 0 and can have subcategories
  knowledge: number | { value: number; subcategories?: Record<string, number> };
  creativity: number | { value: number; subcategories?: Record<string, number> };
  vocabulary: number | { value: number; subcategories?: Record<string, number> };
  courage: number | { value: number; subcategories?: Record<string, number> };
  curiosity: number | { value: number; subcategories?: Record<string, number> };
  teamwork: number | { value: number; subcategories?: Record<string, number> };
  empathy: number | { value: number; subcategories?: Record<string, number> };
  persistence: number | { value: number; subcategories?: Record<string, number> };
  logic: number | { value: number; subcategories?: Record<string, number> };
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
  // ===== NEW: Explicit Measurements for Image Consistency =====
  /** Explicit numeric age in years (e.g., 5 for a 5-year-old) */
  ageNumeric?: number;
  /** Explicit height in centimeters (e.g., 120 for 120cm) */
  heightCm?: number;

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
  isPublic: boolean;
  originalAvatarId?: string;
  createdAt: string;
  updatedAt: string;
  inventory: InventoryItem[];
  skills: Skill[];
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
  name: string;
  description?: string;
  physicalTraits: PhysicalTraits;
  personalityTraits: PersonalityTraits;
  imageUrl?: string;
  visualProfile?: AvatarVisualProfile;
  creationType: "ai-generated" | "photo-upload";
}
