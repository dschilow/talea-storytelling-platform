export interface AvatarConfig {
  age?: string;
  gender?: string;
  ageGroup?: string;
  ethnicity?: string;
  personality?: string;
  appearance?: string;
  hobbies?: string;
  backstory?: string;
}

export interface PersonalityTrait {
  trait: string;
  value: number; // 0-100
  history: Array<{
    timestamp: string;
    oldValue: number;
    newValue: number;
    reason: string; // story title or event that caused change
    storyId?: string;
  }>;
}

export interface AvatarMemory {
  id: string;
  storyId: string;
  storyTitle: string;
  experience: string;
  emotionalImpact: 'positive' | 'negative' | 'neutral';
  personalityChanges: Array<{
    trait: string;
    change: number;
  }>;
  createdAt: string;
  timestamp?: string; // deprecated, use createdAt
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
  imageUrl?: string;       // 🎁 URL des generierten Artefakt-Bildes
  storyEffect?: string;    // Was das Artefakt in Geschichten bewirken kann
}

export interface Skill {
  id: string;
  name: string;
  level: number;
  progress: number;
  description?: string;
}

export interface Avatar {
  id: string;
  userId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  config?: AvatarConfig;
  creationType?: 'ai-generated' | 'photo-upload';
  status?: 'generating' | 'complete' | 'error';
  personalityTraits?: any; // Backend hierarchical personality traits

  // Personality development system
  personality?: {
    traits: PersonalityTrait[];
    lastUpdated: string;
  };

  // Memory system
  memories?: AvatarMemory[];
  inventory?: InventoryItem[];
  skills?: Skill[];

  metadata?: {
    tokensUsed?: {
      prompt: number;
      completion: number;
      total: number;
    };
    model?: string;
    processingTime?: number;
    imagesGenerated?: number;
    totalCost?: {
      text: number;
      images: number;
      total: number;
    };
  };
  createdAt: string;
  updatedAt: string;
}