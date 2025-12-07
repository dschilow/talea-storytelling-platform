// Four-Phase Story Generation Orchestrator
// Coordinates all 4 phases: Skeleton -> Matching -> Finalization -> Images

import type { StoryConfig, Chapter } from "./generate";
import { Phase1SkeletonGenerator, type Phase1GenerationResult } from "./phase1-skeleton";
import { Phase2CharacterMatcher } from "./phase2-matcher";
import { Phase3StoryFinalizer, type Phase3FinalizationResult } from "./phase3-finalizer";
import { FairyTaleSelector, type SelectedFairyTale } from "./fairy-tale-selector";
import { ai } from "~encore/clients";
import { storyDB } from "./db";
import type { StorySkeleton, CharacterTemplate, FinalizedStory } from "./types";
import { logTopic, type LogEvent } from "../log/logger";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import {
  applyStoryExperienceToConfig,
  buildStoryExperienceContext,
  describeEmotionalFlavors,
  describeSpecialIngredients,
  type StoryExperienceContext,
} from "./story-experience";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { InventoryItem } from "../avatar/avatar";
import { generateArtifactImage } from "./artifact-image-generator";
import type { NewArtifact } from "./types";
import { addArtifactToInventoryInternal } from "../gamification/item-system";

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
  // 🎁 NEW: Loot artifact from this story
  newArtifact?: NewArtifact & { imageUrl?: string };
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
      remixInstructions: phase1Result.remixInstructions, // NEW: Pass remix instructions from Phase1
      selectedFairyTale: selectedFairyTale ?? undefined, // NEW: Pass fairy tale for originality validation
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

    // ===== PHASE 4: Generate Chapter Images =====
    console.log("[4-Phase] ===== PHASE 4: IMAGE GENERATION =====");
    const phase4Start = Date.now();

    const chaptersWithImages = await this.generateChapterImages(
      finalizedStory,
      input.avatarDetails,
      characterAssignments
    );
    phaseDurations.phase4Duration = Date.now() - phase4Start;
    console.log(`[4-Phase] Phase 4 completed in ${phaseDurations.phase4Duration}ms`);

    const successfulImages = chaptersWithImages.filter(ch => ch.imageUrl).length;

    // Generate cover image
    console.log("[4-Phase] Generating cover image...");
    const coverStart = Date.now();
    const coverImage = await this.generateCoverImage(
      finalizedStory,
      input.avatarDetails,
      characterAssignments
    );
    const coverDuration = Date.now() - coverStart;
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
      avatarDevelopments: finalizedStory.avatarDevelopments || [], // 🔧 Pass through from Phase 3
      // 🎁 NEW: Pass loot artifact with generated image to frontend
      newArtifact: finalizedStory.newArtifact
        ? { ...finalizedStory.newArtifact, imageUrl: artifactImageUrl }
        : undefined,
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

    const chapters: Chapter[] = [];

    // Generate all images in parallel for speed
    const imagePromises = story.chapters.map(async (chapter) => {
      try {
        // Build enhanced prompt with character consistency
        const enhancedPrompt = this.buildEnhancedImagePrompt(
          chapter.imageDescription,
          avatarDetails,
          characterAssignments
        );
        const imageSeed = Math.floor(Math.random() * 1_000_000_000);
        const imageModel = "ai.generateImage-default";
        const negativePrompt = "deformed, disfigured, duplicate, extra limbs, watermark, text, clones, twins, multiple views, split screen, multiple instances of same character";
        const stylePreset = "watercolor_storybook";

        console.log(`[4-Phase] Generating image for chapter ${chapter.order}...`);
        const imageUrl = await this.generateImage(enhancedPrompt, imageSeed, negativePrompt);

        return {
          id: crypto.randomUUID(),
          title: chapter.title,
          content: chapter.content,
          imageUrl,
          order: chapter.order,
          imagePrompt: enhancedPrompt,
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
  private visualProfileToImagePrompt(vp: any): string {
    if (!vp) return 'no visual details available';

    // OPTIMIZATION: Use the pre-generated, consistent image prompt if available
    if (vp.imagePrompt && typeof vp.imagePrompt === 'string' && vp.imagePrompt.length > 10) {
      // Strip "Portrait of [Name], " prefix if present to fit into scene description
      let prompt = vp.imagePrompt;
      // Remove common prefixes that might have been generated
      prompt = prompt.replace(/^Portrait of [^,]+,\s*/i, '');
      prompt = prompt.replace(/^A portrait of [^,]+,\s*/i, '');

      return prompt;
    }

    const parts: string[] = [];

    // AGE FIRST (critical for size relationships)
    if (vp.ageApprox) {
      parts.push(`${vp.ageApprox} years old`);

      // Add explicit size constraints based on age
      if (vp.ageApprox <= 7) {
        parts.push('small child size');
      } else if (vp.ageApprox <= 10) {
        parts.push('child-sized');
      }
    }

    if (vp.gender) parts.push(vp.gender);

    if (vp.hair) {
      const hairParts = [];
      if (vp.hair.color) hairParts.push(vp.hair.color);
      if (vp.hair.length) hairParts.push(vp.hair.length);
      if (vp.hair.type) hairParts.push(vp.hair.type);
      if (vp.hair.style) hairParts.push(vp.hair.style);
      if (hairParts.length > 0) parts.push(`${hairParts.join(' ')} hair`);
    }

    if (vp.eyes?.color) parts.push(`${vp.eyes.color} eyes`);

    if (vp.skin?.tone) parts.push(`${vp.skin.tone} skin`);

    if (vp.clothingCanonical) {
      const clothingParts = [];
      if (vp.clothingCanonical.outfit) clothingParts.push(vp.clothingCanonical.outfit);
      else {
        if (vp.clothingCanonical.top) clothingParts.push(vp.clothingCanonical.top);
        if (vp.clothingCanonical.bottom) clothingParts.push(vp.clothingCanonical.bottom);
      }
      if (vp.clothingCanonical.footwear) clothingParts.push(vp.clothingCanonical.footwear);
      if (clothingParts.length > 0) parts.push(`wearing ${clothingParts.join(', ')}`);
    }

    if (vp.accessories && vp.accessories.length > 0) {
      parts.push(`with ${vp.accessories.join(', ')}`);
    }

    if (vp.consistentDescriptors && vp.consistentDescriptors.length > 0) {
      parts.push(vp.consistentDescriptors.join(', '));
    }

    return parts.join(', ');
  }

  /**
   * Build enhanced image prompt with character consistency
   * CRITICAL: Maintains age/size order to prevent mix-ups
   * OPTIMIZATION v2.4: Genre-Aware Costume Override based on imageDescription
   */
  private buildEnhancedImagePrompt(
    baseDescription: string,
    avatarDetails: AvatarDetail[],
    characterAssignments: Map<string, CharacterTemplate>
  ): string {
    // OPTIMIZATION v2.4: Check imageDescription for genre keywords
    const genreKeywords = ['medieval', 'fantasy', 'magic', 'castle', 'knight', 'princess', 'dragon', 'fairy', 'wizard', 'witch', 'kingdom', 'ancient', 'steampunk', 'victorian', 'retro', 'historical', 'old world', 'village', 'steam', 'gear', 'clockwork', 'brass'];
    const descriptionLower = baseDescription.toLowerCase();
    const isGenreScene = genreKeywords.some(keyword => descriptionLower.includes(keyword));
    const isSteampunk = descriptionLower.includes('steampunk') || descriptionLower.includes('steam') || descriptionLower.includes('gear') || descriptionLower.includes('clockwork');

    // Build character lookup with AGE for sorting
    interface CharacterInfo {
      name: string;
      description: string;
      age: number;
    }

    const allCharacters = new Map<string, CharacterInfo>();

    // Add avatars with FULL descriptions + age
    for (const avatar of avatarDetails) {
      let visualContext = avatar.visualProfile
        ? this.visualProfileToImagePrompt(avatar.visualProfile)
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

      const age = avatar.visualProfile?.ageApprox || 8; // fallback

      allCharacters.set(avatar.name.toLowerCase(), {
        name: avatar.name,
        description: visualContext,
        age
      });
    }

    // Add supporting characters with FULL descriptions
    for (const char of characterAssignments.values()) {
      let fullDesc = char.visualProfile.description || 'default character';

      // If we have a pre-built image prompt (from our optimization), use it!
      // But visualProfileToImagePrompt already handles this.
      // Wait, `char.visualProfile.description` is the TEXT description.
      // `visualProfileToImagePrompt` converts the structured data (or uses the imagePrompt field).
      // We should use `visualProfileToImagePrompt` here too!

      fullDesc = this.visualProfileToImagePrompt(char.visualProfile);

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

      const age = 30; // Adults default to 30

      allCharacters.set(char.name.toLowerCase(), {
        name: char.name,
        description: fullDesc,
        age
      });
    }

    // Extract character names mentioned in this scene
    // Note: descriptionLower already declared above (line 755)
    const charactersInScene: CharacterInfo[] = [];

    for (const [charName, charInfo] of allCharacters.entries()) {
      if (descriptionLower.includes(charName)) {
        charactersInScene.push(charInfo);
      }
    }

    // If no characters found, include ALL (fallback)
    if (charactersInScene.length === 0) {
      console.warn("[Image Prompt] No characters detected in scene description, including all");
      charactersInScene.push(...allCharacters.values());
    }

    // CRITICAL: Sort by AGE (youngest first) to establish clear size hierarchy
    // This prevents younger children from appearing older/bigger than older ones
    charactersInScene.sort((a, b) => a.age - b.age);

    // Add explicit age ordering instruction
    const characterBlock = charactersInScene
      .map(c => `${c.name}: ${c.description}`)
      .join("\n\n");

    const ageOrder = charactersInScene.length > 1
      ? `\nIMPORTANT: Characters listed from youngest to oldest. Maintain size relationships - ${charactersInScene[0].name} (${charactersInScene[0].age}y) must be SMALLER than any older character.`
      : '';

    return `
${baseDescription}

CHARACTERS IN THIS SCENE (lock face/outfit/age):
${characterBlock}${ageOrder}

Art style: watercolor illustration, Axel Scheffler style, warm colours, child-friendly
IMPORTANT: Keep each character's face, age, outfit, hair, and species consistent across all images. Do not add text or watermarks.
ENSURE SINGLE INSTANCE OF EACH CHARACTER. Do not generate twins or clones.
    `.trim();
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
    negativePrompt?: string
  ): Promise<string | undefined> {
    try {
      const response = await ai.generateImage({
        prompt,
        seed,
        negativePrompt: negativePrompt,
      });

      return response.imageUrl;
    } catch (error) {
      console.error("[4-Phase] Image generation failed:", error);
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
      // Build cover scene description
      const avatarNames = avatarDetails.map(a => a.name).join(", ");
      const supportingCharacters = Array.from(characterAssignments.values())
        .slice(0, 2) // Include up to 2 main supporting characters
        .map(c => c.name)
        .join(", ");

      const coverDescription = `
Book cover illustration for "${story.title}".
Main characters ${avatarNames}${supportingCharacters ? ` with ${supportingCharacters}` : ''} in an exciting scene.
${story.description}
      `.trim();

      const enhancedPrompt = this.buildEnhancedImagePrompt(
        coverDescription,
        avatarDetails,
        characterAssignments
      );

      const seed = Math.floor(Math.random() * 1_000_000_000);
      const stylePreset = "watercolor_storybook";
      const negativePrompt = "deformed, disfigured, duplicate, extra limbs, watermark, text, clones, twins, multiple views, split screen, multiple instances of same character";
      const imageUrl = await this.generateImage(enhancedPrompt, seed, negativePrompt);

      console.log("[4-Phase] Cover image generated:", !!imageUrl);
      return { url: imageUrl, prompt: enhancedPrompt };
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

