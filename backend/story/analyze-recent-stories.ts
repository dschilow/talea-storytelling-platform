// Public endpoint to analyze recent production stories
// No auth required - for optimization purposes only

import { api } from "encore.dev/api";
import { storyDB } from "./db";
import { generateOverallReport } from "./phase-scorer";

interface AnalysisRequest {
  limit?: number; // How many recent stories to analyze (default: 5, max: 20)
}

interface AnalysisResponse {
  analyzed: number;
  averageScores: {
    phase0: number;
    phase1: number;
    phase2: number;
    phase3: number;
    phase4: number;
    overall: number;
  };
  stories: Array<{
    storyId: string;
    title: string;
    createdAt: Date;
    overallScore: number;
    phaseScores: {
      phase0: number;
      phase1: number;
      phase2: number;
      phase3: number;
      phase4: number;
    };
  }>;
  topIssues: string[];
  topRecommendations: string[];
  priorityTargets: Array<{
    phase: string;
    score: number;
  }>;
}

export const analyzeRecentStories = api<AnalysisRequest, AnalysisResponse>(
  { expose: true, method: "POST", path: "/story/analyze-recent", auth: false },
  async (req): Promise<AnalysisResponse> => {
    const limit = Math.min(req.limit || 5, 20);

    console.log(`[Analyze Recent] Analyzing last ${limit} stories...`);

    // Get recent completed stories
    const stories = await storyDB.queryAll<{
      id: string;
      title: string;
      config: string;
      metadata: string | null;
      created_at: Date;
    }>`
      SELECT id, title, config, metadata, created_at
      FROM stories
      WHERE status = 'complete'
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    if (stories.length === 0) {
      return {
        analyzed: 0,
        averageScores: {
          phase0: 0,
          phase1: 0,
          phase2: 0,
          phase3: 0,
          phase4: 0,
          overall: 0
        },
        stories: [],
        topIssues: ['No completed stories found in database'],
        topRecommendations: [],
        priorityTargets: []
      };
    }

    const reports: any[] = [];
    const storyResults: any[] = [];

    for (const story of stories) {
      try {
        const config = JSON.parse(story.config);
        const metadata = story.metadata ? JSON.parse(story.metadata) : {};

        // Extract phase data from metadata
        const chapters = await storyDB.queryAll<{
          title: string;
          content: string;
          image_url: string | null;
          chapter_order: number;
        }>`
          SELECT title, content, image_url, chapter_order
          FROM chapters
          WHERE story_id = ${story.id}
          ORDER BY chapter_order
        `;

        const phaseLogs = {
          phase0: {
            fairyTaleUsed: metadata.storyExperience?.fairyTale || null,
            config,
            durationMs: metadata.phases?.phase0Duration || 0
          },
          phase1: {
            skeleton: {
              title: story.title,
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
                name: char.characterName
              }
            })),
            durationMs: metadata.phases?.phase2Duration || 0
          },
          phase3: {
            story: {
              title: story.title,
              chapters: chapters.map(ch => ({
                order: ch.chapter_order,
                title: ch.title,
                content: ch.content
              })),
              chaptersCount: chapters.length
            },
            usage: metadata.tokensUsed || {},
            durationMs: metadata.phases?.phase3Duration || 0,
            config
          },
          phase4: {
            totalImages: chapters.length,
            successfulImages: chapters.filter(ch => ch.image_url).length,
            images: chapters.map((ch, idx) => ({
              chapterOrder: idx + 1,
              hasImage: !!ch.image_url
            })),
            durationMs: metadata.phases?.phase4Duration || 0
          }
        };

        const report = generateOverallReport(
          `prod-${story.id}`,
          story.id,
          story.title,
          config,
          phaseLogs
        );

        reports.push(report);

        storyResults.push({
          storyId: story.id,
          title: story.title,
          createdAt: story.created_at,
          overallScore: report.overallScore,
          phaseScores: {
            phase0: report.phases.phase0.score,
            phase1: report.phases.phase1.score,
            phase2: report.phases.phase2.score,
            phase3: report.phases.phase3.score,
            phase4: report.phases.phase4.score
          }
        });

      } catch (error) {
        console.error(`[Analyze Recent] Error analyzing story ${story.id}:`, error);
      }
    }

    // Calculate averages
    const avgScores = {
      phase0: reports.reduce((sum, r) => sum + r.phases.phase0.score, 0) / reports.length,
      phase1: reports.reduce((sum, r) => sum + r.phases.phase1.score, 0) / reports.length,
      phase2: reports.reduce((sum, r) => sum + r.phases.phase2.score, 0) / reports.length,
      phase3: reports.reduce((sum, r) => sum + r.phases.phase3.score, 0) / reports.length,
      phase4: reports.reduce((sum, r) => sum + r.phases.phase4.score, 0) / reports.length,
      overall: reports.reduce((sum, r) => sum + r.overallScore, 0) / reports.length
    };

    // Collect issues and recommendations
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

    // Priority targets
    const priorityTargets = [
      { phase: 'Phase 0', score: avgScores.phase0 },
      { phase: 'Phase 1', score: avgScores.phase1 },
      { phase: 'Phase 2', score: avgScores.phase2 },
      { phase: 'Phase 3', score: avgScores.phase3 },
      { phase: 'Phase 4', score: avgScores.phase4 },
    ].sort((a, b) => a.score - b.score);

    console.log(`[Analyze Recent] Analysis complete. Overall score: ${avgScores.overall.toFixed(2)}/10.0`);

    return {
      analyzed: reports.length,
      averageScores: avgScores,
      stories: storyResults,
      topIssues: uniqueIssues.slice(0, 10),
      topRecommendations: uniqueRecommendations.slice(0, 10),
      priorityTargets
    };
  }
);
