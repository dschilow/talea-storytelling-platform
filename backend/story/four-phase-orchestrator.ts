// Four-Phase Story Generation Orchestrator
// Coordinates all 4 phases: Skeleton -> Matching -> Finalization -> Images

import type { StoryConfig, Chapter } from "./generate";
import { Phase1SkeletonGenerator } from "./phase1-skeleton";
import type { Phase1GenerationResult } from "./phase1-skeleton";
import { Phase2CharacterMatcher } from "./phase2-matcher";
import { Phase3StoryFinalizer } from "./phase3-finalizer";
import type { Phase3FinalizationResult } from "./phase3-finalizer";
import { FairyTaleSelector } from "./fairy-tale-selector";
import type { SelectedFairyTale } from "./fairy-tale-selector";
import { ai } from "~encore/clients";
import { storyDB } from "./db";
import type { StorySkeleton, CharacterTemplate, FinalizedStory, ArtifactTemplate, PendingArtifact } from "./types";
import { artifactMatcher, recordStoryArtifact } from "./artifact-matcher";
import { logTopic } from "../log/logger";
import type { LogEvent } from "../log/logger";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import {
  applyStoryExperienceToConfig,
  buildStoryExperienceContext,
  describeEmotionalFlavors,
  describeSpecialIngredients,
} from "./story-experience";
import type { StoryExperienceContext } from "./story-experience";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { InventoryItem } from "../avatar/avatar";
import { generateArtifactImage } from "./artifact-image-generator";
import type { NewArtifact } from "./types";
import { addArtifactToInventoryInternal } from "../gamification/item-system";
// NEW v2.0: Character Invariants for image consistency
import { extractInvariantsFromDescription } from "./character-invariants";
// OPTIMIZATION v3.0: Image Consistency System
import {
  createDeterministicSeed,
  smartClampPrompt,
} from "./image-consistency-system";

interface AvatarDetail {
  id: string;
  name: string;
  description?: string;
  physicalTraits?: any;
  personalityTraits?: any;
  imageUrl?: string;
  visualProfile?: any;
  creationType: "ai-generated" | "photo-upload";
  inventory?: InventoryItem[];  // ­ƒÄü NEW: Avatar's existing artifacts
}

interface FourPhaseInput {
  config: StoryConfig;
  avatarDetails: AvatarDetail[];
  userId: string;
  clerkToken: string;
  storyId: string; // ­ƒÄü NEW: Required for artifact source tracking
}

interface StoryExperienceSummary {
  soul: {
    key: string;
    label: string;
    description: string;
    storyPromise: string;
    recommendedStylePreset: string;
    recommendedTone: string;
    defaultSuspense: number;
    defaultHumor: number;
    defaultPacing: string;
    allowRhymes: boolean;
  } | null;
  emotionalFlavors: Array<{
    key: string;
    label: string;
    description: string;
    effect: string;
  }>;
  tempo: {
    key: string;
    label: string;
    description: string;
    pacing: string;
  } | null;
  specialIngredients: Array<{
    key: string;
    label: string;
    description: string;
    hookHint?: string;
    forcesTwist: boolean;
    emphasis?: string;
  }>;
  descriptions: {
    emotionalFlavors: string;
    specialIngredients: string;
  };
}

interface FourPhaseOutput {
  title: string;
  description: string;
  coverImageUrl?: string;
  chapters: Chapter[];
  avatarDevelopments?: any[];
  // ­ƒÄü Loot artifact from this story (deprecated - use pendingArtifact)
  newArtifact?: NewArtifact & { imageUrl?: string };
  // ­ƒÄü NEW: Pending artifact from pool (unlocked after reading)
  pendingArtifact?: PendingArtifact;
  newlyGeneratedCharacters?: Array<{
    id: string;
    name: string;
    role: string;
    species?: string;
    gender?: string;
  }>;
  metadata?: {
    tokensUsed?: {
      prompt: number;
      completion: number;
      total: number;
      inputCostUSD?: number;
      outputCostUSD?: number;
      totalCostUSD?: number;
      modelUsed?: string;
      breakdown?: {
        phase1?: {
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
        } | null;
        phase3?: {
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
        } | null;
      };
    };
    model?: string;
    processingTime?: number;
    imagesGenerated?: number;
    totalCost?: {
      text: number;
      images: number;
      total: number;
    };
    phases?: {
      phase1Duration?: number;
      phase2Duration?: number;
      phase3Duration?: number;
      phase4Duration?: number;
    };
    characterPoolUsed?: {
      placeholder: string;
      characterId: string;
      characterName: string;
    }[];
    storyExperience?: StoryExperienceSummary;
  };
}

export class FourPhaseOrchestrator {
  private phase1Generator: Phase1SkeletonGenerator;
  private phase2Matcher: Phase2CharacterMatcher;
  private phase3Finalizer: Phase3StoryFinalizer;
  private fairyTaleSelector: FairyTaleSelector;

  constructor() {
    this.phase1Generator = new Phase1SkeletonGenerator();
    this.phase2Matcher = new Phase2CharacterMatcher();
    this.phase3Finalizer = new Phase3StoryFinalizer();
    this.fairyTaleSelector = new FairyTaleSelector();
  }

  private async logPhaseEvent(
    source: LogEvent["source"],
    request: any,
    response: any,
    metadata?: any
  ): Promise<void> {
    await publishWithTimeout(logTopic, {
      source,
      timestamp: new Date(),
      request,
      response,
      metadata,
    });
  }

  async orchestrate(input: FourPhaseInput): Promise<FourPhaseOutput> {
    console.log("[4-Phase] Starting orchestration...");
    const startTime = Date.now();

    const phaseDurations = {
      phase1Duration: 0,
      phase2Duration: 0,
      phase3Duration: 0,
      phase4Duration: 0,
    };

    const configWithExperience: StoryConfig = applyStoryExperienceToConfig({ ...input.config });
    const experienceContext = buildStoryExperienceContext(configWithExperience);
    console.log("[4-Phase] Story experience applied:", {
      soul: experienceContext.soul?.label ?? "none",
      flavors: experienceContext.emotionalFlavors.map(f => f.label),
      tempo: experienceContext.tempo?.label ?? "default",
      specialIngredients: experienceContext.specialIngredients.map(i => i.label),
    });

    // ===== PHASE 0: Fairy Tale Pre-Selection (NEW) =====
    let selectedFairyTale: SelectedFairyTale | null = null;

    // ­ƒöº OPTIMIZATION 1: Auto-activate fairy tale template for fairy tale genres (robust i18n)
    const normalizeGenreString = (value?: string) =>
      (value ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[-_\s]/g, "");

    const normalizedGenre = normalizeGenreString(input.config.genre);
    const normalizedSetting = normalizeGenreString(input.config.setting);
    const isFairyTaleGenre =
      normalizedGenre.includes("maerchen") ||
      normalizedGenre.includes("marchen") ||
      normalizedGenre.includes("fairytale") ||
      normalizedGenre.includes("fairytales") ||
      normalizedGenre.includes("fairy") ||
      normalizedGenre.includes("magic") ||
      normalizedSetting.includes("fairy") ||
      normalizedSetting.includes("maerchen") ||
      normalizedSetting.includes("marchen");

    const userRequestedFairyTaleTemplate = input.config.preferences?.useFairyTaleTemplate ?? false;
    const experienceRequestedFairyTaleTemplate = configWithExperience.preferences?.useFairyTaleTemplate ?? false;

    const useFairyTaleTemplate =
      userRequestedFairyTaleTemplate ||
      experienceRequestedFairyTaleTemplate ||
      isFairyTaleGenre;

    // If user wants fairy tales but genre is not canonical, normalize to a stable backend value
    const genreLooksFairy =
      normalizedGenre.includes("fairy") ||
      normalizedGenre.includes("maerchen") ||
      normalizedGenre.includes("marchen");
    if (useFairyTaleTemplate && !genreLooksFairy) {
      configWithExperience.genre = "fairytale";
      input.config.genre = input.config.genre || "fairytale";
      console.log(`[4-Phase] Normalized genre to "fairytale" because fairy-tale template is active (original: "${normalizedGenre}")`);
    }

    // Propagate the resolved preference so every phase sees the same flag
    configWithExperience.preferences = {
      ...(configWithExperience.preferences ?? {}),
      useFairyTaleTemplate,
    };
    input.config.preferences = {
      ...(input.config.preferences ?? {}),
      useFairyTaleTemplate,
    };

    console.log("[4-Phase] Fairy tale intent:", {
      requestedByUser: userRequestedFairyTaleTemplate,
      requestedByExperience: experienceRequestedFairyTaleTemplate,
      detectedFromGenre: isFairyTaleGenre,
      resolved: useFairyTaleTemplate,
      genre: configWithExperience.genre,
      setting: configWithExperience.setting,
    });

    if (isFairyTaleGenre && !userRequestedFairyTaleTemplate) {
      console.log(`[4-Phase] ­ƒÄ¡ AUTO-ACTIVATED Fairy Tale Template for genre: "${input.config.genre}"`);
    }

    if (useFairyTaleTemplate) {
      console.log("[4-Phase] ===== PHASE 0: FAIRY TALE SELECTION =====");
      const phase0Start = Date.now();

      selectedFairyTale = await this.fairyTaleSelector.selectBestMatch(
        configWithExperience,
        input.avatarDetails.length
      );

      const phase0Duration = Date.now() - phase0Start;

      if (selectedFairyTale) {
        console.log(`[4-Phase] Ô£à Phase 0 completed in ${phase0Duration}ms`);
        console.log(`[4-Phase] Selected: ${selectedFairyTale.tale.title} (score: ${selectedFairyTale.matchScore})`);
        console.log(`[4-Phase] This will save ~47 seconds in Phase 1 by skipping skeleton generation`);
      } else {
        console.log(`[4-Phase] ÔÜá´©Å Phase 0 completed in ${phase0Duration}ms - No suitable fairy tale found`);
        console.log(`[4-Phase] Will proceed with standard skeleton generation`);
      }
    } else {
      console.log("[4-Phase] Fairy tale template disabled - skipping Phase 0");
    }

    // ===== PHASE 1: Generate Story Skeleton =====
    console.log("[4-Phase] ===== PHASE 1: SKELETON GENERATION =====");
    const phase1Start = Date.now();

    const phase1Result: Phase1GenerationResult = await this.phase1Generator.generate({
      config: configWithExperience,
      experience: experienceContext,
      avatarDetails: input.avatarDetails.map(a => ({
        name: a.name,
        description: a.description,
      })),
      selectedFairyTale, // NEW: Pass to Phase1 to signal skip
    });
    const skeleton = phase1Result.skeleton;
    phaseDurations.phase1Duration = Date.now() - phase1Start;
    console.log(`[4-Phase] Phase 1 completed in ${phaseDurations.phase1Duration}ms`);

    const phase1RequestPayload = {
      phase: 1,
      label: "PHASE 1: Story-Skeleton (Struktur)",
      config: {
        genre: configWithExperience.genre,
        setting: configWithExperience.setting,
        ageGroup: configWithExperience.ageGroup,
        complexity: configWithExperience.complexity,
        length: configWithExperience.length,
        aiModel: configWithExperience.aiModel || "gpt-5-mini",
        stylePreset: configWithExperience.stylePreset,
        tone: configWithExperience.tone,
        pacing: configWithExperience.pacing,
        suspenseLevel: configWithExperience.suspenseLevel,
        humorLevel: configWithExperience.humorLevel,
        storySoul: configWithExperience.storySoul ?? input.config.storySoul,
        storyTempo: configWithExperience.storyTempo ?? input.config.storyTempo,
        specialIngredients: configWithExperience.specialIngredients ?? input.config.specialIngredients,
        emotionalFlavors: configWithExperience.emotionalFlavors ?? input.config.emotionalFlavors,
        hasTwist: configWithExperience.hasTwist,
        preferences: configWithExperience.preferences, // CRITICAL: Shows useFairyTaleTemplate flag
      },
      storyExperience: this.summarizeExperience(experienceContext),
      avatars: input.avatarDetails.map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
      })),
      useFairyTaleTemplateRequested: userRequestedFairyTaleTemplate,
      useFairyTaleTemplateResolved: useFairyTaleTemplate,
      openAIRequest: phase1Result.openAIRequest,
    };

    // Log skeleton with chapter summaries (not full content) to save tokens
    // Full skeleton is in phase1Result.openAIResponse.choices[0].message.content
    const phase1ResponsePayload = {
      status: "completed",
      durationMs: phaseDurations.phase1Duration,
      usage: phase1Result.usage,
      skeleton: {
        title: skeleton.title,
        chaptersCount: skeleton.chapters?.length,
        requirementsCount: skeleton.supportingCharacterRequirements?.length,
        chapters: skeleton.chapters?.map(ch => ({
          order: ch.order,
          contentPreview: ch.content.substring(0, 150) + (ch.content.length > 150 ? '...' : ''),
          words: ch.content.split(/\s+/).length
        })),
        supportingCharacters: skeleton.supportingCharacterRequirements?.map(req => ({
          placeholder: req.placeholder,
          role: req.role,
          archetype: req.archetype,
          visualHints: req.visualHints
        })),
      },
    };

    await this.logPhaseEvent("phase1-skeleton-generation", phase1RequestPayload, phase1ResponsePayload);

    // ===== PHASE 2: Match Characters from Pool =====
    console.log("[4-Phase] ===== PHASE 2: CHARACTER MATCHING =====");
    const phase2Start = Date.now();

    // Get recent stories for freshness calculation
    const recentStoryIds = await this.getRecentStoryIds(input.userId, 5);

    const avatarNames = input.avatarDetails
      .map((avatar) => avatar.name?.trim())
      .filter((name): name is string => Boolean(name));

    // CRITICAL FIX: When using fairy tale template, pass selectedFairyTale to Phase 2
    // so it can load roles from fairy_tale_roles table instead of empty skeleton
    // Also pass full avatarDetails to load visual profiles
    const characterAssignments = await this.phase2Matcher.match(
      skeleton,
      input.config.setting,
      recentStoryIds,
      avatarNames,
      useFairyTaleTemplate,
      selectedFairyTale,  // Pass fairy tale so Phase2 can load roles from DB
      input.avatarDetails  // ­ƒöº NEW: Pass full avatar details with visualProfile
    );
    phaseDurations.phase2Duration = Date.now() - phase2Start;
    console.log(`[4-Phase] Phase 2 completed in ${phaseDurations.phase2Duration}ms`);
    console.log(`[4-Phase] Matched ${characterAssignments.size} characters from pool`);

    // COLLECT NEWLY GENERATED CHARACTERS
    const newlyGeneratedCharacters: any[] = [];
    characterAssignments.forEach((char: any) => {
      if (char.isNew) {
        newlyGeneratedCharacters.push({
          id: char.id,
          name: char.name,
          role: char.role,
          species: char.visualProfile?.species || 'unknown',
          gender: char.gender || 'unknown'
        });
      }
    });

    const phase2RequestPayload = {
      phase: 2,
      label: "PHASE 2: Beste Charaktere matchen",
      setting: input.config.setting,
      requirements: skeleton.supportingCharacterRequirements?.map(req => ({
        placeholder: req.placeholder,
        role: req.role,
        archetype: req.archetype,
        emotionalNature: req.emotionalNature,
        importance: req.importance,
      })),
      recentStoryCount: recentStoryIds.length,
    };

    const phase2ResponsePayload = {
      status: "completed",
      durationMs: phaseDurations.phase2Duration,
      matchedCount: characterAssignments.size,
      assignments: Array.from(characterAssignments.entries()).map(([placeholder, char]) => ({
        placeholder,
        character: {
          id: char.id,
          name: char.name,
          role: char.role,
          archetype: char.archetype,
          emotionalNature: char.emotionalNature,
          visualProfile: {
            description: char.visualProfile.description,
            species: char.visualProfile.species,
            colorPalette: char.visualProfile.colorPalette,
          },
          usageStats: {
            totalUsageCount: char.totalUsageCount,
            recentUsageCount: char.recentUsageCount,
            lastUsedAt: char.lastUsedAt,
          },
        },
      })),
    };

    await this.logPhaseEvent("phase2-character-matching", phase2RequestPayload, phase2ResponsePayload);

    // ===== PHASE 2.5: Match Artifact from Pool =====
    console.log("[4-Phase] ===== PHASE 2.5: ARTIFACT MATCHING =====");
    const phase2_5Start = Date.now();

    let matchedArtifact: ArtifactTemplate | undefined;

    if (skeleton.artifactRequirement) {
      try {
        matchedArtifact = await artifactMatcher.match(
          skeleton.artifactRequirement,
          configWithExperience.genre || 'adventure',
          recentStoryIds,
          configWithExperience.language || 'de'
        );

        console.log("[4-Phase] ­ƒÄü Artifact matched:", {
          id: matchedArtifact.id,
          name: matchedArtifact.name.de,
          category: matchedArtifact.category,
          rarity: matchedArtifact.rarity,
          discoveryChapter: skeleton.artifactRequirement.discoveryChapter,
          usageChapter: skeleton.artifactRequirement.usageChapter,
        });

        // Record the artifact assignment to the story
        await recordStoryArtifact(
          input.storyId,
          matchedArtifact.id,
          skeleton.artifactRequirement.discoveryChapter,
          skeleton.artifactRequirement.usageChapter
        );
      } catch (error) {
        console.error("[4-Phase] Failed to match artifact:", error);
        // Continue without artifact - Phase 3 will use fallback
      }
    } else {
      console.log("[4-Phase] No artifact requirement in skeleton - skipping artifact matching");
    }

    const phase2_5Duration = Date.now() - phase2_5Start;
    console.log(`[4-Phase] Phase 2.5 completed in ${phase2_5Duration}ms`);

    // ===== PHASE 3: Finalize Story with Fairy Tale Template =====
    console.log("[4-Phase] ===== PHASE 3: FAIRY TALE IMPLEMENTATION =====");
    const phase3Start = Date.now();

    const phase3Result: Phase3FinalizationResult = await this.phase3Finalizer.finalize({
      skeleton,
      assignments: characterAssignments,
      config: configWithExperience,
      experience: experienceContext,
      avatarDetails: input.avatarDetails,
      useFairyTaleTemplate,
      remixInstructions: phase1Result.remixInstructions,
      selectedFairyTale: selectedFairyTale ?? undefined,
      matchedArtifact, // NEW: Pass matched artifact from Phase 2.5
    });
    const finalizedStory = phase3Result.story;
    phaseDurations.phase3Duration = Date.now() - phase3Start;

    if (phase3Result.fairyTaleUsed) {
      console.log(`[4-Phase] Ô£¿ Fairy tale used: ${phase3Result.fairyTaleUsed.title} (score: ${phase3Result.fairyTaleUsed.matchScore})`);
      console.log(`[4-Phase] Match reason: ${phase3Result.fairyTaleUsed.matchReason}`);
    } else {
      console.log("[4-Phase] No fairy tale used - standard story generation");
    }

    console.log(`[4-Phase] Phase 3 completed in ${phaseDurations.phase3Duration}ms`);

    const totalWords = finalizedStory.chapters?.reduce((sum, ch) => sum + ch.content.split(/\s+/).length, 0) || 0;

    const phase3RequestPayload = {
      phase: 3,
      label: "PHASE 3: M├ñrchen-basierte Story-Implementierung",
      config: {
        aiModel: configWithExperience.aiModel || "gpt-5-mini",
        ageGroup: configWithExperience.ageGroup,
        genre: configWithExperience.genre,
        stylePreset: configWithExperience.stylePreset,
        tone: configWithExperience.tone,
        pacing: configWithExperience.pacing,
        suspenseLevel: configWithExperience.suspenseLevel,
        humorLevel: configWithExperience.humorLevel,
        hasTwist: configWithExperience.hasTwist,
        hooks: configWithExperience.hooks,
        preferences: configWithExperience.preferences, // CRITICAL: Shows useFairyTaleTemplate flag
      },
      storyExperience: this.summarizeExperience(experienceContext),
      skeletonTitle: skeleton.title,
      charactersAssigned: characterAssignments.size,
      avatarsCount: input.avatarDetails.length,
      fairyTaleUsed: phase3Result.fairyTaleUsed || null,
      useFairyTaleTemplateRequested: userRequestedFairyTaleTemplate,
      useFairyTaleTemplateResolved: useFairyTaleTemplate,
      openAIRequest: phase3Result.openAIRequest,
    };

    const phase3ResponsePayload = {
      status: "completed",
      durationMs: phaseDurations.phase3Duration,
      usage: phase3Result.usage,
      story: {
        title: finalizedStory.title,
        description: finalizedStory.description,
        chaptersCount: finalizedStory.chapters?.length,
        totalWords,
        chapters: finalizedStory.chapters?.map(ch => ({
          order: ch.order,
          title: ch.title,
          wordCount: ch.content.split(/\s+/).length,
          imageDescriptionPreview: ch.imageDescription?.substring(0, 150) + "...",
        })),
      },
      openAIResponse: phase3Result.openAIResponse,
    };

    await this.logPhaseEvent("phase3-story-finalization", phase3RequestPayload, phase3ResponsePayload);

    // ===== PHASE 4: Generate Images (Parallelized) =====
    console.log("[4-Phase] ===== PHASE 4: IMAGE GENERATION (PARALLEL) =====");
    const phase4Start = Date.now();

    // ­ƒöº OPTIMIZATION: Run Cover and Chapter generation in parallel
    let chaptersWithImages: Chapter[] = [];
    let coverImageResult: { url?: string; prompt: string } | undefined = undefined;

    try {
      // Create a timeout promise for the entire image generation process (5 minutes max for all images)
      const GLOBAL_IMAGE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes for all 6 images in parallel

      const imageGenerationPromise = Promise.all([
        this.generateChapterImages(
          finalizedStory,
          input.avatarDetails,
          characterAssignments
        ),
        this.generateCoverImage(
          finalizedStory,
          input.avatarDetails,
          characterAssignments
        )
      ]);

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Image generation timeout after ${GLOBAL_IMAGE_TIMEOUT_MS}ms`)), GLOBAL_IMAGE_TIMEOUT_MS)
      );

      [chaptersWithImages, coverImageResult] = await Promise.race([
        imageGenerationPromise,
        timeoutPromise
      ]);

      console.log(`[4-Phase] Ô£à All images generated successfully`);
    } catch (imageError) {
      console.error("[4-Phase] ÔØî Image generation failed:", imageError);
      // Continue with chapters without images - story text is still valid
      chaptersWithImages = finalizedStory.chapters.map(ch => ({
        id: (ch as { id?: string }).id ?? crypto.randomUUID(),
        title: ch.title,
        content: ch.content,
        imageUrl: undefined, // No image generated
        order: ch.order,
      }));
      coverImageResult = undefined;
    }

    phaseDurations.phase4Duration = Date.now() - phase4Start;
    console.log(`[4-Phase] Phase 4 completed in ${phaseDurations.phase4Duration}ms`);

    const successfulImages = chaptersWithImages.filter(ch => ch.imageUrl).length;

    // Cover image results
    const coverImage = coverImageResult;
    const coverDuration = phaseDurations.phase4Duration; // Approximate since parallel
    const coverImageUrl = coverImage?.url;

    // ===== PHASE 4.5 & 4.6: DISABLED - Using Artifact Pool System Instead =====
    // OLD SYSTEM (DEPRECATED): Generated random artifacts immediately after story generation
    // NEW SYSTEM: Artifacts are selected from pool (Phase 2.5) and unlocked AFTER reading (markRead.ts)
    //
    // Benefits of new system:
    // - 100 unique, predefined artifacts with meaningful names/descriptions
    // - Intelligent matching based on story genre and needs
    // - Prevents repetition through usage tracking
    // - Unlocked as REWARD after completing story reading
    // - Creates gamification loop and encourages story completion
    //
    // Artifact flow:
    // 1. Phase 1: AI generates artifactRequirement (category, abilities, discovery/usage chapters)
    // 2. Phase 2.5: Match best artifact from pool using scoring algorithm
    // 3. Phase 3: AI integrates matched artifact into story narrative
    // 4. Story saved with artifact relationship in story_artifacts table (locked)
    // 5. User reads story completely
    // 6. markRead.ts: Unlock artifact and add to avatar inventory (REWARD!)
    //
    console.log("[4-Phase] ÔÅ¡´©Å  Skipping old artifact generation - using Pool System");

    const totalDuration = Date.now() - startTime;
    console.log(`[4-Phase] Total orchestration completed in ${totalDuration}ms`);

    const phase4RequestPayload = {
      phase: 4,
      label: "PHASE 4: Konsistente Bilder generieren",
      chaptersToGenerate: finalizedStory.chapters?.length,
      imageDescriptions: finalizedStory.chapters?.map(ch => ({
        chapterOrder: ch.order,
        chapterTitle: ch.title,
        description: ch.imageDescription,
      })),
    };

    const phase4ResponsePayload = {
      status: "completed",
      durationMs: phaseDurations.phase4Duration,
      totalImages: chaptersWithImages.length,
      successfulImages,
      failedImages: chaptersWithImages.length - successfulImages,
      images: chaptersWithImages.map(ch => ({
        chapterOrder: ch.order,
        chapterTitle: ch.title,
        hasImage: !!ch.imageUrl,
        imageUrl: ch.imageUrl,
        prompt: (ch as any).imagePrompt,
        promptPreview: ch.imagePrompt ? `${ch.imagePrompt.substring(0, 180)}...` : undefined,
        seed: (ch as any).imageSeed,
        model: (ch as any).imageModel,
        style: (ch as any).imageStyle,
        negativePrompt: (ch as any).imageNegativePrompt,
      })),
      coverImage: {
        url: coverImage?.url,
        promptPreview: coverImage?.prompt ? `${coverImage.prompt.substring(0, 180)}...` : undefined,
        prompt: coverImage?.prompt,
        durationMs: coverDuration,
        success: !!coverImage?.url,
      },
      totalDurationMs: totalDuration,
    };

    await this.logPhaseEvent("phase4-image-generation", phase4RequestPayload, phase4ResponsePayload);

    // Build metadata about character pool usage
    const characterPoolUsed = Array.from(characterAssignments.entries()).map(([placeholder, character]) => ({
      placeholder,
      characterId: character.id,
      characterName: character.name,
    }));

    const totalPromptTokens =
      (phase1Result.usage?.promptTokens ?? 0) + (phase3Result.usage?.promptTokens ?? 0);
    const totalCompletionTokens =
      (phase1Result.usage?.completionTokens ?? 0) + (phase3Result.usage?.completionTokens ?? 0);
    const totalTokens = totalPromptTokens + totalCompletionTokens;

    return {
      title: finalizedStory.title,
      description: finalizedStory.description,
      coverImageUrl,
      chapters: chaptersWithImages,
      avatarDevelopments: finalizedStory.avatarDevelopments || [], // Pass through from Phase 3
      // ­ƒÄü Legacy artifact system disabled - now using Pool System
      newArtifact: undefined,
      // ­ƒÄü NEW: Pending artifact from pool (unlocked after reading)
      pendingArtifact: phase3Result.pendingArtifact,
      metadata: {
        processingTime: totalDuration,
        imagesGenerated: chaptersWithImages.length + 1, // chapters + cover
        phases: phaseDurations,
        characterPoolUsed,
        model: configWithExperience.aiModel || "gpt-5-mini",
        storyExperience: this.summarizeExperience(experienceContext),
        tokensUsed: {
          prompt: totalPromptTokens,
          completion: totalCompletionTokens,
          total: totalTokens,
          modelUsed: configWithExperience.aiModel || "gpt-5-mini",
          // Calculate costs based on model pricing
          // gpt-5-mini: $0.075 per 1M input, $0.30 per 1M output
          // gpt-5: $2.50 per 1M input, $10.00 per 1M output
          inputCostUSD: this.calculateInputCost(totalPromptTokens, configWithExperience.aiModel || "gpt-5-mini"),
          outputCostUSD: this.calculateOutputCost(totalCompletionTokens, configWithExperience.aiModel || "gpt-5-mini"),
          totalCostUSD: this.calculateTotalCost(totalPromptTokens, totalCompletionTokens, configWithExperience.aiModel || "gpt-5-mini"),
          breakdown: {
            phase1: phase1Result.usage ?? null,
            phase3: phase3Result.usage ?? null,
          },
        },
      },
      newlyGeneratedCharacters: newlyGeneratedCharacters.length > 0 ? newlyGeneratedCharacters : undefined, // Pass to frontend
    };
  }

  private summarizeExperience(context: StoryExperienceContext) {
    return {
      soul: context.soul
        ? {
          key: context.soul.key,
          label: context.soul.label,
          storyPromise: context.soul.storyPromise,
          recommendedStylePreset: context.soul.recommendedStylePreset,
          recommendedTone: context.soul.recommendedTone,
          defaultSuspense: context.soul.defaultSuspense,
          defaultHumor: context.soul.defaultHumor,
          defaultPacing: context.soul.defaultPacing,
          allowRhymes: context.soul.allowRhymes ?? false,
          description: context.soul.description,
        }
        : null,
      emotionalFlavors: context.emotionalFlavors.map(flavor => ({
        key: flavor.key,
        label: flavor.label,
        description: flavor.description,
        effect: flavor.effect,
      })),
      tempo: context.tempo
        ? {
          key: context.tempo.key,
          label: context.tempo.label,
          description: context.tempo.description,
          pacing: context.tempo.pacing,
        }
        : null,
      specialIngredients: context.specialIngredients.map(ingredient => ({
        key: ingredient.key,
        label: ingredient.label,
        description: ingredient.description,
        hookHint: ingredient.hookHint,
        forcesTwist: ingredient.forcesTwist ?? false,
        emphasis: ingredient.emphasis,
      })),
      descriptions: {
        emotionalFlavors: describeEmotionalFlavors(context),
        specialIngredients: describeSpecialIngredients(context),
      },
    };
  }

  /**
   * Get recent story IDs for freshness calculation
   */
  private async getRecentStoryIds(userId: string, limit: number): Promise<string[]> {
    try {
      const rows = await storyDB.queryAll<{ id: string }>`
        SELECT id FROM stories
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
      return rows.map(r => r.id);
    } catch (error) {
      console.warn("[4-Phase] Failed to load recent stories:", error);
      return [];
    }
  }

  /**
   * Generate images for all chapters using avatar canonical appearance
   */
  private async generateChapterImages(
    story: FinalizedStory,
    avatarDetails: AvatarDetail[],
    characterAssignments: Map<string, CharacterTemplate>
  ): Promise<Chapter[]> {
    console.log("[4-Phase] Generating chapter images...");

    // ­ƒöº OPTIMIZATION: Patch character assignments with updated visual profiles from JSON
    // This ensures we use the manually corrected/enhanced character data
    await this.patchCharacterAssignments(characterAssignments);

    const referenceImages = avatarDetails
      .map(av => av.imageUrl || av.visualProfile?.imageUrl)
      .filter((url): url is string => !!url && url.trim().length > 0)
      .filter((url, index, arr) => arr.indexOf(url) === index)
      .slice(0, 1);

    if (referenceImages.length > 0) {
      console.log(`[4-Phase] Using ${referenceImages.length} reference images for consistency`);
    }
    const chapters: Chapter[] = [];

    // OPTIMIZATION v3.0: Create consistent seed base for ALL chapter images
    const avatarNames = avatarDetails.map(a => a.name);
    const storyBaseSeed = createDeterministicSeed(story.title || 'Story', avatarNames);
    console.log(`[4-Phase] ­ƒÄ» Using consistent seed base: ${storyBaseSeed} for all chapter images`);

    // Generate all images in parallel for speed
    const imagePromises = story.chapters.map(async (chapter, chapterIndex) => {
      try {
        // Build enhanced prompt with character consistency
        const enhancedPrompt = this.buildEnhancedImagePrompt(
          chapter.imageDescription,
          avatarDetails,
          characterAssignments
        );

        const promptForModel = this.clampPositivePrompt(enhancedPrompt);

        // CRITICAL FIX v3.0: Use CONSISTENT seed with small offset for scene variation
        const imageSeed = (storyBaseSeed + chapterIndex * 3) >>> 0;
        const imageModel = "ai.generateImage-default";



        const stylePreset = "watercolor_storybook";

        console.log(`[4-Phase] Generating image for chapter ${chapter.order}...`);
        const imageUrl = await this.generateImage(promptForModel, imageSeed, undefined, referenceImages);

        return {
          id: crypto.randomUUID(),
          title: chapter.title,
          content: chapter.content,
          imageUrl,
          order: chapter.order,
          imagePrompt: promptForModel,
          imageSeed,
          imageModel,
          imageStyle: stylePreset,
          imageNegativePrompt: undefined,
        };
      } catch (error) {
        console.error(`[4-Phase] Failed to generate image for chapter ${chapter.order}:`, error);
        return {
          id: crypto.randomUUID(),
          title: chapter.title,
          content: chapter.content,
          imageUrl: undefined,
          order: chapter.order,
          imagePrompt: undefined,
          imageSeed: undefined,
          imageModel: undefined,
          imageStyle: undefined,
          imageNegativePrompt: undefined,
        };
      }
    });

    const results = await Promise.all(imagePromises);
    chapters.push(...results);

    // Sort by order to ensure correct sequence
    chapters.sort((a, b) => a.order - b.order);

    console.log(`[4-Phase] Generated ${chapters.filter(c => c.imageUrl).length}/${chapters.length} chapter images`);

    return chapters;
  }

  /**
   * Convert structured visual profile to English text for image generation
   * CRITICAL: Maintains age/size relationships to prevent younger characters appearing older
   */
  /**
   * Convert structured visual profile to English text for image generation
   * v3.0: NOW INTEGRATES CHARACTER INVARIANTS for tooth gaps, protruding ears, etc.
   * Focuses on critical distinctive features + visual anchors
   */
  private normalizeNameKey(name?: string): string {
    return String(name || "")
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
  }

  private formatDisplayName(name: string): string {
    const trimmed = String(name || "").trim();
    if (!trimmed) return trimmed;
    const isAllLower = trimmed === trimmed.toLowerCase();
    const isAllUpper = trimmed === trimmed.toUpperCase();
    if (!isAllLower && !isAllUpper) return trimmed;
    return trimmed
      .split(/\s+/)
      .map(part => (part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : ""))
      .join(" ");
  }

  private findNameIndex(haystack: string, needle: string): number {
    if (!needle) return -1;
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    const match = regex.exec(haystack);
    if (match) return match.index;
    const fallback = haystack.indexOf(needle);
    return fallback;
  }

  private extractNumericAgeFromProfile(vp: any): number | null {
    if (!vp) return null;
    if (typeof vp.ageNumeric === "number") return vp.ageNumeric;
    if (typeof vp.ageApprox === "number") return vp.ageApprox;
    if (typeof vp.age === "number") return vp.age;
    const ageApprox = String(vp.ageApprox || "");
    const match = ageApprox.match(/\d+/);
    if (match) return parseInt(match[0], 10);

    const description = String(vp.description || "");
    const descMatch = description.match(/\b(\d{1,2})\s*(?:years?\s*old|year-old|yo|y\/o)\b/i);
    if (descMatch) return parseInt(descMatch[1], 10);

    const ageApproxLower = ageApprox.toLowerCase();
    if (ageApproxLower.includes("toddler")) return 3;
    if (ageApproxLower.includes("preschool")) return 4;
    if (ageApproxLower.includes("kindergarten")) return 5;
    if (ageApproxLower.includes("young child")) return 6;
    if (ageApproxLower.includes("child")) return 8;
    if (ageApproxLower.includes("preteen")) return 11;
    if (ageApproxLower.includes("teen")) return 14;

    return null;
  }

  private ageCategoryToNumber(ageCategory?: string): number | null {
    if (!ageCategory) return null;
    switch (ageCategory) {
      case "child": return 8;
      case "teenager": return 15;
      case "young_adult": return 22;
      case "adult": return 35;
      case "elder": return 65;
      default: return null;
    }
  }

  private visualProfileToImagePromptWithInvariants(
    vp: any,
    avatarDescription?: string
  ): string {
    if (!vp) return 'no visual details available';

    const parts: string[] = [];

    // 1. AGE AND GENDER (CRITICAL for size consistency)
    const numericAge = this.extractNumericAgeFromProfile(vp);
    const ageLabelRaw = numericAge !== null
      ? `${numericAge}-year-old`
      : (vp.ageApprox ? String(vp.ageApprox).replace(/years?\s+old/gi, "year-old").trim() : "child");
    const ageLabel = ageLabelRaw
      .replace(/\b(years?\s+old)\b\s+\b(years?\s+old)\b/gi, "$1")
      .replace(/\byear-old\b\s+\byear-old\b/gi, "year-old")
      .replace(/\s+/g, " ")
      .trim();
    const gender = vp.gender || 'child';
    parts.push(`${ageLabel} ${gender}`.trim());

    // 2. HAIR (locked color for consistency)
    if (vp.hair) {
      const color = vp.hair.color || 'brown';
      const style = vp.hair.style || 'tousled';
      parts.push(`${color} ${style} hair`);
    }

    // 3. EYES (locked color for consistency)
    if (vp.eyes?.color) {
      parts.push(`${vp.eyes.color} eyes`);
    }

    // 4. SKIN TONE
    if (vp.skin?.tone) {
      parts.push(`${vp.skin.tone} skin`);
    }

    // 5. KEY CLOTHING
    if (vp.clothingCanonical?.outfit) {
      parts.push(`wearing ${vp.clothingCanonical.outfit}`);
    } else if (vp.clothingCanonical?.top) {
      parts.push(`wearing ${vp.clothingCanonical.top}`);
    }

    // 6. CRITICAL: EXTRACT INVARIANTS FROM DESCRIPTION
    // This is where tooth gaps, protruding ears, etc. come from!
    if (avatarDescription) {
      const invariantFeatures = extractInvariantsFromDescription(avatarDescription);

      // Add priority 1 features (tooth gap, protruding ears, glasses, etc.)
      const criticalFeatures = invariantFeatures
        .filter(f => f.priority === 1)
        .map(f => f.mustIncludeToken);

      if (criticalFeatures.length > 0) {
        parts.push(`DISTINCTIVE FEATURES: ${criticalFeatures.join(', ')}`);
      }

      // Add priority 2 features
      const secondaryFeatures = invariantFeatures
        .filter(f => f.priority === 2)
        .map(f => f.mustIncludeToken)
        .slice(0, 3); // Limit to avoid prompt bloat

      if (secondaryFeatures.length > 0) {
        parts.push(secondaryFeatures.join(', '));
      }
    }

    // 7. ACCESSORIES FROM PROFILE
    if (vp.accessories && vp.accessories.length > 0) {
      // Add up to 2 accessories
      const accessoryList = vp.accessories.slice(0, 2).join(', ');
      parts.push(`with ${accessoryList}`);
    }

    // 8. FACE FEATURES FROM PROFILE
    if (vp.face?.otherFeatures && vp.face.otherFeatures.length > 0) {
      parts.push(vp.face.otherFeatures.slice(0, 2).join(', '));
    }

    // 9. SKIN DISTINCTIVE FEATURES
    if (vp.skin?.distinctiveFeatures && vp.skin.distinctiveFeatures.length > 0) {
      parts.push(vp.skin.distinctiveFeatures.slice(0, 2).join(', '));
    }

    // 10. CHILD SAFETY (Strict for human children)
    const ageForSafety = numericAge ?? 8;
    if (ageForSafety <= 12 && (!vp.species || String(vp.species).toLowerCase().includes('human'))) {
      parts.push('child proportions, NO beard, NO mustache, smooth young face');
    }

    return parts.join(', ');
  }

  /**
   * Build enhanced image prompt with character consistency
   * CRITICAL: Maintains age/size order to prevent mix-ups
   * v4.0: Flux-optimized natural language with explicit positioning
   */
  private buildEnhancedImagePrompt(
    baseDescription: string,
    avatarDetails: AvatarDetail[],
    characterAssignments: Map<string, CharacterTemplate>
  ): string {
    // Translate common German object nouns to English for image models
    const germanToEnglishObjects: Record<string, string> = {
      'zauberstab': 'magic wand with glowing tip',
      'schwert': 'sword',
      'schild': 'shield',
      'buch': 'book',
      'schlüssel': 'key',
      'schluessel': 'key',
      'kompass': 'compass',
      'krone': 'crown',
      'ring': 'magic ring',
      'amulett': 'amulet',
      'kristall': 'crystal',
      'laterne': 'lantern',
      'feder': 'feather',
      'stab': 'magic staff',
      'dolch': 'dagger',
      'bogen': 'bow',
      'pfeil': 'arrow',
      'helm': 'helmet',
      'mantel': 'cloak',
      'umhang': 'cape',
      'kette': 'necklace',
      'armband': 'bracelet',
      'spiegel': 'mirror',
      'trank': 'potion bottle',
      'karte': 'map',
      'pergament': 'scroll',
      'zepter': 'scepter',
      'kelch': 'chalice',
      'harfe': 'harp',
      'flöte': 'flute',
      'floete': 'flute',
      'glocke': 'bell',
      'fackel': 'torch',
      'kerze': 'candle',
    };

    let translatedDescription = baseDescription || '';
    for (const [german, english] of Object.entries(germanToEnglishObjects)) {
      const regex = new RegExp(`\\b${german}\\b`, 'gi');
      if (regex.test(translatedDescription)) {
        translatedDescription = translatedDescription.replace(regex, english);
      }
    }

    let cleanedDescription = translatedDescription.replace(/\s+/g, ' ').trim();

    const shotTypes = [
      'WIDE SHOT',
      'CLOSE-UP',
      'CLOSE UP',
      'HERO SHOT',
      'DRAMATIC ANGLE',
      'MEDIUM SHOT',
      'OVERHEAD SHOT',
      'LOW ANGLE',
      'HIGH ANGLE'
    ];
    let shotType = '';
    for (const type of shotTypes) {
      const regex = new RegExp(`\\b${type}\\b`, 'i');
      if (regex.test(cleanedDescription)) {
        shotType = type;
        cleanedDescription = cleanedDescription.replace(regex, '').trim();
        break;
      }
    }

    cleanedDescription = cleanedDescription
      .replace(/\b(FOREGROUND|MIDGROUND|BACKGROUND|LIGHTING|MOOD|ATMOSPHERE|COMPOSITION|STYLE|SHOT TYPE|SHOT|CAMERA|POSITIONING|CHARACTERS IN THIS SCENE)\b[:,-]*/gi, '')
      .replace(/\b(crowd|villagers|townsfolk|bystanders|onlookers|passersby|spectators)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    interface CharacterInfo {
      name: string;
      displayName: string;
      nameKey: string;
      description: string;
      age: number;
      heightCm?: number;
      species?: string;
      orderIndex: number;
      appearanceIndex?: number;
    }

    const allCharacters = new Map<string, CharacterInfo>();
    const avatarNameSet = new Set(avatarDetails.map(a => this.normalizeNameKey(a.name)));

    for (const [avatarIndex, avatar] of avatarDetails.entries()) {
      const visualContext = avatar.visualProfile
        ? this.visualProfileToImagePromptWithInvariants(avatar.visualProfile, avatar.description)
        : (avatar.description || 'default appearance');

      const age = this.extractNumericAgeFromProfile(avatar.visualProfile) ?? 8;
      const heightCm = avatar.visualProfile?.heightCm || avatar.visualProfile?.height;
      const species = avatar.visualProfile?.species || (age <= 12 ? 'human' : undefined);

      const nameKey = this.normalizeNameKey(avatar.name);
      const displayName = this.formatDisplayName(avatar.name);
      if (!nameKey) continue;

      allCharacters.set(nameKey, {
        name: avatar.name,
        displayName,
        nameKey,
        description: visualContext,
        age,
        heightCm,
        species,
        orderIndex: avatarIndex,
      });
    }

    let supportingIndex = 0;
    for (const char of characterAssignments.values()) {
      const nameKey = this.normalizeNameKey(char.name);
      if (!nameKey) continue;
      if (avatarNameSet.has(nameKey)) {
        continue;
      }

      const visualContext = this.visualProfileToImagePromptWithInvariants(char.visualProfile, undefined);
      const ageFromProfile = this.extractNumericAgeFromProfile(char.visualProfile);
      const age = ageFromProfile ?? this.ageCategoryToNumber(char.age_category) ?? 30;
      const visualProfile = char.visualProfile as { heightCm?: number; height?: number } | undefined;
      const heightCm = visualProfile?.heightCm || visualProfile?.height;

      const displayName = this.formatDisplayName(char.name);
      allCharacters.set(nameKey, {
        name: char.name,
        displayName,
        nameKey,
        description: visualContext,
        age,
        heightCm,
        species: char.visualProfile?.species,
        orderIndex: avatarDetails.length + supportingIndex,
      });
      supportingIndex += 1;
    }

    const descriptionLower = cleanedDescription.toLowerCase();
    const charactersInScene: CharacterInfo[] = [];

    for (const charInfo of allCharacters.values()) {
      const index = this.findNameIndex(descriptionLower, charInfo.nameKey);
      if (index >= 0) {
        charInfo.appearanceIndex = index;
        charactersInScene.push(charInfo);
      }
    }

    if (charactersInScene.length === 0) {
      for (const avatar of avatarDetails) {
        const key = this.normalizeNameKey(avatar.name);
        const info = key ? allCharacters.get(key) : undefined;
        if (info) charactersInScene.push(info);
      }
    }

    const orderedCharacters = [...charactersInScene].sort((a, b) => {
      const aIndex = typeof a.appearanceIndex === 'number' ? a.appearanceIndex : -1;
      const bIndex = typeof b.appearanceIndex === 'number' ? b.appearanceIndex : -1;
      if (aIndex === -1 && bIndex === -1) {
        return a.orderIndex - b.orderIndex;
      }
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    const normalizeDescriptor = (desc: string) => {
      return String(desc || '')
        .replace(/DISTINCTIVE FEATURES:\s*/gi, 'distinct features include ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const positionLabels = (() => {
      if (orderedCharacters.length === 1) return ['IN THE CENTER'];
      if (orderedCharacters.length === 2) return ['ON THE LEFT', 'ON THE RIGHT'];
      if (orderedCharacters.length === 3) return ['ON THE LEFT', 'IN THE CENTER', 'ON THE RIGHT'];
      if (orderedCharacters.length === 4) return ['LEFTMOST', 'LEFT-CENTER', 'RIGHT-CENTER', 'RIGHTMOST'];
      return orderedCharacters.map((_, idx) => `POSITION ${idx + 1} (left to right)`);
    })();

    const ensurePeriod = (line: string) => {
      if (!line) return '';
      return /[.!?]$/.test(line) ? line : `${line}.`;
    };

    const characterSentences = orderedCharacters.map((c, index) => {
      const label = positionLabels[index] || `POSITION ${index + 1}`;
      const descriptor = normalizeDescriptor(c.description);
      const heightClause = c.heightCm ? `${c.heightCm}cm tall` : '';
      const speciesLower = String(c.species || '').toLowerCase();
      const speciesClause = speciesLower && !speciesLower.includes('human') ? c.species : '';
      const parts = [descriptor, heightClause, speciesClause].filter(Boolean).join(', ');
      const safeParts = parts || 'a distinct character';
      return `${label}: ${c.displayName} is ${safeParts}.`;
    });

    const totalCharacters = orderedCharacters.length;
    const countSentence = totalCharacters === 1
      ? 'A scene with exactly one distinct character.'
      : `A scene with exactly ${totalCharacters} distinct characters.`;

    const typeCounts = new Map<string, number>();
    for (const c of orderedCharacters) {
      const speciesLower = String(c.species || '').toLowerCase();
      let label = 'character';
      if (speciesLower.includes('human')) {
        label = c.age <= 18 ? 'child' : 'adult';
      } else if (speciesLower.includes('dwarf') || c.name.toLowerCase().includes('dwarf')) {
        label = 'dwarf';
      } else if (speciesLower.includes('gnome')) {
        label = 'gnome';
      } else if (speciesLower) {
        label = speciesLower;
      }
      typeCounts.set(label, (typeCounts.get(label) || 0) + 1);
    }

    const breakdownParts = Array.from(typeCounts.entries()).map(([label, count]) => {
      const suffix = count > 1 ? 's' : '';
      return `${count} ${label}${suffix}`;
    });
    const breakdownSentence = breakdownParts.length > 1
      ? `The scene includes ${breakdownParts.join(' and ')}.`
      : '';

    const humanKids = orderedCharacters.filter(c => {
      const speciesLower = String(c.species || '').toLowerCase();
      return speciesLower.includes('human') && c.age <= 18;
    });
    let sizeSentence = '';
    if (humanKids.length >= 2) {
      const sorted = [...humanKids].sort((a, b) => {
        if (a.heightCm && b.heightCm) return a.heightCm - b.heightCm;
        return a.age - b.age;
      });
      const shortest = sorted[0];
      const tallest = sorted[sorted.length - 1];
      if (shortest && tallest && shortest.nameKey !== tallest.nameKey) {
        sizeSentence = `There is a clear height difference: ${tallest.displayName} is significantly taller than ${shortest.displayName}.`;
      }
    }

    const sceneSentence = cleanedDescription
      ? (cleanedDescription.toLowerCase().startsWith('the scene')
        ? cleanedDescription
        : `The scene shows ${cleanedDescription}`)
      : '';

    const promptParts = [
      "Children's storybook illustration, whimsical watercolor, warm light, highly detailed, print-ready.",
      shotType ? ensurePeriod(`It is a ${shotType.toLowerCase()} view`) : '',
      countSentence,
      breakdownSentence,
      sceneSentence ? ensurePeriod(sceneSentence) : '',
      '',
      'CHARACTERS IN THIS SCENE:',
      ...characterSentences,
      sizeSentence ? ensurePeriod(sizeSentence) : '',
      orderedCharacters.length > 1
        ? 'The characters are distinct, different, and contrasting in clothing colors and facial features.'
        : '',
      'Keep faces, hair, and outfits consistent across all images. No text or watermarks.'
    ].filter(Boolean);

    return promptParts.join('\n');
  }
  /**
   * OPTIMIZATION v3.0: Smart prompt clamping that PRESERVES character identity blocks
   * Character details at the START are never truncated, only scene details at END
   */
  private clampPositivePrompt(prompt: string, maxLength = 3000): string {
    let result = String(prompt || "").trim();
    if (result.length <= maxLength) return result;

    const originalLength = result.length;

    // OPTIMIZATION v3.0: Check for new format with [AGES:] or [STYLE:] blocks
    if (result.includes('[AGES:') || result.includes('[STYLE:') || result.includes('=== CHARACTERS')) {
      const smartResult = smartClampPrompt(result, maxLength);
      if (smartResult.length !== originalLength) {
        console.log(`[Image Prompt] Smart clamped from ${originalLength} to ${smartResult.length} (preserved character blocks)`);
      }
      return smartResult;
    }

    // Legacy format handling below...

    // Collapse excessive whitespace to save space
    result = result.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (result.length <= maxLength) {
      console.warn(`[Image Prompt] Trimmed prompt from ${originalLength} to ${result.length} (collapsed whitespace)`);
      return result;
    }

    // Preserve character block by trimming the scene description if needed
    const marker = "\nCHARACTERS IN THIS SCENE";
    const markerIndex = result.indexOf(marker);
    if (markerIndex > -1) {
      const rest = result.slice(markerIndex);
      let pre = result.slice(0, markerIndex);
      const allowedPre = Math.max(200, maxLength - rest.length - 3);
      if (pre.length > allowedPre) {
        pre = pre.slice(0, allowedPre).trimEnd() + "...";
        result = (pre + rest).trim();
      }
      if (result.length <= maxLength) {
        console.warn(`[Image Prompt] Trimmed prompt from ${originalLength} to ${result.length} (shortened scene)`);
        return result;
      }
    }

    // Remove lower-priority lines to fit the limit (NEVER remove age/character blocks)
    const lineRemovals: RegExp[] = [
      /\nCRITICAL ANTI-DUPLICATION:[^\n]*/i,
      /\nIMPORTANT: Keep each character's face[^\n]*/i,
      /\nTOTAL CHARACTERS VISIBLE:[^\n]*/i,
      /\nArt style:[^\n]*/i,
    ];
    for (const pattern of lineRemovals) {
      const next = result.replace(pattern, "").trim();
      if (next.length !== result.length) {
        result = next;
        if (result.length <= maxLength) {
          console.warn(`[Image Prompt] Trimmed prompt from ${originalLength} to ${result.length} (removed low-priority lines)`);
          return result;
        }
      }
    }

    // Hard truncate as a last resort (but try to preserve start with character info)
    if (result.length > maxLength) {
      result = result.slice(0, Math.max(2, maxLength - 3)).trimEnd() + "...";
      console.warn(`[Image Prompt] Trimmed prompt from ${originalLength} to ${result.length} (hard truncate)`);
    }

    return result;
  }

  /**
   * Helper to patch character assignments with updated data from JSON logs
   */
  private async patchCharacterAssignments(characterAssignments: Map<string, CharacterTemplate>) {
    try {
      // Find the latest character log file
      const logDir = path.join(process.cwd(), 'Logs');
      if (!fs.existsSync(logDir)) return;

      const files = fs.readdirSync(logDir)
        .filter(f => f.startsWith('talea-characters-') && f.endsWith('.json'))
        .sort()
        .reverse(); // Newest first

      if (files.length === 0) return;

      const latestFile = path.join(logDir, files[0]);
      console.log(`[Orchestrator] Loading updated character data from ${latestFile}`);

      const rawData = fs.readFileSync(latestFile, 'utf-8');
      const updatedCharacters = JSON.parse(rawData);

      // Create a lookup map by ID and Name
      const charMap = new Map<string, any>();
      for (const char of updatedCharacters) {
        charMap.set(char.id, char);
        if (char.name) charMap.set(char.name.toLowerCase(), char);
      }

      // Patch assignments
      for (const [placeholder, template] of characterAssignments.entries()) {
        let updated = charMap.get(template.id);
        if (!updated && template.name) {
          updated = charMap.get(template.name.toLowerCase());
        }

        if (updated && updated.visualProfile) {
          console.log(`[Orchestrator] Patching visual profile for ${template.name}`);
          template.visualProfile = {
            ...template.visualProfile,
            ...updated.visualProfile
          };
          // Also update name/role if changed
          if (updated.name) template.name = updated.name;
          if (updated.role) template.role = updated.role;
        }
      }
    } catch (error) {
      console.warn("[Orchestrator] Failed to patch character assignments:", error);
    }
  }

  /**
   * Generate a single image using AI service
   */
  private async generateImage(
    prompt: string,
    seed?: number,
    negativePrompt?: string,
    referenceImages?: string[],
    ipAdapterWeight?: number,
    retryCount = 0,
    maxRetries = 2
  ): Promise<string | undefined> {
    try {
      console.log(`[4-Phase] Generating image (attempt ${retryCount + 1}/${maxRetries + 1})...`);

      // Increase timeout to 90s to prevent failures on complex prompts (like covers)
      const timeout = 90000; // 90 seconds per image

      const refs = (referenceImages || [])
        .filter((url) => typeof url === 'string' && url.trim().length > 0)
        .slice(0, 1);

      const imagePromise = ai.generateImage({
        prompt,
        seed,
        negativePrompt: negativePrompt,
        referenceImages: refs.length > 0 ? refs : undefined,
        ipAdapterWeight: refs.length > 0 ? (ipAdapterWeight ?? 0.8) : undefined,
      });

      const response = await Promise.race([
        imagePromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Image generation timeout after ${timeout}ms`)), timeout)
        )
      ]);

      console.log(`[4-Phase] Ô£à Image generated successfully`);
      return response.imageUrl;
    } catch (error) {
      console.error(`[4-Phase] Image generation failed (attempt ${retryCount + 1}):`, error);

      // Retry logic
      if (retryCount < maxRetries) {
        console.log(`[4-Phase] Retrying image generation (${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retry
        return this.generateImage(prompt, seed, negativePrompt, referenceImages, ipAdapterWeight, retryCount + 1, maxRetries);
      }

      console.error(`[4-Phase] ÔØî Image generation failed after ${maxRetries + 1} attempts`);
      return undefined;
    }
  }

  /**
   * Generate cover image for the story
   */
  private async generateCoverImage(
    story: FinalizedStory,
    avatarDetails: AvatarDetail[],
    characterAssignments: Map<string, CharacterTemplate>
  ): Promise<{ url?: string; prompt: string } | undefined> {
    console.log("[4-Phase] Generating cover image...");

    try {
      // Build cover scene description with CLEAR character positioning
      const avatarNames = avatarDetails.map(a => this.formatDisplayName(a.name)).join(" and ");

      // CRITICAL FIX: Filter out avatars from supporting characters to prevent duplicates
      const avatarNamesLower = avatarDetails.map(a => this.normalizeNameKey(a.name));
      const supportingCharacters = Array.from(characterAssignments.values())
        .filter(c => !avatarNamesLower.includes(this.normalizeNameKey(c.name))) // Exclude avatars
        .slice(0, 2) // Include up to 2 main supporting characters
        .map(c => this.formatDisplayName(c.name))
        .join(" and ");

      const coverDescription = `
Book cover illustration for "${story.title}".
Main characters: ${avatarNames}${supportingCharacters ? ` with ${supportingCharacters}` : ''} in an exciting scene.
CRITICAL: Each character appears exactly once and looks distinct.
      `.trim();

      const referenceImages = avatarDetails
        .map(av => av.imageUrl || av.visualProfile?.imageUrl)
        .filter((url): url is string => !!url && url.trim().length > 0)
        .filter((url, index, arr) => arr.indexOf(url) === index)
        .slice(0, 1);

      const enhancedPrompt = this.buildEnhancedImagePrompt(
        coverDescription,
        avatarDetails,
        characterAssignments
      );

      const promptForModel = this.clampPositivePrompt(enhancedPrompt);

      const seed = Math.floor(Math.random() * 1_000_000_000);
      const imageUrl = await this.generateImage(promptForModel, seed, undefined, referenceImages);

      console.log("[4-Phase] Cover image generated:", !!imageUrl);
      return { url: imageUrl, prompt: promptForModel };
    } catch (error) {
      console.error("[4-Phase] Failed to generate cover image:", error);
      return undefined;
    }
  }

  /**
   * Calculate input cost based on model pricing
   */
  private calculateInputCost(tokens: number, model: string): number {
    const pricePerMillion = this.getInputPricePerMillion(model);
    return (tokens * pricePerMillion) / 1_000_000;
  }

  /**
   * Calculate output cost based on model pricing
   */
  private calculateOutputCost(tokens: number, model: string): number {
    const pricePerMillion = this.getOutputPricePerMillion(model);
    return (tokens * pricePerMillion) / 1_000_000;
  }

  /**
   * Calculate total cost
   */
  private calculateTotalCost(inputTokens: number, outputTokens: number, model: string): number {
    return this.calculateInputCost(inputTokens, model) + this.calculateOutputCost(outputTokens, model);
  }

  /**
   * Get input token pricing per million tokens for model
   */
  private getInputPricePerMillion(model: string): number {
    if (model.includes("gpt-5-nano")) return 0.03; // $0.03 per 1M
    if (model.includes("gpt-5-mini")) return 0.075; // $0.075 per 1M
    if (model.includes("gpt-5-pro")) return 5.00; // $5.00 per 1M
    if (model.includes("gpt-5")) return 2.50; // $2.50 per 1M (base gpt-5)
    if (model.includes("o4-mini")) return 1.10; // $1.10 per 1M
    if (model.includes("gpt-4")) return 2.50; // $2.50 per 1M (fallback)
    return 0.075; // Default to gpt-5-mini pricing
  }

  /**
   * Get output token pricing per million tokens for model
   */
  private getOutputPricePerMillion(model: string): number {
    if (model.includes("gpt-5-nano")) return 0.12; // $0.12 per 1M
    if (model.includes("gpt-5-mini")) return 0.30; // $0.30 per 1M
    if (model.includes("gpt-5-pro")) return 20.00; // $20.00 per 1M
    if (model.includes("gpt-5")) return 10.00; // $10.00 per 1M (base gpt-5)
    if (model.includes("o4-mini")) return 4.40; // $4.40 per 1M
    if (model.includes("gpt-4")) return 10.00; // $10.00 per 1M (fallback)
    return 0.30; // Default to gpt-5-mini pricing
  }

  /**
   * Store skeleton in database for debugging/analysis
   */
  async storeSkeleton(storyId: string, skeleton: StorySkeleton): Promise<void> {
    try {
      const id = crypto.randomUUID();
      await storyDB.exec`
        INSERT INTO story_skeletons (id, story_id, title, chapters, supporting_character_requirements)
        VALUES (
          ${id},
          ${storyId},
          ${skeleton.title},
          ${JSON.stringify(skeleton.chapters)},
          ${JSON.stringify(skeleton.supportingCharacterRequirements)}
        )
      `;
      console.log("[4-Phase] Skeleton stored in database");
    } catch (error) {
      console.warn("[4-Phase] Failed to store skeleton:", error);
    }
  }

  /**
   * Update character usage statistics after story generation
   */
  async updateCharacterUsage(
    storyId: string,
    characterAssignments: Map<string, CharacterTemplate>
  ): Promise<void> {
    await this.phase2Matcher.updateUsageStats(characterAssignments, storyId);
  }
}











