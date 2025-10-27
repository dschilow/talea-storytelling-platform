/**
 * Image Prompt Generation Service
 *
 * Generates consistent image prompts for story chapters using avatar canons.
 */

import { api } from "encore.dev/api";
import type { Avatar } from "../avatar/avatar";
import { avatarCanonManager } from "../avatar/avatar-canon-manager";
import { ImagePromptBuilder, validateImagePromptQuality } from "./image-prompt-builder";
import type { StandardizedAvatarAnalysis, AvatarCanon } from "../avatar/avatar-analysis-schema";
import { convertToAvatarCanon } from "../avatar/avatar-analysis-schema";

/**
 * Image prompt generation request
 */
export interface ImagePromptGenerationRequest {
  storyData: {
    title: string;
    chapters: Array<{
      order: number;
      title: string;
      content: string;
      imageDescription: {
        scene: string;
        characters: string;
        environment: string;
        composition: string;
        mood: string;
      };
    }>;
  };
  avatarIds: string[];
  style?: string;
}

/**
 * Image prompt generation response
 */
export interface ImagePromptGenerationResponse {
  prompts: Array<{
    chapterNumber: number;
    chapterTitle: string;
    prompt: string;
    qualityScore: number;
    validation: {
      isValid: boolean;
      missing: string[];
    };
  }>;
  metadata: {
    avatarCanonsUsed: string[];
    totalQualityScore: number;
    consistencyWarnings: string[];
  };
}

/**
 * Generate image prompts for story chapters
 */
export const generateChapterImagePrompts = api<
  ImagePromptGenerationRequest,
  ImagePromptGenerationResponse
>(
  { expose: true, method: "POST", path: "/ai/generate-chapter-image-prompts" },
  async (req) => {
    console.log(`[image-prompt-service] 🎨 Generating prompts for ${req.storyData.chapters.length} chapters`);

    try {
      // 1. Load avatar canons
      const avatarCanons = await avatarCanonManager.getCanons(req.avatarIds);
      console.log(`[image-prompt-service] ✅ Loaded ${avatarCanons.size} avatar canons`);

      // 2. Validate consistency
      const consistencyCheck = avatarCanonManager.validateConsistency(avatarCanons);
      const consistencyWarnings = consistencyCheck.isConsistent ? [] : consistencyCheck.issues;

      // 3. Create prompt builder
      const promptBuilder = new ImagePromptBuilder(avatarCanons, req.style);

      // 4. Generate prompts for all chapters
      const prompts = req.storyData.chapters.map((chapter, index) => {
        const prompt = promptBuilder.generateChapterPrompt(
          chapter.order,
          chapter.imageDescription.scene,
          Array.from(avatarCanons.keys()),
          extractPoses(chapter.imageDescription.characters, Array.from(avatarCanons.keys())),
          chapter.imageDescription.environment,
          chapter.imageDescription.composition
        );

        // Validate prompt quality
        const quality = validateImagePromptQuality(prompt);

        return {
          chapterNumber: chapter.order,
          chapterTitle: chapter.title,
          prompt,
          qualityScore: quality.score,
          validation: promptBuilder.validatePrompt(prompt)
        };
      });

      // 5. Calculate overall metrics
      const totalQualityScore = prompts.reduce((sum, p) => sum + p.qualityScore, 0) / prompts.length;
      const validationPassed = prompts.every(p => p.validation.isValid);

      console.log(`[image-prompt-service] ✅ Generated ${prompts.length} prompts`);
      console.log(`[image-prompt-service] 📊 Average quality: ${totalQualityScore.toFixed(1)}/10`);
      console.log(`[image-prompt-service] ✅ All valid: ${validationPassed}`);

      if (consistencyWarnings.length > 0) {
        console.warn(`[image-prompt-service] ⚠️ Consistency warnings:`, consistencyWarnings);
      }

      return {
        prompts,
        metadata: {
          avatarCanonsUsed: Array.from(avatarCanons.keys()),
          totalQualityScore: Math.round(totalQualityScore * 10) / 10,
          consistencyWarnings
        }
      };

    } catch (error) {
      console.error("[image-prompt-service] ❌ Generation failed:", error);
      throw error;
    }
  }
);

/**
 * Extract avatar poses from character description
 */
function extractPoses(
  charactersDescription: string,
  avatarNames: string[]
): Record<string, string> {
  const poses: Record<string, string> = {};

  for (const name of avatarNames) {
    const regex = new RegExp(`${name}\\s+([^,]+)`, 'i');
    const match = charactersDescription.match(regex);
    if (match) {
      poses[name] = match[1].trim();
    } else {
      poses[name] = "standing naturally";
    }
  }

  return poses;
}

/**
 * Generate prompts with enhanced validation
 */
export async function generateEnhancedImagePrompts(
  storyData: ImagePromptGenerationRequest["storyData"],
  avatarIds: string[],
  style?: string
): Promise<ImagePromptGenerationResponse> {

  console.log(`[enhanced-prompts] 🚀 Starting enhanced prompt generation`);

  // Use the main API function
  return await generateChapterImagePrompts({
    storyData,
    avatarIds,
    style: style || "Axel Scheffler watercolor"
  });
}
