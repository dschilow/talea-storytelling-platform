import { SQLDatabase } from "encore.dev/storage/sqldb";

const avatarDB = SQLDatabase.named("avatar");

export type CosmosSourceType = "doku" | "story";

interface TrackCosmosReadParams {
  avatarId: string;
  profileId?: string;
  sourceContentId: string;
  sourceContentType: CosmosSourceType;
  domainId: string;
  topicId?: string;
  summary?: string;
}

const STORY_DOMAIN_MAP: Array<{ keywords: string[]; domainId: string }> = [
  { keywords: ["weltraum", "space", "planet", "galax"], domainId: "space" },
  { keywords: ["natur", "tier", "wald", "animal"], domainId: "nature" },
  { keywords: ["geschichte", "histor", "antike", "ritter"], domainId: "history" },
  { keywords: ["technik", "robot", "erfind", "maschine"], domainId: "tech" },
  { keywords: ["mensch", "koerper", "körper", "gesund"], domainId: "body" },
  { keywords: ["erde", "klima", "wetter", "ozean"], domainId: "earth" },
  { keywords: ["kunst", "musik", "malen", "theater"], domainId: "art" },
  { keywords: ["logik", "raetsel", "rätsel", "puzzle"], domainId: "logic" },
];

const DOKU_DOMAIN_MAP: Array<{ keywords: string[]; domainId: string }> = [
  { keywords: ["astronom", "weltraum", "galax", "planet", "stern", "kosmos"], domainId: "space" },
  { keywords: ["natur", "tier", "bio", "pflanz", "zool"], domainId: "nature" },
  { keywords: ["geschichte", "kultur", "antike", "histor"], domainId: "history" },
  { keywords: ["technik", "erfind", "physik", "robot", "maschine"], domainId: "tech" },
  { keywords: ["mensch", "koerper", "körper", "medizin", "gesund"], domainId: "body" },
  { keywords: ["erde", "geografie", "geographie", "klima", "wetter", "ozean"], domainId: "earth" },
  { keywords: ["kunst", "musik", "malerei", "kompon"], domainId: "art" },
  { keywords: ["mathe", "logik", "raetsel", "rätsel", "algorithm"], domainId: "logic" },
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
  return "history";
}

export function buildTopicId(params: {
  sourceContentType: CosmosSourceType;
  sourceContentId: string;
  domainId: string;
  label?: string;
}): string {
  const sanitizedLabel = String(params.label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  const suffix = sanitizedLabel || params.sourceContentId.slice(0, 12);
  return `${params.sourceContentType}_${params.domainId}_${suffix}`;
}

export async function trackCosmosReadEvent(params: TrackCosmosReadParams): Promise<void> {
  const sourceEventType = params.sourceContentType === "doku" ? "doku_read" : "story_read";
  const topicId = params.topicId || null;
  const id = `cs_${params.avatarId}_${params.domainId}_${topicId || "general"}_REMEMBER`;
  const masteryDelta = 2.0;
  const confidenceDelta = 1.0;

  const existing = await avatarDB.queryRow`
    SELECT mastery, confidence
    FROM competency_state
    WHERE avatar_id = ${params.avatarId}
      AND domain_id = ${params.domainId}
      AND COALESCE(topic_id, '') = ${topicId || ""}
      AND skill_type = 'REMEMBER'
  `;

  const currentMastery = existing ? Number(existing.mastery) || 0 : 0;
  const currentConfidence = existing ? Number(existing.confidence) || 0 : 0;
  const newMastery = Math.min(100, currentMastery + masteryDelta);
  const newConfidence = Math.min(100, currentConfidence + confidenceDelta);
  const newStage = computeStage(newMastery, newConfidence);

  await avatarDB.exec`
    INSERT INTO competency_state (id, avatar_id, profile_id, domain_id, topic_id, skill_type, mastery, confidence, stage, topics_explored, last_activity_at, updated_at)
    VALUES (
      ${id},
      ${params.avatarId},
      ${params.profileId ?? null},
      ${params.domainId},
      ${topicId},
      'REMEMBER',
      ${newMastery},
      ${newConfidence},
      ${newStage},
      1,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (avatar_id, domain_id, COALESCE(topic_id, ''), skill_type)
    DO UPDATE SET
      mastery = LEAST(100, competency_state.mastery + ${masteryDelta}),
      confidence = LEAST(100, competency_state.confidence + ${confidenceDelta}),
      stage = ${newStage},
      topics_explored = competency_state.topics_explored + 1,
      last_activity_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  `;

  const eventId = `ev_read_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
      ${eventId},
      ${params.avatarId},
      ${params.profileId ?? null},
      ${params.domainId},
      ${topicId},
      ${sourceEventType},
      'REMEMBER',
      ${100},
      ${100},
      ${JSON.stringify({
        summary,
        sourceType: sourceEventType,
      })},
      ${params.sourceContentId},
      ${params.sourceContentType}
    )
  `;
}

function computeStage(mastery: number, confidence: number): string {
  if (mastery >= 80 && confidence >= 65) return "mastered";
  if (mastery >= 55 && confidence >= 40) return "can_explain";
  if (mastery >= 25 && confidence >= 15) return "understood";
  return "discovered";
}
