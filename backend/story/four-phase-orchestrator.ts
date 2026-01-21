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
import type { InventoryItem, AvatarVisualProfile } from "../avatar/avatar";
import { generateArtifactImage } from "./artifact-image-generator";
import type { NewArtifact } from "./types";
import { addArtifactToInventoryInternal } from "../gamification/item-system";
// NEW v2.0: Character Invariants for image consistency
import {
  buildInvariantsFromVisualProfile,
  formatInvariantsForPrompt,
  extractInvariantsFromDescription,
} from "./character-invariants";
import type { CharacterInvariants } from "./character-invariants";
import { buildCrossChapterInvariantsBlock } from "./image-description-enricher";
import type { AvatarProfileWithDescription } from "./image-description-enricher";
// OPTIMIZATION v3.0: Image Consistency System
import {
  createDeterministicSeed,
  smartClampPrompt,
} from "./image-consistency-system";
import {
  buildCompactAgeBlock,
  buildExplicitAgeEnforcement,
  type CharacterWithHeight,
} from "./age-consistency-guards";

interface AvatarDetail {
  id: string;
  name: string;
  description?: string;
  physicalTraits?: any;
  personalityTraits?: any;
  imageUrl?: string;
  visualProfile?: any;
  creationType: "ai-generated" | "photo-upload";
  inventory?: InventoryItem[];  // 🎁 NEW: Avatar's existing artifacts
}

interface FourPhaseInput {
  config: StoryConfig;
  avatarDetails: AvatarDetail[];
  userId: string;
  clerkToken: string;
  storyId: string; // 🎁 NEW: Required for artifact source tracking
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
  // 🎁 Loot artifact from this story (deprecated - use pendingArtifact)
  newArtifact?: NewArtifact & { imageUrl?: string };
  // 🎁 NEW: Pending artifact from pool (unlocked after reading)
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

    // 🔧 OPTIMIZATION 1: Auto-activate fairy tale template for fairy tale genres (robust i18n)
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
      console.log(`[4-Phase] 🎭 AUTO-ACTIVATED Fairy Tale Template for genre: "${input.config.genre}"`);
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
        console.log(`[4-Phase] ✅ Phase 0 completed in ${phase0Duration}ms`);
        console.log(`[4-Phase] Selected: ${selectedFairyTale.tale.title} (score: ${selectedFairyTale.matchScore})`);
        console.log(`[4-Phase] This will save ~47 seconds in Phase 1 by skipping skeleton generation`);
      } else {
        console.log(`[4-Phase] ⚠️ Phase 0 completed in ${phase0Duration}ms - No suitable fairy tale found`);
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
      input.avatarDetails  // 🔧 NEW: Pass full avatar details with visualProfile
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

        console.log("[4-Phase] 🎁 Artifact matched:", {
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
      console.log(`[4-Phase] ✨ Fairy tale used: ${phase3Result.fairyTaleUsed.title} (score: ${phase3Result.fairyTaleUsed.matchScore})`);
      console.log(`[4-Phase] Match reason: ${phase3Result.fairyTaleUsed.matchReason}`);
    } else {
      console.log("[4-Phase] No fairy tale used - standard story generation");
    }

    console.log(`[4-Phase] Phase 3 completed in ${phaseDurations.phase3Duration}ms`);

    const totalWords = finalizedStory.chapters?.reduce((sum, ch) => sum + ch.content.split(/\s+/).length, 0) || 0;

    const phase3RequestPayload = {
      phase: 3,
      label: "PHASE 3: Märchen-basierte Story-Implementierung",
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

    // 🔧 OPTIMIZATION: Run Cover and Chapter generation in parallel
    const [chaptersWithImages, coverImageResult] = await Promise.all([
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

    phaseDurations.phase4Duration = Date.now() - phase4Start;
    console.log(`[4-Phase] Phase 4 completed in ${phaseDurations.phase4Duration}ms`);

    const successfulImages = chaptersWithImages.filter(ch => ch.imageUrl).length;

    // Cover image results
    const coverImage = coverImageResult;
    const coverDuration = phaseDurations.phase4Duration; // Approximate since parallel
    const coverImageUrl = coverImage?.url;

    // ===== PHASE 4.5: Generate Artifact Image (if newArtifact exists) =====
    let artifactImageUrl: string | undefined;
    let artifactImagePrompt: string | undefined;

    if (finalizedStory.newArtifact) {
      console.log("[4-Phase] 🎁 Generating artifact image...");
      const artifactStart = Date.now();

      try {
        const artifactResult = await generateArtifactImage(finalizedStory.newArtifact);
        artifactImageUrl = artifactResult.imageUrl;
        artifactImagePrompt = artifactResult.prompt;

        const artifactDuration = Date.now() - artifactStart;
        console.log(`[4-Phase] Artifact image generated in ${artifactDuration}ms: ${artifactResult.success ? '✅' : '❌'}`);

        if (artifactResult.error) {
          console.warn(`[4-Phase] Artifact image warning: ${artifactResult.error}`);
        }

        // ===== PHASE 4.6: Save Artifact to Avatar Inventory =====
        // Save the artifact to each participating avatar's inventory
        for (const avatarDetail of input.avatarDetails) {
          try {
            const inventoryItem: InventoryItem = {
              id: crypto.randomUUID(),
              name: finalizedStory.newArtifact.name,
              type: finalizedStory.newArtifact.type || "TOOL",
              level: 1,
              sourceStoryId: input.storyId, // ✅ FIX: Use actual story ID
              description: finalizedStory.newArtifact.description,
              visualPrompt: finalizedStory.newArtifact.visualDescriptorKeywords.join(', '),
              tags: finalizedStory.newArtifact.visualDescriptorKeywords,
              acquiredAt: new Date().toISOString(),
              imageUrl: artifactImageUrl,
              storyEffect: finalizedStory.newArtifact.storyEffect,
            };

            await addArtifactToInventoryInternal(avatarDetail.id, inventoryItem);
            console.log(`[4-Phase] 💾 Artifact saved to avatar ${avatarDetail.name}'s inventory`);
          } catch (saveError) {
            console.error(`[4-Phase] Failed to save artifact for avatar ${avatarDetail.name}:`, saveError);
          }
        }

        console.log("[4-Phase] Artifact generation summary:", {
          newArtifact: finalizedStory.newArtifact.name,
          imageGenerated: !!artifactImageUrl,
          assignedAvatars: input.avatarDetails.map(a => a.name),
        });
      } catch (error) {
        console.error("[4-Phase] Failed to generate artifact image:", error);
      }
    } else {
      console.log("[4-Phase] No newArtifact in story response - skipping artifact image generation");
    }

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
      // 🎁 Legacy: Pass loot artifact with generated image (deprecated)
      newArtifact: finalizedStory.newArtifact
        ? { ...finalizedStory.newArtifact, imageUrl: artifactImageUrl }
        : undefined,
      // 🎁 NEW: Pending artifact from pool (unlocked after reading)
      pendingArtifact: phase3Result.pendingArtifact,
      metadata: {
        processingTime: totalDuration,
        imagesGenerated: chaptersWithImages.length + 1 + (artifactImageUrl ? 1 : 0), // chapters + cover + artifact
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

    // 🔧 OPTIMIZATION: Patch character assignments with updated visual profiles from JSON
    // This ensures we use the manually corrected/enhanced character data
    await this.patchCharacterAssignments(characterAssignments);

    // NEW v2.0: Build character invariants for ALL avatars
    // This ensures consistent features (tooth gaps, etc.) across all chapters
    const avatarInvariants = new Map<string, CharacterInvariants>();

    // v3.0 FIX: Only collect features that should be FORBIDDEN for ALL characters
    // NOT features that are forbidden only because another character has them
    const universalForbiddenFeatures: string[] = [];

    for (const avatar of avatarDetails) {
      if (avatar.visualProfile) {
        const invariants = buildInvariantsFromVisualProfile(
          avatar.name,
          avatar.visualProfile as AvatarVisualProfile,
          avatar.description
        );
        avatarInvariants.set(avatar.name, invariants);

        // v3.1: forbiddenFeatures now ONLY contains universal features (no hair/eye colors)
        // Hair/eye color conflicts are now in forbiddenColorsForThisCharacter (not used in negative prompt)
        universalForbiddenFeatures.push(...invariants.forbiddenFeatures);

        console.log(`[4-Phase] Built invariants for ${avatar.name}:`, {
          mustInclude: invariants.mustIncludeFeatures.map(f => f.mustIncludeToken).slice(0, 3),
          universalForbidden: invariants.forbiddenFeatures.slice(0, 3),
          perCharacterForbidden: invariants.forbiddenColorsForThisCharacter?.slice(0, 3) || []
        });
      }
    }

    // NEW v2.0: Build cross-chapter invariants reference block
    // This is appended to EVERY image prompt for consistency
    const avatarProfilesWithDesc: Record<string, AvatarProfileWithDescription> = {};
    for (const avatar of avatarDetails) {
      if (avatar.visualProfile) {
        avatarProfilesWithDesc[avatar.name] = {
          profile: avatar.visualProfile as AvatarVisualProfile,
          description: avatar.description
        };
      }
    }
    const crossChapterInvariantsBlock = buildCrossChapterInvariantsBlock(avatarProfilesWithDesc);

    const chapters: Chapter[] = [];

    // OPTIMIZATION v3.0: Create consistent seed base for ALL chapter images
    const avatarNames = avatarDetails.map(a => a.name);
    const storyBaseSeed = createDeterministicSeed(story.title || 'Story', avatarNames);
    console.log(`[4-Phase] 🎯 Using consistent seed base: ${storyBaseSeed} for all chapter images`);

    // OPTIMIZATION v3.0: Build character-first block for prompt start
    const charactersForAgeBlock: CharacterWithHeight[] = avatarDetails.map(av => {
      const profile = av.visualProfile as any;
      return {
        name: av.name,
        ageNumeric: profile?.ageNumeric || profile?.age,
        ageApprox: profile?.ageApprox,
        heightCm: profile?.heightCm || profile?.height,
        species: profile?.characterType?.toLowerCase().includes('animal') ? 'animal' : 'human',
      };
    });

    const compactAgeBlock = buildCompactAgeBlock(charactersForAgeBlock);
    const ageEnforcement = buildExplicitAgeEnforcement(charactersForAgeBlock);
    console.log(`[4-Phase] 📋 Age block: ${compactAgeBlock}`);

    // CRITICAL v3.6: Build Flux.1 human ear guard (Flux.1 Dev ignores negative prompts!)
    // This MUST be at the TOP of the prompt for maximum effect
    const humanAvatars = avatarDetails.filter(av => {
      const profile = av.visualProfile as any;
      const charType = profile?.characterType?.toLowerCase() || '';
      return !charType.includes('animal') && !charType.includes('creature');
    });
    const flux1HumanGuard = humanAvatars.length > 0
      ? `[FLUX.1 CRITICAL FOR ${humanAvatars.map(a => a.name).join(' AND ')}: MUST have normal ROUND human ears on SIDES of head. Ears must be naturally positioned at ear-level, NOT pointed, NOT elf-like, NOT fantasy-shaped. 100% human child anatomy.]`
      : '';
    console.log(`[4-Phase] 👂 Flux.1 Human Guard: ${flux1HumanGuard ? 'ACTIVE' : 'N/A (no humans)'}`);

    // Generate all images in parallel for speed
    const imagePromises = story.chapters.map(async (chapter, chapterIndex) => {
      try {
        // Build enhanced prompt with character consistency
        const enhancedPrompt = this.buildEnhancedImagePrompt(
          chapter.imageDescription,
          avatarDetails,
          characterAssignments
        );

        // OPTIMIZATION v3.6: Prepend ALL consistency blocks including Flux.1 human guard
        const promptWithAgeFirst = `${compactAgeBlock}\n${ageEnforcement}\n${flux1HumanGuard}\n\n${enhancedPrompt}\n\n${crossChapterInvariantsBlock}`;
        const promptForModel = this.clampPositivePrompt(promptWithAgeFirst);

        // CRITICAL FIX v3.0: Use CONSISTENT seed with small offset for scene variation
        const imageSeed = (storyBaseSeed + chapterIndex * 3) >>> 0;
        const imageModel = "ai.generateImage-default";

        // ⚠️ NOTE: FLUX.1 Dev does NOT support negative prompts natively!
        // We still create this for: (1) logging/debugging, (2) future model compatibility
        // The ACTUAL character-specific exclusions are handled via "NOT X" in the POSITIVE prompt
        // (see buildCrossChapterInvariantsBlock and characterBlock above)
        const baseNegativePrompts = [
          "deformed, disfigured, watermark, text, signature, low quality",
          "duplicate characters, extra people, crowd, extra children, extra boys, extra girls, extra humans",
          "twins, clones, mirror image, repeated face, same person twice, multiple instances of same character",
          "extra dwarfs, extra gnomes, gnome crowd, dwarf crowd, multiple dwarfs, second dwarf",
          "beard on children, hat on children, dwarfified kids, child with beard",
          "mislabeled species, wrong species, swapped species, puppet, mannequin"
        ];

        // v3.1: Only add UNIVERSAL forbidden features (tooth gap → no complete teeth, etc.)
        // Hair/eye colors are now handled via "NOT X" in the POSITIVE prompt
        const uniqueForbidden = [...new Set(universalForbiddenFeatures)].slice(0, 10);
        const negativePrompt = [...baseNegativePrompts, ...uniqueForbidden].join(", ");

        const stylePreset = "watercolor_storybook";

        console.log(`[4-Phase] Generating image for chapter ${chapter.order}...`);
        const imageUrl = await this.generateImage(promptForModel, imageSeed, negativePrompt);

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
          imageNegativePrompt: negativePrompt,
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
   * v3.0: NOW USES CHARACTER INVARIANTS for tooth gaps, protruding ears, etc.
   * OPTIMIZATION v2.4: Genre-Aware Costume Override based on imageDescription
   */
  private buildEnhancedImagePrompt(
    baseDescription: string,
    avatarDetails: AvatarDetail[],
    characterAssignments: Map<string, CharacterTemplate>
  ): string {
    const cleanedDescription = baseDescription.replace(/\s+/g, ' ').trim();

    // OPTIMIZATION v2.4: Check imageDescription for genre keywords
    const genreKeywords = ['medieval', 'fantasy', 'magic', 'castle', 'knight', 'princess', 'dragon', 'fairy', 'wizard', 'witch', 'kingdom', 'ancient', 'steampunk', 'victorian', 'retro', 'historical', 'old world', 'village', 'steam', 'gear', 'clockwork', 'brass'];
    const descriptionLower = cleanedDescription.toLowerCase();
    const isGenreScene = genreKeywords.some(keyword => descriptionLower.includes(keyword));
    const isSteampunk = descriptionLower.includes('steampunk') || descriptionLower.includes('steam') || descriptionLower.includes('gear') || descriptionLower.includes('clockwork');

    // Build character lookup with AGE for sorting
    interface CharacterInfo {
      name: string;
      displayName: string;
      nameKey: string;
      description: string;
      age: number;
      species?: string;
      orderIndex: number;
      appearanceIndex?: number;
      invariantsMustInclude?: string[];  // NEW: Critical features
      invariantsForbidden?: string[];     // NEW: Forbidden features
    }

    const allCharacters = new Map<string, CharacterInfo>();
    const avatarNameSet = new Set(avatarDetails.map(a => this.normalizeNameKey(a.name)));
    const hasPositioning = /\bPOSITIONING\s*:/i.test(cleanedDescription);

    // Add avatars with FULL descriptions + age + INVARIANTS
    for (const [avatarIndex, avatar] of avatarDetails.entries()) {
      // v3.0: Use new method that extracts invariants from avatar description
      let visualContext = avatar.visualProfile
        ? this.visualProfileToImagePromptWithInvariants(avatar.visualProfile, avatar.description)
        : (avatar.description || 'default appearance');

      // OPTIMIZATION v2.4: Apply genre-aware costume override
      if (isGenreScene && visualContext.includes('hoodie')) {
        if (isSteampunk) {
          visualContext = visualContext
            .replace(/hoodie/gi, "vest with brass buttons")
            .replace(/jeans/gi, "striped trousers")
            .replace(/t-shirt/gi, "ruffled shirt")
            .replace(/sneakers/gi, "heavy boots")
            .replace(/casual jacket/gi, "victorian coat");
          console.log(`[Image Prompt] 🎭 Applied Steampunk costume override for ${avatar.name}`);
        } else {
          visualContext = visualContext
            .replace(/hoodie/gi, "hooded tunic")
            .replace(/jeans/gi, "breeches")
            .replace(/t-shirt/gi, "linen shirt")
            .replace(/sneakers/gi, "leather boots")
            .replace(/casual jacket/gi, "medieval tunic");
          console.log(`[Image Prompt] 🎭 Applied Fantasy costume override for ${avatar.name}`);
        }
      }

      const age = this.extractNumericAgeFromProfile(avatar.visualProfile) ?? 8; // Default for child avatars
      const species = avatar.visualProfile?.species || (age <= 12 ? 'human child' : undefined);
      console.log(`[Image Prompt] Avatar ${avatar.name}: age=${age} (from ageNumeric=${avatar.visualProfile?.ageNumeric}, ageApprox=${avatar.visualProfile?.ageApprox})`);

      // v3.0: Extract invariants for this avatar
      let invariantsMustInclude: string[] = [];
      let invariantsForbidden: string[] = [];

      if (avatar.description) {
        const invariantFeatures = extractInvariantsFromDescription(avatar.description);
        invariantsMustInclude = invariantFeatures
          .filter(f => f.priority === 1)
          .map(f => f.mustIncludeToken);

        // Build forbidden list from alternatives
        invariantsForbidden = invariantFeatures
          .filter(f => f.forbiddenAlternative)
          .map(f => f.forbiddenAlternative as string);
      }

      const nameKey = this.normalizeNameKey(avatar.name);
      const displayName = this.formatDisplayName(avatar.name);
      if (!nameKey) continue;

      allCharacters.set(nameKey, {
        name: avatar.name,
        displayName,
        nameKey,
        description: visualContext,
        age,
        species,
        orderIndex: avatarIndex,
        invariantsMustInclude,
        invariantsForbidden,
      });
    }

    // Add supporting characters with FULL descriptions
    let supportingIndex = 0;
    for (const char of characterAssignments.values()) {
      const nameKey = this.normalizeNameKey(char.name);
      if (!nameKey) continue;
      if (avatarNameSet.has(nameKey)) {
        continue; // Avoid overriding avatars with lower-fidelity pool data
      }
      // v3.0: Use the new method that integrates invariants
      // Pool characters don't have user descriptions, so we pass undefined
      let fullDesc = this.visualProfileToImagePromptWithInvariants(char.visualProfile, undefined);

      // OPTIMIZATION v2.4: Apply genre-aware costume override for pool characters too
      if (isGenreScene && fullDesc.includes('hoodie')) {
        if (isSteampunk) {
          fullDesc = fullDesc
            .replace(/hoodie/gi, "vest with brass buttons")
            .replace(/jeans/gi, "striped trousers")
            .replace(/t-shirt/gi, "ruffled shirt")
            .replace(/sneakers/gi, "heavy boots");
          console.log(`[Image Prompt] 🎭 Applied Steampunk costume override for pool character: ${char.name}`);
        } else {
          fullDesc = fullDesc
            .replace(/hoodie/gi, "hooded tunic")
            .replace(/jeans/gi, "breeches")
            .replace(/t-shirt/gi, "linen shirt")
            .replace(/sneakers/gi, "leather boots");
          console.log(`[Image Prompt] 🎭 Applied Fantasy costume override for pool character: ${char.name}`);
        }
      }

      const ageFromProfile = this.extractNumericAgeFromProfile(char.visualProfile);
      let age = ageFromProfile ?? this.ageCategoryToNumber(char.age_category) ?? 30;

      const displayName = this.formatDisplayName(char.name);
      allCharacters.set(nameKey, {
        name: char.name,
        displayName,
        nameKey,
        description: fullDesc,
        age,
        species: char.visualProfile?.species,
        orderIndex: avatarDetails.length + supportingIndex,
      });
      supportingIndex += 1;
    }

    // Extract character names mentioned in this scene
    // Note: descriptionLower already declared above (line 755)
    const charactersInScene: CharacterInfo[] = [];

    for (const charInfo of allCharacters.values()) {
      const index = this.findNameIndex(descriptionLower, charInfo.nameKey);
      if (index >= 0) {
        charInfo.appearanceIndex = index;
        charactersInScene.push(charInfo);
      }
    }

    // If no characters found, include ALL (fallback)
    if (charactersInScene.length === 0) {
      console.warn("[Image Prompt] No characters detected in scene description, including all");
      charactersInScene.push(...allCharacters.values());
    }

    // Prefer mention order for positioning; fall back to avatar order
    const orderedCharacters = [...charactersInScene].sort((a, b) => {
      const aIndex = typeof a.appearanceIndex === "number" ? a.appearanceIndex : -1;
      const bIndex = typeof b.appearanceIndex === "number" ? b.appearanceIndex : -1;
      if (aIndex === -1 && bIndex === -1) {
        return a.orderIndex - b.orderIndex;
      }
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    // OPTIMIZATION v3.0: Add LEFT/RIGHT positioning to prevent character duplication
    const positioningInstructions = hasPositioning
      ? ''
      : orderedCharacters.length === 2
        ? `\nPOSITIONING: ${orderedCharacters[0].displayName} on LEFT side, ${orderedCharacters[1].displayName} on RIGHT side of the image.`
        : orderedCharacters.length >= 3
          ? `\nPOSITIONING: Left to right order: ${orderedCharacters.map(c => c.displayName).join(', ')}.`
          : '';

    // Add explicit age ordering instruction with INVARIANTS
    const characterBlock = orderedCharacters
      .map((c, index) => {
        const position = index === 0 ? '(LEFT)' : index === 1 ? '(RIGHT)' : `(position ${index + 1})`;

        // v3.1: Clean species tag - only use if it's a simple, clear species
        let speciesTag = '';
        if (c.species) {
          const speciesLower = String(c.species).toLowerCase();
          // Only include species if it's clearly defined (not mixed like "human adult, child")
          if (speciesLower.includes('human') && !speciesLower.includes(',')) {
            speciesTag = c.age <= 12 ? 'HUMAN CHILD' : c.age <= 18 ? 'HUMAN TEENAGER' : 'HUMAN ADULT';
          } else if (!speciesLower.includes(',')) {
            speciesTag = c.species.toUpperCase();
          }
        }
        if (c.name.toLowerCase().includes('dwarf')) {
          speciesTag = 'DWARF';
        }

        // CRITICAL: Add visual identifiers to distinguish characters
        const visualId = c.age <= 12
          ? `${c.age}-year-old child`
          : c.age <= 18
            ? `${c.age}-year-old teenager`
            : 'adult';

        // v3.0: Add MUST INCLUDE features (tooth gap, protruding ears, etc.)
        const mustInclude = c.invariantsMustInclude && c.invariantsMustInclude.length > 0
          ? `\n  MUST SHOW: ${c.invariantsMustInclude.join(', ')}`
          : '';

        // v3.1 CRITICAL: FLUX.1 Dev does NOT support negative prompts!
        // We must use "NOT X" in the POSITIVE prompt instead of relying on negativePrompt
        const forbidden = c.invariantsForbidden && c.invariantsForbidden.length > 0
          ? `\n  DO NOT: ${c.invariantsForbidden.slice(0, 3).join(', NOT ')}`
          : '';

        // For child avatars: explicitly forbid beard/hat to prevent dwarf substitution
        // v3.1: Use "NOT" syntax instead of "NO" for better FLUX.1 compatibility
        const safety = (c.species || '').toLowerCase().includes('human') && c.age <= 12
          ? '\n  CHILD: smooth young face, NOT beard, NOT mustache, NOT facial hair, NOT hat, NOT dwarf, NOT gnome'
          : '';

        return `${c.displayName} ${position}: ${speciesTag} ${visualId}\n  ${c.description}${mustInclude}${forbidden}${safety}`;
      })
      .join("\n\n");

    // v3.0 FIX: Only include age order instruction for CHILD characters, use actual ages
    const childCharacters = charactersInScene.filter(c => c.age <= 18);
    const ageOrder = childCharacters.length > 1
      ? `\nIMPORTANT: Child characters with their ages: ${childCharacters.map(c => `${c.displayName} (${c.age}yo)`).join(', ')}. Younger children must be SMALLER than older ones!`
      : childCharacters.length === 1
        ? `\nIMPORTANT: ${childCharacters[0].displayName} is a ${childCharacters[0].age} year old child - draw as young child, NOT teenager!`
        : '';

    const totalCharacters = charactersInScene.length;
    const totalHumans = charactersInScene.filter(c => (c.species || '').toLowerCase().includes('human')).length;
    const totalDwarfs = charactersInScene.filter(c => {
      const speciesLower = (c.species || '').toLowerCase();
      const nameLower = c.name.toLowerCase();
      return speciesLower.includes('dwarf') || nameLower.includes('dwarf');
    }).length;
    const allowPuppets = /\b(puppet|marionette|wooden boy|wooden puppet)\b/i.test(cleanedDescription);
    const forbiddenEntities = [
      'extra humans',
      'extra dwarfs',
      'extra gnomes',
      'twins',
      'clones',
      'extra people',
      'background kids',
      'statues',
    ];
    if (!allowPuppets) {
      forbiddenEntities.push('puppets', 'dolls', 'mannequins');
    }

    return `
${cleanedDescription}
${positioningInstructions}

CHARACTERS IN THIS SCENE (lock face/outfit/age/POSITION):
${characterBlock}
TOTAL CHARACTERS VISIBLE: ${totalCharacters}. Humans: ${totalHumans}. Dwarfs: ${totalDwarfs}. NOT any ${forbiddenEntities.join(', ')}. If extra characters appear, remove them and leave empty space.
${ageOrder}

Art style: watercolor illustration, Axel Scheffler style (The Gruffalo), slightly caricature, bold outlines, consistent character faces.
IMPORTANT: Keep each character's face, age, outfit, hair, and species consistent across all images. Do not add text or watermarks.
CRITICAL ANTI-DUPLICATION: Each character appears EXACTLY ONCE at their designated position. NO twins, NO clones, NO duplicates.
    `.trim();
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
    retryCount = 0,
    maxRetries = 2
  ): Promise<string | undefined> {
    try {
      console.log(`[4-Phase] Generating image (attempt ${retryCount + 1}/${maxRetries + 1})...`);

      // Increase timeout to 90s to prevent failures on complex prompts (like covers)
      const timeout = 90000; // 90 seconds per image

      const imagePromise = ai.generateImage({
        prompt,
        seed,
        negativePrompt: negativePrompt,
      });

      const response = await Promise.race([
        imagePromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Image generation timeout after ${timeout}ms`)), timeout)
        )
      ]);

      console.log(`[4-Phase] ✅ Image generated successfully`);
      return response.imageUrl;
    } catch (error) {
      console.error(`[4-Phase] Image generation failed (attempt ${retryCount + 1}):`, error);

      // Retry logic
      if (retryCount < maxRetries) {
        console.log(`[4-Phase] Retrying image generation (${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retry
        return this.generateImage(prompt, seed, negativePrompt, retryCount + 1, maxRetries);
      }

      console.error(`[4-Phase] ❌ Image generation failed after ${maxRetries + 1} attempts`);
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
CRITICAL: Each character appears EXACTLY ONCE. NO duplicates, NO clones, NO twins.
      `.trim();

      // CRITICAL FIX v3.6: Cover MUST have same consistency blocks as chapters!
      // Build age block for cover (same as chapters)
      const charactersForAgeBlock: CharacterWithHeight[] = avatarDetails.map(av => {
        const profile = av.visualProfile as any;
        return {
          name: av.name,
          ageNumeric: profile?.ageNumeric || profile?.age,
          ageApprox: profile?.ageApprox,
          heightCm: profile?.heightCm || profile?.height,
          species: profile?.characterType?.toLowerCase().includes('animal') ? 'animal' : 'human',
        };
      });
      const compactAgeBlock = buildCompactAgeBlock(charactersForAgeBlock);
      const ageEnforcement = buildExplicitAgeEnforcement(charactersForAgeBlock);

      // Build cross-chapter invariants block (same as chapters)
      const avatarProfilesWithDesc: Record<string, AvatarProfileWithDescription> = {};
      for (const avatar of avatarDetails) {
        if (avatar.visualProfile) {
          avatarProfilesWithDesc[avatar.name] = {
            profile: avatar.visualProfile as AvatarVisualProfile,
            description: avatar.description
          };
        }
      }
      const crossChapterInvariantsBlock = buildCrossChapterInvariantsBlock(avatarProfilesWithDesc);

      // CRITICAL v3.6: Build Flux.1 human ear guard (Flux.1 Dev ignores negative prompts!)
      const humanAvatars = avatarDetails.filter(av => {
        const profile = av.visualProfile as any;
        const charType = profile?.characterType?.toLowerCase() || '';
        return !charType.includes('animal') && !charType.includes('creature');
      });
      const flux1HumanGuard = humanAvatars.length > 0
        ? `[FLUX.1 CRITICAL FOR ${humanAvatars.map(a => a.name).join(' AND ')}: MUST have normal ROUND human ears on SIDES of head. Ears must be naturally positioned at ear-level, NOT pointed, NOT elf-like, NOT fantasy-shaped. 100% human child anatomy.]`
        : '';

      const enhancedPrompt = this.buildEnhancedImagePrompt(
        coverDescription,
        avatarDetails,
        characterAssignments
      );

      // CRITICAL v3.6: Prepend ALL consistency blocks (same format as chapters!)
      const promptWithConsistency = `${compactAgeBlock}\n${ageEnforcement}\n${flux1HumanGuard}\n\n${enhancedPrompt}\n\n${crossChapterInvariantsBlock}`;
      const promptForModel = this.clampPositivePrompt(promptWithConsistency);

      const seed = Math.floor(Math.random() * 1_000_000_000);
      const stylePreset = "watercolor_storybook";
      // OPTIMIZATION v3.5: Enhanced negative prompt for cover to prevent swaps/duplicates
      const negativePrompt = [
        "deformed, disfigured, watermark, text, signature, low quality",
        "duplicate characters, extra people, crowd, extra children, extra boys, extra girls, extra humans",
        "twins, clones, mirror image, repeated face, same person twice, multiple instances of same character",
        "extra dwarfs, extra gnomes, gnome crowd, dwarf crowd, multiple dwarfs, second dwarf",
        "beard on children, hat on children, dwarfified kids, child with beard",
        "mislabeled species, wrong species, swapped species, puppet, mannequin"
      ].join(", ");
      const imageUrl = await this.generateImage(promptForModel, seed, negativePrompt);

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

