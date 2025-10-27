/**
 * Enhanced Test Suite for 10.0/10 Optimization
 *
 * Comprehensive testing for all optimization features:
 * - Avatar canon consistency
 * - Story quality metrics
 * - Image prompt validation
 * - Avatar analysis quality
 */

import { validateAvatarAnalysis } from "../ai/avatar-analysis-validator";
import { validateImagePromptQuality } from "./image-prompt-builder";
import { validatePromptQualityExtended } from "./prompt-quality-validator";
import { buildImagePrompt } from "./image-prompt-builder";
import { buildEnhancedSystemPrompt } from "./enhanced-story-prompts";
import { generateInitialPortrait, generateStoryThumbnail } from "../avatar/avatar-portrait-generator";
import type { StandardizedAvatarAnalysis, AvatarCanon } from "../avatar/avatar-analysis-schema";
import { convertToAvatarCanon } from "../avatar/avatar-analysis-schema";

// Test data
export const TEST_AVATAR_ANALYSIS: StandardizedAvatarAnalysis = {
  name: "Alexander",
  type: "human child",
  ageApprox: "6-8",
  gender: "boy",

  hair: {
    color: "chestnut brown with golden highlights",
    style: "short voluminous curls with side-swept bangs",
    length: "short",
    texture: "curly"
  },

  eyes: {
    color: "warm amber",
    shape: "round",
    size: "large",
    expression: "curious and bright"
  },

  face: {
    shape: "round",
    skinTone: "light warm peach-beige",
    distinctiveFeatures: ["rosy cheeks", "button nose", "dimples when smiling"]
  },

  body: {
    build: "slim",
    height: "average",
    posture: "upright and confident"
  },

  clothing: {
    primary: "green hoodie",
    secondary: "white t-shirt",
    style: "casual",
    colors: ["green", "white"]
  },

  emotionalTriggers: {
    joy: ["discovering something new", "helping others", "playing with friends"],
    fear: ["dark places", "being alone", "heights"],
    anger: ["injustice", "bullies", "when friends are hurt"],
    sadness: ["letting friends down", "feeling left out", "disappointing others"]
  },

  typicalActions: {
    movement: ["quick jumps", "eager running", "spontaneous gestures"],
    speech: ["excited shouting", "fast talking", "lots of questions"],
    interaction: ["hugs friends often", "high-fives", "playful pushing"]
  },

  canonDescriptors: {
    short: "boy with brown curls and amber eyes",
    medium: "energetic boy with chestnut-brown curly hair, bright amber eyes, wearing a green hoodie",
    long: "A curious 6-8 year old boy with short voluminous chestnut-brown curls with golden highlights and bright amber eyes. His round face features rosy cheeks, a button nose, and dimples when he smiles. He has a slim build and confident posture, dressed casually in a green hoodie over a white t-shirt."
  }
};

export const TEST_AVATAR_ANALYSIS_2: StandardizedAvatarAnalysis = {
  name: "adrian",
  type: "human child",
  ageApprox: "6-8",
  gender: "boy",

  hair: {
    color: "golden blonde with messy fringe",
    style: "short messy hair with spiky fringe",
    length: "short",
    texture: "wavy"
  },

  eyes: {
    color: "bright sky blue",
    shape: "wide",
    size: "large",
    expression: "dreamy and thoughtful"
  },

  face: {
    shape: "oval",
    skinTone: "fair peach with rosy cheeks",
    distinctiveFeatures: ["freckles across nose", "gentle smile", "smooth complexion"]
  },

  body: {
    build: "slim",
    height: "average",
    posture: "relaxed and thoughtful"
  },

  clothing: {
    primary: "blue denim jacket",
    secondary: "mustard yellow hoodie",
    style: "casual",
    colors: ["blue", "yellow", "white"]
  },

  emotionalTriggers: {
    joy: ["quiet moments", "solving puzzles", "sharing ideas"],
    fear: ["loud noises", "conflict", "uncertainty"],
    anger: ["broken promises", "unfairness", "being rushed"],
    sadness: ["feeling misunderstood", "letting others down", "missing opportunities"]
  },

  typicalActions: {
    movement: ["careful steps", "thoughtful gestures", "observant pauses"],
    speech: ["soft voice", "detailed explanations", "thoughtful questions"],
    interaction: ["gentle touches", "encouraging words", "patient listening"]
  },

  canonDescriptors: {
    short: "boy with blonde hair and blue eyes",
    medium: "thoughtful boy with golden blonde messy hair, bright blue eyes, wearing a blue jacket",
    long: "A thoughtful 6-8 year old boy with short messy golden blonde hair and bright sky blue eyes. His oval face features freckles across the nose, a gentle smile, and smooth fair skin. He has a slim build and relaxed posture, dressed casually in a blue denim jacket over a mustard yellow hoodie."
  }
};

/**
 * Test Avatar Analysis Validation
 */
export function testAvatarAnalysisValidation(): {
  name: string;
  passed: boolean;
  score: number;
  issues: string[];
} {
  console.log("[test-suite] 🧪 Testing avatar analysis validation...");

  const validation = validateAvatarAnalysis(TEST_AVATAR_ANALYSIS);

  const passed = validation.isValid && validation.score >= 9.0;
  const issues = validation.issues;

  console.log(`[test-suite] ✅ Validation score: ${validation.score}/10`);
  if (issues.length > 0) {
    console.log(`[test-suite] ⚠️ Issues:`, issues);
  }

  return {
    name: "Avatar Analysis Validation",
    passed,
    score: validation.score,
    issues
  };
}

/**
 * Test Image Prompt Quality
 */
export function testImagePromptQuality(): {
  name: string;
  passed: boolean;
  score: number;
  issues: string[];
} {
  console.log("[test-suite] 🧪 Testing image prompt quality...");

  const avatar1Canon = convertToAvatarCanon(TEST_AVATAR_ANALYSIS);
  const avatar2Canon = convertToAvatarCanon(TEST_AVATAR_ANALYSIS_2);

  const prompt = buildImagePrompt(
    "Alexander reaches toward a glowing golden key while adrian watches from behind",
    [avatar1Canon, avatar2Canon],
    "spiral stone staircase, warm candlelight, fluttering banners",
    "diagonal view from below, Alexander foreground left reaching up, adrian background right observing"
  );

  const validation = validateImagePromptQuality(prompt);
  const extendedValidation = validatePromptQualityExtended(prompt);

  const passed = validation.score >= 9.0 && extendedValidation.score >= 9.0;
  const score = (validation.score + extendedValidation.score) / 2;
  const issues = [...validation.missing, ...extendedValidation.recommendations];

  console.log(`[test-suite] ✅ Prompt quality: ${validation.score}/10`);
  console.log(`[test-suite] ✅ Extended quality: ${extendedValidation.score}/10`);
  console.log(`[test-suite] 📝 Prompt length: ${prompt.length} characters`);

  return {
    name: "Image Prompt Quality",
    passed,
    score,
    issues
  };
}

/**
 * Test Avatar Visual Differences
 */
export function testAvatarVisualDifferences(): {
  name: string;
  passed: boolean;
  score: number;
  issues: string[];
} {
  console.log("[test-suite] 🧪 Testing avatar visual differences...");

  const canon1 = convertToAvatarCanon(TEST_AVATAR_ANALYSIS);
  const canon2 = convertToAvatarCanon(TEST_AVATAR_ANALYSIS_2);

  const issues: string[] = [];

  // Check hair colors are different
  if (canon1.hair.color === canon2.hair.color) {
    issues.push("Same hair color");
  }

  // Check eye colors are different
  if (canon1.eyes.color === canon2.eyes.color) {
    issues.push("Same eye color");
  }

  // Check clothing is different
  if (canon1.clothing.primary === canon2.clothing.primary) {
    issues.push("Same primary clothing");
  }

  const score = issues.length === 0 ? 10.0 : 5.0;
  const passed = issues.length === 0;

  console.log(`[test-suite] ✅ Visual differences: ${passed ? "✅ PASS" : "❌ FAIL"}`);
  if (issues.length > 0) {
    console.log(`[test-suite] ⚠️ Issues:`, issues);
  }

  return {
    name: "Avatar Visual Differences",
    passed,
    score,
    issues
  };
}

/**
 * Test Portrait Generation
 */
export function testPortraitGeneration(): {
  name: string;
  passed: boolean;
  score: number;
  issues: string[];
} {
  console.log("[test-suite] 🧪 Testing portrait generation...");

  const issues: string[] = [];

  try {
    // Test initial portrait
    const initialPrompt = generateInitialPortrait(TEST_AVATAR_ANALYSIS);
    if (!initialPrompt.includes("Axel Scheffler")) {
      issues.push("Missing art style in initial portrait");
    }

    // Test story thumbnail
    const thumbnailPrompt = generateStoryThumbnail(TEST_AVATAR_ANALYSIS, "adventure");
    if (!thumbnailPrompt.includes("excited")) {
      issues.push("Missing emotion in thumbnail");
    }

    // Test prompt length
    if (initialPrompt.length < 200) {
      issues.push("Initial portrait prompt too short");
    }

    const score = issues.length === 0 ? 10.0 : 7.0;
    const passed = issues.length === 0;

    console.log(`[test-suite] ✅ Portrait generation: ${passed ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`[test-suite] 📝 Initial prompt: ${initialPrompt.length} characters`);
    console.log(`[test-suite] 📝 Thumbnail prompt: ${thumbnailPrompt.length} characters`);

    return {
      name: "Portrait Generation",
      passed,
      score,
      issues
    };

  } catch (error) {
    return {
      name: "Portrait Generation",
      passed: false,
      score: 0,
      issues: [`Error: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}

/**
 * Test Enhanced Story Prompts
 */
export function testEnhancedStoryPrompts(): {
  name: string;
  passed: boolean;
  score: number;
  issues: string[];
} {
  console.log("[test-suite] 🧪 Testing enhanced story prompts...");

  try {
    const systemPrompt = buildEnhancedSystemPrompt(TEST_AVATAR_ANALYSIS, TEST_AVATAR_ANALYSIS_2, {
      allowRhymes: true,
      suspenseLevel: 2,
      humorLevel: 1,
      complexity: "medium",
      learningMode: { enabled: true, learningObjectives: ["teamwork", "courage"] }
    });

    const issues: string[] = [];

    // Check required elements
    if (!systemPrompt.includes("AVATAR-VISUELLE KONTINUITÄT")) {
      issues.push("Missing avatar visual continuity section");
    }
    if (!systemPrompt.includes("CHARAKTERISIERUNG")) {
      issues.push("Missing characterization section");
    }
    if (!systemPrompt.includes("DIALOG-RATIO")) {
      issues.push("Missing dialog ratio section");
    }
    if (!systemPrompt.includes("CLIFFHANGER")) {
      issues.push("Missing cliffhanger section");
    }
    if (!systemPrompt.includes("SUBTILE WEISHEIT")) {
      issues.push("Missing learning section");
    }

    // Check avatar-specific content
    if (!systemPrompt.includes("Alexander")) {
      issues.push("Missing first avatar name");
    }
    if (!systemPrompt.includes("adrian")) {
      issues.push("Missing second avatar name");
    }

    const score = issues.length === 0 ? 10.0 : 6.0;
    const passed = issues.length === 0;

    console.log(`[test-suite] ✅ Enhanced prompts: ${passed ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`[test-suite] 📝 Prompt length: ${systemPrompt.length} characters`);

    return {
      name: "Enhanced Story Prompts",
      passed,
      score,
      issues
    };

  } catch (error) {
    return {
      name: "Enhanced Story Prompts",
      passed: false,
      score: 0,
      issues: [`Error: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}

/**
 * Run complete test suite
 */
export async function runEnhancedTestSuite(): Promise<{
  results: Array<{
    name: string;
    passed: boolean;
    score: number;
    issues: string[];
  }>;
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    averageScore: number;
    successRate: number;
  };
}> {
  console.log("[test-suite] 🚀 Starting Enhanced Test Suite for 10.0/10 Optimization");
  console.log("[test-suite] 📊 Testing all optimization features...");

  const tests = [
    testAvatarAnalysisValidation,
    testImagePromptQuality,
    testAvatarVisualDifferences,
    testPortraitGeneration,
    testEnhancedStoryPrompts
  ];

  const results = tests.map(test => test());

  // Wait a bit for any async operations
  await new Promise(resolve => setTimeout(resolve, 100));

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const averageScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
  const successRate = (passed / results.length) * 100;

  const summary = {
    totalTests: results.length,
    passed,
    failed,
    averageScore: Math.round(averageScore * 10) / 10,
    successRate: Math.round(successRate * 10) / 10
  };

  console.log("\n[test-suite] 🎯 TEST SUITE COMPLETE");
  console.log(`[test-suite] 📊 Results: ${passed}/${results.length} passed (${summary.successRate}%)`);
  console.log(`[test-suite] 📈 Average score: ${summary.averageScore}/10`);
  console.log(`[test-suite] 🎯 Target: 95% success rate`);

  if (summary.successRate >= 95) {
    console.log("[test-suite] 🎉 ACCEPTANCE CRITERIA MET!");
  } else {
    console.log("[test-suite] ⚠️ BELOW ACCEPTANCE CRITERIA");
  }

  results.forEach((result, index) => {
    console.log(`\n  ${index + 1}. ${result.name}: ${result.passed ? "✅" : "❌"} (${result.score}/10)`);
    if (result.issues.length > 0) {
      result.issues.forEach(issue => console.log(`     - ${issue}`));
    }
  });

  return { results, summary };
}
