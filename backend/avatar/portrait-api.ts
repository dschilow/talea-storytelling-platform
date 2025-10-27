/**
 * Avatar Portrait API
 *
 * Simple API endpoint for generating avatar portrait prompts.
 */

import { api } from "encore.dev/api";
import { generatePortraitPrompt } from "./simple-portrait-generator";

export interface PortraitRequest {
  avatar: string;
  emotion: 'happy' | 'sad' | 'surprised' | 'neutral' | 'thinking';
  pose: 'standing' | 'sitting' | 'jumping' | 'waving';
}

export interface PortraitResponse {
  prompt: string;
  avatar: string;
  emotion: string;
  pose: string;
}

/**
 * Generate avatar portrait prompt
 */
export const generatePortrait = api<
  PortraitRequest,
  PortraitResponse
>(
  { expose: true, method: "POST", path: "/avatar/generate-portrait" },
  async (req) => {
    console.log(`[portrait-api] Generating portrait for ${req.avatar} (${req.emotion}, ${req.pose})`);

    try {
      const prompt = generatePortraitPrompt(req.avatar, req.emotion, req.pose);

      return {
        prompt,
        avatar: req.avatar,
        emotion: req.emotion,
        pose: req.pose
      };

    } catch (error) {
      console.error("[portrait-api] Error generating portrait:", error);
      throw new Error(`Failed to generate portrait: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
