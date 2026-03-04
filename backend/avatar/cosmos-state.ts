/**
 * cosmos-state.ts - API endpoint for cosmos state
 *
 * GET /avatar/cosmos-state?avatarId=...
 * Returns all domain progress for rendering the 3D cosmos.
 */

import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { avatarDB } from "./db";
import { ensureCosmosTrackingSchema } from "./cosmos-schema";

interface CosmosStateRequest {
  avatarId: string;
  profileId?: string;
}

interface DomainProgress {
  domainId: string;
  mastery: number;
  confidence: number;
  stage: string;
  topicsExplored: number;
  lastActivityAt: string | null;
  recentHighlight?: string;
}

interface CosmosStateResponse {
  domains: DomainProgress[];
}

// Base domains (MVP). Additional domains discovered in DB are appended dynamically.
const BASE_DOMAINS = ['nature', 'space', 'history', 'tech', 'body', 'earth', 'art', 'logic'];

export const getCosmosState = api<CosmosStateRequest, CosmosStateResponse>(
  { expose: true, method: "GET", path: "/avatar/cosmos-state" },
  async (req) => {
    const auth = getAuthData();
    if (!auth) throw APIError.unauthenticated("Unauthorized");
    if (!req.avatarId) throw APIError.invalidArgument("avatarId is required");
    await ensureCosmosTrackingSchema();

    // Fetch all competency states for this avatar, aggregated by domain
    const rows = await avatarDB.query`
      SELECT
        domain_id,
        COALESCE(AVG(mastery), 0) as avg_mastery,
        COALESCE(AVG(confidence), 0) as avg_confidence,
        COUNT(DISTINCT topic_id) as topics_explored,
        MAX(last_activity_at) as last_activity_at
      FROM competency_state
      WHERE avatar_id = ${req.avatarId}
        AND (${req.profileId}::TEXT IS NULL OR profile_id = ${req.profileId})
      GROUP BY domain_id
    `;

    const domainMap = new Map<string, DomainProgress>();

    for await (const row of rows) {
      const mastery = Number(row.avg_mastery) || 0;
      const confidence = Number(row.avg_confidence) || 0;

      domainMap.set(row.domain_id, {
        domainId: row.domain_id,
        mastery: Math.round(mastery * 10) / 10,
        confidence: Math.round(confidence * 10) / 10,
        stage: computeStage(mastery, confidence),
        topicsExplored: Number(row.topics_explored) || 0,
        lastActivityAt: row.last_activity_at
          ? new Date(row.last_activity_at).toISOString()
          : null,
      });
    }

    // Fetch recent evidence highlights for active domains
    for (const [domainId, dp] of domainMap) {
      if (dp.mastery > 0) {
        const highlightRows = await avatarDB.query`
          SELECT payload->>'summary' as summary
          FROM evidence_events
          WHERE avatar_id = ${req.avatarId}
            AND domain_id = ${domainId}
            AND payload->>'summary' IS NOT NULL
          ORDER BY created_at DESC
          LIMIT 1
        `;

        for await (const row of highlightRows) {
          if (row.summary) {
            dp.recentHighlight = row.summary;
          }
        }
      }
    }

    // Fill missing base domains with empty progress and append additional discovered domains.
    const discoveredDomainIds = Array.from(domainMap.keys()).filter(
      (id) => !BASE_DOMAINS.includes(id)
    );
    const orderedDomainIds = [...BASE_DOMAINS, ...discoveredDomainIds.sort()];
    const domains = orderedDomainIds.map(
      (id) =>
        domainMap.get(id) ?? {
          domainId: id,
          mastery: 0,
          confidence: 0,
          stage: 'discovered',
          topicsExplored: 0,
          lastActivityAt: null,
        }
    );

    return { domains };
  }
);

function computeStage(mastery: number, confidence: number): string {
  if (mastery >= 80 && confidence >= 65) return 'mastered';
  if (mastery >= 55 && confidence >= 40) return 'can_explain';
  if (mastery >= 25 && confidence >= 15) return 'understood';
  return 'discovered';
}
