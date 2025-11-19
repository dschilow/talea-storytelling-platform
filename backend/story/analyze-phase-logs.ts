// Phase Log Analysis Tool
// Extrahiert und analysiert Phase-Logs aus der Log-Datenbank

import { logDB } from "../log/db";

export interface PhaseLogData {
  phase0?: any;
  phase1?: any;
  phase2?: any;
  phase3?: any;
  phase4?: any;
}

/**
 * Extrahiert Phase-Logs für eine spezifische Story aus der Datenbank
 * Logs werden von der Log-Service Datenbank gelesen
 */
export async function extractPhaseLogsFromDatabase(storyId: string): Promise<PhaseLogData> {
  const phaseLogs: PhaseLogData = {};

  try {
    // Query Phase 0 logs (Fairy Tale Selection)
    const phase0Rows = await logDB.queryAll<{
      request: string;
      response: string;
      created_at: Date;
    }>`
      SELECT request, response, created_at
      FROM logs
      WHERE source = 'fairy-tale-selection'
        AND request::jsonb @> jsonb_build_object('storyId', ${storyId})
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (phase0Rows.length > 0) {
      const row = phase0Rows[0];
      const request = typeof row.request === 'string' ? JSON.parse(row.request) : row.request;
      const response = typeof row.response === 'string' ? JSON.parse(row.response) : row.response;

      phaseLogs.phase0 = {
        fairyTaleUsed: response.selectedFairyTale || null,
        config: request.config || {},
        durationMs: response.durationMs || 0
      };

      console.log(`[Log Analyzer] Found Phase 0 log for story ${storyId}`);
    } else {
      console.log(`[Log Analyzer] No Phase 0 log found for story ${storyId}`);
    }

    // Query Phase 1 logs (Skeleton Generation)
    const phase1Rows = await logDB.queryAll<{
      request: string;
      response: string;
      created_at: Date;
    }>`
      SELECT request, response, created_at
      FROM logs
      WHERE source = 'phase1-skeleton-generation'
        AND created_at >= NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 10
    `;

    // Find the most relevant Phase 1 log (may not have storyId yet)
    for (const row of phase1Rows) {
      const request = typeof row.request === 'string' ? JSON.parse(row.request) : row.request;
      const response = typeof row.response === 'string' ? JSON.parse(row.response) : row.response;

      // Check if this log is related to our story (by timing or config match)
      phaseLogs.phase1 = {
        skeleton: response.skeleton || {},
        usage: response.usage || {},
        durationMs: response.durationMs || 0,
        config: request.config || {},
        openAIRequest: request.openAIRequest || null
      };

      console.log(`[Log Analyzer] Found Phase 1 log for story ${storyId}`);
      break;
    }

    // Query Phase 2 logs (Character Matching)
    const phase2Rows = await logDB.queryAll<{
      request: string;
      response: string;
      created_at: Date;
    }>`
      SELECT request, response, created_at
      FROM logs
      WHERE source = 'phase2-character-matching'
        AND created_at >= NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 10
    `;

    for (const row of phase2Rows) {
      const request = typeof row.request === 'string' ? JSON.parse(row.request) : row.request;
      const response = typeof row.response === 'string' ? JSON.parse(row.response) : row.response;

      phaseLogs.phase2 = {
        matchedCount: response.matchedCount || 0,
        requirementsCount: request.requirements?.length || 0,
        assignments: response.assignments || [],
        durationMs: response.durationMs || 0
      };

      console.log(`[Log Analyzer] Found Phase 2 log for story ${storyId}`);
      break;
    }

    // Query Phase 3 logs (Story Finalization)
    const phase3Rows = await logDB.queryAll<{
      request: string;
      response: string;
      created_at: Date;
    }>`
      SELECT request, response, created_at
      FROM logs
      WHERE source = 'phase3-story-finalization'
        AND created_at >= NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 10
    `;

    for (const row of phase3Rows) {
      const request = typeof row.request === 'string' ? JSON.parse(row.request) : row.request;
      const response = typeof row.response === 'string' ? JSON.parse(row.response) : row.response;

      phaseLogs.phase3 = {
        story: response.story || {},
        usage: response.usage || {},
        durationMs: response.durationMs || 0,
        fairyTaleUsed: request.fairyTaleUsed || null,
        config: request.config || {},
        openAIRequest: request.openAIRequest || null,
        openAIResponse: response.openAIResponse || null
      };

      console.log(`[Log Analyzer] Found Phase 3 log for story ${storyId}`);
      break;
    }

    // Query Phase 4 logs (Image Generation)
    const phase4Rows = await logDB.queryAll<{
      request: string;
      response: string;
      created_at: Date;
    }>`
      SELECT request, response, created_at
      FROM logs
      WHERE source = 'phase4-image-generation'
        AND created_at >= NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 10
    `;

    for (const row of phase4Rows) {
      const request = typeof row.request === 'string' ? JSON.parse(row.request) : row.request;
      const response = typeof row.response === 'string' ? JSON.parse(row.response) : row.response;

      phaseLogs.phase4 = {
        totalImages: response.totalImages || 0,
        successfulImages: response.successfulImages || 0,
        failedImages: response.failedImages || 0,
        images: response.images || [],
        coverImage: response.coverImage || null,
        durationMs: response.durationMs || 0
      };

      console.log(`[Log Analyzer] Found Phase 4 log for story ${storyId}`);
      break;
    }

  } catch (error) {
    console.error(`[Log Analyzer] Error extracting phase logs:`, error);
  }

  // Fallback: Extract data from story metadata if logs are incomplete
  if (!phaseLogs.phase1 || !phaseLogs.phase2 || !phaseLogs.phase3 || !phaseLogs.phase4) {
    console.warn(`[Log Analyzer] Some phase logs missing, attempting to extract from story metadata...`);
    await enrichFromStoryMetadata(storyId, phaseLogs);
  }

  return phaseLogs;
}

/**
 * Enriches phase logs with data from story metadata if logs are incomplete
 */
async function enrichFromStoryMetadata(storyId: string, phaseLogs: PhaseLogData): Promise<void> {
  try {
    const { storyDB } = await import("./db");

    const storyRow = await storyDB.queryRow<{
      metadata: string | null;
      config: string;
      avatar_developments: string | null;
      created_at: Date;
    }>`
      SELECT metadata, config, avatar_developments, created_at
      FROM stories
      WHERE id = ${storyId}
    `;

    if (!storyRow) {
      console.warn(`[Log Analyzer] Story ${storyId} not found in database`);
      return;
    }

    const metadata = storyRow.metadata ? JSON.parse(storyRow.metadata) : {};
    const config = JSON.parse(storyRow.config);
    const avatarDevelopments = storyRow.avatar_developments ? JSON.parse(storyRow.avatar_developments) : [];

    // Enrich Phase 1 if missing
    if (!phaseLogs.phase1) {
      phaseLogs.phase1 = {
        skeleton: {
          title: metadata.title || 'Unknown',
          chapters: Array(5).fill({ order: 0, content: '' }),
          supportingCharacterRequirements: []
        },
        usage: metadata.tokensUsed || {},
        durationMs: metadata.phases?.phase1Duration || 0,
        config
      };
    }

    // Enrich Phase 2 if missing
    if (!phaseLogs.phase2) {
      const characterPoolUsed = metadata.characterPoolUsed || [];
      phaseLogs.phase2 = {
        matchedCount: characterPoolUsed.length,
        requirementsCount: characterPoolUsed.length,
        assignments: characterPoolUsed.map((char: any) => ({
          placeholder: char.placeholder,
          character: {
            id: char.characterId,
            name: char.characterName,
            role: 'unknown'
          }
        })),
        durationMs: metadata.phases?.phase2Duration || 0
      };
    }

    // Enrich Phase 3 if missing
    if (!phaseLogs.phase3) {
      const chapters = await storyDB.queryAll<{
        title: string;
        content: string;
        chapter_order: number;
      }>`
        SELECT title, content, chapter_order
        FROM chapters
        WHERE story_id = ${storyId}
        ORDER BY chapter_order
      `;

      phaseLogs.phase3 = {
        story: {
          title: metadata.title || 'Unknown',
          description: metadata.description || '',
          chapters: chapters.map(ch => ({
            order: ch.chapter_order,
            title: ch.title,
            content: ch.content
          })),
          avatarDevelopments,
          chaptersCount: chapters.length
        },
        usage: metadata.tokensUsed || {},
        durationMs: metadata.phases?.phase3Duration || 0,
        config
      };
    }

    // Enrich Phase 4 if missing
    if (!phaseLogs.phase4) {
      const chapters = await storyDB.queryAll<{
        image_url: string | null;
      }>`
        SELECT image_url
        FROM chapters
        WHERE story_id = ${storyId}
        ORDER BY chapter_order
      `;

      const images = chapters.map((ch, idx) => ({
        chapterOrder: idx + 1,
        imageUrl: ch.image_url,
        hasImage: !!ch.image_url,
        prompt: null
      }));

      const coverImageRow = await storyDB.queryRow<{ cover_image_url: string | null }>`
        SELECT cover_image_url
        FROM stories
        WHERE id = ${storyId}
      `;

      phaseLogs.phase4 = {
        totalImages: chapters.length,
        successfulImages: images.filter(img => img.hasImage).length,
        failedImages: images.filter(img => !img.hasImage).length,
        images,
        coverImage: {
          url: coverImageRow?.cover_image_url || null
        },
        durationMs: metadata.phases?.phase4Duration || 0
      };
    }

    // Enrich Phase 0 if missing and fairy tale was used
    if (!phaseLogs.phase0 && config.preferences?.useFairyTaleTemplate) {
      phaseLogs.phase0 = {
        fairyTaleUsed: metadata.storyExperience?.fairyTale || null,
        config,
        durationMs: 0
      };
    }

    console.log(`[Log Analyzer] Enriched phase logs from story metadata`);
  } catch (error) {
    console.error(`[Log Analyzer] Error enriching from story metadata:`, error);
  }
}

/**
 * API endpoint to manually analyze phase logs for a story
 */
import { api } from "encore.dev/api";
import { generateOverallReport } from "./phase-scorer";

export const analyzeStory = api(
  { expose: true, method: "GET", path: "/story/analyze/:storyId", auth: true },
  async (req: { storyId: string }): Promise<{
    storyId: string;
    phaseLogs: PhaseLogData;
    report: any;
  }> => {
    console.log(`[Analyze Story] Analyzing story: ${req.storyId}`);

    const phaseLogs = await extractPhaseLogsFromDatabase(req.storyId);

    const report = generateOverallReport(
      `manual-analysis-${Date.now()}`,
      req.storyId,
      phaseLogs.phase3?.story?.title || 'Unknown',
      phaseLogs.phase1?.config || {},
      phaseLogs
    );

    return {
      storyId: req.storyId,
      phaseLogs,
      report
    };
  }
);
