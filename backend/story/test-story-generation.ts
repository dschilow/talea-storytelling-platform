// Automated Story Generation Testing Framework
// Generiert Stories mit verschiedenen Konfigurationen und bewertet alle 4 Phasen

import { api } from "encore.dev/api";
import type { StoryConfig } from "./generate";
import { generate } from "./generate";
import { generateOverallReport } from "./phase-scorer";
import type { OverallScoreReport } from "./phase-scorer";
import { extractPhaseLogsFromDatabase } from "./analyze-phase-logs";
import { avatarDB } from "../avatar/db";
import crypto from "crypto";

export interface TestConfig {
  name: string;
  description: string;
  genre: string;
  setting: string;
  ageGroup: "3-5" | "6-8" | "9-12" | "13+";
  complexity: "simple" | "medium" | "complex";
  length: "short" | "medium" | "long";
  avatarCount: number;
  useFairyTaleTemplate?: boolean;
  aiModel?: string;
}

export interface TestResult {
  testId: string;
  testName: string;
  timestamp: Date;
  config: TestConfig;
  storyId: string;
  storyTitle: string;
  report: OverallScoreReport;
  duration: number;
  success: boolean;
  error?: string;
}

// Predefined test configurations for systematic testing
export const TEST_CONFIGS: TestConfig[] = [
  {
    name: "Test 1: Klassisches Märchen - Grundschüler",
    description: "Klassisches Märchen für 6-8 Jahre mit 2 Avataren",
    genre: "Klassische Märchen",
    setting: "Magischer Wald mit alten Bäumen",
    ageGroup: "6-8",
    complexity: "medium",
    length: "medium",
    avatarCount: 2,
    useFairyTaleTemplate: true,
    aiModel: "gpt-5-mini"
  },
  {
    name: "Test 2: Märchenwelten - Teenager",
    description: "Komplexe Märchenwelt für 9-12 Jahre mit 1 Avatar",
    genre: "Märchenwelten und Magie",
    setting: "Verzaubertes Schloss mit geheimen Gängen",
    ageGroup: "9-12",
    complexity: "complex",
    length: "long",
    avatarCount: 1,
    useFairyTaleTemplate: true,
    aiModel: "gpt-5-mini"
  },
  {
    name: "Test 3: Abenteuer - Kinder",
    description: "Abenteuer-Geschichte ohne Märchen-Template",
    genre: "Abenteuer",
    setting: "Geheimnisvolle Insel",
    ageGroup: "6-8",
    complexity: "simple",
    length: "short",
    avatarCount: 2,
    useFairyTaleTemplate: false,
    aiModel: "gpt-5-mini"
  },
  {
    name: "Test 4: Klassische Märchen - Kleinkinder",
    description: "Einfaches Märchen für sehr junge Kinder",
    genre: "Klassische Märchen",
    setting: "Bunter Blumengarten",
    ageGroup: "3-5",
    complexity: "simple",
    length: "short",
    avatarCount: 1,
    useFairyTaleTemplate: true,
    aiModel: "gpt-5-nano"
  },
  {
    name: "Test 5: Märchenwelten - Erweitert",
    description: "Komplexe Märchen-Story mit mehreren Avataren",
    genre: "Märchenwelten und Magie",
    setting: "Magisches Königreich mit verschiedenen Reichen",
    ageGroup: "9-12",
    complexity: "complex",
    length: "long",
    avatarCount: 3,
    useFairyTaleTemplate: true,
    aiModel: "gpt-5"
  }
];

/**
 * Erstellt Test-Avatare für automatisierte Tests
 * Diese Avatare sind speziell für Test-Zwecke und haben volle visual profiles
 */
async function createTestAvatars(userId: string, count: number): Promise<string[]> {
  const avatarIds: string[] = [];

  const testAvatarTemplates = [
    {
      name: "Emma",
      description: "Ein mutiges 7-jähriges Mädchen mit braunen Haaren",
      visualProfile: {
        gender: "female",
        ageApprox: 7,
        species: "human",
        hair: { color: "brown", length: "medium", type: "wavy", style: "ponytail" },
        eyes: { color: "blue" },
        skin: { tone: "light" },
        clothingCanonical: {
          outfit: "red hoodie and jeans"
        },
        consistentDescriptors: ["friendly smile", "curious eyes"]
      }
    },
    {
      name: "Luca",
      description: "Ein cleverer 8-jähriger Junge mit blonden Haaren",
      visualProfile: {
        gender: "male",
        ageApprox: 8,
        species: "human",
        hair: { color: "blonde", length: "short", type: "straight", style: "messy" },
        eyes: { color: "green" },
        skin: { tone: "medium" },
        clothingCanonical: {
          outfit: "blue t-shirt and shorts"
        },
        consistentDescriptors: ["thoughtful expression", "adventurous spirit"]
      }
    },
    {
      name: "Sophie",
      description: "Eine kreative 9-jährige mit roten Haaren",
      visualProfile: {
        gender: "female",
        ageApprox: 9,
        species: "human",
        hair: { color: "red", length: "long", type: "curly", style: "braids" },
        eyes: { color: "hazel" },
        skin: { tone: "light" },
        clothingCanonical: {
          outfit: "purple dress with stars"
        },
        consistentDescriptors: ["imaginative", "artistic"]
      }
    }
  ];

  for (let i = 0; i < Math.min(count, testAvatarTemplates.length); i++) {
    const template = testAvatarTemplates[i];
    const id = crypto.randomUUID();

    // Base personality traits (all avatars start with 9 base traits at 0)
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

    const physicalTraits = {
      age: template.visualProfile.ageApprox,
      gender: template.visualProfile.gender
    };

    await avatarDB.exec`
      INSERT INTO avatars (
        id, user_id, name, description,
        physical_traits, personality_traits, visual_profile,
        creation_type, is_public, created_at, updated_at
      ) VALUES (
        ${id}, ${userId}, ${template.name}, ${template.description},
        ${JSON.stringify(physicalTraits)},
        ${JSON.stringify(personalityTraits)},
        ${JSON.stringify(template.visualProfile)},
        'ai-generated', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `;

    avatarIds.push(id);
    console.log(`[Test Framework] Created test avatar: ${template.name} (${id})`);
  }

  return avatarIds;
}

/**
 * Löscht Test-Avatare nach dem Test
 */
async function deleteTestAvatars(avatarIds: string[]): Promise<void> {
  for (const id of avatarIds) {
    await avatarDB.exec`DELETE FROM avatars WHERE id = ${id}`;
  }
  console.log(`[Test Framework] Deleted ${avatarIds.length} test avatars`);
}

/**
 * Führt einen einzelnen Test durch
 */
async function runSingleTest(
  testConfig: TestConfig,
  userId: string,
  testId: string
): Promise<TestResult> {
  const startTime = Date.now();
  console.log(`\n======================================`);
  console.log(`[Test Framework] Starting: ${testConfig.name}`);
  console.log(`[Test Framework] Test ID: ${testId}`);
  console.log(`======================================\n`);

  let avatarIds: string[] = [];
  let storyId = "";
  let storyTitle = "";
  let success = false;
  let error: string | undefined;
  let report: OverallScoreReport | null = null;

  try {
    // Step 1: Create test avatars
    console.log(`[Test Framework] Creating ${testConfig.avatarCount} test avatars...`);
    avatarIds = await createTestAvatars(userId, testConfig.avatarCount);

    // Step 2: Build story config
    const storyConfig: StoryConfig = {
      avatarIds,
      genre: testConfig.genre,
      setting: testConfig.setting,
      length: testConfig.length,
      complexity: testConfig.complexity,
      ageGroup: testConfig.ageGroup,
      aiModel: (testConfig.aiModel as any) || "gpt-5-mini",
      useCharacterPool: true,
      preferences: {
        useFairyTaleTemplate: testConfig.useFairyTaleTemplate ?? false
      }
    };

    // Step 3: Generate story
    console.log(`[Test Framework] Generating story...`);
    const story = await generate({
      userId,
      config: storyConfig
    });

    storyId = story.id;
    storyTitle = story.title;
    success = story.status === 'complete';

    console.log(`[Test Framework] Story generated: ${storyTitle} (${storyId})`);
    console.log(`[Test Framework] Status: ${story.status}`);

    // Step 4: Extract phase logs from database
    console.log(`[Test Framework] Extracting phase logs...`);
    const phaseLogs = await extractPhaseLogsFromDatabase(storyId);

    // Step 5: Generate score report
    console.log(`[Test Framework] Generating score report...`);
    report = generateOverallReport(
      testId,
      storyId,
      storyTitle,
      storyConfig,
      phaseLogs
    );

    console.log(`\n======================================`);
    console.log(`[Test Framework] Test Complete: ${testConfig.name}`);
    console.log(`[Test Framework] Overall Score: ${report.overallScore}/10.0`);
    console.log(`======================================\n`);

  } catch (err) {
    success = false;
    error = String((err as Error).message || err);
    console.error(`[Test Framework] Test failed:`, err);

    // Create minimal report for failed tests
    report = {
      testId,
      timestamp: new Date(),
      storyId: storyId || 'none',
      storyTitle: storyTitle || 'Failed',
      config: testConfig,
      phases: {
        phase0: { phase: 'Phase 0', score: 0, maxScore: 10, details: {}, issues: [error], recommendations: [] },
        phase1: { phase: 'Phase 1', score: 0, maxScore: 10, details: {}, issues: [error], recommendations: [] },
        phase2: { phase: 'Phase 2', score: 0, maxScore: 10, details: {}, issues: [error], recommendations: [] },
        phase3: { phase: 'Phase 3', score: 0, maxScore: 10, details: {}, issues: [error], recommendations: [] },
        phase4: { phase: 'Phase 4', score: 0, maxScore: 10, details: {}, issues: [error], recommendations: [] }
      },
      overallScore: 0,
      summary: `Test failed: ${error}`
    };
  } finally {
    // Step 6: Cleanup test avatars
    if (avatarIds.length > 0) {
      console.log(`[Test Framework] Cleaning up test avatars...`);
      await deleteTestAvatars(avatarIds);
    }
  }

  const duration = Date.now() - startTime;

  return {
    testId,
    testName: testConfig.name,
    timestamp: new Date(),
    config: testConfig,
    storyId,
    storyTitle,
    report: report!,
    duration,
    success,
    error
  };
}

/**
 * API Endpoint: Führt einen einzelnen Test durch
 */
export const runTest = api(
  { expose: true, method: "POST", path: "/story/test/run", auth: true },
  async (req: { userId: string; testConfigIndex: number }): Promise<TestResult> => {
    const testConfig = TEST_CONFIGS[req.testConfigIndex];

    if (!testConfig) {
      throw new Error(`Invalid test config index: ${req.testConfigIndex}`);
    }

    const testId = `test-${req.testConfigIndex + 1}-${Date.now()}`;
    return await runSingleTest(testConfig, req.userId, testId);
  }
);

/**
 * API Endpoint: Führt alle Tests durch (Batch)
 */
export interface BatchTestRequest {
  userId: string;
  testIndices?: number[]; // Optional: Nur bestimmte Tests
}

export interface BatchTestResponse {
  batchId: string;
  results: TestResult[];
  summary: {
    totalTests: number;
    successfulTests: number;
    failedTests: number;
    averageScore: number;
    totalDuration: number;
  };
}

export const runBatchTests = api<BatchTestRequest, BatchTestResponse>(
  { expose: true, method: "POST", path: "/story/test/batch", auth: true },
  async (req): Promise<BatchTestResponse> => {
    const batchId = `batch-${Date.now()}`;
    const indicesToRun = req.testIndices || [0, 1, 2, 3, 4];

    console.log(`\n========================================`);
    console.log(`[Batch Test] Starting batch: ${batchId}`);
    console.log(`[Batch Test] Running ${indicesToRun.length} tests`);
    console.log(`========================================\n`);

    const results: TestResult[] = [];
    let totalDuration = 0;

    // Run tests sequentially to avoid overwhelming the system
    for (const index of indicesToRun) {
      const testConfig = TEST_CONFIGS[index];
      if (!testConfig) {
        console.warn(`[Batch Test] Skipping invalid index: ${index}`);
        continue;
      }

      const testId = `${batchId}-test-${index + 1}`;
      const result = await runSingleTest(testConfig, req.userId, testId);
      results.push(result);
      totalDuration += result.duration;

      // Small delay between tests to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const successfulTests = results.filter(r => r.success).length;
    const failedTests = results.length - successfulTests;
    const averageScore = results.reduce((sum, r) => sum + r.report.overallScore, 0) / results.length;

    console.log(`\n========================================`);
    console.log(`[Batch Test] Batch Complete: ${batchId}`);
    console.log(`[Batch Test] Success: ${successfulTests}/${results.length}`);
    console.log(`[Batch Test] Average Score: ${averageScore.toFixed(2)}/10.0`);
    console.log(`[Batch Test] Total Duration: ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`========================================\n`);

    return {
      batchId,
      results,
      summary: {
        totalTests: results.length,
        successfulTests,
        failedTests,
        averageScore: parseFloat(averageScore.toFixed(2)),
        totalDuration
      }
    };
  }
);

/**
 * API Endpoint: Listet alle verfügbaren Test-Konfigurationen
 */
export const listTestConfigs = api(
  { expose: true, method: "GET", path: "/story/test/configs", auth: true },
  async (): Promise<{ configs: TestConfig[] }> => {
    return { configs: TEST_CONFIGS };
  }
);
