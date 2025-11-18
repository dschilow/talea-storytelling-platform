// Fairy Tales Type Definitions
// Professional story generation system with avatar integration

export interface FairyTale {
  id: string; // e.g., "grimm-015"
  title: string;
  source: string; // grimm, andersen, russian, etc.
  originalLanguage?: string;
  englishTranslation?: string;
  cultureRegion: string;
  ageRecommendation: number;
  durationMinutes: number;
  genreTags: string[]; // ["adventure", "dark", "moral"]
  moralLesson?: string;
  summary?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FairyTaleRole {
  id: number;
  taleId: string;
  roleType: RoleType;
  roleName?: string;
  roleCount: number;
  description?: string;
  required: boolean;
  archetypePreference?: string; // hero, villain, trickster, sage
  ageRangeMin?: number;
  ageRangeMax?: number;
  professionPreference: string[]; // ["child", "wizard", "animal"]
  // NEW: Enhanced matching requirements (Migration 14)
  speciesRequirement?: string; // human, animal, magical_creature, etc.
  genderRequirement?: string; // male, female, neutral, any
  ageRequirement?: string; // child, teenager, young_adult, adult, elder, ageless, any
  sizeRequirement?: string; // tiny, small, medium, large, giant, any
  socialClassRequirement?: string; // royalty, nobility, merchant, craftsman, commoner, outcast, any
  createdAt: string;
}

export type RoleType = 
  | 'protagonist'
  | 'antagonist'
  | 'helper'
  | 'love_interest'
  | 'supporting';

export interface FairyTaleScene {
  id: number;
  taleId: string;
  sceneNumber: number;
  sceneTitle?: string;
  sceneDescription: string;
  dialogueTemplate?: string;
  characterVariables: Record<string, string>; // {"PROTAGONIST": "name", "HELPER": "name"}
  setting?: string; // "forest", "castle", "village"
  mood?: string; // "mysterious", "happy", "tense"
  illustrationPromptTemplate?: string;
  durationSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedStory {
  id: string;
  userId: string;
  taleId: string;
  title: string;
  storyText?: string;
  characterMappings: Record<string, string>; // {"protagonist": "avatar-id-123"}
  generationParams?: GenerationParams;
  status: StoryStatus;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export type StoryStatus = 'generating' | 'ready' | 'failed';

export interface GenerationParams {
  length?: 'short' | 'medium' | 'long';
  style?: 'classic' | 'modern' | 'humorous';
  targetAge?: number;
  includeImages?: boolean;
}

export interface GeneratedStoryScene {
  id: number;
  storyId: string;
  sceneNumber: number;
  sceneText: string;
  imageUrl?: string;
  imagePrompt?: string;
  imageGenerationStatus: ImageGenerationStatus;
  consistencyScore?: number;
  createdAt: string;
  updatedAt: string;
}

export type ImageGenerationStatus = 'pending' | 'generating' | 'ready' | 'failed';

export interface AvatarConsistencyProfile {
  avatarId: string;
  keyIdentifiers: KeyIdentifiers;
  immutableFeatures: string[]; // Features that must NEVER change
  varyingFeatures: string[]; // Features that can vary (emotions, poses)
  consistencyHash: string;
  consistencyScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface KeyIdentifiers {
  profession?: string;
  age?: number;
  hairColor?: string;
  eyeColor?: string;
  distinctiveFeature?: string;
  clothingStyle?: string;
  species?: string;
}

export interface FairyTaleUsageStats {
  taleId: string;
  totalGenerations: number;
  successfulGenerations: number;
  failedGenerations: number;
  avgGenerationTimeSeconds: number;
  lastGeneratedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// =====================================================
// REQUEST/RESPONSE TYPES
// =====================================================

export interface ListFairyTalesRequest {
  source?: string;
  minAge?: number;
  maxAge?: number;
  genres?: string[];
  limit?: number;
  offset?: number;
}

export interface ListFairyTalesResponse {
  tales: FairyTale[];
  total: number;
}

export interface GetFairyTaleRequest {
  id: string;
  includeRoles?: boolean;
  includeScenes?: boolean;
}

export interface GetFairyTaleResponse {
  tale: FairyTale;
  roles?: FairyTaleRole[];
  scenes?: FairyTaleScene[];
}

export interface GenerateStoryRequest {
  taleId: string;
  characterMappings: Record<string, string>; // {"protagonist": "avatar-id"}
  params?: GenerationParams;
}

export interface GenerateStoryResponse {
  storyId: string;
  title: string;
  status: StoryStatus;
  estimatedTimeSeconds: number;
}

export interface GetGeneratedStoryRequest {
  storyId: string;
  includeScenes?: boolean;
}

export interface GetGeneratedStoryResponse {
  story: GeneratedStory;
  scenes?: GeneratedStoryScene[];
  tale?: FairyTale;
}

export interface ValidateCharacterMappingRequest {
  taleId: string;
  characterMappings: Record<string, string>;
}

export interface ValidateCharacterMappingResponse {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  roleType: string;
  avatarId?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  roleType: string;
  avatarId: string;
  message: string;
  recommendation?: string;
}

// =====================================================
// INTERNAL PROCESSING TYPES
// =====================================================

export interface ResolvedCharacter {
  roleType: RoleType;
  avatarId: string;
  name: string;
  age: number;
  appearance: string;
  profession: string;
  visualProfile: any;
}

export interface SceneImagePrompt {
  sceneNumber: number;
  textDescription: string;
  imagePrompt: string;
  characters: string[];
  setting: string;
  mood: string;
}

export interface ConsistencyValidation {
  isValid: boolean;
  issues: ConsistencyIssue[];
  repairedPrompt?: string;
}

export interface ConsistencyIssue {
  severity: 'error' | 'warning';
  feature: string;
  message: string;
  originalValue?: any;
  newValue?: any;
}
