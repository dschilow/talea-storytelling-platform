/**
 * Test Framework for Avatar Image Consistency & Story Quality
 * 
 * Implements automated testing as per optimization spec Section 9:
 * - 100 test images with expected avatar count/species
 * - 10 test stories with quality metrics
 * - Success rate ≥95% acceptance criteria
 */

import type { StoryConfig } from "./generate";
import type { Avatar } from "../avatar/avatar";
import { performVisionQA } from "./vision-qa";
import type { VisionQAExpectation, VisionQAResult } from "./vision-qa";

export interface TestImage {
  id: string;
  imageUrl: string;
  expectedAvatars: Array<{
    name: string;
    species: "human" | "cat" | "dog" | "animal";
    keyFeatures: string[];
  }>;
  testCategory: "cover" | "chapter" | "single-avatar" | "multi-avatar";
}

export interface TestStory {
  id: string;
  config: StoryConfig;
  avatars: Avatar[];
  expectedChapters: number;
  expectedWordCountPerChapter: number;
  qualityMetrics: {
    hasCliffhangers: boolean;
    hasConsistentNames: boolean;
    hasLearningOutcomes: boolean;
    hasAvatarDevelopments: boolean;
  };
}

export interface TestResult {
  testId: string;
  testType: "image" | "story";
  passed: boolean;
  errors: string[];
  metrics: {
    processingTimeMs?: number;
    qaScore?: number;
    wordCount?: number;
    imageCount?: number;
  };
  timestamp: Date;
}

export interface TestSuite {
  name: string;
  description: string;
  tests: Array<TestImage | TestStory>;
  results: TestResult[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    successRate: number;
    averageProcessingTime: number;
  };
}

/**
 * Runs image consistency tests
 */
export async function testImageConsistency(
  testImage: TestImage
): Promise<TestResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    // Build expectations for Vision-QA
    const expectations: VisionQAExpectation = {
      characterCount: testImage.expectedAvatars.length,
      characters: testImage.expectedAvatars.map(avatar => ({
        name: avatar.name,
        species: avatar.species,
        keyFeatures: avatar.keyFeatures,
      })),
    };

    // Perform Vision-QA
    const qaResult: VisionQAResult = await performVisionQA(
      testImage.imageUrl,
      expectations
    );

    // Check for violations
    if (!qaResult.pass) {
      errors.push(...qaResult.violations);
    }

    const processingTime = Date.now() - startTime;

    return {
      testId: testImage.id,
      testType: "image",
      passed: qaResult.pass,
      errors,
      metrics: {
        processingTimeMs: processingTime,
        qaScore: qaResult.confidence,
      },
      timestamp: new Date(),
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    errors.push(`Test execution failed: ${error instanceof Error ? error.message : String(error)}`);

    return {
      testId: testImage.id,
      testType: "image",
      passed: false,
      errors,
      metrics: {
        processingTimeMs: processingTime,
      },
      timestamp: new Date(),
    };
  }
}

/**
 * Runs story quality tests
 */
export async function testStoryQuality(
  testStory: TestStory,
  generatedStory: any // Story response from generate endpoint
): Promise<TestResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    // Check chapter count
    if (generatedStory.chapters.length !== testStory.expectedChapters) {
      errors.push(
        `Expected ${testStory.expectedChapters} chapters, got ${generatedStory.chapters.length}`
      );
    }

    // Check word count per chapter
    let totalWords = 0;
    generatedStory.chapters.forEach((chapter: any, index: number) => {
      const wordCount = chapter.content.split(/\s+/).length;
      totalWords += wordCount;

      if (wordCount < testStory.expectedWordCountPerChapter * 0.8) {
        errors.push(
          `Chapter ${index + 1} too short: ${wordCount} words (expected ~${testStory.expectedWordCountPerChapter})`
        );
      }
    });

    // Check cliffhangers (except last chapter)
    if (testStory.qualityMetrics.hasCliffhangers) {
      const cliffhangerKeywords = ["aber", "plötzlich", "doch", "jedoch", "was", "wie", "warum"];
      generatedStory.chapters.slice(0, -1).forEach((chapter: any, index: number) => {
        const lastSentence = chapter.content.trim().split(/[.!?]/).slice(-2, -1)[0] || "";
        const hasCliffhanger = cliffhangerKeywords.some(keyword =>
          lastSentence.toLowerCase().includes(keyword)
        );

        if (!hasCliffhanger) {
          errors.push(`Chapter ${index + 1} missing cliffhanger`);
        }
      });
    }

    // Check consistent names
    if (testStory.qualityMetrics.hasConsistentNames) {
      const expectedNames = testStory.avatars.map(a => a.name);
      const storyText = generatedStory.chapters.map((c: any) => c.content).join(" ");

      expectedNames.forEach(name => {
        if (!storyText.includes(name)) {
          errors.push(`Avatar name "${name}" not found in story`);
        }
      });
    }

    // Check learning outcomes
    if (testStory.qualityMetrics.hasLearningOutcomes) {
      if (!generatedStory.learningOutcomes || generatedStory.learningOutcomes.length === 0) {
        errors.push("Missing learning outcomes");
      }
    }

    // Check avatar developments
    if (testStory.qualityMetrics.hasAvatarDevelopments) {
      if (!generatedStory.avatarDevelopments || generatedStory.avatarDevelopments.length === 0) {
        errors.push("Missing avatar developments");
      } else if (generatedStory.avatarDevelopments.length !== testStory.avatars.length) {
        errors.push(
          `Expected ${testStory.avatars.length} avatar developments, got ${generatedStory.avatarDevelopments.length}`
        );
      }
    }

    const processingTime = Date.now() - startTime;

    return {
      testId: testStory.id,
      testType: "story",
      passed: errors.length === 0,
      errors,
      metrics: {
        processingTimeMs: processingTime,
        wordCount: totalWords,
        imageCount: generatedStory.chapters.length + 1, // chapters + cover
      },
      timestamp: new Date(),
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    errors.push(`Test execution failed: ${error instanceof Error ? error.message : String(error)}`);

    return {
      testId: testStory.id,
      testType: "story",
      passed: false,
      errors,
      metrics: {
        processingTimeMs: processingTime,
      },
      timestamp: new Date(),
    };
  }
}

/**
 * Runs a complete test suite
 */
export async function runTestSuite(suite: TestSuite): Promise<TestSuite> {
  console.log(`[test-framework] Running test suite: ${suite.name}`);
  console.log(`[test-framework] Total tests: ${suite.tests.length}`);

  const results: TestResult[] = [];

  for (const test of suite.tests) {
    if ("imageUrl" in test) {
      // Image test
      const result = await testImageConsistency(test);
      results.push(result);
      console.log(`[test-framework] Image test ${test.id}: ${result.passed ? "✅ PASS" : "❌ FAIL"}`);
    } else {
      // Story test - requires actual story generation
      console.log(`[test-framework] Story test ${test.id}: Skipped (requires manual story generation)`);
    }
  }

  // Calculate summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const successRate = (passed / results.length) * 100;
  const averageProcessingTime =
    results.reduce((sum, r) => sum + (r.metrics.processingTimeMs || 0), 0) / results.length;

  suite.results = results;
  suite.summary = {
    totalTests: results.length,
    passed,
    failed,
    successRate,
    averageProcessingTime,
  };

  console.log(`[test-framework] Test suite complete:`);
  console.log(`[test-framework] - Passed: ${passed}/${results.length} (${successRate.toFixed(2)}%)`);
  console.log(`[test-framework] - Average time: ${averageProcessingTime.toFixed(0)}ms`);

  return suite;
}

/**
 * Generates a test report
 */
export function generateTestReport(suite: TestSuite): string {
  const report = [
    `# Test Report: ${suite.name}`,
    ``,
    `**Description:** ${suite.description}`,
    `**Date:** ${new Date().toISOString()}`,
    ``,
    `## Summary`,
    ``,
    `- **Total Tests:** ${suite.summary.totalTests}`,
    `- **Passed:** ${suite.summary.passed} ✅`,
    `- **Failed:** ${suite.summary.failed} ❌`,
    `- **Success Rate:** ${suite.summary.successRate.toFixed(2)}% ${suite.summary.successRate >= 95 ? "🎉 MEETS ACCEPTANCE CRITERIA" : "⚠️ BELOW ACCEPTANCE CRITERIA (95%)"}`,
    `- **Average Processing Time:** ${suite.summary.averageProcessingTime.toFixed(0)}ms`,
    ``,
    `## Detailed Results`,
    ``,
  ];

  suite.results.forEach((result, index) => {
    report.push(`### Test ${index + 1}: ${result.testId}`);
    report.push(`- **Type:** ${result.testType}`);
    report.push(`- **Status:** ${result.passed ? "✅ PASS" : "❌ FAIL"}`);
    report.push(`- **Processing Time:** ${result.metrics.processingTimeMs}ms`);

    if (result.metrics.qaScore !== undefined) {
      report.push(`- **QA Score:** ${result.metrics.qaScore.toFixed(2)}`);
    }

    if (result.errors.length > 0) {
      report.push(`- **Errors:**`);
      result.errors.forEach(error => {
        report.push(`  - ${error}`);
      });
    }

    report.push(``);
  });

  return report.join("\n");
}

