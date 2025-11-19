#!/usr/bin/env bun

/**
 * Production Story Analysis Script
 *
 * Analyzes recent stories from production database
 * Scores all 4 phases and provides optimization recommendations
 *
 * Usage:
 *   bun run analyze-production-stories.ts
 */

import { generateOverallReport } from './backend/story/phase-scorer';
import { logDB } from './backend/log/db';
import { storyDB } from './backend/story/db';

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

async function analyzeRecentStories(limit: number = 5) {
  logSection('📊 Production Story Analysis');

  log(`Analyzing the last ${limit} stories from production...`, 'cyan');
  log('', 'reset');

  // Get recent stories from database
  const stories = await storyDB.queryAll<{
    id: string;
    user_id: string;
    title: string;
    config: string;
    metadata: string | null;
    created_at: Date;
    status: string;
  }>`
    SELECT id, user_id, title, config, metadata, created_at, status
    FROM stories
    WHERE status = 'complete'
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  if (stories.length === 0) {
    log('❌ No completed stories found in database', 'red');
    return;
  }

  log(`✅ Found ${stories.length} completed stories`, 'green');
  log('', 'reset');

  const reports: any[] = [];

  for (const story of stories) {
    log(`📖 Analyzing: "${story.title}"`, 'cyan');
    log(`   Story ID: ${story.id}`, 'reset');
    log(`   Created: ${story.created_at.toLocaleString()}`, 'reset');

    try {
      const config = JSON.parse(story.config);
      const metadata = story.metadata ? JSON.parse(story.metadata) : {};

      // Extract phase data from metadata and database
      const phaseLogs = await extractPhaseData(story.id, config, metadata);

      // Generate report
      const report = generateOverallReport(
        `prod-analysis-${story.id}`,
        story.id,
        story.title,
        config,
        phaseLogs
      );

      reports.push(report);

      log(`   Overall Score: ${report.overallScore.toFixed(2)}/10.0`, 'yellow');

      // Show phase scores
      log(`   Phase Scores:`, 'reset');
      log(`     Phase 0: ${report.phases.phase0.score.toFixed(1)}/10.0`, 'cyan');
      log(`     Phase 1: ${report.phases.phase1.score.toFixed(1)}/10.0`, 'cyan');
      log(`     Phase 2: ${report.phases.phase2.score.toFixed(1)}/10.0`, 'cyan');
      log(`     Phase 3: ${report.phases.phase3.score.toFixed(1)}/10.0`, 'cyan');
      log(`     Phase 4: ${report.phases.phase4.score.toFixed(1)}/10.0`, 'cyan');

      // Show top issues
      const allIssues = [
        ...report.phases.phase0.issues,
        ...report.phases.phase1.issues,
        ...report.phases.phase2.issues,
        ...report.phases.phase3.issues,
        ...report.phases.phase4.issues
      ];

      if (allIssues.length > 0) {
        log(`   Issues (${allIssues.length}):`, 'yellow');
        allIssues.slice(0, 3).forEach(issue => {
          log(`     - ${issue}`, 'red');
        });
      }

      log('', 'reset');

    } catch (error) {
      log(`   ❌ Error analyzing story: ${error}`, 'red');
      log('', 'reset');
    }
  }

  // Calculate averages
  logSection('📈 Overall Analysis');

  if (reports.length === 0) {
    log('❌ No reports generated', 'red');
    return;
  }

  const avgScores = {
    phase0: reports.reduce((sum, r) => sum + r.phases.phase0.score, 0) / reports.length,
    phase1: reports.reduce((sum, r) => sum + r.phases.phase1.score, 0) / reports.length,
    phase2: reports.reduce((sum, r) => sum + r.phases.phase2.score, 0) / reports.length,
    phase3: reports.reduce((sum, r) => sum + r.phases.phase3.score, 0) / reports.length,
    phase4: reports.reduce((sum, r) => sum + r.phases.phase4.score, 0) / reports.length,
    overall: reports.reduce((sum, r) => sum + r.overallScore, 0) / reports.length
  };

  log('Average Scores across all analyzed stories:', 'bold');
  log(`  Phase 0 (Fairy Tale Selection): ${avgScores.phase0.toFixed(2)}/10.0`, 'cyan');
  log(`  Phase 1 (Skeleton Generation):  ${avgScores.phase1.toFixed(2)}/10.0`, 'cyan');
  log(`  Phase 2 (Character Matching):   ${avgScores.phase2.toFixed(2)}/10.0`, 'cyan');
  log(`  Phase 3 (Story Finalization):   ${avgScores.phase3.toFixed(2)}/10.0`, 'cyan');
  log(`  Phase 4 (Image Generation):     ${avgScores.phase4.toFixed(2)}/10.0`, 'cyan');
  log(`  Overall:                        ${avgScores.overall.toFixed(2)}/10.0`, 'yellow');
  log('', 'reset');

  // Collect all issues and recommendations
  const allIssues: string[] = [];
  const allRecommendations: string[] = [];

  reports.forEach(report => {
    Object.values(report.phases).forEach((phase: any) => {
      if (phase.issues) allIssues.push(...phase.issues);
      if (phase.recommendations) allRecommendations.push(...phase.recommendations);
    });
  });

  const uniqueIssues = [...new Set(allIssues)];
  const uniqueRecommendations = [...new Set(allRecommendations)];

  if (uniqueIssues.length > 0) {
    log('⚠️  Top Critical Issues:', 'yellow');
    uniqueIssues.slice(0, 10).forEach((issue, i) => {
      log(`   ${i + 1}. ${issue}`, 'red');
    });
    log('', 'reset');
  }

  if (uniqueRecommendations.length > 0) {
    log('💡 Optimization Recommendations:', 'green');
    uniqueRecommendations.slice(0, 10).forEach((rec, i) => {
      log(`   ${i + 1}. ${rec}`, 'cyan');
    });
    log('', 'reset');
  }

  // Priority targets
  const phaseScores = [
    { name: 'Phase 0', score: avgScores.phase0 },
    { name: 'Phase 1', score: avgScores.phase1 },
    { name: 'Phase 2', score: avgScores.phase2 },
    { name: 'Phase 3', score: avgScores.phase3 },
    { name: 'Phase 4', score: avgScores.phase4 },
  ];

  phaseScores.sort((a, b) => a.score - b.score);

  log('🎯 Priority Optimization Targets:', 'magenta');
  phaseScores.forEach((phase, index) => {
    const icon = index < 2 ? '❗' : index < 4 ? '⚠️' : '✅';
    log(`   ${icon} ${phase.name}: ${phase.score.toFixed(2)}/10.0`, 'yellow');
  });

  log('', 'reset');

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `test-results/production-analysis-${timestamp}.json`;

  try {
    await Bun.write(filename, JSON.stringify({
      timestamp: new Date(),
      analyzed: reports.length,
      averageScores: avgScores,
      reports,
      issues: uniqueIssues,
      recommendations: uniqueRecommendations
    }, null, 2));

    log(`💾 Analysis saved to: ${filename}`, 'green');
  } catch (error) {
    log(`⚠️  Failed to save analysis: ${error}`, 'yellow');
  }

  logSection('✅ Analysis Complete');

  if (avgScores.overall >= 9.5) {
    log('🎉 EXCELLENT! Average score >= 9.5/10.0', 'green');
    log('Your story generation is performing at optimal level!', 'green');
  } else if (avgScores.overall >= 8.0) {
    log('👍 GOOD! Average score >= 8.0/10.0', 'yellow');
    log('There are some optimization opportunities available.', 'yellow');
  } else {
    log('⚠️  NEEDS IMPROVEMENT! Average score < 8.0/10.0', 'red');
    log('Significant optimization potential identified.', 'red');
  }

  log('', 'reset');
  log('Next Steps:', 'bold');
  log('1. Review the recommendations above', 'cyan');
  log('2. Implement the suggested code optimizations', 'cyan');
  log('3. Deploy the changes to Railway', 'cyan');
  log('4. Run this analysis again to measure improvement', 'cyan');
  log('5. Repeat until average score >= 9.5/10.0', 'cyan');
}

async function extractPhaseData(storyId: string, config: any, metadata: any) {
  // Extract what we can from metadata
  const chapters = await storyDB.queryAll<{
    title: string;
    content: string;
    image_url: string | null;
    chapter_order: number;
  }>`
    SELECT title, content, image_url, chapter_order
    FROM chapters
    WHERE story_id = ${storyId}
    ORDER BY chapter_order
  `;

  const phaseLogs: any = {
    phase0: {
      fairyTaleUsed: metadata.storyExperience?.fairyTale || null,
      config,
      durationMs: metadata.phases?.phase0Duration || 0
    },
    phase1: {
      skeleton: {
        title: metadata.title || 'Unknown',
        chapters: chapters.map(ch => ({
          order: ch.chapter_order,
          content: ch.content
        })),
        supportingCharacterRequirements: []
      },
      usage: metadata.tokensUsed || {},
      durationMs: metadata.phases?.phase1Duration || 0,
      config
    },
    phase2: {
      matchedCount: metadata.characterPoolUsed?.length || 0,
      requirementsCount: metadata.characterPoolUsed?.length || 0,
      assignments: (metadata.characterPoolUsed || []).map((char: any) => ({
        placeholder: char.placeholder,
        character: {
          id: char.characterId,
          name: char.characterName,
          role: 'unknown'
        }
      })),
      durationMs: metadata.phases?.phase2Duration || 0
    },
    phase3: {
      story: {
        title: metadata.title || 'Unknown',
        description: metadata.description || '',
        chapters: chapters.map(ch => ({
          order: ch.chapter_order,
          title: ch.title,
          content: ch.content
        })),
        avatarDevelopments: [],
        chaptersCount: chapters.length
      },
      usage: metadata.tokensUsed || {},
      durationMs: metadata.phases?.phase3Duration || 0,
      config
    },
    phase4: {
      totalImages: chapters.length,
      successfulImages: chapters.filter(ch => ch.image_url).length,
      failedImages: chapters.filter(ch => !ch.image_url).length,
      images: chapters.map((ch, idx) => ({
        chapterOrder: idx + 1,
        imageUrl: ch.image_url,
        hasImage: !!ch.image_url
      })),
      coverImage: { url: null },
      durationMs: metadata.phases?.phase4Duration || 0
    }
  };

  return phaseLogs;
}

// Main execution
analyzeRecentStories(5).catch(error => {
  log(`\n❌ Fatal error: ${error}`, 'red');
  console.error(error);
  process.exit(1);
});
