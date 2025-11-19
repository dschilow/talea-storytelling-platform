// AUTOMATED TEST ENDPOINT - Requires Automation API Key
// This endpoint allows automated testing with API key authentication

import { api } from "encore.dev/api";
import { generate } from "./generate";
import { avatarDB } from "../avatar/db";
import { requireAutomationKey } from "../helpers/automationAuth";
import crypto from "crypto";

interface AutoTestRequest {
  apiKey?: string; // Automation API key for security
  testId?: string;
  genre: string;
  setting: string;
  ageGroup: "3-5" | "6-8" | "9-12" | "13+";
  complexity: "simple" | "medium" | "complex";
  length: "short" | "medium" | "long";
  aiModel?: string;
}

interface AutoTestResponse {
  testId: string;
  storyId: string;
  storyTitle: string;
  status: string;
  message: string;
  createdAvatars: string[];
}

/**
 * AUTO-TEST ENDPOINT (Requires Automation API Key)
 *
 * Generates a complete story with automatic avatar creation
 * For automated optimization testing only
 */
export const autoTest = api<AutoTestRequest, AutoTestResponse>(
  { expose: true, method: "POST", path: "/story/auto-test", auth: false },
  async (req): Promise<AutoTestResponse> => {
    // Validate automation API key
    requireAutomationKey(req.apiKey);

    const testId = req.testId || `autotest-${Date.now()}`;
    const userId = `test-user-${testId}`;

    console.log(`[Auto Test] Starting test: ${testId}`);
    console.log(`[Auto Test] Genre: ${req.genre}, AgeGroup: ${req.ageGroup}`);

    // Create 2 test avatars automatically
    const avatarIds: string[] = [];

    const testAvatars = [
      {
        name: "Emma",
        visualProfile: {
          gender: "female",
          ageApprox: 7,
          species: "human",
          hair: { color: "brown", length: "medium", type: "wavy" },
          eyes: { color: "blue" },
          skin: { tone: "light" },
          clothingCanonical: { outfit: "red hoodie and jeans" }
        }
      },
      {
        name: "Luca",
        visualProfile: {
          gender: "male",
          ageApprox: 8,
          species: "human",
          hair: { color: "blonde", length: "short", type: "straight" },
          eyes: { color: "green" },
          skin: { tone: "medium" },
          clothingCanonical: { outfit: "blue t-shirt and shorts" }
        }
      }
    ];

    for (const template of testAvatars) {
      const avatarId = crypto.randomUUID();

      const personalityTraits = {
        knowledge: { value: 5 },
        creativity: { value: 5 },
        vocabulary: { value: 5 },
        courage: { value: 5 },
        curiosity: { value: 5 },
        teamwork: { value: 5 },
        empathy: { value: 5 },
        persistence: { value: 5 },
        logic: { value: 5 }
      };

      await avatarDB.exec`
        INSERT INTO avatars (
          id, user_id, name, description,
          physical_traits, personality_traits, visual_profile,
          creation_type, is_public, created_at, updated_at
        ) VALUES (
          ${avatarId}, ${userId}, ${template.name}, ${'Test avatar for automated testing'},
          ${JSON.stringify({ age: template.visualProfile.ageApprox, gender: template.visualProfile.gender })},
          ${JSON.stringify(personalityTraits)},
          ${JSON.stringify(template.visualProfile)},
          'ai-generated', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `;

      avatarIds.push(avatarId);
      console.log(`[Auto Test] Created avatar: ${template.name} (${avatarId})`);
    }

    // Generate story
    console.log(`[Auto Test] Generating story...`);

    try {
      const story = await generate({
        userId,
        config: {
          avatarIds,
          genre: req.genre,
          setting: req.setting,
          length: req.length,
          complexity: req.complexity,
          ageGroup: req.ageGroup,
          aiModel: req.aiModel as any || "gpt-5-mini",
          useCharacterPool: true
        }
      });

      console.log(`[Auto Test] Story generated: ${story.title} (${story.id})`);
      console.log(`[Auto Test] Status: ${story.status}`);

      // Cleanup: Delete test avatars
      for (const avatarId of avatarIds) {
        await avatarDB.exec`DELETE FROM avatars WHERE id = ${avatarId}`;
      }
      console.log(`[Auto Test] Cleaned up ${avatarIds.length} test avatars`);

      return {
        testId,
        storyId: story.id,
        storyTitle: story.title,
        status: story.status,
        message: `Story generated successfully. Use /story/analyze/${story.id} to analyze.`,
        createdAvatars: avatarIds
      };

    } catch (error) {
      // Cleanup avatars even on error
      for (const avatarId of avatarIds) {
        try {
          await avatarDB.exec`DELETE FROM avatars WHERE id = ${avatarId}`;
        } catch (e) {
          console.error(`[Auto Test] Failed to cleanup avatar ${avatarId}:`, e);
        }
      }

      console.error(`[Auto Test] Error:`, error);

      return {
        testId,
        storyId: '',
        storyTitle: '',
        status: 'error',
        message: `Error: ${(error as Error).message}`,
        createdAvatars: avatarIds
      };
    }
  }
);
