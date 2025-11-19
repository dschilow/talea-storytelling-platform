// TypeScript types for character pool and 4-phase story generation system

export interface CharacterTemplate {
  id: string;
  name: string;
  role: string; // guide, companion, obstacle, discovery, support, special
  archetype: string; // helpful_elder, loyal_animal, etc.

  // Emotional Profile
  emotionalNature: {
    dominant: string;
    secondary: string[];
    triggers?: string[];
  };

  // Visual Profile
  visualProfile: {
    description: string;
    imagePrompt?: string;
    species: string;
    colorPalette: string[];
  };
  imageUrl?: string;

  // NEW: Enhanced Matching Attributes (Migration 7)
  gender?: string; // male, female, neutral, any
  age_category?: string; // child, teenager, young_adult, adult, elder, ageless, any
  species_category?: string; // human, humanoid, animal, magical_creature, mythical, elemental, any
  profession_tags?: string[]; // ['royalty', 'craftsman', 'warrior', etc.]
  size_category?: string; // tiny, small, medium, large, giant, any
  social_class?: string; // royalty, nobility, merchant, craftsman, commoner, outcast, any
  personality_keywords?: string[]; // ['brave', 'cunning', 'kind', etc.]
  physical_description?: string;
  backstory?: string;

  // Screen Time & Availability
  maxScreenTime: number; // 0-100 percentage
  availableChapters: number[]; // [1,2,3,4,5]
  canonSettings?: string[]; // Where this character fits

  // Tracking
  recentUsageCount?: number;
  totalUsageCount?: number;
  lastUsedAt?: Date;

  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
  isActive?: boolean;
}

export interface CharacterRequirement {
  placeholder: string; // e.g., "{{WISE_ELDER}}"
  role: string;
  archetype: string;
  emotionalNature: string;
  requiredTraits: string[];
  visualHints?: string; // NEW: Visual description hints (animal type, profession, appearance)
  importance: "high" | "medium" | "low";
  inChapters: number[];
}

export interface ChapterSkeleton {
  order: number;
  content: string; // Story with {{PLACEHOLDERS}}
  characterRolesNeeded: {
    placeholder: string;
    role: string;
    archetype: string;
    emotionalNature: string;
    visualHints?: string; // NEW: Visual description hints
    importance: "high" | "medium" | "low";
    inChapters: number[];
  }[];
}

export interface StorySkeleton {
  title: string;
  chapters: ChapterSkeleton[];
  supportingCharacterRequirements: CharacterRequirement[];
  supportingCharacters?: Array<{
    placeholder: string;
    role: string;
    description?: string;
  }>;
}

export interface FinalChapter {
  order: number;
  title: string;
  content: string;
  imageDescription: string; // English description for image generation
}

export interface AvatarDevelopment {
  avatarName: string;
  updates: Array<{
    trait: string; // e.g., "knowledge", "knowledge.history", "creativity", "courage"
    change: number; // Positive number for growth
    description: string; // Why this trait developed
  }>;
}

export interface FinalizedStory {
  title: string;
  description: string;
  chapters: FinalChapter[];
  avatarDevelopments?: AvatarDevelopment[]; // 🔧 NEW: Personality trait updates
}

export interface CharacterAssignment {
  placeholder: string;
  character: CharacterTemplate;
}

export interface GeneratedImage {
  chapterOrder: number;
  imageUrl: string;
  generatedAt: Date;
  prompt: string;
}
