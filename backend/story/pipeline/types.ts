import type { StoryConfig, StoryLanguage } from "../generate";
import type { Avatar } from "../../avatar/avatar";
import type { StoryCategory } from "./constants";
import type { PipelineConfig } from "./pipeline-config";

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
  wordBudget?: import("./word-budget").WordBudget;
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

// Enhanced Personality for recognizable characters
export interface EnhancedPersonality {
  dominant: string;                     // Primary trait: "mutig", "neugierig", "schüchtern"
  secondary: string[];                  // Supporting traits
  catchphrase?: string;                 // Iconic phrase (use max 1x per story!)
  speechPatterns: string[];             // "spricht in Reimen", "stottert wenn aufgeregt"
  emotionalTriggers: string[];          // Situations that cause reactions
  dialogueStyle: "formal" | "casual" | "playful" | "wise" | "grumpy";
  quirk?: string;                       // Unique mannerism: "räuspert sich immer", "zwirbelt am Bart"
}

// Integration plan for organic character entry/exit
export interface CharacterIntegrationPoint {
  chapter: number;
  narrativeHook: string;                // "trifft sie am Brunnen"
  motivation: string;                   // Why is character there?
  concreteAction: string;               // What do they DO (verb + object)
  plotInfluence: string;                // How does this affect the story?
}

export interface CanonFusionPlan {
  characterIntegrations: Array<{
    characterId: string;
    displayName: string;
    entryPoint: CharacterIntegrationPoint;
    activeChapters: CharacterIntegrationPoint[];
    exitPoint?: {
      chapter: number;
      farewell: string;
    };
  }>;

  artifactArc?: {
    discoveryChapter: number;
    discoveryMethod: string;
    failureChapter?: number;
    failureReason?: string;
    successChapter: number;
    successMethod: string;
  };

  bannedPhrases: string[];
}

export interface CharacterSheet {
  characterId: string;
  displayName: string;
  roleType: RoleType;
  slotKey: SlotKey;
  personalityTags?: string[];
  speechStyleHints?: string[];
  // NEW: Enhanced personality for recognizable characters
  enhancedPersonality?: EnhancedPersonality;
  catchphrase?: string;                 // Shortcut for quick access
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
  setting?: string;
  sceneDescription?: string;
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
    strict?: boolean;
    stylePackText?: string;
    fusionSections?: Map<number, string>;
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
    pipelineConfig?: PipelineConfig;
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

// ─── Pool-Schema V2: Enhanced Character Pool ───────────────────────────────
export type Archetype =
  | "ADVENTURER"
  | "MENTOR"
  | "TRICKSTER"
  | "GUARDIAN"
  | "HEALER"
  | "SCHOLAR"
  | "REBEL"
  | "INNOCENT"
  | "EXPLORER"
  | "JESTER";

export interface PoolCharacterMatchingProfile {
  archetypes: Archetype[];
  roleCompatibility: RoleType[];
  themeAffinity: string[];              // ["Freundschaft", "Mut", "Natur"]
  ageRange: { min: number; max: number };
  conflictPotential: string[];          // Abilities usable in conflicts
}

export interface PoolCharacterPersonality {
  dominant: string;                     // "mutig", "ängstlich", "neugierig"
  secondary: string[];
  catchphrase?: string;                 // Use max 1x per story!
  catchphraseContext?: string;          // When to use it: "wenn sie Angst hat"
  speechStyle: string[];                // "förmlich", "direkt", "verspielt"
  triggers: string[];                   // Situations that cause strong reactions
  quirk?: string;                       // A unique mannerism: "räuspert sich immer"
}

export interface PoolCharacterVisualProfile {
  species: string;                      // human_child, animal_bird, cosmic_being
  imagePrompt: string;                  // Detailed image generation prompt
  colorPalette: string[];               // Dominant colors
  consistencyMarkers: string[];         // "runde Brille", "blaues Tuch"
  forbidden: string[];                  // Things that must NEVER appear
}

export interface PoolCharacterStoryBinding {
  canonSettings: string[];              // Settings where character fits
  availableChapters?: number[];         // Which chapters usable (null = all)
  maxScreenTime: number;                // Max % of story (0.0-1.0)
  introStyle: "gradual" | "dramatic" | "casual" | "mysterious";
}

export interface PoolCharacterV2 {
  id: string;
  name: string;
  matchingProfile: PoolCharacterMatchingProfile;
  personality: PoolCharacterPersonality;
  visualProfile: PoolCharacterVisualProfile;
  storyBinding: PoolCharacterStoryBinding;
}

// ─── Pool-Schema V2: Enhanced Artifact Pool ────────────────────────────────
export interface ArtifactMiniArc {
  introduction: string;                 // How it's introduced
  failureMode: string;                  // How it first fails/is misunderstood
  triumphMode: string;                  // How it helps in the end
  activeChapters: number[];             // Min 2-4 chapters active
}

export interface ArtifactStoryFunctions {
  abilities: string[];                  // "leuchtet im Dunkeln", "spricht"
  useRule: string;                      // When/how it works
  miniArc: ArtifactMiniArc;
  plotInfluence: "CLUE" | "TOOL" | "GIFT" | "CHALLENGE";
}

export interface ArtifactGenreAffinity {
  fairytale: number;                    // 0-100
  adventure: number;
  scifi: number;
  modern: number;
  magic: number;
  animals: number;
}

export interface ArtifactVisualProfile {
  imagePrompt: string;
  mustShowWhen: string[];               // "wenn es aktiviert wird"
  style: string;                        // "magisch glühend", "alt und mysteriös"
}

export interface ArtifactV2 {
  id: string;
  name: string;
  storyFunctions: ArtifactStoryFunctions;
  genreAffinity: ArtifactGenreAffinity;
  visualProfile: ArtifactVisualProfile;
}

// ─── Pool-Schema V2: Enhanced Tale Pool DNA ────────────────────────────────
export type EmotionType =
  | "spielerisch"
  | "verzweifelt"
  | "erlöst"
  | "spannend"
  | "geborgen"
  | "traurig"
  | "hoffnungsvoll"
  | "lustig"
  | "ängstlich"
  | "mutig"
  | "neugierig";

export interface VariantChoice {
  dimension: string;                    // "setting", "encounter", "twist", "rescue"
  options: string[];                    // Available variants
  defaultIndex: number;                 // Default variant index
}

export interface TalePoolEntry {
  taleId: string;
  title: string;

  // DNA for semantic matching
  dna: {
    coreConflict: string;               // "Versprechen vs Eigennutz"
    moralLesson: string;                // "Halte deine Versprechen"
    emotionalArc: EmotionType[];        // ["spielerisch", "verzweifelt", "erlöst"]
    themeTags: string[];                // ["Verwandlung", "Versprechen", "Königtum"]
    iconicBeats: string[];              // Key moments that must remain
    flexibleElements: string[];         // Elements that can vary
  };

  // Casting
  roleSlots: RoleSlot[];
  sceneBeats: SceneBeat[];

  // Variation Control
  variationSeed?: number;
  variantChoices: VariantChoice[];
}

// ─── Enhanced Canon-Fusion Plan V2 ─────────────────────────────────────────
export interface CharacterIntegrationV2 {
  characterId: string;
  displayName: string;

  // Personality-driven integration
  personalityProfile: {
    dominant: string;
    catchphrase?: string;
    speechStyle: string[];
    quirk?: string;
  };

  entryPoint: CharacterIntegrationPoint & {
    introStyle: "gradual" | "dramatic" | "casual" | "mysterious";
  };

  activeChapters: Array<CharacterIntegrationPoint & {
    dialogueCue?: string;               // Suggested dialogue line
    catchphraseUse?: boolean;           // Should catchphrase appear here?
    emotionalBeat?: string;             // "zeigt Angst", "wird mutig"
  }>;

  exitPoint?: {
    chapter: number;
    farewell: string;
    emotionalNote: string;              // "traurig aber hoffnungsvoll"
  };
}

export interface ArtifactArcPlan {
  artifactId: string;
  artifactName: string;
  discoveryChapter: number;
  discoveryMethod: string;
  failureChapter: number;
  failureReason: string;
  successChapter: number;
  successMethod: string;
  activeChapters: number[];
}

export interface CanonFusionPlanV2 {
  characterIntegrations: CharacterIntegrationV2[];
  artifactArc?: ArtifactArcPlan;
  bannedPhrases: string[];

  // Summary for prompt injection
  fusionSummary: {
    characterCount: number;
    artifactActive: boolean;
    chaptersWithCatchphrases: number[];
    totalDialogueCues: number;
  };
}

// ─── Pipeline Output Bundle ────────────────────────────────────────────────
export interface PipelineOutput {
  story: StoryDraft;
  castSet: CastSet;
  castLock: string[];
  sceneDirectives: SceneDirective[];
  images: Array<{
    chapter: number;
    imageSpec: ImageSpec;
    finalPrompt: string;
    imageUrl: string;
    validationReport?: any;
  }>;
  qualityReport: any;
  canonFusionPlan?: CanonFusionPlanV2;
  debugBundle: {
    normalizedRequest: NormalizedRequest;
    matchingScores: MatchScore[];
    integrationPlan: any;
    variantPlan?: StoryVariantPlan;
    tokenUsage?: TokenUsage;
    warnings: string[];
  };
}
