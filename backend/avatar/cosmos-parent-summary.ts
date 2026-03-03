/**
 * cosmos-parent-summary.ts - Parent dashboard data
 *
 * GET /avatar/cosmos-parent-summary?avatarId=...
 * Returns evidence highlights, competency trends, and interest profile.
 */

import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { avatarDB } from "./db";

interface EvidenceHighlight {
  id: string;
  domainId: string;
  eventType: string;
  summary: string;
  score: number;
  maxScore: number;
  timestamp: string;
}

interface CompetencyTrend {
  domainId: string;
  skillType: string;
  mastery: number;
  confidence: number;
  stage: string;
}

interface ParentSummaryRequest {
  avatarId: string;
  profileId?: string;
  range?: string; // 'week' | 'month' | 'all'
}

interface ParentSummaryResponse {
  highlights: EvidenceHighlight[];
  competencies: CompetencyTrend[];
  pendingRecalls: number;
  totalEvidenceEvents: number;
}

export const cosmosParentSummary = api<ParentSummaryRequest, ParentSummaryResponse>(
  { expose: true, method: "GET", path: "/avatar/cosmos-parent-summary" },
  async (req) => {
    const auth = getAuthData();
    if (!auth) throw new Error("Unauthorized");

    const range = req.range || 'month';
    let dateFilter: string;
    switch (range) {
      case 'week':
        dateFilter = "NOW() - INTERVAL '7 days'";
        break;
      case 'month':
        dateFilter = "NOW() - INTERVAL '30 days'";
        break;
      default:
        dateFilter = "NOW() - INTERVAL '365 days'";
    }

    // Get evidence highlights (recent events with summaries)
    const highlightRows = await avatarDB.query`
      SELECT id, domain_id, event_type, score, max_score, payload, created_at
      FROM evidence_events
      WHERE avatar_id = ${req.avatarId}
        AND (${req.profileId}::TEXT IS NULL OR profile_id = ${req.profileId})
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const highlights: EvidenceHighlight[] = [];
    for await (const row of highlightRows) {
      const payload = typeof row.payload === 'string'
        ? JSON.parse(row.payload)
        : row.payload;

      highlights.push({
        id: row.id,
        domainId: row.domain_id,
        eventType: row.event_type,
        summary: payload?.summary || `${row.event_type}: ${Math.round(Number(row.score))}%`,
        score: Number(row.score) || 0,
        maxScore: Number(row.max_score) || 100,
        timestamp: new Date(row.created_at).toISOString(),
      });
    }

    // Get all competency states
    const compRows = await avatarDB.query`
      SELECT domain_id, skill_type, mastery, confidence, stage
      FROM competency_state
      WHERE avatar_id = ${req.avatarId}
        AND (${req.profileId}::TEXT IS NULL OR profile_id = ${req.profileId})
      ORDER BY domain_id, skill_type
    `;

    const competencies: CompetencyTrend[] = [];
    for await (const row of compRows) {
      competencies.push({
        domainId: row.domain_id,
        skillType: row.skill_type,
        mastery: Number(row.mastery) || 0,
        confidence: Number(row.confidence) || 0,
        stage: row.stage,
      });
    }

    // Count pending recalls
    const recallCount = await avatarDB.queryRow`
      SELECT COUNT(*) as cnt
      FROM recall_tasks
      WHERE avatar_id = ${req.avatarId}
        AND status = 'pending'
        AND due_at <= NOW()
    `;

    // Count total events
    const eventCount = await avatarDB.queryRow`
      SELECT COUNT(*) as cnt
      FROM evidence_events
      WHERE avatar_id = ${req.avatarId}
    `;

    return {
      highlights,
      competencies,
      pendingRecalls: Number(recallCount?.cnt) || 0,
      totalEvidenceEvents: Number(eventCount?.cnt) || 0,
    };
  }
);
