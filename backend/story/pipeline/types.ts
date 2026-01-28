import type { StoryConfig, StoryLanguage } from "../generate";
import type { Avatar } from "../../avatar/avatar";
import type { StoryCategory } from "./constants";

export type SlotKey = string;

export type RoleType =
  | "PROTAGONIST"
  | "ANTAGONIST"
  | "HELPER"
  | "MENTOR"
  | "LOVE_INTEREST"
  | "TRICKSTER"
  | "COMIC_RELIEF"
  | "GUARDIAN"
  | "NARRATOR"
  | "CAMEO"
  | "AVATAR"
  | "ARTIFACT";

export interface RoleSlot {
  slotKey: SlotKey;
  roleType: RoleType;
  required: boolean;
  roleCount: number;
  archetypePreference?: string[];
  constraints?: string[];
  visualHints?: string[];
  ageHint?: { min: number; max: number };
}

export type BeatType = "SETUP" | "INCITING" | "CONFLICT" | "TWIST" | "CLIMAX" | "RESOLUTION" | "EPILOGUE";
export type Mood = "COZY" | "WONDER" | "FUNNY" | "TENSE" | "MYSTERIOUS" | "SAD" | "TRIUMPH" | "SCARY_LIGHT" | "SCARY_HEAVY";

export interface SceneBeat {
  sceneId?: string;
  sceneNumber: number;
  beatType: BeatType;
  sceneTitle: string;
  setting: string;
  mood: Mood;
  sceneDescription: string;
  mustIncludeSlots: SlotKey[];
  optionalSlots?: SlotKey[];
  artifactPolicy?: {
    requiresArtifact?: boolean;
    artifactSlotKey?: SlotKey;
    artifactMustBeVisible?: boolean;
  };
  promptTemplate?: string;
  promptTokens?: string[];
  imageAvoid?: string[];
  continuityNotes?: string[];
}

export interface TaleDNA {
  taleId: string;
  title: string;
  language: string;
  age: { min: number; max: number };
  summary?: string;
  moralLesson?: string;
  cultureRegion?: string;
  source?: string;
  themeTags?: string[];
  coreConflict?: string;
  emotionalArc?: string[];
  chapterCountHint?: number;
  iconicBeats: string[];
  fixedElements: string[];
  flexibleElements: string[];
  toneBounds: {
    targetTone: string;
    contentRules: string[];
  };
}

export interface StoryDNA {
  templateId: string;
  category: StoryCategory;
  language: string;
  age: { min: number; max: number };
  themeTags: string[];
  coreConflict: string;
  beatPattern: Array<{
    beatType: BeatType;
    sceneTitle: string;
    settingHint: string;
    mood: Mood;
    mustIncludeRoleTypes: RoleType[];
    optionalRoleTypes?: RoleType[];
    requiresArtifact?: boolean;
  }>;
  roleSlots: RoleSlot[];
  artifactCategories: string[];
  artifactAbilities: string[];
  toneBounds: {
    targetTone: string;
    contentRules: string[];
  };
}

export interface StoryBlueprintBase {
  dna: TaleDNA | StoryDNA;
  roles: RoleSlot[];
  scenes: SceneBeat[];
}

export interface NormalizedRequest {
  storyId: string;
  userId: string;
  category: StoryCategory;
  language: StoryLanguage;
  ageMin: number;
  ageMax: number;
  chapterCount: number;
  avatarIds: string[];
  avatarCount: number;
  lengthHint?: string;
  emotionProfile?: Record<string, any>;
  variantSeed?: number;
  taleId?: string;
  requestedTone?: string;
  requestHash: string;
  rawConfig: StoryConfig;
}

export interface StoryVariantPlan {
  storyInstanceId: string;
  taleId: string;
  variantSeed: number;
  variantChoices: Record<string, string>;
  sceneOverrides?: Array<{
    chapter: number;
    setting: string;
    goal: string;
    conflict: string;
    outcome: string;
    artifactUsageHint: string;
    canonAnchorLineHint?: string;
    imageMustShowAdd: string[];
    imageAvoidAdd: string[];
  }>;
  category?: StoryCategory;
}

export interface CharacterSheet {
  characterId: string;
  displayName: string;
  roleType: RoleType;
  slotKey: SlotKey;
  personalityTags?: string[];
  speechStyleHints?: string[];
  visualSignature: string[];
  outfitLock: string[];
  faceLock?: string[];
  forbidden: string[];
  refKey?: string;
  referenceImageId?: string;
  imageUrl?: string;
}

export interface ArtifactCard {
  artifactId: string;
  name: string;
  category?: string;
  storyUseRule: string;
  visualRule: string;
  rarity?: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
}

export interface MatchScore {
  slotKey: SlotKey;
  candidateId: string;
  scores: {
    narrativeFit: number;
    personalitySync: number;
    visualHarmony: number;
    conflictPotential: number;
  };
  finalScore: number;
  notes?: string;
}

export interface CastSet {
  avatars: CharacterSheet[];
  poolCharacters: CharacterSheet[];
  artifact: ArtifactCard;
  slotAssignments: Record<string, string>;
  matchScores?: MatchScore[];
}

export interface ChapterIntegration {
  chapter: number;
  charactersOnStage: SlotKey[];
  avatarFunction?: string;
  canonSafeguard: string;
  canonAnchorLine: string;
  artifactMoment?: string;
}

export interface IntegrationPlan {
  chapters: ChapterIntegration[];
  avatarsPresenceRatio?: number;
}

export interface SceneDirective {
  chapter: number;
  setting: string;
  mood?: Mood;
  charactersOnStage: SlotKey[];
  goal: string;
  conflict: string;
  outcome: string;
  artifactUsage: string;
  canonAnchorLine: string;
  dialogCues?: string[];
  imageMustShow: string[];
  imageAvoid: string[];
}

export interface ImageSpec {
  chapter: number;
  style: string;
  composition: string;
  blocking: string;
  actions: string;
  propsVisible: string[];
  lighting: string;
  refs: Record<string, string>;
  negatives: string[];
  onStageExact: SlotKey[];
  finalPromptText?: string;
}

export interface StoryChapterText {
  chapter: number;
  title: string;
  text: string;
}

export interface StoryDraft {
  title: string;
  description: string;
  chapters: StoryChapterText[];
}

export interface PipelineDependencies {
  storyWriter?: StoryWriter;
  imageDirector?: ImageDirector;
  imageGenerator?: ImageGenerator;
  visionValidator?: VisionValidator;
}

export interface StoryWriter {
  writeStory: (input: {
    normalizedRequest: NormalizedRequest;
    cast: CastSet;
    dna: TaleDNA | StoryDNA;
    directives: SceneDirective[];
  }) => Promise<{ draft: StoryDraft; usage?: TokenUsage }>;
}

export interface ImageDirector {
  createImageSpecs: (input: {
    normalizedRequest: NormalizedRequest;
    cast: CastSet;
    directives: SceneDirective[];
  }) => Promise<ImageSpec[]>;
}

export interface ImageGenerator {
  generateImages: (input: {
    normalizedRequest: NormalizedRequest;
    cast: CastSet;
    directives: SceneDirective[];
    imageSpecs: ImageSpec[];
  }) => Promise<Array<{ chapter: number; imageUrl?: string; prompt: string; provider?: string }>>;
}

export interface VisionValidator {
  validateImages: (input: {
    normalizedRequest: NormalizedRequest;
    cast: CastSet;
    directives: SceneDirective[];
    imageSpecs: ImageSpec[];
    images: Array<{ chapter: number; imageUrl?: string; prompt: string }>;
  }) => Promise<{ report: any; retryAdvice: Record<number, string[]> }>;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model?: string;
  inputCostUSD?: number;
  outputCostUSD?: number;
  totalCostUSD?: number;
}

export type AvatarDetail = Omit<Avatar, "userId" | "isShared" | "originalAvatarId" | "createdAt" | "updatedAt">;
