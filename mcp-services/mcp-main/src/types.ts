// Avatar Types (matching your existing schema)
export interface PhysicalTraits {
  characterType: string;
  appearance: string;
}

export interface PersonalityTraits {
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
  creationType: 'ai-generated' | 'photo-upload';
  isPublic: boolean;
  originalAvatarId?: string;
  createdAt: string;
  updatedAt: string;
}

// Memory Types
export interface AvatarMemory {
  id: string;
  avatarId: string;
  storyId: string;
  storyTitle: string;
  experience: string;
  emotionalImpact: 'positive' | 'negative' | 'neutral';
  personalityChanges: Array<{
    trait: string;
    change: number;
  }>;
  createdAt: string;
}

// MCP Tool Request/Response Types
export interface GetVisualProfileRequest {
  avatarId: string;
  userId: string; // From Clerk token
}

export interface GetMultipleProfilesRequest {
  avatarIds: string[];
  userId: string;
}

export interface GetMemoriesRequest {
  avatarId: string;
  userId: string;
  limit?: number;
}

export interface SearchMemoriesRequest {
  avatarId: string;
  userId: string;
  searchTerm: string;
  limit?: number;
}

export interface AddMemoryRequest {
  avatarId: string;
  userId: string;
  storyId: string;
  storyTitle: string;
  experience: string;
  emotionalImpact: 'positive' | 'negative' | 'neutral';
  personalityChanges: Array<{
    trait: string;
    change: number;
  }>;
}

export interface GetPersonalityRequest {
  avatarId: string;
  userId: string;
}

export interface BuildImagePromptRequest {
  avatarId: string;
  userId: string;
  sceneDescription?: string;
  action?: string;
  expression?: string;
  clothing?: string;
}

// Database Row Types
export interface AvatarRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  physical_traits: string; // JSON
  personality_traits: string; // JSON
  image_url: string | null;
  visual_profile: string | null; // JSON
  creation_type: 'ai-generated' | 'photo-upload';
  is_public: boolean;
  original_avatar_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemoryRow {
  id: string;
  avatar_id: string;
  story_id: string;
  story_title: string;
  experience: string;
  emotional_impact: 'positive' | 'negative' | 'neutral';
  personality_changes: string; // JSON
  created_at: string;
}
