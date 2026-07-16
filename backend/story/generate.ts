import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { generateStoryContent } from "./ai-generation";
import { generateStoryDevMode, pickDevModePoolCharacters, recordDevModePoolCharacterUsage } from "./dev-mode-generation";
import { generateStoryStandardMode } from "./standard-mode-generation";
import type { Avatar, InventoryItem, Skill } from "../avatar/avatar";
import { avatar } from "~encore/clients";
import { storyDB } from "./db";
import { logTopic } from "../log/logger";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { avatarDB } from "../avatar/db";
import { upgradePersonalityTraits } from "../avatar/upgradePersonalityTraits";
import { getAuthData } from "~encore/auth";
import { validateAvatarDevelopments } from "../helpers/mcpClient";
import { assignAvatarDevelopmentIds } from "./avatar-development-assignment";
import { resolveImageUrlForClient } from "../helpers/bucket-storage";
import { buildStoryChapterImageUrlForClient, buildArtifactImageUrlForClient } from "../helpers/image-proxy";
import { updateStoryInstanceStatus } from "./pipeline/repository";
import { claimGenerationUsage } from "../helpers/billing";
import { extractParticipantProfileIds, extractRequestedProfileId } from "../helpers/profile-context";
import {
  assertParentalDailyLimit,
  buildGenerationGuidanceFromControls,
  getParentalControlsForUser,
  sanitizeTextWithBlockedTerms,
} from "../helpers/parental-controls";
import { StoryPipelineOrchestrator } from "./pipeline/orchestrator";
import { buildImageCostEntry, buildLlmCostEntry, summarizeStoryCostEntries } from "./pipeline/cost-ledger";
import { GEMINI_MAIN_STORY_MODEL } from "./pipeline/model-routing";
import {
  calculateGenerationUsageResidual,
  normalizeGeneratedImageCount,
  resolveAdminImageCallCount,
} from "./generation-cost-residual";
import { normalizeOpenRouterModel } from "./openrouter-generation";
import {
  assertProfilesBelongToUser,
  ensureDefaultProfileForUser,
  getProfileForUser,
  resolveRequestedProfileId,
} from "../helpers/profiles";
import type {
  StorySoulKey,
  EmotionalFlavorKey,
  StoryTempoKey,
  SpecialIngredientKey,
} from "./story-experience";
import {
  ageToAgeGroup,
  buildStoryProfilePrompt,
} from "../helpers/child-profile-personalization";
import { enrichStoryForTTS } from "./tts-enrichment";
import { reserveStoryGenerationCapacity } from "./generation-capacity";

const mcpServerApiKey = secret("MCPServerAPIKey");
// Keep cost reporting aligned with the reliable checkpoint used by the image
// pipeline. The old estimate understated the six observed provider charges.
const DEV_MODE_IMAGE_MODEL = "runware:400@4";
const DEV_MODE_IMAGE_COST_USD = 0.00151;

type AvatarDevelopmentValidationResult = {
  isValid?: boolean;
  errors?: unknown;
  normalized?: any[];
};

// Avatar DB is already available through the avatar service client

export type StylePresetKey =
  | "rhymed_playful"
  | "gentle_minimal"
  | "wild_imaginative"
  | "philosophical_warm"
  | "mischief_empowering"
  | "adventure_epic"
  | "quirky_dark_sweet"
  | "cozy_friendly"
  | "classic_fantasy"
  | "whimsical_logic"
  | "mythic_allegory"
  | "road_fantasy"
  | "imaginative_meta"
  | "pastoral_heart"
  | "bedtime_soothing";

export type StoryTone =
  | "warm"
  | "witty"
  | "epic"
  | "soothing"
  | "mischievous"
  | "wonder";

export type StoryLanguage = "de" | "en" | "fr" | "es" | "it" | "nl" | "ru";

export type StoryPacing = "slow" | "balanced" | "fast";
export type StoryPOV = "ich" | "personale";
export type StoryPromptVersion = "v6" | "v7" | "v8";
export type PlotHookKey =
  | "secret_door"
  | "riddle_puzzle"
  | "lost_map"
  | "mysterious_guide"
  | "time_glitch"
  | "friend_turns_foe"
  | "foe_turns_friend"
  | "moral_choice";

export type AIModel =
  | "claude-sonnet-4-6"
  | "gpt-5"
  | "gpt-5.4"
  | "gpt-5.4-mini"
  | "gpt-5.4-nano"
  | "gpt-5-pro"
  | "gpt-4.1-nano"
  | "gpt-4.1-mini"
  | "gpt-4.1"
  | "o4-mini"
  | "gemini-3-flash-preview"
  | "gemini-3.1-flash-lite-preview"
  | "gemini-3-pro-preview"
  | "gemini-3.1-pro-preview"
  | "minimax-m2.7";

export type AIProvider = "native" | "openrouter";

export interface StoryConfig {
  avatarIds: string[];
  genre: string;
  setting: string;
  length: "short" | "medium" | "long";
  complexity: "simple" | "medium" | "complex";
  learningMode?: LearningMode;
  ageGroup: "3-5" | "6-8" | "9-12" | "13+";

  // Optional advanced styling parameters from StoryWizard
  stylePreset?: StylePresetKey;
  allowRhymes?: boolean;
  tone?: StoryTone;
  language?: StoryLanguage;
  suspenseLevel?: 0 | 1 | 2 | 3;
  humorLevel?: 0 | 1 | 2 | 3;
  pacing?: StoryPacing;
  pov?: StoryPOV;
  hooks?: PlotHookKey[];
  hasTwist?: boolean;
  customPrompt?: string;
  storySoul?: StorySoulKey;
  emotionalFlavors?: EmotionalFlavorKey[];
  storyTempo?: StoryTempoKey;
  specialIngredients?: SpecialIngredientKey[];

  // AI Model selection for story generation
  aiModel?: AIModel;
  aiProvider?: AIProvider;
  openRouterModel?: string;

  // 4-Phase System: Enable character pool system
  useCharacterPool?: boolean;

  // Fairy Tale System: Enable fairy tale template mode
  preferences?: {
    useFairyTaleTemplate?: boolean;
  };

  // Injected safety/goals guidance from parental controls.
  parentalGuidance?: string;

  // Optional: fail generation when release-quality gates are not met.
  // Default false to avoid hard failures for recoverable narrative quality issues.
  strictQualityGates?: boolean;


  // Optional release-gate behavior. Customer generation keeps this in warn
  // mode; block is reserved for explicit editorial workflows.
  strictReleaseGateMode?: "warn" | "block";
  // Release pipeline mode (candidate generation + semantic critic + selective surgery).
  // Default true for Story Pipeline v2.
  releaseMode?: boolean;

  // Escape hatch: route the standard path back to the old Story Pipeline v2
  // (orchestrator). The default standard path now runs the proven dev-mode
  // quality engine plus product features (memories, developments, artifact).
  useLegacyPipelineV2?: boolean;

  // Optional override for number of story candidates in release mode (1-3).
  releaseCandidateCount?: number;

  // Optional semantic critic minimum score (0-10) required for release mode.
  criticMinScore?: number;

  // Optional semantic critic model override.
  criticModel?: AIModel;

  // Optional override for chapter-level selective surgery edits (0-5). 0 disables surgery.
  maxSelectiveSurgeryEdits?: number;

  // Cost controls for story writer post-processing.
  // Defaults favor lower token usage; increase explicitly for quality experiments.
  maxRewritePasses?: 0 | 1 | 2;
  maxExpandCalls?: number;
  maxWarningPolishCalls?: number;
  maxStoryTokens?: number;

  // Prompt pipeline version. V8 enables the new two-pass blueprint flow.
  promptVersion?: StoryPromptVersion;

  // Developer Mode: bypass all enrichment (visual profiles, memories, DNA,
  // character pool, artifacts, style packs) and generate from a minimal prompt
  // for A/B prompt-quality testing. No images, no personality updates, no
  // memory inserts. Output is still persisted as a normal story so it can be
  // read in the reader.
  developerMode?: boolean;

  // Editorial content rendered by the normal reader but stored outside the
  // user-story progression system.
  contentType?: "standard" | "character_life";
  characterId?: string;
}

export interface LearningMode {
  enabled: boolean;
  subjects: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  learningObjectives: string[];
  assessmentType: "quiz" | "interactive" | "discussion";
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  ttsText?: string;
  imageUrl?: string;
  scenicImageUrl?: string;
  scenicImagePrompt?: string;
  order: number;
  imagePrompt?: string;
  imageSeed?: number;
  imageModel?: string;
}

export interface Story {
  id: string;
  userId: string;
  primaryProfileId?: string;
  participantProfileIds?: string[];
  title: string;
  description: string;
  coverImageUrl?: string;
  config: StoryConfig;
  chapters: Chapter[];
  status: "generating" | "complete" | "error";
  avatarDevelopments?: any[];
  metadata?: {
    tokensUsed?: {
      prompt: number;
      completion: number;
      total: number;
    };
    model?: string;
    processingTime?: number;
    imagesGenerated?: number;
    imageCalls?: number;
    imageCostUSD?: number;
    totalCost?: {
      text: number;
      images: number;
      total: number;
    };
    // 🎁 Artifact earned from this story
    newArtifact?: {
      name: string;
      description: string;
      type: string;
      storyEffect?: string;
      visualDescriptorKeywords?: string[];
      imageUrl?: string;
    };
    // Pending artifact from pool (unlock after reading)
    pendingArtifact?: any;
    chapterVisuals?: Record<string, {
      scenicImageUrl?: string;
      scenicImagePrompt?: string;
    }>;
  };
  // Cost tracking properties
  tokensInput?: number;
  tokensOutput?: number;
  tokensTotal?: number;
  costInputUSD?: number;
  costOutputUSD?: number;
  costTotalUSD?: number;
  costMcpUSD?: number;
  modelUsed?: string;
  // Cost tracking is now logged to files instead of DB
  createdAt: Date;
  updatedAt: Date;
}

export type StorySummary = Omit<Story, 'chapters'>;

interface McpAvatarMemory {
  id: string;
  avatarId: string;
  storyId: string;
  storyTitle: string;
  experience: string;
  emotionalImpact: "positive" | "negative" | "neutral";
  personalityChanges: Array<{ trait: string; change: number }>;
  createdAt: string;
}

type StoryAvatar = Omit<Avatar, "userId" | "isShared" | "originalAvatarId" | "createdAt" | "updatedAt"> & {
  // Optional memories field keeps compatibility with ExtendedAvatarDetails in ai-generation
  memories?: McpAvatarMemory[];
};

interface GenerateStoryRequest {
  storyId?: string;
  userId: string;
  profileId?: string;
  participantProfileIds?: string[];
  config: StoryConfig;
}

function resolveClientProvidedStoryId(storyId: string | undefined): string {
  const trimmed = storyId?.trim();
  if (!trimmed) {
    return crypto.randomUUID();
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    throw APIError.invalidArgument("storyId must be a valid UUID");
  }

  return trimmed;
}

function uniqueTrimmed(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    )
  );
}

function mergePromptBlocks(...blocks: Array<string | undefined>): string | undefined {
  const merged = blocks
    .map((block) => block?.trim())
    .filter((block): block is string => Boolean(block))
    .join("\n\n");

  return merged.length > 0 ? merged : undefined;
}

// Generates a new story based on the provided configuration.
export const generate = api<GenerateStoryRequest, Story>(
  { expose: true, method: "POST", path: "/story/generate", auth: true },
  async (req) => {
    const id = resolveClientProvidedStoryId(req.storyId);
    const now = new Date();
    const auth = getAuthData();
    const currentUserId = auth?.userID;

    if (!currentUserId) {
      throw APIError.unauthenticated("Missing authenticated user for story generation");
    }

    if (req.userId && auth?.userID && req.userId !== auth.userID) {
      throw APIError.permissionDenied("userId mismatch: request userId does not match authenticated user");
    }

    const clerkToken = auth?.clerkToken;
    if (!clerkToken) {
      throw APIError.unauthenticated("Missing Clerk token for MCP operations");
    }

    const parentalControls = await getParentalControlsForUser(currentUserId);
    const dayStartUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const todayUsage = await storyDB.queryRow<{ count: number }>`
      SELECT COUNT(*)::int AS count
      FROM stories
      WHERE user_id = ${currentUserId}
        AND created_at >= ${dayStartUtc}
    `;
    assertParentalDailyLimit({
      controls: parentalControls,
      kind: "story",
      usedToday: todayUsage?.count ?? 0,
    });

    const parentalGuidance = buildGenerationGuidanceFromControls(parentalControls);
    const requestedAiModel = req.config.aiModel;
    const requestedAiProvider: AIProvider = req.config.aiProvider === "openrouter" ? "openrouter" : "native";
    const requestedOpenRouterModel =
      requestedAiProvider === "openrouter"
        ? normalizeOpenRouterModel(req.config.openRouterModel)
        : undefined;
    const defaultAiModel: AIModel = "gemini-3-flash-preview";
    const effectiveAiModel: AIModel = requestedAiModel ?? defaultAiModel;
    if (requestedAiProvider === "openrouter" || (requestedAiModel && requestedAiModel !== defaultAiModel)) {
      console.log("[story.generate] Model override from wizard applied", {
        userId: currentUserId,
        requestedAiProvider,
        requestedAiModel,
        requestedOpenRouterModel,
        defaultAiModel,
      });
    }

    const blockedTerms = parentalControls.enabled ? parentalControls.blockedTerms : [];
    const requestedPrimaryProfileId = req.profileId ?? extractRequestedProfileId(req);
    const primaryProfileId = await resolveRequestedProfileId({
      userId: currentUserId,
      requestedProfileId: requestedPrimaryProfileId,
      fallbackName: auth?.email ?? undefined,
    });
    const primaryProfile = await getProfileForUser({
      userId: currentUserId,
      profileId: primaryProfileId,
    });
    const defaultProfile = await ensureDefaultProfileForUser(
      currentUserId,
      auth?.email ?? undefined,
    );
    const requestedParticipants = extractParticipantProfileIds(req);
    const participantProfileIds = uniqueTrimmed([
      primaryProfileId,
      ...(
        requestedParticipants.length > 0
          ? await assertProfilesBelongToUser(currentUserId, requestedParticipants)
          : []
      ),
    ]);
    const inferredAgeGroup = ageToAgeGroup(primaryProfile.age);
    const profilePrompt = buildStoryProfilePrompt(primaryProfile);
    const config: StoryConfig = {
      ...req.config,
      ageGroup: req.config.ageGroup || inferredAgeGroup || "6-8",
      aiModel: effectiveAiModel,
      aiProvider: requestedAiProvider,
      openRouterModel: requestedOpenRouterModel,
      parentalGuidance: parentalGuidance || undefined,
      // Keep parental guidance separate; it is injected via STYLE PACK block downstream.
      // Merge child-profile context into the user's prompt so generation stays child-specific.
      // In developer mode we keep the prompt minimal: no profile context injection.
      customPrompt: req.config.developerMode
        ? req.config.customPrompt
        : mergePromptBlocks(req.config.customPrompt, profilePrompt),
    };
    const mcpApiKey = mcpServerApiKey();

    console.log("[story.generate] Incoming request:", {
      storyId: id,
      userId: currentUserId,
      config: req?.config ? {
        avatarIdsCount: config.avatarIds?.length ?? 0,
        genre: config.genre,
        setting: config.setting,
        length: config.length,
        complexity: config.complexity,
        ageGroup: config.ageGroup,
        aiModel: config.aiModel ?? 'not-set',
        aiProvider: config.aiProvider ?? 'native',
        openRouterModel: config.openRouterModel,
        stylePreset: config.stylePreset,
        tone: config.tone,
        language: config.language,
        allowRhymes: config.allowRhymes ?? false,
        suspenseLevel: config.suspenseLevel ?? 1,
        humorLevel: config.humorLevel ?? 2,
        pacing: config.pacing ?? "balanced",
        pov: config.pov ?? "personale",
        hooksCount: config.hooks?.length ?? 0,
        hasTwist: config.hasTwist ?? false,
        learningMode: config.learningMode ? {
          enabled: config.learningMode.enabled,
          subjectsCount: config.learningMode.subjects?.length ?? 0,
          difficulty: config.learningMode.difficulty,
          objectivesCount: config.learningMode.learningObjectives?.length ?? 0,
          assessmentType: config.learningMode.assessmentType,
        } : undefined,
        hasParentalGuidance: Boolean(config.parentalGuidance),
      } : undefined,
    });

    await reserveStoryGenerationCapacity({
      userId: currentUserId,
      createReservation: async (tx) => {
        const reserved = await tx.queryRow`
          INSERT INTO stories (
            id, user_id, primary_profile_id, title, description, config, status, created_at, updated_at
          ) VALUES (
            ${id}, ${currentUserId}, ${primaryProfileId},
            ${config.language === "en" ? "Generating..." : config.language === "fr" ? "En cours de génération..." : config.language === "es" ? "Generando..." : config.language === "it" ? "Generazione in corso..." : config.language === "nl" ? "Wordt gegenereerd..." : config.language === "ru" ? "Генерация..." : "Wird generiert..."},
            ${config.language === "en" ? "Your story is being created..." : config.language === "fr" ? "Votre histoire est en cours de création..." : config.language === "es" ? "Tu historia está siendo creada..." : config.language === "it" ? "La tua storia è in fase di creazione..." : config.language === "nl" ? "Jouw verhaal wordt aangemaakt..." : config.language === "ru" ? "Ваша история создаётся..." : "Deine Geschichte wird erstellt..."},
            ${JSON.stringify(config)}, 'generating', ${now}, ${now}
          )
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        `;
        if (!reserved) {
          // A concurrent/duplicate request already reserved this storyId
          // (e.g. an edge/proxy retry of the same slow POST — the client
          // itself does not retry). Without this guard the second INSERT
          // raised a raw duplicate-key error that surfaced to the frontend
          // as an opaque "internal error" 500 while the first request kept
          // generating in the background. Surface a clean, recoverable
          // conflict instead so the client polls for the in-flight story
          // rather than double-generating.
          throw APIError.alreadyExists(
            "Für diese Geschichte läuft bereits eine Generierung.",
          );
        }
      },
    });

    try {
      await claimGenerationUsage({
        userId: currentUserId,
        kind: "story",
        profileId: primaryProfileId,
        contentRef: id,
        clerkToken,
      });

      await Promise.all(
        participantProfileIds.flatMap((participantProfileId) => [
          storyDB.exec`
            INSERT INTO story_participants (
              id,
              story_id,
              profile_id,
              avatar_ids,
              created_at
            )
            VALUES (
              ${crypto.randomUUID()},
              ${id},
              ${participantProfileId},
              ${JSON.stringify(config.avatarIds || [])}::jsonb,
              ${now}
            )
            ON CONFLICT (story_id, profile_id) DO UPDATE
            SET avatar_ids = EXCLUDED.avatar_ids
          `,
          storyDB.exec`
            INSERT INTO story_profile_state (
              profile_id,
              story_id,
              is_favorite,
              progress_pct,
              completion_state,
              created_at,
              updated_at
            )
            VALUES (
              ${participantProfileId},
              ${id},
              FALSE,
              0,
              'not_started',
              ${now},
              ${now}
            )
            ON CONFLICT (profile_id, story_id) DO NOTHING
          `,
        ])
      );

      console.log("[story.generate] Loading avatar details...", { count: config.avatarIds.length });
      // Fetch all avatars in a single query to avoid N+1 problem
      type AvatarRow = {
        id: string;
        user_id: string;
        profile_id: string | null;
        name: string;
        description: string | null;
        physical_traits: string;
        personality_traits: string;
        image_url: string | null;
        visual_profile: string | null;
        creation_type: "ai-generated" | "photo-upload";
        is_public: boolean;
        inventory: string | null;
        skills: string | null;
      };
      const avatarRows = await avatarDB.queryAll<AvatarRow>`
        SELECT id, user_id, profile_id, name, description, physical_traits, personality_traits, image_url, visual_profile, creation_type, is_public, inventory, skills
        FROM avatars
        WHERE id = ANY(${config.avatarIds})
      `;

      // Validate all requested avatars were found and build ordered map
      const avatarRowMap = new Map(avatarRows.map((r) => [r.id, r]));
      for (const avatarId of config.avatarIds) {
        if (!avatarRowMap.has(avatarId)) {
          throw APIError.notFound(`Avatar ${avatarId} not found`);
        }
      }

      // Authorization checks and per-avatar link lookups (sequential: each may need a DB call)
      for (const row of avatarRows) {
        if (row.user_id !== currentUserId) {
          if (!row.is_public) {
            throw APIError.permissionDenied("Avatar is not available. Copy it into your profile first.");
          }
        } else {
          const ownerProfileId = row.profile_id || defaultProfile.id;
          if (!participantProfileIds.includes(ownerProfileId)) {
            throw APIError.permissionDenied("Avatar belongs to another child profile.");
          }
        }
      }

      // Parse, upgrade traits and collect trait upgrade promises in parallel
      const traitUpgradePromises: Promise<void>[] = [];
      const avatarDetails: StoryAvatar[] = config.avatarIds
        .map((avatarId) => avatarRowMap.get(avatarId)!)
        .map((row) => {
          const physicalTraits = row.physical_traits ? JSON.parse(row.physical_traits) : {};
          const rawPersonalityTraits = row.personality_traits ? JSON.parse(row.personality_traits) : {};
          const upgradedPersonalityTraits = upgradePersonalityTraits(rawPersonalityTraits);

          if (Object.keys(upgradedPersonalityTraits).length > Object.keys(rawPersonalityTraits).length) {
            traitUpgradePromises.push(
              avatarDB.exec`
                UPDATE avatars
                SET personality_traits = ${JSON.stringify(upgradedPersonalityTraits)},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${row.id}
              `.catch((upgradeError) => {
                console.warn("[story.generate] Failed to persist upgraded traits", { avatarId: row.id, upgradeError });
              })
            );
          }

          let inventory: InventoryItem[] = [];
          let skills: Skill[] = [];

          try {
            inventory = row.inventory ? (JSON.parse(row.inventory) as InventoryItem[]) : [];
          } catch (parseInvErr) {
            console.warn("[story.generate] Failed to parse inventory JSON; defaulting to []", { avatarId: row.id, parseInvErr });
          }

          try {
            skills = row.skills ? (JSON.parse(row.skills) as Skill[]) : [];
          } catch (parseSkillsErr) {
            console.warn("[story.generate] Failed to parse skills JSON; defaulting to []", { avatarId: row.id, parseSkillsErr });
          }

          return {
            id: row.id,
            name: row.name,
            description: row.description || undefined,
            physicalTraits,
            personalityTraits: upgradedPersonalityTraits,
            imageUrl: row.image_url || undefined,
            visualProfile: row.visual_profile ? JSON.parse(row.visual_profile) : undefined,
            creationType: row.creation_type,
            isPublic: row.is_public,
            inventory,
            skills,
          };
        });

      // Fire-and-forget trait upgrades in parallel (non-blocking)
      if (traitUpgradePromises.length > 0) {
        void Promise.all(traitUpgradePromises);
      }

      console.log("[story.generate] Avatar details for story generation:", avatarDetails.map(a => ({
        name: a.name,
        hasImage: !!a.imageUrl,
        hasVisualProfile: !!a.visualProfile
      })));

      // Check if we should use the Story Pipeline v2
      const useCharacterPool = config.useCharacterPool ?? true; // Default to true
      let generatedStory: any;
      let pipelineResult: Awaited<ReturnType<StoryPipelineOrchestrator["run"]>> | undefined;

      if (config.developerMode === true) {
        console.log("[story.generate] 🧪 DEVELOPER MODE — adaptive polish cost-optimized quality path (support model for planning/judging, selected model for prose, images enabled, NO personality updates)");

        // Auto-cast: load the active character pool and pick supporting cast
        // matching this story's setting. We deliberately don't run the full
        // casting-engine (variant plan / blueprint / artifact matcher / RNG)
        // — just enough scoring to bring useful candidates into the prompt.
        const poolCharacters = await pickDevModePoolCharacters({
          setting: config.setting,
          genre: config.genre,
          ageGroup: config.ageGroup,
          userId: currentUserId,
          excludeNames: new Set(avatarDetails.map((a) => a.name.toLowerCase())),
          heroCount: avatarDetails.length,
        });

        console.log("[story.generate] 🧪 Dev mode auto-cast:", {
          poolCount: poolCharacters.length,
          names: poolCharacters.map((c) => c.name),
        });

        const devResult = await generateStoryDevMode({
          config,
          userId: currentUserId,
          storyId: id,
          avatars: avatarDetails.map((a) => ({
            id: a.id,
            name: a.name,
            description: a.description,
            imageUrl: a.imageUrl,
            visualProfile: a.visualProfile,
            physicalTraits: a.physicalTraits,
            personalityTraits: a.personalityTraits,
          })),
          poolCharacters,
          primaryProfileAge: primaryProfile.age,
        });
        await recordDevModePoolCharacterUsage({
          storyId: id,
          poolCharacters,
          selectedSupportingCast: devResult.metadata.selectedSupportingCast,
        });
        // v12 §F: visibility for the release gate. The story is still
        // persisted (so devs can inspect what went wrong) but PDF building
        // and final-image consumers must treat it as a debug candidate.
        if (devResult.metadata?.status === "quality_gate_failed" || devResult.metadata?.releaseReady === false) {
          console.warn("[story.generate] Dev-mode story returned with quality gate fail — treating as debug candidate", {
            storyId: id,
            status: devResult.metadata?.status,
            releaseReady: devResult.metadata?.releaseReady,
            qualityGateFailureReason: devResult.metadata?.qualityGateFailureReason,
            hardIssueList: devResult.metadata?.hardIssueList?.slice(0, 6),
            imagesSkippedDueToQualityGate: devResult.metadata?.imagesSkippedDueToQualityGate,
            qualityScore: devResult.metadata?.qualityScore,
          });
        }
        // Persist chapter shape with order field consumed downstream.
        generatedStory = devResult;
      } else if (config.useLegacyPipelineV2 === true && useCharacterPool) {
        console.log("[story.generate] Using legacy Story Pipeline v2 (explicit useLegacyPipelineV2 flag)...");
        const orchestrator = new StoryPipelineOrchestrator();

        pipelineResult = await orchestrator.run({
          storyId: id,
          userId: currentUserId,
          config,
          avatars: avatarDetails,
          enableVisionValidation: Boolean((config as any).enableVisionValidation),
        });

        const imageByChapter = new Map(
          pipelineResult.images.map((img) => [img.chapter, img.imageUrl])
        );
        const promptByChapter = new Map(
          pipelineResult.imageSpecs.map((spec: any) => [spec.chapter, spec.finalPromptText || ""])
        );
        const scenicImageByChapter = new Map(
          pipelineResult.images.map((img) => [img.chapter, img.scenicImageUrl])
        );
        const scenicPromptByChapter = new Map(
          pipelineResult.images.map((img) => [img.chapter, img.scenicPrompt || ""])
        );

        const chapters = pipelineResult.storyDraft.chapters.map((ch) => ({
          id: crypto.randomUUID(),
          title: (String(ch.title || "").trim() || (config.language === "en" ? `Chapter ${ch.chapter}` : config.language === "fr" ? `Chapitre ${ch.chapter}` : config.language === "es" ? `Capítulo ${ch.chapter}` : config.language === "it" ? `Capitolo ${ch.chapter}` : config.language === "nl" ? `Hoofdstuk ${ch.chapter}` : config.language === "ru" ? `Глава ${ch.chapter}` : `Kapitel ${ch.chapter}`)),
          content: ch.text,
          imageUrl: imageByChapter.get(ch.chapter),
          scenicImageUrl: scenicImageByChapter.get(ch.chapter),
          scenicImagePrompt: scenicPromptByChapter.get(ch.chapter),
          order: ch.chapter,
          imagePrompt: promptByChapter.get(ch.chapter),
          imageModel: "runware",
        }));

        const chapterVisuals = Object.fromEntries(
          chapters
            .filter((chapter) => chapter.scenicImageUrl || chapter.scenicImagePrompt)
            .map((chapter) => [
              String(chapter.order),
              {
                scenicImageUrl: chapter.scenicImageUrl,
                scenicImagePrompt: chapter.scenicImagePrompt,
              },
            ])
        );

        const tokenUsage = pipelineResult.tokenUsage
          ? {
              prompt: pipelineResult.tokenUsage.promptTokens,
              completion: pipelineResult.tokenUsage.completionTokens,
              total: pipelineResult.tokenUsage.totalTokens,
              inputCostUSD: pipelineResult.tokenUsage.inputCostUSD,
              outputCostUSD: pipelineResult.tokenUsage.outputCostUSD,
              totalCostUSD: pipelineResult.tokenUsage.totalCostUSD,
              modelUsed: pipelineResult.tokenUsage.model || config.aiModel || GEMINI_MAIN_STORY_MODEL,
            }
          : { prompt: 0, completion: 0, total: 0 };

        const pendingArtifact = pipelineResult.artifactMeta
          ? {
              id: pipelineResult.artifactMeta.id,
              name: config.language === "de" ? pipelineResult.artifactMeta.name.de : pipelineResult.artifactMeta.name.en,
              nameEn: pipelineResult.artifactMeta.name.en,
              description: config.language === "de" ? pipelineResult.artifactMeta.description.de : pipelineResult.artifactMeta.description.en,
              category: pipelineResult.artifactMeta.category,
              rarity: pipelineResult.artifactMeta.rarity,
              storyRole: pipelineResult.artifactMeta.storyRole,
              visualKeywords: pipelineResult.artifactMeta.visualKeywords,
              imageUrl: await buildArtifactImageUrlForClient(
                pipelineResult.artifactMeta.id,
                pipelineResult.artifactMeta.imageUrl
              ),
              discoveryChapter: 2,
              usageChapter: 4,
              locked: true,
            }
          : undefined;

        const characterPoolUsed = pipelineResult.castSet.poolCharacters.map((character) => ({
          characterId: character.characterId,
          characterName: character.displayName,
        }));

        const coverImageUrl = pipelineResult.coverImage?.imageUrl || imageByChapter.get(1);
        generatedStory = {
          title: pipelineResult.storyDraft.title,
          description: pipelineResult.storyDraft.description,
          coverImageUrl,
          chapters,
          avatarDevelopments: [],
          pendingArtifact,
          metadata: {
            tokensUsed: tokenUsage,
            model: tokenUsage.modelUsed,
            imagesGenerated:
              pipelineResult.images.filter((img) => img.imageUrl).length +
              pipelineResult.images.filter((img) => img.scenicImageUrl).length +
              (pipelineResult.coverImage?.imageUrl ? 1 : 0),
            characterPoolUsed,
            chapterVisuals,
            quality: pipelineResult.criticReport
              ? {
                  criticScore: pipelineResult.criticReport.overallScore,
                  criticSummary: pipelineResult.criticReport.summary,
                  releaseReady: pipelineResult.criticReport.releaseReady,
                }
              : undefined,
            releasePipeline: pipelineResult.releaseReport,
            costBreakdown: pipelineResult.costEntries?.length
              ? summarizeStoryCostEntries(pipelineResult.costEntries, {
                  selectedCandidateTag: pipelineResult.releaseReport?.selectedCandidateIndex
                    ? `cand-${pipelineResult.releaseReport.selectedCandidateIndex}`
                    : undefined,
                })
              : undefined,
          },
        };
      } else if (!useCharacterPool) {
        console.log("[story.generate] Using legacy story generation (no character pool)...");
        // Generate story content using AI with avatar canonical appearance
        console.log("[story.generate] Calling generateStoryContent with MCP context...");
        generatedStory = await generateStoryContent({
          config,
          avatarDetails,
          clerkToken,
        });
      } else {
        // DEFAULT standard path: dev-mode quality engine (screenplay-first)
        // as prose/image core + product features (memory continuity in the
        // prompt, AI avatar developments, artifact red thread + unlock flow).
        console.log("[story.generate] Using standard quality pipeline (dev-mode engine + product features)...");
        generatedStory = await generateStoryStandardMode({
          config,
          userId: currentUserId,
          storyId: id,
          avatars: avatarDetails.map((a) => ({
            id: a.id,
            name: a.name,
            description: a.description,
            imageUrl: a.imageUrl,
            visualProfile: a.visualProfile,
            physicalTraits: a.physicalTraits,
            personalityTraits: a.personalityTraits,
          })),
          primaryProfileAge: primaryProfile.age,
        });
      }

      console.log("[story.generate] Story content generated:", {
        title: generatedStory?.title,
        descLen: generatedStory?.description?.length,
        chapters: generatedStory?.chapters?.length,
        coverImageUrlLen: generatedStory?.coverImageUrl?.length,
        devCount: generatedStory?.avatarDevelopments?.length ?? 0,
        tokens: generatedStory?.metadata?.tokensUsed,
      });

      const developmentAvatars = avatarDetails.map(({ id: avatarId, name }) => ({
        id: avatarId,
        name,
      }));
      let validatedDevelopments = assignAvatarDevelopmentIds(
        generatedStory.avatarDevelopments ?? [],
        developmentAvatars,
      );
      if (!config.developerMode) {
        try {
          const validation = await validateAvatarDevelopments(
            validatedDevelopments,
            mcpApiKey
          ) as AvatarDevelopmentValidationResult;
          if (validation?.isValid === false) {
            throw new Error(`Avatar developments invalid: ${JSON.stringify(validation.errors ?? {})}`);
          }
          if (Array.isArray(validation?.normalized)) {
            // Re-attach story-specific trait descriptions that the external
            // normalizer may strip — the WHY of each change must survive.
            const originalDescriptions = new Map<string, string>();
            for (const dev of validatedDevelopments) {
              for (const traitChange of (Array.isArray(dev?.changedTraits) ? dev.changedTraits : [])) {
                if (typeof traitChange?.description === "string" && traitChange.description.trim()) {
                  originalDescriptions.set(
                    `${String(dev?.avatarId || dev?.name || "").toLowerCase()}|${traitChange.trait}`,
                    traitChange.description,
                  );
                }
              }
            }
            validatedDevelopments = (validation.normalized as typeof validatedDevelopments).map((dev: any) => ({
              ...dev,
              changedTraits: Array.isArray(dev?.changedTraits)
                ? dev.changedTraits.map((traitChange: any) => ({
                    ...traitChange,
                    description: traitChange?.description
                      || originalDescriptions.get(
                        `${String(dev?.avatarId || dev?.name || "").toLowerCase()}|${traitChange?.trait}`,
                      ),
                  }))
                : dev?.changedTraits,
            }));
          }
        } catch (validationError) {
          console.warn("[story.generate] Avatar development validation warning:", validationError);
        }
      }
      validatedDevelopments = assignAvatarDevelopmentIds(
        validatedDevelopments,
        developmentAvatars,
      );

      let parentalFilterReplacements = 0;
      if (blockedTerms.length > 0) {
        const sanitizedTitle = sanitizeTextWithBlockedTerms(generatedStory.title ?? "", blockedTerms);
        const sanitizedDescription = sanitizeTextWithBlockedTerms(generatedStory.description ?? "", blockedTerms);
        parentalFilterReplacements += sanitizedTitle.replacements + sanitizedDescription.replacements;

        generatedStory = {
          ...generatedStory,
          title: sanitizedTitle.text,
          description: sanitizedDescription.text,
          chapters: Array.isArray(generatedStory.chapters)
            ? generatedStory.chapters.map((chapter: any) => {
                const chapterTitle = sanitizeTextWithBlockedTerms(chapter?.title ?? "", blockedTerms);
                const chapterContent = sanitizeTextWithBlockedTerms(chapter?.content ?? "", blockedTerms);
                parentalFilterReplacements += chapterTitle.replacements + chapterContent.replacements;
                return {
                  ...chapter,
                  title: chapterTitle.text,
                  content: chapterContent.text,
                };
              })
            : generatedStory.chapters,
        };
      }

      // Extract cost data from pipeline metadata. Stage-based pipelines
      // (developer mode AND the standard quality path) expose one token/cost
      // row per quality stage; the legacy orchestrator keeps its own ledger.
      const metadataUsage = generatedStory.metadata?.tokensUsed;
      const devModeStages = Array.isArray(generatedStory.metadata?.devModeStages)
        ? generatedStory.metadata.devModeStages
        : [];
      const stagePipelinePhase = config.developerMode === true ? "dev-mode-generation" : "standard-mode-generation";
      const devModeCostEntries = devModeStages.length > 0
        ? devModeStages
            .map((stage: any) => {
              const usage = stage?.usage;
              if (!usage) return null;
              const model = stage?.modelUsed || metadataUsage?.modelUsed || config.aiModel || GEMINI_MAIN_STORY_MODEL;
              return buildLlmCostEntry({
                phase: stagePipelinePhase,
                step: String(stage?.stage || "unknown-stage"),
                usage: {
                  promptTokens: Number(usage.prompt || 0),
                  completionTokens: Number(usage.completion || 0),
                  totalTokens: Number(usage.total || 0),
                  model,
                },
                fallbackModel: model,
                success: true,
                metadata: {
                  durationMs: stage?.durationMs,
                  score: stage?.score,
                  pipeline: generatedStory.metadata?.generationMode
                    || generatedStory.metadata?.devModePipeline
                    || "adaptive-polish-cost-optimized",
                  modelRole: stage?.modelRole,
                },
              });
            })
            .filter(Boolean)
        : [];
      const reportedImageCount = generatedStory.metadata?.imagesGenerated;
      const reportedImagesGenerated = normalizeGeneratedImageCount(reportedImageCount);
      const reportedImageCalls = normalizeGeneratedImageCount(generatedStory.metadata?.imageCalls);
      const devModeImageCalls = devModeStages.length > 0
        ? (reportedImageCalls ?? reportedImagesGenerated ?? 0)
        : 0;
      const measuredImageCostUSD = Number(generatedStory.metadata?.imageCostUSD || 0);
      const billedImageCostUSD = measuredImageCostUSD > 0
        ? measuredImageCostUSD
        : Number((devModeImageCalls * DEV_MODE_IMAGE_COST_USD).toFixed(6));
      const devModeImageCostEntries = devModeImageCalls > 0 || measuredImageCostUSD > 0
        ? [buildImageCostEntry({
            phase: stagePipelinePhase,
            step: "runware-images",
            provider: "runware",
            model: DEV_MODE_IMAGE_MODEL,
            success: (reportedImagesGenerated ?? 0) > 0,
            itemCount: devModeImageCalls,
            providerCostUSD: billedImageCostUSD,
            metadata: {
              estimated: measuredImageCostUSD <= 0,
              unitCostUSD: measuredImageCostUSD > 0 ? undefined : DEV_MODE_IMAGE_COST_USD,
              source: measuredImageCostUSD > 0 ? "runware-response" : "dev-mode-image-count-fallback",
            },
          })]
        : [];
      const residualModel =
        generatedStory.metadata?.supportModel
        || metadataUsage?.modelUsed
        || config.aiModel
        || GEMINI_MAIN_STORY_MODEL;
      const devModeResidualUsage = devModeCostEntries.length > 0
        ? calculateGenerationUsageResidual({
            metadataUsage,
            trackedEntries: devModeCostEntries as any[],
            residualModel,
          })
        : null;
      const devModeResidualCostEntry = devModeResidualUsage
        ? buildLlmCostEntry({
            phase: stagePipelinePhase,
            step: "image-prompt-and-vision-qa",
            usage: devModeResidualUsage,
            fallbackModel: residualModel,
            success: true,
            metadata: {
              source: "metadata-minus-dev-mode-stages",
              pipeline: generatedStory.metadata?.generationMode
                || generatedStory.metadata?.devModePipeline
                || "adaptive-polish-cost-optimized",
            },
          })
        : null;

      const fallbackUsage = pipelineResult?.tokenUsage
        ? pipelineResult.tokenUsage
        : metadataUsage
          ? {
              promptTokens: metadataUsage.prompt || 0,
              completionTokens: metadataUsage.completion || 0,
              totalTokens: metadataUsage.total || 0,
              model: metadataUsage.modelUsed || config.aiModel || GEMINI_MAIN_STORY_MODEL,
            }
          : undefined;
      const fallbackCostEntries = devModeCostEntries.length > 0
        ? [...devModeCostEntries, ...(devModeResidualCostEntry ? [devModeResidualCostEntry] : [])]
        : fallbackUsage
        ? [
            buildLlmCostEntry({
              phase: "story-generation",
              step: "legacy-total",
              usage: fallbackUsage,
              fallbackModel: fallbackUsage.model || config.aiModel || GEMINI_MAIN_STORY_MODEL,
            }),
          ].filter(Boolean)
        : [];
      const storyCostEntries = pipelineResult?.costEntries?.length
        ? pipelineResult.costEntries
        : [...fallbackCostEntries, ...devModeImageCostEntries];
      const selectedCandidateTag = pipelineResult?.releaseReport?.selectedCandidateIndex
        ? `cand-${pipelineResult.releaseReport.selectedCandidateIndex}`
        : undefined;
      const costSummary = summarizeStoryCostEntries((storyCostEntries.filter(Boolean) as any[]), {
        selectedCandidateTag,
      });
      const hasImageLedgerEntries = (storyCostEntries as any[]).some((entry: any) => entry?.kind === "image");
      const adminImageCalls = resolveAdminImageCallCount({
        reportedImageCalls,
        ledgerImageCalls: costSummary.totals.images.calls,
        ledgerImageSuccessCount: costSummary.totals.images.successCount,
        reportedImagesGenerated,
        hasImageLedgerEntries,
      });

      const tokensUsed = generatedStory.metadata?.tokensUsed || { prompt: 0, completion: 0, total: 0 };
      const inputCost = costSummary.totals.llm.inputCostUSD || 0;
      const outputCost = costSummary.totals.llm.outputCostUSD || 0;
      const totalCost = costSummary.totals.overall.trackedCostUSD || 0;
      const modelUsed = (generatedStory.metadata?.tokensUsed as any)?.modelUsed || config.aiModel || GEMINI_MAIN_STORY_MODEL;
      const mcpCost = 0; // TODO: Track MCP costs separately

      console.log("[story.generate] Cost tracking:", {
        model: modelUsed,
        tokens: costSummary.totals.llm,
        inputCost: `$${inputCost.toFixed(6)}`,
        outputCost: `$${outputCost.toFixed(6)}`,
        totalCost: `$${totalCost.toFixed(6)}`,
      });

      // Write cost data to log file
      await publishWithTimeout(logTopic, {
        source: "story-generation-costs" as any, // Custom log source for cost tracking
        timestamp: new Date(),
        request: {
          storyId: id,
          userId: currentUserId,
          model: modelUsed,
        },
        response: {
          title: generatedStory.title,
          summary: costSummary.summary,
          sections: costSummary.sections,
          tokens: {
            input: costSummary.totals.llm.inputTokens || tokensUsed.prompt || 0,
            cached_input: (costSummary.totals.llm as any).cachedInputTokens || 0,
            output: costSummary.totals.llm.outputTokens || tokensUsed.completion || 0,
            total: costSummary.totals.llm.totalTokens || tokensUsed.total || 0,
          },
          costs: {
            cached_input_usd: (costSummary.totals.llm as any).cachedInputCostUSD || 0,
            input_usd: inputCost,
            output_usd: outputCost,
            total_usd: totalCost,
            llm_total_usd: costSummary.totals.llm.totalCostUSD || 0,
            image_total_usd: costSummary.totals.images.providerCostUSD || 0,
            image_total_credits: costSummary.totals.images.providerCostCredits || 0,
            mcp_usd: mcpCost,
          },
          totals: costSummary.totals,
          breakdown: costSummary.breakdown,
          debug: costSummary.debug,
        },
      });

      const persistedStages = Array.isArray(generatedStory.metadata?.devModeStages)
        ? generatedStory.metadata.devModeStages
        : [];
      const pipelineDurationMs = persistedStages.reduce(
        (sum: number, stage: any) => sum + Math.max(0, Number(stage?.durationMs || 0)),
        0,
      );
      const toAdminMetricRows = (rows: any[] = []) => rows.map((row: any) => ({
        key: String(row?.key || "unknown"),
        calls: Number(row?.calls || 0),
        inputTokens: Number(row?.inputTokens || 0),
        outputTokens: Number(row?.outputTokens || 0),
        totalTokens: Number(row?.totalTokens || 0),
        totalCostUSD: Number(((row?.totalCostUSD || 0) + (row?.providerCostUSD || 0)).toFixed(6)),
      }));
      const adminGenerationMetrics = {
        version: 1 as const,
        currency: "USD" as const,
        calculatedAt: new Date().toISOString(),
        tokens: {
          input: costSummary.totals.llm.inputTokens || tokensUsed.prompt || 0,
          cachedInput: costSummary.totals.llm.cachedInputTokens || 0,
          output: costSummary.totals.llm.outputTokens || tokensUsed.completion || 0,
          total: costSummary.totals.llm.totalTokens || tokensUsed.total || 0,
        },
        costs: {
          cachedInputUSD: costSummary.totals.llm.cachedInputCostUSD || 0,
          inputUSD: inputCost,
          outputUSD: outputCost,
          storyUSD: costSummary.totals.llm.totalCostUSD || 0,
          imagesUSD: costSummary.totals.images.providerCostUSD || 0,
          totalUSD: totalCost,
          imageCredits: costSummary.totals.images.providerCostCredits || 0,
        },
        calls: {
          llm: costSummary.totals.llm.calls || 0,
          images: adminImageCalls,
        },
        durationMs: pipelineDurationMs,
        imageCostEstimated: (storyCostEntries as any[]).some(
          (entry: any) => entry?.kind === "image" && entry?.metadata?.estimated === true,
        ),
        stages: toAdminMetricRows(costSummary.breakdown.byStep),
        models: toAdminMetricRows(costSummary.breakdown.byModel),
      };
      // 🎁 Add artifact metadata so it's persisted and returned to frontend
      const enrichedMetadata = {
        ...generatedStory.metadata,
        processingTime: generatedStory.metadata?.processingTime || pipelineDurationMs,
        totalCost: {
          text: adminGenerationMetrics.costs.storyUSD,
          images: adminGenerationMetrics.costs.imagesUSD,
          total: adminGenerationMetrics.costs.totalUSD,
        },
        adminGenerationMetrics,
        newArtifact: generatedStory.newArtifact || undefined,
        pendingArtifact: generatedStory.pendingArtifact || undefined,
        parentalFilters:
          parentalFilterReplacements > 0
            ? {
                active: true,
                replacements: parentalFilterReplacements,
              }
            : undefined,
      };
      
      console.log("[story.generate] 🎁 artifact in response:", {
        hasNewArtifact: !!generatedStory.newArtifact,
        newArtifactName: generatedStory.newArtifact?.name || 'none',
        hasPendingArtifact: !!generatedStory.pendingArtifact,
        pendingArtifactName: generatedStory.pendingArtifact?.name || 'none',
      });

      // Update story with generated content
      console.log("[story.generate] Persisting story header into DB...");
      await storyDB.exec`
        UPDATE stories
        SET title = ${generatedStory.title},
            description = ${generatedStory.description},
            cover_image_url = ${generatedStory.coverImageUrl},
            avatar_developments = ${JSON.stringify(validatedDevelopments || [])},
            metadata = ${JSON.stringify(enrichedMetadata)},
            status = 'complete',
            updated_at = ${new Date()}
        WHERE id = ${id}
      `;

      // Insert chapters
      console.log("[story.generate] Inserting chapters...", { count: generatedStory.chapters.length });
      const insertedChapters: Array<{ id: string; title: string; content: string; order: number }> = [];
      for (const chapter of generatedStory.chapters) {
        const chapterId = crypto.randomUUID();
        console.log("[story.generate] Insert chapter:", {
          id: chapterId,
          title: chapter?.title,
          titleLen: chapter?.title?.length,
          contentLen: chapter?.content?.length,
          imageUrlLen: chapter?.imageUrl?.length,
          order: chapter?.order,
        });
        await storyDB.exec`
          INSERT INTO chapters (
            id, story_id, title, content, image_url, chapter_order, created_at
          ) VALUES (
            ${chapterId}, ${id}, ${chapter.title}, ${chapter.content},
            ${chapter.imageUrl}, ${chapter.order}, ${now}
          )
        `;
        insertedChapters.push({
          id: chapterId,
          title: chapter.title,
          content: chapter.content,
          order: chapter.order,
        });
      }

      // TTS Enrichment Phase: Annotate chapter text with xAI TTS expression tags.
      // Skipped in developer mode (we want a clean A/B without extra LLM calls).
      if (!config.developerMode) {
        // Runs in background — does not block story completion
        enrichStoryForTTS({
          storyId: id,
          chapters: insertedChapters,
          aiModel: config.aiModel,
        }).catch((error) => {
          console.error(`[story.generate] TTS enrichment failed (non-blocking): ${error instanceof Error ? error.message : String(error)}`);
        });
      } else {
        console.log("[story.generate] 🧪 Developer mode — skipping TTS enrichment.");
      }

      // Generation only prepares and stores proposed avatar developments.
      // Progression is awarded after the reader explicitly completes the story
      // via /story/mark-read; generating or previewing content never mutates an avatar.
      console.log("[story.generate] Avatar progression deferred until story completion", {
        storyId: id,
        developmentCount: validatedDevelopments.length,
      });

      // Return the complete story
      console.log("[story.generate] Loading full story payload to return...");
      const story = await getCompleteStory(id);
      console.log("[story.generate] Done. Returning story:", {
        id: story.id,
        title: story.title,
        chapters: story.chapters?.length,
        status: story.status,
      });

      return story;

    } catch (error) {
      // Update story status to error
      console.error("[story.generate] ERROR:", error);
      const errorMessage = String((error as any)?.message || error);
      const errorStack = (error as any)?.stack ? String((error as any).stack).slice(0, 2000) : undefined;
      const errorMetadata = {
        error: {
          message: errorMessage,
          stack: errorStack,
          storyId: id,
          at: new Date().toISOString(),
        },
      };
      await storyDB.exec`
        UPDATE stories
        SET status = 'error',
            metadata = ${JSON.stringify(errorMetadata)},
            updated_at = ${new Date()}
        WHERE id = ${id}
      `;
      try {
        await updateStoryInstanceStatus(id, "error", String((error as any)?.message || error));
      } catch (pipelineStatusError) {
        console.warn("[story.generate] Failed to update story_instances status:", pipelineStatusError);
      }
      try {
        await publishWithTimeout(logTopic, {
          source: 'openai-story-generation',
          timestamp: new Date(),
          request: { storyId: id, userId: currentUserId, config },
          response: { error: String((error as any)?.message || error), stack: (error as any)?.stack?.slice(0, 2000) }
        });
      } catch (e) {
        console.warn("[story.generate] Failed to publish error log:", e);
      }

      if (error instanceof APIError) {
        throw error;
      }
      if (errorMessage.startsWith("Story quality gates failed:")) {
        const failedCodes = errorMessage.replace("Story quality gates failed:", "").trim();
        throw APIError.failedPrecondition(
          `Die Geschichte wurde nicht veroeffentlicht, weil die Qualitaetspruefung fehlgeschlagen ist. Bitte erneut generieren. Codes: ${failedCodes}`
        );
      }
      throw APIError.internal(`Story generation failed (storyId=${id}): ${errorMessage}`);
    }
  }
);

async function getCompleteStory(storyId: string): Promise<Story> {
  const storyRow = await storyDB.queryRow<{
    id: string;
    user_id: string;
    primary_profile_id: string | null;
    title: string;
    description: string;
    cover_image_url: string | null;
    config: string;
    avatar_developments: string | null;
    metadata: string | null;
    status: "generating" | "complete" | "error";
    tokens_input: number | null;
    tokens_output: number | null;
    tokens_total: number | null;
    cost_input_usd: number | null;
    cost_output_usd: number | null;
    cost_total_usd: number | null;
    cost_mcp_usd: number | null;
    model_used: string | null;
    created_at: Date;
    updated_at: Date;
  }>`
    SELECT * FROM stories WHERE id = ${storyId}
  `;

  if (!storyRow) {
    throw new Error("Story not found");
  }

  const chapterRows = await storyDB.queryAll<{
    id: string;
    title: string;
    content: string;
    image_url: string | null;
    chapter_order: number;
  }>`
    SELECT id, title, content, image_url, chapter_order 
    FROM chapters 
    WHERE story_id = ${storyId} 
    ORDER BY chapter_order
  `;

  const participantRows = await storyDB.queryAll<{ profile_id: string }>`
    SELECT profile_id
    FROM story_participants
    WHERE story_id = ${storyId}
    ORDER BY created_at ASC
  `;

  const parsedMetadata = parseJsonObject(storyRow.metadata);
  const chapterVisuals = (parsedMetadata?.chapterVisuals && typeof parsedMetadata.chapterVisuals === "object")
    ? parsedMetadata.chapterVisuals as Record<string, { scenicImageUrl?: string; scenicImagePrompt?: string }>
    : {};
  const coverImageUrl = await resolveImageUrlForClient(storyRow.cover_image_url || undefined);
  const chapters = await Promise.all(chapterRows.map(async (ch) => {
    const scenicRawUrl = chapterVisuals[String(ch.chapter_order)]?.scenicImageUrl || undefined;
    const scenicResolvedUrl = scenicRawUrl ? await resolveImageUrlForClient(scenicRawUrl) : undefined;
    return {
      id: ch.id,
      title: (String(ch.title || "").trim() || `Kapitel ${ch.chapter_order}`),
      content: ch.content,
      imageUrl: await buildStoryChapterImageUrlForClient(storyId, ch.chapter_order, ch.image_url || undefined),
      scenicImageUrl: scenicResolvedUrl || scenicRawUrl,
      scenicImagePrompt: chapterVisuals[String(ch.chapter_order)]?.scenicImagePrompt || undefined,
      order: ch.chapter_order,
    };
  }));

  return {
    id: storyRow.id,
    userId: storyRow.user_id,
    primaryProfileId: storyRow.primary_profile_id || undefined,
    participantProfileIds: participantRows.map((row) => row.profile_id),
    title: storyRow.title,
    description: storyRow.description,
    coverImageUrl,
    config: JSON.parse(storyRow.config),
    avatarDevelopments: storyRow.avatar_developments ? JSON.parse(storyRow.avatar_developments) : undefined,
    metadata: parsedMetadata || undefined,
    chapters,
    status: storyRow.status,
    tokensInput: storyRow.tokens_input || undefined,
    tokensOutput: storyRow.tokens_output || undefined,
    tokensTotal: storyRow.tokens_total || undefined,
    costInputUSD: storyRow.cost_input_usd || undefined,
    costOutputUSD: storyRow.cost_output_usd || undefined,
    costTotalUSD: storyRow.cost_total_usd || undefined,
    costMcpUSD: storyRow.cost_mcp_usd || undefined,
    modelUsed: storyRow.model_used || undefined,
    createdAt: storyRow.created_at,
    updatedAt: storyRow.updated_at,
  };
}

function parseJsonObject(value: string | null): any {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}






