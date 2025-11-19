#!/usr/bin/env bun

/**
 * Automated Story Generation Optimization Test Runner
 *
 * This script:
 * 1. Generates 5 real stories with different configurations
 * 2. Analyzes logs from each story
 * 3. Scores all 4 phases (0.0-10.0)
 * 4. Identifies optimization opportunities
 * 5. Provides recommendations for code improvements
 *
 * Usage:
 *   bun run run-optimization-tests.ts
 *
 * Prerequisites:
 *   - Encore backend must be running (encore run)
 *   - Valid Clerk user token in CLERK_TOKEN env variable
 */

interface TestConfig {
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

interface TestResult {
  testId: string;
  testName: string;
  timestamp: Date;
  config: TestConfig;
  storyId: string;
  storyTitle: string;
  report: any;
  duration: number;
  success: boolean;
  error?: string;
}

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
const USER_ID = process.env.USER_ID || 'test-user-' + Date.now();
const CLERK_TOKEN = process.env.CLERK_TOKEN;

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message: string, color: keyof typeof COLORS = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(80));
  log(title, 'bold');
  console.log('='.repeat(80) + '\n');
}

async function waitForBackend(maxAttempts = 30): Promise<boolean> {
  log('🔄 Waiting for backend to be ready...', 'cyan');

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${BACKEND_URL}/healthz`);
      if (response.ok) {
        log('✅ Backend is ready!', 'green');
        return true;
      }
    } catch (error) {
      // Backend not ready yet
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
    process.stdout.write('.');
  }

  log('\n❌ Backend failed to start after 60 seconds', 'red');
  return false;
}

async function runSingleTest(testIndex: number): Promise<TestResult | null> {
  logSection(`Test ${testIndex + 1}: Starting`);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (CLERK_TOKEN) {
      headers['Authorization'] = `Bearer ${CLERK_TOKEN}`;
    }

    const response = await fetch(`${BACKEND_URL}/story/test/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId: USER_ID,
        testConfigIndex: testIndex
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      log(`❌ Test ${testIndex + 1} failed: ${response.status} ${response.statusText}`, 'red');
      log(`Error: ${errorText}`, 'red');
      return null;
    }

    const result: TestResult = await response.json();

    log(`✅ Test ${testIndex + 1} completed: ${result.testName}`, 'green');
    log(`   Story: "${result.storyTitle}"`, 'cyan');
    log(`   Overall Score: ${result.report.overallScore}/10.0`, 'yellow');
    log(`   Duration: ${(result.duration / 1000).toFixed(1)}s`, 'cyan');

    return result;
  } catch (error) {
    log(`❌ Test ${testIndex + 1} error: ${error}`, 'red');
    return null;
  }
}

async function analyzeResults(results: TestResult[]): Promise<void> {
  logSection('📊 Test Results Analysis');

  if (results.length === 0) {
    log('❌ No test results to analyze', 'red');
    return;
  }

  // Calculate average scores per phase
  const phaseAverages = {
    phase0: 0,
    phase1: 0,
    phase2: 0,
    phase3: 0,
    phase4: 0,
    overall: 0
  };

  results.forEach(result => {
    if (result.report && result.report.phases) {
      phaseAverages.phase0 += result.report.phases.phase0?.score || 0;
      phaseAverages.phase1 += result.report.phases.phase1?.score || 0;
      phaseAverages.phase2 += result.report.phases.phase2?.score || 0;
      phaseAverages.phase3 += result.report.phases.phase3?.score || 0;
      phaseAverages.phase4 += result.report.phases.phase4?.score || 0;
      phaseAverages.overall += result.report.overallScore || 0;
    }
  });

  const count = results.length;
  Object.keys(phaseAverages).forEach(key => {
    phaseAverages[key as keyof typeof phaseAverages] /= count;
  });

  log('Average Scores:', 'bold');
  log(`  Phase 0 (Fairy Tale Selection): ${phaseAverages.phase0.toFixed(2)}/10.0`, 'cyan');
  log(`  Phase 1 (Skeleton Generation):  ${phaseAverages.phase1.toFixed(2)}/10.0`, 'cyan');
  log(`  Phase 2 (Character Matching):   ${phaseAverages.phase2.toFixed(2)}/10.0`, 'cyan');
  log(`  Phase 3 (Story Finalization):   ${phaseAverages.phase3.toFixed(2)}/10.0`, 'cyan');
  log(`  Phase 4 (Image Generation):     ${phaseAverages.phase4.toFixed(2)}/10.0`, 'cyan');
  log(`  Overall:                        ${phaseAverages.overall.toFixed(2)}/10.0`, 'yellow');

  // Collect all issues
  const allIssues: string[] = [];
  const allRecommendations: string[] = [];

  results.forEach(result => {
    if (result.report && result.report.phases) {
      Object.values(result.report.phases).forEach((phase: any) => {
        if (phase.issues) allIssues.push(...phase.issues);
        if (phase.recommendations) allRecommendations.push(...phase.recommendations);
      });
    }
  });

  // Remove duplicates
  const uniqueIssues = [...new Set(allIssues)];
  const uniqueRecommendations = [...new Set(allRecommendations)];

  if (uniqueIssues.length > 0) {
    log('\n⚠️  Critical Issues:', 'yellow');
    uniqueIssues.slice(0, 10).forEach(issue => {
      log(`   - ${issue}`, 'red');
    });
  }

  if (uniqueRecommendations.length > 0) {
    log('\n💡 Optimization Recommendations:', 'green');
    uniqueRecommendations.slice(0, 10).forEach(rec => {
      log(`   - ${rec}`, 'cyan');
    });
  }

  // Identify worst performing phase
  const phaseScores = [
    { name: 'Phase 0', score: phaseAverages.phase0 },
    { name: 'Phase 1', score: phaseAverages.phase1 },
    { name: 'Phase 2', score: phaseAverages.phase2 },
    { name: 'Phase 3', score: phaseAverages.phase3 },
    { name: 'Phase 4', score: phaseAverages.phase4 },
  ];

  phaseScores.sort((a, b) => a.score - b.score);

  log('\n🎯 Priority Optimization Targets:', 'magenta');
  phaseScores.slice(0, 3).forEach((phase, index) => {
    log(`   ${index + 1}. ${phase.name}: ${phase.score.toFixed(2)}/10.0`, 'yellow');
  });
}

async function saveResults(results: TestResult[]): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `test-results/optimization-run-${timestamp}.json`;

  try {
    await Bun.write(filename, JSON.stringify({
      timestamp: new Date(),
      results,
      summary: {
        totalTests: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        averageScore: results.reduce((sum, r) => sum + (r.report?.overallScore || 0), 0) / results.length
      }
    }, null, 2));

    log(`\n💾 Results saved to: ${filename}`, 'green');
  } catch (error) {
    log(`\n⚠️  Failed to save results: ${error}`, 'yellow');
  }
}

async function main() {
  logSection('🚀 Automated Story Generation Optimization Test Runner');

  log(`Backend URL: ${BACKEND_URL}`, 'cyan');
  log(`User ID: ${USER_ID}`, 'cyan');
  log(`Auth: ${CLERK_TOKEN ? '✅ Configured' : '⚠️  No CLERK_TOKEN (using test mode)'}`, 'yellow');

  // Wait for backend
  const backendReady = await waitForBackend();
  if (!backendReady) {
    log('\n❌ Cannot proceed without backend. Please start Encore:', 'red');
    log('   cd backend && encore run', 'yellow');
    process.exit(1);
  }

  // Run all 5 tests
  const results: TestResult[] = [];

  for (let i = 0; i < 5; i++) {
    const result = await runSingleTest(i);

    if (result) {
      results.push(result);
    }

    // Wait between tests to avoid overwhelming the system
    if (i < 4) {
      log(`\n⏳ Waiting 5 seconds before next test...`, 'cyan');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Analyze results
  await analyzeResults(results);

  // Save results
  await saveResults(results);

  logSection('✅ Test Run Complete');

  if (results.length === 0) {
    log('❌ All tests failed. Check backend logs and authentication.', 'red');
    process.exit(1);
  }

  const avgScore = results.reduce((sum, r) => sum + (r.report?.overallScore || 0), 0) / results.length;

  if (avgScore >= 9.5) {
    log('🎉 EXCELLENT! Average score >= 9.5/10.0', 'green');
  } else if (avgScore >= 8.0) {
    log('👍 GOOD! Average score >= 8.0/10.0', 'yellow');
  } else {
    log('⚠️  NEEDS IMPROVEMENT! Average score < 8.0/10.0', 'red');
    log('   Review recommendations above and implement optimizations.', 'yellow');
  }

  log(`\nNext steps:`, 'bold');
  log(`1. Review the results in test-results/`, 'cyan');
  log(`2. Implement the recommended optimizations`, 'cyan');
  log(`3. Run this script again to measure improvement`, 'cyan');
  log(`4. Repeat until average score >= 9.5/10.0`, 'cyan');
}

main().catch(error => {
  log(`\n❌ Fatal error: ${error}`, 'red');
  console.error(error);
  process.exit(1);
});
