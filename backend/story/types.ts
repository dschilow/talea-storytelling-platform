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
    imagePrompt: string;
    species: string;
    colorPalette: string[];
  };
  imageUrl?: string;

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
    importance: "high" | "medium" | "low";
    inChapters: number[];
  }[];
}

export interface StorySkeleton {
  title: string;
  chapters: ChapterSkeleton[];
  supportingCharacterRequirements: CharacterRequirement[];
}

export interface FinalChapter {
  order: number;
  title: string;
  content: string;
  imageDescription: string; // English description for image generation
}

export interface FinalizedStory {
  title: string;
  description: string;
  chapters: FinalChapter[];
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
