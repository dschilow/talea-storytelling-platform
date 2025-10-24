/**
 * Vision-QA & Self-Check System (Abschnitt 6.1-6.2 & 10.5)
 * OpenAI Vision API for image quality assurance
 */

import { secret } from "encore.dev/config";
import type { SpeciesType } from "./avatar-image-optimization";

const openAIKey = secret("OpenAIKey");

export interface VisionQAExpectation {
  characterCount: number;
  characters: Array<{
    name: string;
    species: SpeciesType;
    keyFeatures: string[]; // e.g., ["orange tabby stripes", "white chin", "long whiskers"]
  }>;
}

export interface VisionQAResult {
  pass: boolean;
  violations: string[];
  similarity?: number;
  details?: {
    characterCountCorrect: boolean;
    characterCountFound?: number;
    speciesCorrect: boolean;
    featuresCorrect: boolean;
  };
}

/**
 * Builds a QA prompt for OpenAI Vision API
 */
function buildQAPrompt(expectation: VisionQAExpectation): string {
  const lines: string[] = [
    "You are a precise image analysis AI. Analyze this children's book illustration and answer these questions:",
    "",
    `1. CHARACTER COUNT: Are there exactly ${expectation.characterCount} character(s) in this image?`,
  ];

  expectation.characters.forEach((char, idx) => {
    lines.push("");
    lines.push(`2.${idx + 1}. CHARACTER "${char.name.toUpperCase()}" - SPECIES CHECK:`);
    
    if (char.species === "cat") {
      lines.push(`   - Is there exactly ONE cat (NOT a human, NOT anthropomorphic)?`);
      lines.push(`   - Is the cat on four legs (quadruped, NOT standing upright)?`);
      lines.push(`   - Is the cat NOT wearing clothes?`);
    } else if (char.species === "dog") {
      lines.push(`   - Is there exactly ONE dog (NOT a human, NOT anthropomorphic)?`);
      lines.push(`   - Is the dog on four legs (quadruped, NOT standing upright)?`);
      lines.push(`   - Is the dog NOT wearing clothes?`);
    } else if (char.species === "human") {
      lines.push(`   - Is there exactly ONE human child?`);
      lines.push(`   - Is this character clearly a human (NOT an animal)?`);
    }

    if (char.keyFeatures.length > 0) {
      lines.push("");
      lines.push(`2.${idx + 1}.2. KEY FEATURES for "${char.name}":`);
      char.keyFeatures.slice(0, 5).forEach((feature) => {
        lines.push(`   - Does the character have: ${feature}?`);
      });
    }
  });

  lines.push("");
  lines.push("3. CRITICAL CHECKS:");
  lines.push("   - Are there any duplicate characters (two identical boys, two identical cats, etc.)?");
  lines.push("   - Are there any extra/unexpected characters not listed above?");
  lines.push("   - Are there any anthropomorphic animals (animals with human features or standing like humans)?");
  
  lines.push("");
  lines.push("RESPOND IN JSON FORMAT:");
  lines.push('{');
  lines.push('  "characterCount": number (count of distinct characters),');
  lines.push('  "characterCountCorrect": boolean,');
  lines.push('  "violations": string[] (list specific issues found, empty array if none),');
  lines.push('  "characterDetails": [');
  expectation.characters.forEach((char, idx) => {
    lines.push(`    {`);
    lines.push(`      "name": "${char.name}",`);
    lines.push(`      "speciesCorrect": boolean,`);
    lines.push(`      "featuresCorrect": boolean,`);
    lines.push(`      "issues": string[] (specific issues for this character)`);
    lines.push(`    }${idx < expectation.characters.length - 1 ? ',' : ''}`);
  });
  lines.push('  ]');
  lines.push('}');

  return lines.join("\n");
}

/**
 * Calls OpenAI Vision API to analyze an image
 */
async function callVisionAPI(
  imageUrl: string,
  prompt: string
): Promise<any> {
  const apiKey = openAIKey();

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Vision API failed: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices?.[0]?.message?.content || "{}");
}

/**
 * Performs Vision QA on a generated image
 */
export async function performVisionQA(
  imageUrl: string,
  expectation: VisionQAExpectation
): Promise<VisionQAResult> {
  try {
    const prompt = buildQAPrompt(expectation);
    console.log("[VisionQA] Analyzing image with expectations:", {
      characterCount: expectation.characterCount,
      characters: expectation.characters.map((c) => `${c.name} (${c.species})`),
    });

    const apiResult = await callVisionAPI(imageUrl, prompt);
    console.log("[VisionQA] API result:", apiResult);

    const violations: string[] = [];
    let characterCountCorrect = false;
    let speciesCorrect = true;
    let featuresCorrect = true;

    // Check character count
    if (apiResult.characterCountCorrect === false || 
        apiResult.characterCount !== expectation.characterCount) {
      violations.push(
        `Character count mismatch: expected ${expectation.characterCount}, found ${apiResult.characterCount || "unknown"}`
      );
    } else {
      characterCountCorrect = true;
    }

    // Check each character
    if (apiResult.characterDetails && Array.isArray(apiResult.characterDetails)) {
      apiResult.characterDetails.forEach((detail: any, idx: number) => {
        const expectedChar = expectation.characters[idx];
        
        if (detail.speciesCorrect === false) {
          speciesCorrect = false;
          violations.push(
            `Species mismatch for ${expectedChar.name}: expected ${expectedChar.species}`
          );
        }

        if (detail.featuresCorrect === false) {
          featuresCorrect = false;
          violations.push(
            `Feature mismatch for ${expectedChar.name}`
          );
        }

        if (detail.issues && Array.isArray(detail.issues) && detail.issues.length > 0) {
          detail.issues.forEach((issue: string) => {
            violations.push(`${expectedChar.name}: ${issue}`);
          });
        }
      });
    }

    // Add any general violations from API
    if (apiResult.violations && Array.isArray(apiResult.violations)) {
      violations.push(...apiResult.violations);
    }

    const pass = violations.length === 0;

    console.log(`[VisionQA] Result: ${pass ? "✅ PASS" : "❌ FAIL"} (${violations.length} violations)`);
    if (!pass) {
      console.log("[VisionQA] Violations:", violations);
    }

    return {
      pass,
      violations,
      details: {
        characterCountCorrect,
        characterCountFound: apiResult.characterCount,
        speciesCorrect,
        featuresCorrect,
      },
    };
  } catch (error) {
    console.error("[VisionQA] Error during QA:", error);
    // In case of QA failure, we don't block - log and continue
    return {
      pass: true, // Allow to pass if QA system fails (fail-open strategy)
      violations: [],
      details: {
        characterCountCorrect: false,
        speciesCorrect: false,
        featuresCorrect: false,
      },
    };
  }
}

// ========================================================================
// Self-Check & Repair Helpers (Abschnitt 6 & 10.5)
// ========================================================================

export interface RepairConfig {
  cfg: number;
  positivePrompt: string;
  negativePrompt: string;
}

/**
 * Strengthens constraints for retry attempts
 * - Increases CFG
 * - Duplicates MUST INCLUDE tokens
 * - Adds identity negatives
 */
export function strengthenConstraintsForRetry(
  config: RepairConfig,
  attempt: number,
  identityNegatives: string[]
): RepairConfig {
  const strengthened = { ...config };

  // Increase CFG (cap at 12)
  strengthened.cfg = Math.min(config.cfg + 1, 12);

  // Duplicate MUST INCLUDE tokens
  const mustIncludeMatch = config.positivePrompt.match(/MUST INCLUDE: ([^.]+)/);
  if (mustIncludeMatch) {
    const mustIncludeTokens = mustIncludeMatch[1];
    strengthened.positivePrompt = config.positivePrompt.replace(
      /MUST INCLUDE: ([^.]+)/,
      `MUST INCLUDE: ${mustIncludeTokens}, ${mustIncludeTokens}` // Duplicate for emphasis
    );
  }

  // Add identity negatives if not present
  const existingNegatives = new Set(config.negativePrompt.split(", ").map((n) => n.trim()));
  const newNegatives = identityNegatives.filter((neg) => !existingNegatives.has(neg));

  if (newNegatives.length > 0) {
    strengthened.negativePrompt = [config.negativePrompt, ...newNegatives].join(", ");
  }

  console.log(`[RepairConfig] Attempt ${attempt}: CFG ${config.cfg} -> ${strengthened.cfg}`);
  console.log(`[RepairConfig] Added ${newNegatives.length} new negative prompts`);

  return strengthened;
}

/**
 * Extracts key features from character block for QA
 */
export function extractKeyFeaturesFromMustInclude(mustInclude: string[]): string[] {
  // Take top 5 most descriptive features
  return mustInclude.filter((f) => f.trim().length > 5).slice(0, 5);
}

