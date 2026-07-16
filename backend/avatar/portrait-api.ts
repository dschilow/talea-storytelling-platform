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
  { expose: false, method: "POST", path: "/avatar/generate-portrait", auth: true },
  async (req) => {
    console.info("[portrait-api] Building legacy portrait prompt", { emotion: req.emotion, pose: req.pose });

    try {
      const prompt = generatePortraitPrompt(req.avatar, req.emotion, req.pose);

      return {
        prompt,
        avatar: req.avatar,
        emotion: req.emotion,
        pose: req.pose
      };

    } catch (error: any) {
      console.error("[portrait-api] Portrait prompt failed", { errorName: error?.name });
      throw new Error("Failed to generate portrait prompt.");
    }
  }
);
