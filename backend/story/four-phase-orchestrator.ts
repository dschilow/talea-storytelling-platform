// Four-Phase Story Generation Orchestrator
// Coordinates all 4 phases: Skeleton -> Matching -> Finalization -> Images

import type { StoryConfig, Chapter } from "./generate";
import { Phase1SkeletonGenerator } from "./phase1-skeleton";
import { Phase2CharacterMatcher } from "./phase2-matcher";
import { Phase3StoryFinalizer } from "./phase3-finalizer";
import { ai } from "~encore/clients";
import { storyDB } from "./db";
import type { StorySkeleton, CharacterTemplate, FinalizedStory } from "./types";
import { logTopic } from "../log/logger";
import { publishWithTimeout } from "../helpers/pubsubTimeout";

interface AvatarDetail {
  id: string;
  name: string;
  description?: string;
  physicalTraits?: any;
  personalityTraits?: any;
  imageUrl?: string;
  visualProfile?: any;
  creationType: "ai-generated" | "photo-upload";
}

interface FourPhaseInput {
  config: StoryConfig;
  avatarDetails: AvatarDetail[];
  userId: string;
  clerkToken: string;
}

interface FourPhaseOutput {
  title: string;
  description: string;
  coverImageUrl?: string;
  chapters: Chapter[];
  avatarDevelopments?: any[];
  metadata?: {
    tokensUsed?: {
      prompt: number;
      completion: number;
      total: number;
      inputCostUSD?: number;
      outputCostUSD?: number;
      totalCostUSD?: number;
      modelUsed?: string;
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
  };
}

export class FourPhaseOrchestrator {
  private phase1Generator: Phase1SkeletonGenerator;
  private phase2Matcher: Phase2CharacterMatcher;
  private phase3Finalizer: Phase3StoryFinalizer;

  constructor() {
    this.phase1Generator = new Phase1SkeletonGenerator();
    this.phase2Matcher = new Phase2CharacterMatcher();
    this.phase3Finalizer = new Phase3StoryFinalizer();
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

    // ===== PHASE 1: Generate Story Skeleton =====
    console.log("[4-Phase] ===== PHASE 1: SKELETON GENERATION =====");
    const phase1Start = Date.now();

    await publishWithTimeout(logTopic, {
      source: "4-phase-orchestrator",
      level: "info",
      message: "Phase 1: Skeleton Generation started",
      timestamp: new Date(),
      data: {
        phase: 1,
        genre: input.config.genre,
        setting: input.config.setting,
        avatarCount: input.avatarDetails.length,
        aiModel: input.config.aiModel || "gpt-5-mini",
      },
    });

    const skeleton = await this.phase1Generator.generate({
      config: input.config,
      avatarDetails: input.avatarDetails.map(a => ({
        name: a.name,
        description: a.description,
      })),
    });
    phaseDurations.phase1Duration = Date.now() - phase1Start;
    console.log(`[4-Phase] Phase 1 completed in ${phaseDurations.phase1Duration}ms`);

    await publishWithTimeout(logTopic, {
      source: "4-phase-orchestrator",
      level: "info",
      message: "Phase 1: Skeleton Generation completed",
      timestamp: new Date(),
      data: {
        phase: 1,
        duration: phaseDurations.phase1Duration,
        title: skeleton.title,
        chaptersCount: skeleton.chapters?.length,
        requirementsCount: skeleton.supportingCharacterRequirements?.length,
      },
    });

    // ===== PHASE 2: Match Characters from Pool =====
    console.log("[4-Phase] ===== PHASE 2: CHARACTER MATCHING =====");
    const phase2Start = Date.now();

    await publishWithTimeout(logTopic, {
      source: "4-phase-orchestrator",
      level: "info",
      message: "Phase 2: Character Matching started",
      timestamp: new Date(),
      data: {
        phase: 2,
        requirementsCount: skeleton.supportingCharacterRequirements?.length,
        setting: input.config.setting,
      },
    });

    // Get recent stories for freshness calculation
    const recentStoryIds = await this.getRecentStoryIds(input.userId, 5);

    const characterAssignments = await this.phase2Matcher.match(
      skeleton,
      input.config.setting,
      recentStoryIds
    );
    phaseDurations.phase2Duration = Date.now() - phase2Start;
    console.log(`[4-Phase] Phase 2 completed in ${phaseDurations.phase2Duration}ms`);
    console.log(`[4-Phase] Matched ${characterAssignments.size} characters from pool`);

    await publishWithTimeout(logTopic, {
      source: "4-phase-orchestrator",
      level: "info",
      message: "Phase 2: Character Matching completed",
      timestamp: new Date(),
      data: {
        phase: 2,
        duration: phaseDurations.phase2Duration,
        matchedCharacters: characterAssignments.size,
        characters: Array.from(characterAssignments.entries()).map(([placeholder, char]) => ({
          placeholder,
          name: char.name,
          role: char.role,
          archetype: char.archetype,
        })),
      },
    });

    // ===== PHASE 3: Finalize Story with Characters =====
    console.log("[4-Phase] ===== PHASE 3: STORY FINALIZATION =====");
    const phase3Start = Date.now();

    await publishWithTimeout(logTopic, {
      source: "4-phase-orchestrator",
      level: "info",
      message: "Phase 3: Story Finalization started",
      timestamp: new Date(),
      data: {
        phase: 3,
        skeletonTitle: skeleton.title,
        charactersCount: characterAssignments.size,
        aiModel: input.config.aiModel || "gpt-5-mini",
      },
    });

    const finalizedStory = await this.phase3Finalizer.finalize({
      skeleton,
      assignments: characterAssignments,
      config: input.config,
      avatarDetails: input.avatarDetails,
    });
    phaseDurations.phase3Duration = Date.now() - phase3Start;
    console.log(`[4-Phase] Phase 3 completed in ${phaseDurations.phase3Duration}ms`);

    await publishWithTimeout(logTopic, {
      source: "4-phase-orchestrator",
      level: "info",
      message: "Phase 3: Story Finalization completed",
      timestamp: new Date(),
      data: {
        phase: 3,
        duration: phaseDurations.phase3Duration,
        title: finalizedStory.title,
        chaptersCount: finalizedStory.chapters?.length,
        totalWords: finalizedStory.chapters?.reduce((sum, ch) => sum + ch.content.split(/\s+/).length, 0),
      },
    });

    // ===== PHASE 4: Generate Chapter Images =====
    console.log("[4-Phase] ===== PHASE 4: IMAGE GENERATION =====");
    const phase4Start = Date.now();

    await publishWithTimeout(logTopic, {
      source: "4-phase-orchestrator",
      level: "info",
      message: "Phase 4: Image Generation started",
      timestamp: new Date(),
      data: {
        phase: 4,
        chaptersToGenerate: finalizedStory.chapters?.length,
      },
    });

    const chaptersWithImages = await this.generateChapterImages(
      finalizedStory,
      input.avatarDetails,
      characterAssignments,
      input.config
    );
    phaseDurations.phase4Duration = Date.now() - phase4Start;
    console.log(`[4-Phase] Phase 4 completed in ${phaseDurations.phase4Duration}ms`);

    const successfulImages = chaptersWithImages.filter(ch => ch.imageUrl).length;

    await publishWithTimeout(logTopic, {
      source: "4-phase-orchestrator",
      level: "info",
      message: "Phase 4: Image Generation completed",
      timestamp: new Date(),
      data: {
        phase: 4,
        duration: phaseDurations.phase4Duration,
        totalImages: chaptersWithImages.length,
        successfulImages,
        failedImages: chaptersWithImages.length - successfulImages,
      },
    });

    // Generate cover image
    console.log("[4-Phase] Generating cover image...");
    const coverStart = Date.now();
    const coverImageUrl = await this.generateCoverImage(
      finalizedStory,
      input.avatarDetails,
      characterAssignments
    );
    const coverDuration = Date.now() - coverStart;

    await publishWithTimeout(logTopic, {
      source: "4-phase-orchestrator",
      level: "info",
      message: "Cover Image Generation completed",
      timestamp: new Date(),
      data: {
        duration: coverDuration,
        success: !!coverImageUrl,
      },
    });

    const totalDuration = Date.now() - startTime;
    console.log(`[4-Phase] Total orchestration completed in ${totalDuration}ms`);

    // Final summary log
    await publishWithTimeout(logTopic, {
      source: "4-phase-orchestrator",
      level: "info",
      message: "4-Phase Story Generation completed",
      timestamp: new Date(),
      data: {
        totalDuration,
        phase1Duration: phaseDurations.phase1Duration,
        phase2Duration: phaseDurations.phase2Duration,
        phase3Duration: phaseDurations.phase3Duration,
        phase4Duration: phaseDurations.phase4Duration,
        title: finalizedStory.title,
        charactersUsed: characterAssignments.size,
        chaptersGenerated: chaptersWithImages.length,
        imagesGenerated: successfulImages + (coverImageUrl ? 1 : 0),
      },
    });

    // Build metadata about character pool usage
    const characterPoolUsed = Array.from(characterAssignments.entries()).map(([placeholder, character]) => ({
      placeholder,
      characterId: character.id,
      characterName: character.name,
    }));

    return {
      title: finalizedStory.title,
      description: finalizedStory.description,
      coverImageUrl,
      chapters: chaptersWithImages,
      avatarDevelopments: [], // Will be generated by existing AI system
      metadata: {
        processingTime: totalDuration,
        imagesGenerated: chaptersWithImages.length + 1, // chapters + cover
        phases: phaseDurations,
        characterPoolUsed,
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
    characterAssignments: Map<string, CharacterTemplate>,
    config: StoryConfig
  ): Promise<Chapter[]> {
    console.log("[4-Phase] Generating chapter images...");

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

        console.log(`[4-Phase] Generating image for chapter ${chapter.order}...`);
        const imageUrl = await this.generateImage(enhancedPrompt, config);

        return {
          id: crypto.randomUUID(),
          title: chapter.title,
          content: chapter.content,
          imageUrl,
          order: chapter.order,
        };
      } catch (error) {
        console.error(`[4-Phase] Failed to generate image for chapter ${chapter.order}:`, error);
        return {
          id: crypto.randomUUID(),
          title: chapter.title,
          content: chapter.content,
          imageUrl: undefined,
          order: chapter.order,
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
   */
  private visualProfileToImagePrompt(vp: any): string {
    if (!vp) return 'no visual details available';

    const parts: string[] = [];

    if (vp.ageApprox) parts.push(`${vp.ageApprox} years old`);
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
   */
  private buildEnhancedImagePrompt(
    baseDescription: string,
    avatarDetails: AvatarDetail[],
    characterAssignments: Map<string, CharacterTemplate>
  ): string {
    // Add avatar canonical appearance with converted visual profiles
    const avatarBlocks = avatarDetails
      .map(avatar => {
        const visualContext = avatar.visualProfile
          ? this.visualProfileToImagePrompt(avatar.visualProfile)
          : (avatar.description || 'no description');
        return `[${avatar.name}]: ${visualContext}`;
      })
      .join("\n");

    // Add supporting character consistency
    const supportingCharacterBlocks = Array.from(characterAssignments.values())
      .map(char => `[${char.name}]: ${char.visualProfile.description}`)
      .join("\n");

    return `
${baseDescription}

CHARACTER CONSISTENCY GUIDE:
${avatarBlocks}

${supportingCharacterBlocks}

STYLE: Axel Scheffler watercolor illustration, warm colors, child-friendly, storybook quality
    `.trim();
  }

  /**
   * Generate a single image using AI service
   */
  private async generateImage(prompt: string, config: StoryConfig): Promise<string | undefined> {
    try {
      const response = await ai.generateImage({
        prompt,
        ageGroup: config.ageGroup,
        style: "watercolor",
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
  ): Promise<string | undefined> {
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

      const imageUrl = await this.generateImage(enhancedPrompt, { ageGroup: "6-8" } as any);

      console.log("[4-Phase] Cover image generated:", !!imageUrl);
      return imageUrl;
    } catch (error) {
      console.error("[4-Phase] Failed to generate cover image:", error);
      return undefined;
    }
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
