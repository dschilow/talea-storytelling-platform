import { SQLDatabase } from "encore.dev/storage/sqldb";
import { recordReadActivity } from "../avatar/cosmos-mvp-service";

const avatarDB = SQLDatabase.named("avatar");

export type CosmosSourceType = "doku" | "story";

interface TrackCosmosReadParams {
  avatarId: string;
  profileId?: string;
  sourceContentId: string;
  sourceContentType: CosmosSourceType;
  domainId: string;
  topicId?: string;
  contentTitle?: string;
  topicTitle?: string;
  summary?: string;
}

const STORY_DOMAIN_MAP: Array<{ keywords: string[]; domainId: string }> = [
  { keywords: ["weltraum", "space", "planet", "galax"], domainId: "space" },
  { keywords: ["natur", "tier", "wald", "animal"], domainId: "nature" },
  { keywords: ["geschichte", "histor", "antike", "ritter"], domainId: "history" },
  { keywords: ["technik", "robot", "erfind", "maschine"], domainId: "tech" },
  { keywords: ["mensch", "koerper", "koerper", "gesund"], domainId: "body" },
  { keywords: ["erde", "klima", "wetter", "ozean"], domainId: "earth" },
  { keywords: ["kunst", "musik", "malen", "theater"], domainId: "arts" },
  { keywords: ["logik", "raetsel", "raetsel", "puzzle"], domainId: "logic" },
];

const DOKU_DOMAIN_MAP: Array<{ keywords: string[]; domainId: string }> = [
  { keywords: ["astronom", "weltraum", "galax", "planet", "stern", "kosmos"], domainId: "space" },
  { keywords: ["natur", "tier", "bio", "pflanz", "zool"], domainId: "nature" },
  { keywords: ["geschichte", "kultur", "antike", "histor"], domainId: "history" },
  { keywords: ["technik", "erfind", "physik", "robot", "maschine"], domainId: "tech" },
  { keywords: ["mensch", "koerper", "koerper", "medizin", "gesund"], domainId: "body" },
  { keywords: ["erde", "geografie", "geographie", "klima", "wetter", "ozean"], domainId: "earth" },
  { keywords: ["kunst", "musik", "malerei", "kompon"], domainId: "arts" },
  { keywords: ["mathe", "logik", "raetsel", "raetsel", "algorithm"], domainId: "logic" },
];

export function inferDomainFromStoryGenre(genre?: string): string {
  const value = String(genre || "").toLowerCase();
  for (const entry of STORY_DOMAIN_MAP) {
    if (entry.keywords.some((keyword) => value.includes(keyword))) {
      return entry.domainId;
    }
  }
  return "history";
}

export function inferDomainFromDokuTopic(topic?: string, perspective?: string): string {
  const value = `${topic || ""} ${perspective || ""}`.toLowerCase();
  for (const entry of DOKU_DOMAIN_MAP) {
    if (entry.keywords.some((keyword) => value.includes(keyword))) {
      return entry.domainId;
    }
  }
  const p = String(perspective || "").toLowerCase().trim();
  if (p === "technology") return "tech";
  if (p === "nature") return "nature";
  if (p === "history") return "history";
  if (p === "culture") return "arts";
  if (p === "science") return "space";
  return "history";
}

export function buildTopicId(params: {
  sourceContentType: CosmosSourceType;
  sourceContentId: string;
  domainId: string;
  label?: string;
}): string {
  const normalizedDomain = params.domainId === "art" ? "arts" : params.domainId;
  const sanitizedLabel = String(params.label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 72);
  const suffix = sanitizedLabel || params.sourceContentId.slice(0, 12);
  return `${normalizedDomain}_${suffix}`;
}

/**
 * Legacy compatibility hook:
 * - keeps old evidence_events entries for existing dashboards
 * - mirrors read activity into new cosmos MVP tracking tables
 */
export async function trackCosmosReadEvent(params: TrackCosmosReadParams): Promise<void> {
  const normalizedDomainId = params.domainId === "art" ? "arts" : params.domainId;
  const sourceEventType = params.sourceContentType === "doku" ? "doku_read" : "story_read";
  const topicId = params.topicId || null;
  const summary = params.summary || `${sourceEventType}: abgeschlossen`;

  await avatarDB.exec`
    INSERT INTO evidence_events (
      id,
      avatar_id,
      profile_id,
      domain_id,
      topic_id,
      event_type,
      skill_type,
      score,
      max_score,
      payload,
      source_content_id,
      source_content_type
    )
    VALUES (
      ${`ev_read_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`},
      ${params.avatarId},
      ${params.profileId ?? null},
      ${normalizedDomainId},
      ${topicId},
      ${sourceEventType},
      'REMEMBER',
      100,
      100,
      ${JSON.stringify({
        summary,
        sourceType: sourceEventType,
      })}::jsonb,
      ${params.sourceContentId},
      ${params.sourceContentType}
    )
  `;

  try {
    const owner = await avatarDB.queryRow<{ user_id: string; profile_id: string | null }>`
      SELECT user_id
           , profile_id
      FROM avatars
      WHERE id = ${params.avatarId}
      LIMIT 1
    `;

    if (owner?.user_id) {
      const scopedProfileId = params.profileId || owner.profile_id || undefined;
      await recordReadActivity({
        userId: owner.user_id,
        childId: scopedProfileId,
        profileId: scopedProfileId,
        avatarId: params.avatarId,
        sourceContentId: params.sourceContentId,
        sourceContentType: params.sourceContentType,
        domainId: normalizedDomainId,
        topicId: topicId || undefined,
        contentTitle: params.contentTitle,
        topicTitle: params.topicTitle,
        summary,
      });
    }
  } catch (error) {
    console.warn("[cosmos-tracking] failed to mirror read event into cosmos mvp", error);
  }
}
