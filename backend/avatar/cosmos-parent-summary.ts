/**
 * cosmos-parent-summary.ts - Parent dashboard data
 *
 * GET /avatar/cosmos-parent-summary?avatarId=...
 * Returns evidence highlights, competency trends, and interest profile.
 */

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { avatarDB } from "./db";
import { ensureCosmosTrackingSchema } from "./cosmos-schema";
import { ensureCosmosMvpSchema } from "./cosmos-mvp-schema";
import { resolveChildIdForCosmos } from "./cosmos-mvp-service";
import { assertAvatarOwnedByCurrentUser } from "./authz";
import { getProfileForUser } from "../helpers/profiles";

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
  { expose: true, method: "GET", path: "/avatar/cosmos-parent-summary", auth: true },
  async (req) => {
    const auth = getAuthData();
    if (!auth) throw APIError.unauthenticated("Unauthorized");
    if (!req.avatarId) throw APIError.invalidArgument("avatarId is required");
    await assertAvatarOwnedByCurrentUser(req.avatarId);
    if (req.profileId) {
      await getProfileForUser({
        userId: auth!.userID,
        profileId: req.profileId,
      });
    }
    await ensureCosmosTrackingSchema().catch((schemaError) => {
      console.warn("[avatar] cosmos schema ensure skipped in parent summary endpoint", schemaError);
    });
    await ensureCosmosMvpSchema().catch((schemaError) => {
      console.warn("[avatar] cosmos MVP schema ensure skipped in parent summary endpoint", schemaError);
    });

    try {
      const range = req.range || 'month';
      let threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (range === 'week') {
        threshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      } else if (range === 'all') {
        threshold = new Date(0);
      }

      // The Lernkosmos tracks per child profile: quiz and recall evidence carry
      // the profile id in avatar_id, a read is logged twice (legacy row with the
      // avatar id plus the cosmos row). Scope by profile and count a read once,
      // as the cosmos state does.
      const childId = await resolveChildIdForCosmos({
        userId: auth.userID,
        avatarId: req.avatarId,
        profileId: req.profileId,
      });

      // Get evidence highlights (recent events with summaries)
      const highlightRows = await avatarDB.query`
      SELECT id, domain_id, event_type, score, max_score, payload, created_at
      FROM (
        SELECT DISTINCT ON (dedupe_key)
          id, domain_id, event_type, score, max_score, payload, created_at
        FROM (
          SELECT ee.*,
            CASE
              WHEN ee.event_type IN ('doku_read', 'story_read') AND ee.source_content_id IS NOT NULL
                THEN ee.event_type || ':' || ee.source_content_id
              ELSE ee.id
            END AS dedupe_key
          FROM evidence_events ee
          WHERE (ee.profile_id = ${childId} OR ee.avatar_id = ${req.avatarId})
            AND ee.created_at >= ${threshold}
        ) scoped
        ORDER BY dedupe_key, created_at DESC
      ) deduped
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
      WHERE (avatar_id = ${req.avatarId} OR child_id = ${childId})
        AND status = 'pending'
        AND due_at <= NOW()
      `;

      // Count total events (a read counts once, see above)
      const eventCount = await avatarDB.queryRow`
      SELECT COUNT(DISTINCT
        CASE
          WHEN event_type IN ('doku_read', 'story_read') AND source_content_id IS NOT NULL
            THEN event_type || ':' || source_content_id
          ELSE id
        END
      ) as cnt
      FROM evidence_events
      WHERE (profile_id = ${childId} OR avatar_id = ${req.avatarId})
        AND created_at >= ${threshold}
      `;

      return {
        highlights,
        competencies,
        pendingRecalls: Number(recallCount?.cnt) || 0,
        totalEvidenceEvents: Number(eventCount?.cnt) || 0,
      };
    } catch (error) {
      console.error("[avatar] cosmos-parent-summary failed, returning empty summary", error);
      return {
        highlights: [],
        competencies: [],
        pendingRecalls: 0,
        totalEvidenceEvents: 0,
      };
    }
  }
);
