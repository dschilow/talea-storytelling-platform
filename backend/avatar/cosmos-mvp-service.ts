import { APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { avatarDB } from "./db";
import { ensureCosmosMvpSchema } from "./cosmos-mvp-schema";
import {
  AgeBand,
  CanonicalTopicCandidate,
  CORE_DOMAIN_IDS,
  CosmosDomainId,
  DEFAULT_TOPIC_STATS,
  SkillAccuracyStat,
  SkillType,
  TopicKind,
  TopicStage,
  TopicStatsState,
  buildLongTailTopicId,
  applyConfidenceDecay,
  computeMasteryDelta,
  computeQuizConfidenceDelta,
  computeQuizEvolutionDelta,
  computeRecallConfidenceDelta,
  computeStageTransitionEvolutionBonus,
  computeTopicStage,
  confidenceLabel,
  derivePlanetLevel,
  masteryLabel,
  matchTopicV1,
  normalizeDomainId,
  rollingAvg,
  sanitizeTopicStats,
  toAgeBandFromAge,
  updateRollingWindow,
} from "./cosmos-mvp-logic";
import { ensureDefaultProfileForUser, resolveRequestedProfileId } from "../helpers/profiles";

const userDB = SQLDatabase.named("user");
const dokuDB = SQLDatabase.named("doku");
const storyDB = SQLDatabase.named("story");

const FIXED_DOMAINS: CosmosDomainId[] = [...CORE_DOMAIN_IDS];

const ALLOWED_QUESTION_TYPES = new Set([
  "mc_single",
  "mc_multi",
  "true_false",
  "order",
  "match",
  "cause_effect",
]);

type QuestionType =
  | "mc_single"
  | "mc_multi"
  | "true_false"
  | "order"
  | "match"
  | "cause_effect";

interface RawContentPackageTopic {
  topicId?: string;
  topicTitle?: string;
  topicKind?: TopicKind;
  aliases?: string[];
  sourceTitle?: string;
}

export interface ContentIngestRequest {
  childId?: string;
  profileId?: string;
  avatarId?: string;
  userId: string;
  contentType?: "doku" | "story";
  contentPackage: Record<string, unknown>;
}

export interface QuizAnswerInput {
  questionId?: string;
  skillType?: string;
  questionType?: string;
  correct?: boolean;
  difficulty?: number;
}

export interface QuizSubmitRequest {
  userId: string;
  childId?: string;
  profileId?: string;
  avatarId?: string;
  contentId?: string;
  sourceContentId?: string;
  sourceContentType?: "doku" | "story";
  domainId: string;
  topicId?: string;
  topicTitle?: string;
  answers: QuizAnswerInput[];
}

export interface RecallSubmitRequest {
  userId: string;
  childId?: string;
  profileId?: string;
  avatarId?: string;
  recallTaskId: string;
  answers: Array<{ questionId?: string; correct?: boolean }>;
}

export interface ReadActivityRequest {
  userId: string;
  childId?: string;
  profileId?: string;
  avatarId?: string;
  sourceContentId: string;
  sourceContentType: "doku" | "story";
  domainId: string;
  topicId?: string;
  topicTitle?: string;
  contentTitle?: string;
  summary?: string;
}

export interface TopicIslandDTO {
  topicId: string;
  topicTitle: string;
  topicKind: TopicKind;
  stage: TopicStage;
  mastery: number;
  confidence: number;
  masteryLabel: string;
  confidenceLabel: string;
  lastActivityAt: string | null;
  recallDueAt: string | null;
  lat: number;
  lon: number;
  docsCount: number;
}

export interface CosmosStateDomainDTO {
  domainId: CosmosDomainId;
  evolutionIndex: number;
  planetLevel: number;
  stage: TopicStage;
  masteryScore: number;
  confidenceScore: number;
  masteryText: string;
  confidenceText: string;
  evidence: string;
  lastActivityAt: string | null;
  activeTopicCount: number;
}

export interface CosmosStateResponseDTO {
  childId: string;
  domains: CosmosStateDomainDTO[];
  totalStoriesRead: number;
  totalDokusRead: number;
  selectedDomain?: {
    domainId: CosmosDomainId;
    activeIslands: TopicIslandDTO[];
    moreTopicsCount: number;
  };
}

function uuid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

const DOMAIN_META: Record<string, { title: string; icon: string }> = {
  space: { title: "Weltraum", icon: "space" },
  nature: { title: "Natur & Tiere", icon: "nature" },
  history: { title: "Geschichte & Kulturen", icon: "history" },
  tech: { title: "Technik & Erfindungen", icon: "tech" },
  body: { title: "Mensch & Koerper", icon: "body" },
  earth: { title: "Erde & Klima", icon: "earth" },
  arts: { title: "Kunst & Musik", icon: "arts" },
  logic: { title: "Logik & Raetsel", icon: "logic" },
};

function toDomainLabel(domainId: string): string {
  const normalized = normalizeDomainId(domainId);
  if (DOMAIN_META[normalized]?.title) return DOMAIN_META[normalized].title;
  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .slice(0, 64) || "Neue Lernwelt";
}

async function ensureDomainExists(domainId: CosmosDomainId): Promise<void> {
  const normalized = normalizeDomainId(domainId);
  const meta = DOMAIN_META[normalized];
  await avatarDB.exec`
    INSERT INTO domains (domain_id, title, icon, created_at)
    VALUES (
      ${normalized},
      ${meta?.title || toDomainLabel(normalized)},
      ${meta?.icon || normalized},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (domain_id) DO NOTHING
  `;
}

function parseAliases(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 20);
  }
  return [];
}

function normalizeSkillType(input: unknown): SkillType {
  const value = String(input || "").trim().toLowerCase();
  if (value === "remember" || value === "understand" || value === "compare" || value === "apply" || value === "transfer") {
    return value;
  }
  if (value === "explain") return "understand";
  return "remember";
}

function normalizeQuestionType(input: unknown): QuestionType {
  const value = String(input || "").trim().toLowerCase().replace("-", "_");
  if (ALLOWED_QUESTION_TYPES.has(value)) {
    return value as QuestionType;
  }
  if (value === "mc") return "mc_single";
  if (value === "causeeffect") return "cause_effect";
  return "mc_single";
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isValidTopicId(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{1,39}_[a-z0-9][a-z0-9_\-]{2,72}$/i.test(value);
}

function topicTitleFromTopicId(topicId: string): string {
  const suffix = String(topicId || "").split("_").slice(1).join(" ").trim();
  const normalized = suffix.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return "Allgemeines Thema";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function normalizeTopicDisplayTitle(rawTitle: string | null | undefined, topicId: string): string {
  const raw = String(rawTitle || "").trim();
  if (!raw || raw === topicId) {
    return topicTitleFromTopicId(topicId);
  }
  const normalized = raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return topicTitleFromTopicId(topicId);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function normalizeDomainForStorage(value: string | null | undefined): CosmosDomainId {
  return normalizeDomainId(String(value || "").trim());
}

function mapStageToRank(stage: TopicStage): number {
  if (stage === "retained") return 3;
  if (stage === "apply") return 2;
  if (stage === "understood") return 1;
  return 0;
}

function parseDomainFromTopicId(topicId: string): CosmosDomainId | null {
  const prefix = String(topicId || "").split("_")[0];
  if (!prefix) return null;
  return normalizeDomainId(prefix);
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function islandLatLon(topicId: string): { lat: number; lon: number } {
  const latSeed = hashString(`${topicId}:lat`);
  const lonSeed = hashString(`${topicId}:lon`);
  const lat = -60 + (latSeed % 12000) / 100;
  const lon = (lonSeed % 36000) / 100;
  return { lat, lon };
}

function extractRecallEntryFromPackage(contentPackage: unknown): { afterDays: number; questionCount: number } {
  const source = contentPackage && typeof contentPackage === "object" ? (contentPackage as Record<string, unknown>) : {};
  const recallPlan = source.recallPlan && typeof source.recallPlan === "object" ? (source.recallPlan as Record<string, unknown>) : {};
  const entries = Array.isArray(recallPlan.entries) ? recallPlan.entries : [];
  const first = entries[0] && typeof entries[0] === "object" ? (entries[0] as Record<string, unknown>) : {};
  const afterDays = clamp(Math.floor(toNumber(first.afterDays, 5)), 3, 7);
  const questionCount = clamp(Math.floor(toNumber(first.questionCount, 4)), 3, 5);
  return { afterDays, questionCount };
}

function extractRecallQuestionsFromPackage(contentPackage: unknown, count: number): Array<Record<string, unknown>> {
  const source = contentPackage && typeof contentPackage === "object" ? (contentPackage as Record<string, unknown>) : {};
  const quiz = source.quiz && typeof source.quiz === "object" ? (source.quiz as Record<string, unknown>) : {};
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const limited = questions
    .filter((question) => question && typeof question === "object")
    .slice(0, count)
    .map((question, index) => {
      const q = question as Record<string, unknown>;
      return {
        id: String(q.id || `rq_${index}`),
        prompt: String(q.prompt || ""),
        type: String(q.type || "mc_single"),
        choices: Array.isArray(q.choices) ? q.choices : [],
        correct: q.correct ?? null,
      };
    });
  return limited;
}

async function ensureBaseRowsForChild(childId: string): Promise<void> {
  for (const domainId of FIXED_DOMAINS) {
    await ensureDomainExists(domainId);
    await avatarDB.exec`
      INSERT INTO tracking_domain_state (child_id, domain_id, evolution_index, planet_level, updated_at)
      VALUES (${childId}, ${domainId}, 0, 1, CURRENT_TIMESTAMP)
      ON CONFLICT (child_id, domain_id) DO NOTHING
    `;
  }
}

async function syncDokuDomainMappingsForChild(childId: string): Promise<void> {
  const contentRows = await avatarDB.queryAll<{
    content_id: string;
    domain_id: string;
    topic_id: string | null;
  }>`
    SELECT content_id, domain_id, topic_id
    FROM content_items
    WHERE child_id = ${childId}
      AND type = 'doku'
    ORDER BY created_at DESC
    LIMIT 300
  `;
  if (contentRows.length === 0) return;

  const dokuIds = Array.from(
    new Set(contentRows.map((row) => row.content_id).filter(Boolean))
  );
  if (dokuIds.length === 0) return;

  const dokuRows = await dokuDB.queryAll<{ id: string; domain_id: string | null }>`
    SELECT
      id,
      COALESCE(
        metadata->'configSnapshot'->>'domainId',
        metadata->>'domainId'
      ) AS domain_id
    FROM dokus
    WHERE id = ANY(${dokuIds})
  `;
  const dokuDomainMap = new Map<string, CosmosDomainId>();
  for (const row of dokuRows) {
    const rawDomain = String(row.domain_id || "").trim();
    if (!rawDomain) continue;
    dokuDomainMap.set(row.id, normalizeDomainForStorage(rawDomain));
  }

  for (const row of contentRows) {
    const targetDomain = dokuDomainMap.get(row.content_id);
    if (!targetDomain) continue;

    const currentDomain = normalizeDomainForStorage(row.domain_id);
    let nextTopicId = row.topic_id;
    const parsedTopicDomain = row.topic_id ? parseDomainFromTopicId(row.topic_id) : null;
    if (row.topic_id && parsedTopicDomain && parsedTopicDomain !== targetDomain) {
      const suffix = row.topic_id.split("_").slice(1).join("_");
      const remappedTopicId = buildLongTailTopicId(targetDomain, suffix || row.topic_id);
      await ensureTopicExists({
        topicId: remappedTopicId,
        domainId: targetDomain,
        topicKind: "longTail",
        topicTitle: topicTitleFromTopicId(suffix || row.topic_id),
        aliases: [],
      });
      nextTopicId = remappedTopicId;
    }

    const needsUpdate =
      currentDomain !== targetDomain ||
      (nextTopicId && nextTopicId !== row.topic_id);
    if (!needsUpdate) continue;

    await avatarDB.exec`
      UPDATE content_items
      SET domain_id = ${targetDomain},
          topic_id = ${nextTopicId}
      WHERE child_id = ${childId}
        AND content_id = ${row.content_id}
    `;
    await avatarDB.exec`
      UPDATE evidence_events
      SET domain_id = ${targetDomain},
          topic_id = COALESCE(${nextTopicId}, topic_id)
      WHERE profile_id = ${childId}
        AND source_content_id = ${row.content_id}
        AND source_content_type = 'doku'
    `;
  }
}

async function getChildAgeBand(childId: string): Promise<AgeBand> {
  const row = await userDB.queryRow<{ age: number | null }>`
    SELECT age
    FROM child_profiles
    WHERE id = ${childId}
    LIMIT 1
  `;
  return toAgeBandFromAge(row?.age);
}

export async function resolveChildIdForCosmos(params: {
  userId: string;
  childId?: string;
  profileId?: string;
  avatarId?: string;
}): Promise<string> {
  const direct = params.childId?.trim() || params.profileId?.trim();
  if (direct) {
    return await resolveRequestedProfileId({
      userId: params.userId,
      requestedProfileId: direct,
      fallbackName: undefined,
    });
  }

  if (params.avatarId) {
    const avatar = await avatarDB.queryRow<{ profile_id: string | null }>`
      SELECT profile_id
      FROM avatars
      WHERE id = ${params.avatarId}
        AND user_id = ${params.userId}
      LIMIT 1
    `;
    if (avatar?.profile_id) {
      try {
        return await resolveRequestedProfileId({
          userId: params.userId,
          requestedProfileId: avatar.profile_id,
        });
      } catch (error) {
        console.warn("[cosmos-mvp] fallback to avatarId child scope after avatar profile resolve failed", error);
      }
    }
  }

  try {
    const profile = await ensureDefaultProfileForUser(params.userId);
    return profile.id;
  } catch (error) {
    if (params.avatarId) {
      console.warn("[cosmos-mvp] fallback to avatarId child scope after default profile ensure failed", error);
      return params.avatarId;
    }
    throw APIError.internal("Unable to resolve child profile for cosmos tracking");
  }
}

async function fetchCanonicalTopics(domainId: CosmosDomainId): Promise<CanonicalTopicCandidate[]> {
  const rows = await avatarDB.queryAll<{
    topic_id: string;
    title: string;
    aliases: unknown;
  }>`
    SELECT topic_id, title, aliases
    FROM topics
    WHERE domain_id = ${domainId}
      AND kind = 'canonical'
    ORDER BY created_at ASC
  `;

  return rows.map((row) => ({
    topicId: row.topic_id,
    title: row.title,
    aliases: parseAliases(row.aliases),
  }));
}

async function ensureTopicExists(params: {
  topicId: string;
  domainId: CosmosDomainId;
  topicKind: TopicKind;
  topicTitle: string;
  aliases?: string[];
}): Promise<void> {
  await avatarDB.exec`
    INSERT INTO topics (topic_id, domain_id, kind, title, aliases, created_at)
    VALUES (
      ${params.topicId},
      ${params.domainId},
      ${params.topicKind},
      ${params.topicTitle},
      ${JSON.stringify(params.aliases || [])}::jsonb,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (topic_id) DO UPDATE
    SET
      domain_id = EXCLUDED.domain_id,
      kind = EXCLUDED.kind,
      title = EXCLUDED.title,
      aliases = CASE
        WHEN topics.aliases = '[]'::jsonb THEN EXCLUDED.aliases
        ELSE topics.aliases
      END
  `;
}

async function resolveTopic(params: {
  domainId: CosmosDomainId;
  topic: RawContentPackageTopic | undefined;
  fallbackTitle: string;
}): Promise<{
  topicId: string;
  topicTitle: string;
  topicKind: TopicKind;
  sourceTitle: string;
}> {
  await ensureDomainExists(params.domainId);
  const topic = params.topic || {};
  const explicitTopicId = String(topic.topicId || "").trim();
  const topicTitle = String(topic.topicTitle || "").trim() || params.fallbackTitle || "Neues Thema";
  const topicKind = topic.topicKind === "canonical" || topic.topicKind === "longTail" ? topic.topicKind : undefined;

  if (explicitTopicId && isValidTopicId(explicitTopicId)) {
    const explicitDomain = parseDomainFromTopicId(explicitTopicId) || params.domainId;
    const fixedTopicKind: TopicKind = topicKind || "longTail";
    await ensureTopicExists({
      topicId: explicitTopicId,
      domainId: explicitDomain,
      topicKind: fixedTopicKind,
      topicTitle,
      aliases: parseAliases(topic.aliases),
    });
    return {
      topicId: explicitTopicId,
      topicTitle,
      topicKind: fixedTopicKind,
      sourceTitle: String(topic.sourceTitle || topicTitle),
    };
  }

  const candidates = await fetchCanonicalTopics(params.domainId);
  const matched = matchTopicV1({
    domainId: params.domainId,
    requestedTitle: topicTitle,
    candidates,
    threshold: 0.72,
  });

  await ensureTopicExists({
    topicId: matched.topicId,
    domainId: params.domainId,
    topicKind: matched.topicKind,
    topicTitle: matched.topicTitle,
    aliases: parseAliases(topic.aliases),
  });

  return {
    topicId: matched.topicId,
    topicTitle: matched.topicTitle,
    topicKind: matched.topicKind,
    sourceTitle: matched.sourceTitle,
  };
}

interface LoadedTopicState {
  topicId: string;
  domainId: CosmosDomainId;
  mastery: number;
  confidence: number;
  stage: TopicStage;
  stats: TopicStatsState;
  lastActivityAt: string | null;
}

async function loadTopicState(childId: string, topicId: string): Promise<LoadedTopicState | null> {
  const row = await avatarDB.queryRow<{
    topic_id: string;
    domain_id: string;
    mastery: number;
    confidence: number;
    stage: TopicStage;
    stats: unknown;
    last_activity_at: string | null;
  }>`
    SELECT
      t.topic_id,
      t.domain_id,
      COALESCE(tts.mastery, 0) AS mastery,
      COALESCE(tts.confidence, 0) AS confidence,
      COALESCE(tts.stage, 'discovered') AS stage,
      COALESCE(tts.stats, '{}'::jsonb) AS stats,
      tts.last_activity_at
    FROM topics t
    LEFT JOIN tracking_topic_state tts
      ON tts.child_id = ${childId}
     AND tts.topic_id = t.topic_id
    WHERE t.topic_id = ${topicId}
    LIMIT 1
  `;

  if (!row) return null;
  return {
    topicId: row.topic_id,
    domainId: normalizeDomainId(row.domain_id),
    mastery: toNumber(row.mastery, 0),
    confidence: toNumber(row.confidence, 0),
    stage: row.stage || "discovered",
    stats: sanitizeTopicStats(row.stats),
    lastActivityAt: row.last_activity_at || null,
  };
}

async function getOverdueWeeks(childId: string, topicId: string): Promise<number> {
  const row = await avatarDB.queryRow<{ oldest_due: string | null }>`
    SELECT MIN(due_at) AS oldest_due
    FROM recall_tasks
    WHERE child_id = ${childId}
      AND topic_id = ${topicId}
      AND status = 'pending'
      AND due_at < CURRENT_TIMESTAMP
  `;

  if (!row?.oldest_due) return 0;
  const diffMs = Date.now() - new Date(row.oldest_due).getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 0;
  return Math.max(0, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)));
}

async function upsertTopicState(params: {
  childId: string;
  topicId: string;
  mastery: number;
  confidence: number;
  stage: TopicStage;
  stats: TopicStatsState;
}): Promise<void> {
  await avatarDB.exec`
    INSERT INTO tracking_topic_state (
      child_id,
      topic_id,
      mastery,
      confidence,
      stage,
      last_activity_at,
      stats,
      updated_at
    )
    VALUES (
      ${params.childId},
      ${params.topicId},
      ${params.mastery},
      ${params.confidence},
      ${params.stage},
      CURRENT_TIMESTAMP,
      ${JSON.stringify(params.stats)}::jsonb,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (child_id, topic_id)
    DO UPDATE SET
      mastery = EXCLUDED.mastery,
      confidence = EXCLUDED.confidence,
      stage = EXCLUDED.stage,
      last_activity_at = CURRENT_TIMESTAMP,
      stats = EXCLUDED.stats,
      updated_at = CURRENT_TIMESTAMP
  `;
}

async function incrementDomainEvolution(params: {
  childId: string;
  domainId: CosmosDomainId;
  delta: number;
}): Promise<{ evolutionIndex: number; planetLevel: number }> {
  await ensureDomainExists(params.domainId);
  await avatarDB.exec`
    INSERT INTO tracking_domain_state (child_id, domain_id, evolution_index, planet_level, updated_at)
    VALUES (${params.childId}, ${params.domainId}, 0, 1, CURRENT_TIMESTAMP)
    ON CONFLICT (child_id, domain_id) DO NOTHING
  `;

  const row = await avatarDB.queryRow<{ evolution_index: number }>`
    SELECT evolution_index
    FROM tracking_domain_state
    WHERE child_id = ${params.childId}
      AND domain_id = ${params.domainId}
    LIMIT 1
  `;
  const current = Math.max(0, Math.floor(toNumber(row?.evolution_index, 0)));
  const next = Math.max(0, current + Math.max(0, Math.floor(params.delta)));
  const level = derivePlanetLevel(next);

  await avatarDB.exec`
    UPDATE tracking_domain_state
    SET
      evolution_index = ${next},
      planet_level = ${level},
      last_activity_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE child_id = ${params.childId}
      AND domain_id = ${params.domainId}
  `;

  return { evolutionIndex: next, planetLevel: level };
}

async function logEvidence(params: {
  childId: string;
  domainId: CosmosDomainId;
  topicId: string;
  eventType: "quiz" | "recall" | "doku_read" | "story_read";
  score: number;
  maxScore: number;
  sourceContentId?: string;
  sourceContentType?: "doku" | "story";
  summary: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
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
      ${uuid("ev")},
      ${params.childId},
      ${params.childId},
      ${params.domainId},
      ${params.topicId},
      ${params.eventType},
      'REMEMBER',
      ${params.score},
      ${params.maxScore},
      ${JSON.stringify({
        summary: params.summary,
        ...(params.payload || {}),
      })}::jsonb,
      ${params.sourceContentId ?? null},
      ${params.sourceContentType ?? null}
    )
  `;
}

export async function ingestContentPackage(params: ContentIngestRequest): Promise<{
  childId: string;
  contentId: string;
  domainId: CosmosDomainId;
  topicId: string;
  topicKind: TopicKind;
}> {
  await ensureCosmosMvpSchema();
  const childId = await resolveChildIdForCosmos({
    userId: params.userId,
    childId: params.childId,
    profileId: params.profileId,
    avatarId: params.avatarId,
  });
  await ensureBaseRowsForChild(childId);

  const pkg = params.contentPackage || {};
  const domainId = normalizeDomainId(String(pkg.domainId || ""));
  const topic = pkg.topic && typeof pkg.topic === "object" ? (pkg.topic as RawContentPackageTopic) : undefined;
  const title = String(pkg.title || pkg.contentTitle || "Lerninhalt");
  const topicResolved = await resolveTopic({
    domainId,
    topic,
    fallbackTitle: topic?.topicTitle || title,
  });

  const contentId = String(pkg.contentId || "").trim() || uuid("cnt");
  const contentType = params.contentType || (String(pkg.contentType || "doku").trim().toLowerCase() === "story" ? "story" : "doku");

  await avatarDB.exec`
    INSERT INTO content_items (
      content_id,
      child_id,
      domain_id,
      topic_id,
      type,
      package_json,
      created_at
    )
    VALUES (
      ${contentId},
      ${childId},
      ${domainId},
      ${topicResolved.topicId},
      ${contentType},
      ${JSON.stringify(pkg)}::jsonb,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (content_id)
    DO UPDATE SET
      child_id = EXCLUDED.child_id,
      domain_id = EXCLUDED.domain_id,
      topic_id = EXCLUDED.topic_id,
      type = EXCLUDED.type,
      package_json = EXCLUDED.package_json
  `;

  return {
    childId,
    contentId,
    domainId,
    topicId: topicResolved.topicId,
    topicKind: topicResolved.topicKind,
  };
}

function computeSkillStats(answers: QuizAnswerInput[]): {
  bySkill: Partial<Record<SkillType, SkillAccuracyStat>>;
  overallAccuracy: number;
  correctCount: number;
  totalCount: number;
  understandAccuracy: number;
  applyTransferAccuracy: number;
  applyTransferSessionsCount: number;
} {
  const bySkill: Partial<Record<SkillType, SkillAccuracyStat>> = {};
  let totalCount = 0;
  let correctCount = 0;

  let understandTotal = 0;
  let understandCorrect = 0;
  let applyTransferTotal = 0;
  let applyTransferCorrect = 0;

  for (const answer of answers) {
    const skillType = normalizeSkillType(answer.skillType);
    const correct = Boolean(answer.correct);
    totalCount += 1;
    if (correct) correctCount += 1;

    if (!bySkill[skillType]) {
      bySkill[skillType] = { correct: 0, total: 0 };
    }
    bySkill[skillType]!.total += 1;
    if (correct) {
      bySkill[skillType]!.correct += 1;
    }

    if (skillType === "understand") {
      understandTotal += 1;
      if (correct) understandCorrect += 1;
    }
    if (skillType === "apply" || skillType === "transfer") {
      applyTransferTotal += 1;
      if (correct) applyTransferCorrect += 1;
    }
  }

  const overallAccuracy = totalCount > 0 ? correctCount / totalCount : 0;
  const understandAccuracy = understandTotal > 0 ? understandCorrect / understandTotal : 0;
  const applyTransferAccuracy = applyTransferTotal > 0 ? applyTransferCorrect / applyTransferTotal : 0;

  return {
    bySkill,
    overallAccuracy,
    correctCount,
    totalCount,
    understandAccuracy,
    applyTransferAccuracy,
    applyTransferSessionsCount: applyTransferTotal > 0 ? 1 : 0,
  };
}

async function resolveTopicFromQuizInput(params: {
  childId: string;
  domainId: CosmosDomainId;
  topicId?: string;
  topicTitle?: string;
  sourceContentId?: string;
}): Promise<string> {
  await ensureDomainExists(params.domainId);
  const explicitTopicId = String(params.topicId || "").trim();
  const explicitTitle = String(params.topicTitle || "").trim();
  if (explicitTopicId && isValidTopicId(explicitTopicId)) {
    const explicitDomain = parseDomainFromTopicId(explicitTopicId);
    if (explicitDomain && explicitDomain !== params.domainId) {
      const explicitSuffix = explicitTopicId.split("_").slice(1).join("_");
      const remappedTopicId = buildLongTailTopicId(
        params.domainId,
        explicitSuffix || explicitTopicId
      );
      await ensureTopicExists({
        topicId: remappedTopicId,
        domainId: params.domainId,
        topicKind: "longTail",
        topicTitle:
          explicitTitle ||
          topicTitleFromTopicId(explicitSuffix || explicitTopicId),
        aliases: [],
      });
      return remappedTopicId;
    }
    await ensureTopicExists({
      topicId: explicitTopicId,
      domainId: params.domainId,
      topicKind: "longTail",
      topicTitle: explicitTitle || topicTitleFromTopicId(explicitTopicId),
      aliases: [],
    });
    return explicitTopicId;
  }

  if (params.sourceContentId) {
    const content = await avatarDB.queryRow<{ topic_id: string; domain_id: string }>`
      SELECT topic_id, domain_id
      FROM content_items
      WHERE child_id = ${params.childId}
        AND content_id = ${params.sourceContentId}
      LIMIT 1
    `;
    if (
      content?.topic_id &&
      normalizeDomainId(content.domain_id) === params.domainId
    ) {
      return content.topic_id;
    }
  }

  const fallbackTopicId = `${params.domainId}_general`;
  await ensureTopicExists({
    topicId: fallbackTopicId,
    domainId: params.domainId,
    topicKind: "longTail",
    topicTitle: "Allgemeines Thema",
    aliases: [],
  });
  return fallbackTopicId;
}

async function resolveDomainFromSourceContent(params: {
  childId: string;
  requestedDomainId: string;
  sourceContentId?: string;
  sourceContentType?: "doku" | "story";
}): Promise<CosmosDomainId> {
  const requestedRaw = String(params.requestedDomainId || "").trim();
  const hasExplicitRequested = requestedRaw.length > 0;
  const requested = normalizeDomainForStorage(params.requestedDomainId);

  if (params.sourceContentType === "doku" && params.sourceContentId) {
    const dokuRow = await dokuDB.queryRow<{ domain_id: string | null }>`
      SELECT COALESCE(
        metadata->'configSnapshot'->>'domainId',
        metadata->>'domainId'
      ) AS domain_id
      FROM dokus
      WHERE id = ${params.sourceContentId}
      LIMIT 1
    `;
    if (dokuRow?.domain_id) {
      return normalizeDomainForStorage(dokuRow.domain_id);
    }
  }

  if (hasExplicitRequested) {
    return requested;
  }

  if (!params.sourceContentId) {
    return requested;
  }

  const contentRow = await avatarDB.queryRow<{ domain_id: string | null }>`
    SELECT domain_id
    FROM content_items
    WHERE child_id = ${params.childId}
      AND content_id = ${params.sourceContentId}
    LIMIT 1
  `;
  if (contentRow?.domain_id) {
    return normalizeDomainForStorage(contentRow.domain_id);
  }

  return requested;
}

async function loadContentPackageByContentId(childId: string, contentId: string | undefined): Promise<Record<string, unknown> | null> {
  if (!contentId) return null;
  const row = await avatarDB.queryRow<{ package_json: unknown }>`
    SELECT package_json
    FROM content_items
    WHERE child_id = ${childId}
      AND content_id = ${contentId}
    LIMIT 1
  `;
  return row?.package_json && typeof row.package_json === "object"
    ? (row.package_json as Record<string, unknown>)
    : null;
}

export async function submitQuizForCosmos(params: QuizSubmitRequest): Promise<{
  childId: string;
  topicId: string;
  domainId: CosmosDomainId;
  stage: TopicStage;
  mastery: number;
  confidence: number;
  masteryDelta: number;
  confidenceDelta: number;
  recallTaskId: string;
  recallDueAt: string;
  evolutionIndex: number;
  planetLevel: number;
}> {
  await ensureCosmosMvpSchema();
  const childId = await resolveChildIdForCosmos({
    userId: params.userId,
    childId: params.childId,
    profileId: params.profileId,
    avatarId: params.avatarId,
  });
  await ensureBaseRowsForChild(childId);

  const domainId = await resolveDomainFromSourceContent({
    childId,
    requestedDomainId: params.domainId,
    sourceContentId: params.sourceContentId || params.contentId,
    sourceContentType: params.sourceContentType,
  });
  const topicId = await resolveTopicFromQuizInput({
    childId,
    domainId,
    topicId: params.topicId,
    topicTitle: params.topicTitle,
    sourceContentId: params.sourceContentId || params.contentId,
  });
  const resolvedContentId = params.sourceContentId || params.contentId;
  if (resolvedContentId) {
    await avatarDB.exec`
      INSERT INTO content_items (
        content_id,
        child_id,
        domain_id,
        topic_id,
        type,
        package_json,
        created_at
      )
      VALUES (
        ${resolvedContentId},
        ${childId},
        ${domainId},
        ${topicId},
        ${params.sourceContentType ?? "doku"},
        ${JSON.stringify({
          contentId: resolvedContentId,
          contentType: params.sourceContentType ?? "doku",
          domainId,
          title: resolvedContentId,
          topic: { topicId, topicTitle: topicId, topicKind: "longTail" },
          metadata: { source: "quiz_submit" },
        })}::jsonb,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (content_id)
      DO UPDATE SET
        child_id = EXCLUDED.child_id,
        domain_id = EXCLUDED.domain_id,
        topic_id = EXCLUDED.topic_id,
        type = EXCLUDED.type
    `;
  }

  const normalizedAnswers = (Array.isArray(params.answers) ? params.answers : [])
    .map((answer, index) => ({
      questionId: String(answer.questionId || `q_${index}`),
      skillType: normalizeSkillType(answer.skillType),
      questionType: normalizeQuestionType(answer.questionType),
      correct: Boolean(answer.correct),
      difficulty: clamp(Math.round(toNumber(answer.difficulty, 1)), 1, 5),
    }))
    .filter((answer) => answer.questionId.length > 0);

  if (normalizedAnswers.length === 0) {
    throw APIError.invalidArgument("No quiz answers provided");
  }

  const topicState = await loadTopicState(childId, topicId);
  if (!topicState) {
    throw APIError.notFound("Topic not found");
  }

  const ageBand = await getChildAgeBand(childId);
  const overdueWeeks = await getOverdueWeeks(childId, topicId);
  const baseConfidence = applyConfidenceDecay(topicState.confidence, overdueWeeks);

  const metrics = computeSkillStats(normalizedAnswers);
  const masteryDelta = computeMasteryDelta({
    mastery: topicState.mastery,
    overallAccuracy: metrics.overallAccuracy,
    skillStats: metrics.bySkill,
  });
  const confidenceDelta = computeQuizConfidenceDelta(metrics.overallAccuracy);

  const nextMastery = clamp(topicState.mastery + masteryDelta, 0, 100);
  const nextConfidence = clamp(baseConfidence + confidenceDelta, 0, 100);

  const nextStats: TopicStatsState = {
    ...DEFAULT_TOPIC_STATS,
    ...topicState.stats,
  };
  nextStats.quizSessionsCount = Math.max(0, nextStats.quizSessionsCount) + 1;

  if (metrics.bySkill.understand && metrics.bySkill.understand.total > 0) {
    nextStats.understandAccWindow = updateRollingWindow(
      nextStats.understandAccWindow,
      metrics.understandAccuracy,
      5
    );
    nextStats.understandStreak =
      metrics.understandAccuracy >= 0.7 ? nextStats.understandStreak + 1 : 0;
  }

  if (metrics.applyTransferSessionsCount > 0) {
    nextStats.applyTransferAccWindow = updateRollingWindow(
      nextStats.applyTransferAccWindow,
      metrics.applyTransferAccuracy,
      5
    );
    nextStats.applyStreak =
      metrics.applyTransferAccuracy >= 0.7 ? nextStats.applyStreak + 1 : 0;
  }

  const understandRollingAvg = rollingAvg(nextStats.understandAccWindow);
  const applyTransferRollingAvg = rollingAvg(nextStats.applyTransferAccWindow);
  const nextStage = computeTopicStage({
    ageBand,
    quizSessionsCount: nextStats.quizSessionsCount,
    understandRollingAvg,
    applyTransferSessionsCount: nextStats.applyTransferAccWindow.length,
    applyTransferRollingAvg,
    recallPassedCount: nextStats.recallPassedCount,
    confidence: nextConfidence,
    hasAnyActivity: true,
  });

  await upsertTopicState({
    childId,
    topicId,
    mastery: nextMastery,
    confidence: nextConfidence,
    stage: nextStage,
    stats: nextStats,
  });

  const stageBonus = computeStageTransitionEvolutionBonus({
    previousStage: topicState.stage,
    nextStage,
    ageBand,
  });
  const evolutionDelta = computeQuizEvolutionDelta(metrics.overallAccuracy) + stageBonus;
  const domainState = await incrementDomainEvolution({
    childId,
    domainId,
    delta: evolutionDelta,
  });

  await avatarDB.exec`
    INSERT INTO quiz_attempts (
      id,
      child_id,
      content_id,
      topic_id,
      domain_id,
      answers,
      score,
      created_at
    )
    VALUES (
      ${uuid("qa")},
      ${childId},
      ${params.contentId ?? params.sourceContentId ?? null},
      ${topicId},
      ${domainId},
      ${JSON.stringify(normalizedAnswers)}::jsonb,
      ${JSON.stringify({
        overallAccuracy: metrics.overallAccuracy,
        correctCount: metrics.correctCount,
        totalCount: metrics.totalCount,
      })}::jsonb,
      CURRENT_TIMESTAMP
    )
  `;

  await logEvidence({
    childId,
    domainId,
    topicId,
    eventType: "quiz",
    score: Math.round(metrics.overallAccuracy * 100),
    maxScore: 100,
    sourceContentId: params.sourceContentId ?? params.contentId,
    sourceContentType: params.sourceContentType,
    summary: `Quiz: ${metrics.correctCount}/${metrics.totalCount} richtig`,
    payload: {
      overallAccuracy: metrics.overallAccuracy,
      masteryDelta,
      confidenceDelta,
      stage: nextStage,
    },
  });

  const contentPackage = await loadContentPackageByContentId(childId, params.contentId ?? params.sourceContentId);
  const recallPlan = extractRecallEntryFromPackage(contentPackage);
  const recallQuestions = extractRecallQuestionsFromPackage(contentPackage, recallPlan.questionCount);
  const dueAt = new Date(Date.now() + recallPlan.afterDays * 24 * 60 * 60 * 1000);
  const recallTaskId = uuid("recall");

  await avatarDB.exec`
    INSERT INTO recall_tasks (
      id,
      avatar_id,
      profile_id,
      child_id,
      domain_id,
      topic_id,
      source_content_id,
      source_content_type,
      due_at,
      status,
      questions,
      payload,
      created_at
    )
    VALUES (
      ${recallTaskId},
      ${params.avatarId ?? childId},
      ${childId},
      ${childId},
      ${domainId},
      ${topicId},
      ${params.sourceContentId ?? params.contentId ?? null},
      ${params.sourceContentType ?? null},
      ${dueAt.toISOString()},
      'pending',
      ${JSON.stringify(recallQuestions)}::jsonb,
      ${JSON.stringify({
        questions: recallQuestions,
        afterDays: recallPlan.afterDays,
      })}::jsonb,
      CURRENT_TIMESTAMP
    )
  `;

  return {
    childId,
    topicId,
    domainId,
    stage: nextStage,
    mastery: nextMastery,
    confidence: nextConfidence,
    masteryDelta,
    confidenceDelta,
    recallTaskId,
    recallDueAt: dueAt.toISOString(),
    evolutionIndex: domainState.evolutionIndex,
    planetLevel: domainState.planetLevel,
  };
}

export async function submitRecallForCosmos(params: RecallSubmitRequest): Promise<{
  childId: string;
  topicId: string;
  domainId: CosmosDomainId;
  stage: TopicStage;
  mastery: number;
  confidence: number;
  confidenceDelta: number;
  evolutionIndex: number;
  planetLevel: number;
  passed: boolean;
}> {
  await ensureCosmosMvpSchema();
  const childId = await resolveChildIdForCosmos({
    userId: params.userId,
    childId: params.childId,
    profileId: params.profileId,
    avatarId: params.avatarId,
  });
  await ensureBaseRowsForChild(childId);

  const task = await avatarDB.queryRow<{
    id: string;
    domain_id: string;
    topic_id: string;
    status: string;
    child_id: string | null;
    profile_id: string | null;
    source_content_id: string | null;
    source_content_type: "doku" | "story" | null;
  }>`
    SELECT
      id,
      domain_id,
      topic_id,
      status,
      child_id,
      profile_id,
      source_content_id,
      source_content_type
    FROM recall_tasks
    WHERE id = ${params.recallTaskId}
      AND (
        child_id = ${childId}
        OR profile_id = ${childId}
      )
    LIMIT 1
  `;

  if (!task) {
    throw APIError.notFound("Recall task not found");
  }
  if (task.status !== "pending") {
    throw APIError.invalidArgument("Recall task is not pending");
  }

  const answers = (Array.isArray(params.answers) ? params.answers : [])
    .map((answer, index) => ({
      questionId: String(answer.questionId || `rq_${index}`),
      correct: Boolean(answer.correct),
    }))
    .filter((answer) => answer.questionId.length > 0);

  if (answers.length === 0) {
    throw APIError.invalidArgument("No recall answers provided");
  }

  const totalCount = answers.length;
  const correctCount = answers.filter((answer) => answer.correct).length;
  const overallAccuracy = totalCount > 0 ? correctCount / totalCount : 0;
  const passed = overallAccuracy >= 0.7;

  const topicId = task.topic_id;
  const domainId = normalizeDomainId(task.domain_id);
  const topicState = await loadTopicState(childId, topicId);
  if (!topicState) {
    throw APIError.notFound("Topic state not found");
  }

  const ageBand = await getChildAgeBand(childId);
  const overdueWeeks = await getOverdueWeeks(childId, topicId);
  const baseConfidence = applyConfidenceDecay(topicState.confidence, overdueWeeks);
  const confidenceDelta = computeRecallConfidenceDelta(overallAccuracy);
  const nextConfidence = clamp(baseConfidence + confidenceDelta, 0, 100);
  const nextMastery = clamp(topicState.mastery, 0, 100);

  const nextStats: TopicStatsState = {
    ...DEFAULT_TOPIC_STATS,
    ...topicState.stats,
    recallPassedCount: topicState.stats.recallPassedCount + (passed ? 1 : 0),
  };

  const nextStage = computeTopicStage({
    ageBand,
    quizSessionsCount: nextStats.quizSessionsCount,
    understandRollingAvg: rollingAvg(nextStats.understandAccWindow),
    applyTransferSessionsCount: nextStats.applyTransferAccWindow.length,
    applyTransferRollingAvg: rollingAvg(nextStats.applyTransferAccWindow),
    recallPassedCount: nextStats.recallPassedCount,
    confidence: nextConfidence,
    hasAnyActivity: true,
  });

  await upsertTopicState({
    childId,
    topicId,
    mastery: nextMastery,
    confidence: nextConfidence,
    stage: nextStage,
    stats: nextStats,
  });

  const stageBonus = computeStageTransitionEvolutionBonus({
    previousStage: topicState.stage,
    nextStage,
    ageBand,
  });
  const evolutionDelta = (passed ? 6 : 0) + stageBonus;
  const domainState = await incrementDomainEvolution({
    childId,
    domainId,
    delta: evolutionDelta,
  });

  await avatarDB.exec`
    UPDATE recall_tasks
    SET
      status = 'done',
      done_at = CURRENT_TIMESTAMP,
      completed_at = CURRENT_TIMESTAMP,
      score = ${Math.round(overallAccuracy * 100)},
      payload = COALESCE(payload, '{}'::jsonb) || ${JSON.stringify({
        submittedAnswers: answers,
        overallAccuracy,
      })}::jsonb
    WHERE id = ${params.recallTaskId}
  `;

  await logEvidence({
    childId,
    domainId,
    topicId,
    eventType: "recall",
    score: Math.round(overallAccuracy * 100),
    maxScore: 100,
    sourceContentId: task.source_content_id || undefined,
    sourceContentType: task.source_content_type || undefined,
    summary: `Recall: ${correctCount}/${totalCount}`,
    payload: {
      overallAccuracy,
      confidenceDelta,
      stage: nextStage,
      passed,
    },
  });

  return {
    childId,
    topicId,
    domainId,
    stage: nextStage,
    mastery: nextMastery,
    confidence: nextConfidence,
    confidenceDelta,
    evolutionIndex: domainState.evolutionIndex,
    planetLevel: domainState.planetLevel,
    passed,
  };
}

export async function recordReadActivity(params: ReadActivityRequest): Promise<{
  childId: string;
  topicId: string;
  domainId: CosmosDomainId;
  stage: TopicStage;
  evolutionIndex: number;
  planetLevel: number;
}> {
  await ensureCosmosMvpSchema();
  const childId = await resolveChildIdForCosmos({
    userId: params.userId,
    childId: params.childId,
    profileId: params.profileId,
    avatarId: params.avatarId,
  });
  await ensureBaseRowsForChild(childId);

  const domainId = normalizeDomainId(params.domainId);
  const topicId = await resolveTopicFromQuizInput({
    childId,
    domainId,
    topicId: params.topicId,
    topicTitle: params.topicTitle || params.contentTitle,
    sourceContentId: params.sourceContentId,
  });

  const derivedContentTitle =
    String(params.contentTitle || "").trim() ||
    String(params.topicTitle || "").trim() ||
    `${params.sourceContentType === "doku" ? "Doku" : "Story"} ${params.sourceContentId}`;
  const topicTitle =
    String(params.topicTitle || "").trim() ||
    derivedContentTitle;
  const contentPackage = {
    contentId: params.sourceContentId,
    contentType: params.sourceContentType,
    domainId,
    title: derivedContentTitle,
    contentTitle: derivedContentTitle,
    topic: {
      topicId,
      topicTitle,
      topicKind: "longTail",
    },
    metadata: {
      source: "read_activity",
      summary: params.summary || null,
    },
  };

  await avatarDB.exec`
    INSERT INTO content_items (
      content_id,
      child_id,
      domain_id,
      topic_id,
      type,
      package_json,
      created_at
    )
    VALUES (
      ${params.sourceContentId},
      ${childId},
      ${domainId},
      ${topicId},
      ${params.sourceContentType},
      ${JSON.stringify(contentPackage)}::jsonb,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (content_id)
    DO UPDATE SET
      child_id = EXCLUDED.child_id,
      domain_id = EXCLUDED.domain_id,
      topic_id = EXCLUDED.topic_id,
      type = EXCLUDED.type,
      package_json = EXCLUDED.package_json
  `;

  const topicState = await loadTopicState(childId, topicId);
  if (!topicState) {
    throw APIError.notFound("Topic not found");
  }

  const ageBand = await getChildAgeBand(childId);
  const nextStats: TopicStatsState = {
    ...DEFAULT_TOPIC_STATS,
    ...topicState.stats,
    dokuCompletedCount: topicState.stats.dokuCompletedCount + 1,
  };
  const nextStage = computeTopicStage({
    ageBand,
    quizSessionsCount: nextStats.quizSessionsCount,
    understandRollingAvg: rollingAvg(nextStats.understandAccWindow),
    applyTransferSessionsCount: nextStats.applyTransferAccWindow.length,
    applyTransferRollingAvg: rollingAvg(nextStats.applyTransferAccWindow),
    recallPassedCount: nextStats.recallPassedCount,
    confidence: topicState.confidence,
    hasAnyActivity: true,
  });

  await upsertTopicState({
    childId,
    topicId,
    mastery: topicState.mastery,
    confidence: topicState.confidence,
    stage: nextStage,
    stats: nextStats,
  });

  const stageBonus = computeStageTransitionEvolutionBonus({
    previousStage: topicState.stage,
    nextStage,
    ageBand,
  });
  const domainState = await incrementDomainEvolution({
    childId,
    domainId,
    delta: 1 + stageBonus,
  });

  await logEvidence({
    childId,
    domainId,
    topicId,
    eventType: params.sourceContentType === "doku" ? "doku_read" : "story_read",
    score: 100,
    maxScore: 100,
    sourceContentId: params.sourceContentId,
    sourceContentType: params.sourceContentType,
    summary:
      params.summary ||
      `${params.sourceContentType === "doku" ? "Doku" : "Story"} abgeschlossen`,
  });

  return {
    childId,
    topicId,
    domainId,
    stage: nextStage,
    evolutionIndex: domainState.evolutionIndex,
    planetLevel: domainState.planetLevel,
  };
}

type DomainTopicRow = {
  topic_id: string;
  title: string;
  kind: TopicKind;
  mastery: number;
  confidence: number;
  stage: TopicStage;
  last_activity_at: string | null;
  stats: unknown;
  recall_due_at: string | null;
  docs_count: number;
};

function sortTopicRows(rows: DomainTopicRow[]): DomainTopicRow[] {
  return [...rows].sort((a, b) => {
    const aRecall = a.recall_due_at ? new Date(a.recall_due_at).getTime() : Number.POSITIVE_INFINITY;
    const bRecall = b.recall_due_at ? new Date(b.recall_due_at).getTime() : Number.POSITIVE_INFINITY;
    if (aRecall !== bRecall) return aRecall - bRecall;

    const aActivity = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
    const bActivity = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
    if (aActivity !== bActivity) return bActivity - aActivity;

    const aRetained = a.stage === "retained" ? 1 : 0;
    const bRetained = b.stage === "retained" ? 1 : 0;
    if (aRetained !== bRetained) return aRetained - bRetained;

    return a.title.localeCompare(b.title);
  });
}

async function loadDomainTopicRows(params: {
  childId: string;
  domainId: CosmosDomainId;
}): Promise<DomainTopicRow[]> {
  const rows = await avatarDB.queryAll<DomainTopicRow>`
    WITH candidate_topics AS (
      SELECT DISTINCT tts.topic_id
      FROM tracking_topic_state tts
      JOIN topics t
        ON t.topic_id = tts.topic_id
      WHERE tts.child_id = ${params.childId}
        AND t.domain_id = ${params.domainId}

      UNION

      SELECT DISTINCT ci.topic_id
      FROM content_items ci
      WHERE ci.child_id = ${params.childId}
        AND ci.domain_id = ${params.domainId}
        AND ci.topic_id IS NOT NULL

      UNION

      SELECT DISTINCT ee.topic_id
      FROM evidence_events ee
      WHERE ee.profile_id = ${params.childId}
        AND ee.domain_id = ${params.domainId}
        AND ee.topic_id IS NOT NULL
        AND ee.event_type IN ('doku_read', 'story_read', 'quiz')
    )
    SELECT
      ct.topic_id,
      COALESCE(
        NULLIF(t.title, ''),
        NULLIF(topic_title_source.title, ''),
        ct.topic_id
      ) AS title,
      COALESCE(t.kind, 'longTail') AS kind,
      COALESCE(tts.mastery, 0) AS mastery,
      COALESCE(tts.confidence, 0) AS confidence,
      COALESCE(tts.stage, 'discovered') AS stage,
      tts.last_activity_at,
      COALESCE(tts.stats, '{}'::jsonb) AS stats,
      (
        SELECT MIN(rt.due_at)
        FROM recall_tasks rt
        WHERE rt.child_id = ${params.childId}
          AND rt.topic_id = ct.topic_id
          AND rt.status = 'pending'
      ) AS recall_due_at,
      (
        SELECT GREATEST(
          (
            SELECT COUNT(*)::int
            FROM content_items ci
            WHERE ci.child_id = ${params.childId}
              AND ci.topic_id = ct.topic_id
          ),
          (
            SELECT COUNT(DISTINCT ee.source_content_id)::int
            FROM evidence_events ee
            WHERE ee.profile_id = ${params.childId}
              AND ee.topic_id = ct.topic_id
              AND ee.event_type IN ('doku_read', 'story_read')
              AND ee.source_content_id IS NOT NULL
          )
        )::int
      ) AS docs_count
    FROM candidate_topics ct
    LEFT JOIN topics t
      ON t.topic_id = ct.topic_id
    LEFT JOIN tracking_topic_state tts
      ON tts.topic_id = ct.topic_id
     AND tts.child_id = ${params.childId}
    LEFT JOIN LATERAL (
      SELECT COALESCE(
        NULLIF(source_rows.package_json->'topic'->>'topicTitle', ''),
        NULLIF(source_rows.package_json->>'topicTitle', ''),
        NULLIF(source_rows.package_json->>'contentTitle', ''),
        NULLIF(source_rows.package_json->>'title', ''),
        NULLIF(source_rows.payload->>'topicTitle', '')
      ) AS title,
      src_created_at
      FROM (
        SELECT ci.package_json, NULL::jsonb AS payload, ci.created_at AS src_created_at
        FROM content_items ci
        WHERE ci.child_id = ${params.childId}
          AND ci.domain_id = ${params.domainId}
          AND ci.topic_id = ct.topic_id

        UNION ALL

        SELECT NULL::jsonb AS package_json, ee.payload, ee.created_at AS src_created_at
        FROM evidence_events ee
        WHERE ee.profile_id = ${params.childId}
          AND ee.domain_id = ${params.domainId}
          AND ee.topic_id = ct.topic_id
      ) source_rows
      ORDER BY src_created_at DESC
      LIMIT 1
    ) AS topic_title_source ON TRUE
    ORDER BY tts.updated_at DESC NULLS LAST
  `;

  return rows;
}

export async function getDomainTopicsForChild(params: {
  userId: string;
  childId?: string;
  profileId?: string;
  avatarId?: string;
  domainId: string;
}): Promise<{
  childId: string;
  domainId: CosmosDomainId;
  activeIslands: TopicIslandDTO[];
  otherTopics: TopicIslandDTO[];
}> {
  await ensureCosmosMvpSchema();
  const childId = await resolveChildIdForCosmos({
    userId: params.userId,
    childId: params.childId,
    profileId: params.profileId,
    avatarId: params.avatarId,
  });
  await ensureBaseRowsForChild(childId);

  const domainId = normalizeDomainId(params.domainId);
  const rows = sortTopicRows(await loadDomainTopicRows({ childId, domainId }));
  const active = rows.slice(0, 20);
  const rest = rows.slice(20);

  const mapRow = (row: DomainTopicRow): TopicIslandDTO => {
    const { lat, lon } = islandLatLon(row.topic_id);
    const confidence = toNumber(row.confidence, 0);
    return {
      topicId: row.topic_id,
      topicTitle: normalizeTopicDisplayTitle(row.title, row.topic_id),
      topicKind: row.kind,
      stage: row.stage,
      mastery: roundOne(row.mastery),
      confidence: roundOne(confidence),
      masteryLabel: masteryLabel(row.mastery),
      confidenceLabel: confidenceLabel(confidence),
      lastActivityAt: row.last_activity_at || null,
      recallDueAt: row.recall_due_at || null,
      lat,
      lon,
      docsCount: Math.max(0, toNumber(row.docs_count, 0)),
    };
  };

  return {
    childId,
    domainId,
    activeIslands: active.map(mapRow),
    otherTopics: rest.map(mapRow),
  };
}

function stageFromDomainRows(rows: DomainTopicRow[]): TopicStage {
  if (rows.length === 0) return "discovered";
  let stage: TopicStage = "discovered";
  for (const row of rows) {
    if (mapStageToRank(row.stage) > mapStageToRank(stage)) {
      stage = row.stage;
    }
  }
  return stage;
}

export async function getCosmosStateForChild(params: {
  userId: string;
  childId?: string;
  profileId?: string;
  avatarId?: string;
  selectedDomainId?: string;
}): Promise<CosmosStateResponseDTO> {
  await ensureCosmosMvpSchema();
  const childId = await resolveChildIdForCosmos({
    userId: params.userId,
    childId: params.childId,
    profileId: params.profileId,
    avatarId: params.avatarId,
  });
  await ensureBaseRowsForChild(childId);
  try {
    await syncDokuDomainMappingsForChild(childId);
  } catch (error) {
    console.warn("[cosmos-mvp] failed to sync doku domain mappings", error);
  }

  const domainRows = await avatarDB.queryAll<{
    domain_id: string;
    evolution_index: number;
    planet_level: number;
    last_activity_at: string | null;
  }>`
    SELECT
      d.domain_id,
      COALESCE(tds.evolution_index, 0) AS evolution_index,
      COALESCE(tds.planet_level, 1) AS planet_level,
      tds.last_activity_at
    FROM domains d
    LEFT JOIN tracking_domain_state tds
      ON tds.domain_id = d.domain_id
     AND tds.child_id = ${childId}
    WHERE
      d.domain_id = ANY(${FIXED_DOMAINS})
      OR EXISTS (
        SELECT 1
        FROM topics t
        JOIN tracking_topic_state tts
          ON tts.topic_id = t.topic_id
         AND tts.child_id = ${childId}
        WHERE t.domain_id = d.domain_id
      )
      OR EXISTS (
        SELECT 1
        FROM content_items ci
        WHERE ci.child_id = ${childId}
          AND ci.domain_id = d.domain_id
      )
      OR EXISTS (
        SELECT 1
        FROM evidence_events ee
        WHERE ee.profile_id = ${childId}
          AND ee.domain_id = d.domain_id
      )
      OR tds.child_id IS NOT NULL
    ORDER BY
      CASE
        WHEN d.domain_id = ANY(${FIXED_DOMAINS}) THEN array_position(${FIXED_DOMAINS}::text[], d.domain_id)
        ELSE 1000
      END,
      COALESCE(tds.last_activity_at, d.created_at) DESC,
      d.domain_id
  `;

  const contentTotals = await avatarDB.queryRow<{
    total_stories_read: number;
    total_dokus_read: number;
  }>`
    WITH content_totals AS (
      SELECT
        COALESCE(COUNT(*) FILTER (WHERE type = 'story'), 0)::int AS stories_count,
        COALESCE(COUNT(*) FILTER (WHERE type = 'doku'), 0)::int AS dokus_count
      FROM content_items
      WHERE child_id = ${childId}
    ),
    evidence_totals AS (
      SELECT
        COALESCE(COUNT(DISTINCT source_content_id) FILTER (
          WHERE event_type = 'story_read' AND source_content_id IS NOT NULL
        ), 0)::int AS stories_count,
        COALESCE(COUNT(DISTINCT source_content_id) FILTER (
          WHERE event_type = 'doku_read' AND source_content_id IS NOT NULL
        ), 0)::int AS dokus_count
      FROM evidence_events
      WHERE profile_id = ${childId}
    )
    SELECT
      GREATEST(content_totals.stories_count, evidence_totals.stories_count) AS total_stories_read,
      GREATEST(content_totals.dokus_count, evidence_totals.dokus_count) AS total_dokus_read
    FROM content_totals, evidence_totals
  `;

  const dokuProfileTotals = await dokuDB.queryRow<{ total_dokus_read: number }>`
    SELECT COALESCE(COUNT(*), 0)::int AS total_dokus_read
    FROM doku_profile_state
    WHERE profile_id = ${childId}
      AND completion_state = 'completed'
  `;
  const dokuParticipantTotals = await dokuDB.queryRow<{ total_dokus_known: number }>`
    SELECT COALESCE(COUNT(DISTINCT doku_id), 0)::int AS total_dokus_known
    FROM doku_participants
    WHERE profile_id = ${childId}
  `;
  const storyProfileTotals = await storyDB.queryRow<{ total_stories_read: number }>`
    SELECT COALESCE(COUNT(*), 0)::int AS total_stories_read
    FROM story_profile_state
    WHERE profile_id = ${childId}
      AND completion_state = 'completed'
  `;
  const storyParticipantTotals = await storyDB.queryRow<{ total_stories_known: number }>`
    SELECT COALESCE(COUNT(DISTINCT story_id), 0)::int AS total_stories_known
    FROM story_participants
    WHERE profile_id = ${childId}
  `;

  const domains: CosmosStateDomainDTO[] = [];
  for (const row of domainRows) {
    const domainId = normalizeDomainId(row.domain_id);
    const topicRows = await loadDomainTopicRows({ childId, domainId });
    const activeTopicCount = topicRows.length;
    const stage = stageFromDomainRows(topicRows);

    const avgMastery =
      topicRows.length > 0
        ? topicRows.reduce((sum, item) => sum + toNumber(item.mastery, 0), 0) / topicRows.length
        : 0;
    const avgConfidence =
      topicRows.length > 0
        ? topicRows.reduce((sum, item) => sum + toNumber(item.confidence, 0), 0) / topicRows.length
        : 0;

    const evidence = await avatarDB.queryRow<{ summary: string | null }>`
      SELECT payload->>'summary' AS summary
      FROM evidence_events
      WHERE profile_id = ${childId}
        AND domain_id = ${domainId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    domains.push({
      domainId,
      evolutionIndex: Math.max(0, Math.floor(toNumber(row.evolution_index, 0))),
      planetLevel: clamp(Math.floor(toNumber(row.planet_level, 1)), 1, 50),
      stage,
      masteryScore: roundOne(avgMastery),
      confidenceScore: roundOne(avgConfidence),
      masteryText: masteryLabel(avgMastery),
      confidenceText: confidenceLabel(avgConfidence),
      evidence: evidence?.summary || "Neue Lernspur gesammelt.",
      lastActivityAt: row.last_activity_at || null,
      activeTopicCount,
    });
  }

  let selectedDomain: CosmosStateResponseDTO["selectedDomain"] | undefined;
  if (params.selectedDomainId) {
    const selected = normalizeDomainId(params.selectedDomainId);
    const topics = await getDomainTopicsForChild({
      userId: params.userId,
      childId,
      domainId: selected,
    });
    selectedDomain = {
      domainId: selected,
      activeIslands: topics.activeIslands,
      moreTopicsCount: topics.otherTopics.length,
    };
  }

  return {
    childId,
    domains,
    totalStoriesRead: Math.max(
      0,
      toNumber(contentTotals?.total_stories_read, 0),
      toNumber(storyProfileTotals?.total_stories_read, 0),
      toNumber(storyParticipantTotals?.total_stories_known, 0)
    ),
    totalDokusRead: Math.max(
      0,
      toNumber(contentTotals?.total_dokus_read, 0),
      toNumber(dokuProfileTotals?.total_dokus_read, 0),
      toNumber(dokuParticipantTotals?.total_dokus_known, 0)
    ),
    selectedDomain,
  };
}

export async function getTopicTimelineForChild(params: {
  userId: string;
  childId?: string;
  profileId?: string;
  avatarId?: string;
  topicId: string;
}): Promise<{
  childId: string;
  topicId: string;
  docs: Array<{
    contentId: string;
    type: "doku" | "story";
    title: string;
    createdAt: string;
  }>;
  quizAttempts: Array<{
    id: string;
    accuracy: number;
    correctCount: number;
    totalCount: number;
    createdAt: string;
  }>;
  recallTasks: Array<{
    id: string;
    dueAt: string;
    status: string;
    score: number | null;
    doneAt: string | null;
  }>;
}> {
  await ensureCosmosMvpSchema();
  const childId = await resolveChildIdForCosmos({
    userId: params.userId,
    childId: params.childId,
    profileId: params.profileId,
    avatarId: params.avatarId,
  });

  const docs = await avatarDB.queryAll<{
    content_id: string;
    type: "doku" | "story";
    package_json: unknown;
    created_at: string;
  }>`
    SELECT content_id, type, package_json, created_at
    FROM content_items
    WHERE child_id = ${childId}
      AND topic_id = ${params.topicId}
    ORDER BY created_at DESC
    LIMIT 5
  `;

  const fallbackDocs = await avatarDB.queryAll<{
    source_content_id: string;
    source_content_type: string | null;
    event_type: string;
    created_at: string;
  }>`
    SELECT
      source_content_id,
      source_content_type,
      event_type,
      created_at
    FROM evidence_events
    WHERE profile_id = ${childId}
      AND topic_id = ${params.topicId}
      AND source_content_id IS NOT NULL
      AND event_type IN ('doku_read', 'story_read', 'quiz')
    ORDER BY created_at DESC
    LIMIT 20
  `;

  const contentTimelineDocs = docs.map((doc) => {
    const pkg = doc.package_json && typeof doc.package_json === "object"
      ? (doc.package_json as Record<string, unknown>)
      : {};
    return {
      contentId: doc.content_id,
      type: doc.type,
      rawTitle: String(pkg.title || pkg.contentTitle || "").trim(),
      createdAt: doc.created_at,
    };
  });

  const knownDocIds = new Set(contentTimelineDocs.map((doc) => doc.contentId));
  const fallbackDocCandidates: Array<{
    contentId: string;
    type: "doku" | "story";
    createdAt: string;
  }> = [];
  for (const row of fallbackDocs) {
    const contentId = String(row.source_content_id || "").trim();
    if (!contentId || knownDocIds.has(contentId)) continue;
    const type = row.source_content_type === "story" || row.event_type === "story_read"
      ? "story"
      : "doku";
    fallbackDocCandidates.push({
      contentId,
      type,
      createdAt: row.created_at,
    });
    knownDocIds.add(contentId);
  }

  const titleLookupDocs = [
    ...contentTimelineDocs.filter(
      (entry) => !entry.rawTitle || entry.rawTitle === entry.contentId
    ).map((entry) => ({ contentId: entry.contentId, type: entry.type })),
    ...fallbackDocCandidates.map((entry) => ({
      contentId: entry.contentId,
      type: entry.type,
    })),
  ];
  const dokuIds = Array.from(
    new Set(
      titleLookupDocs
        .filter((entry) => entry.type === "doku")
        .map((entry) => entry.contentId)
    )
  );
  const storyIds = Array.from(
    new Set(
      titleLookupDocs
        .filter((entry) => entry.type === "story")
        .map((entry) => entry.contentId)
    )
  );

  const dokuTitleRows = dokuIds.length
    ? await dokuDB.queryAll<{ id: string; title: string }>`
        SELECT id, title
        FROM dokus
        WHERE id = ANY(${dokuIds})
      `
    : [];
  const storyTitleRows = storyIds.length
    ? await storyDB.queryAll<{ id: string; title: string }>`
        SELECT id, title
        FROM stories
        WHERE id = ANY(${storyIds})
      `
    : [];
  const dokuTitleMap = new Map(dokuTitleRows.map((row) => [row.id, row.title]));
  const storyTitleMap = new Map(storyTitleRows.map((row) => [row.id, row.title]));

  const fallbackTimelineDocs = fallbackDocCandidates.map((entry) => ({
    contentId: entry.contentId,
    type: entry.type,
    title:
      (entry.type === "doku"
        ? dokuTitleMap.get(entry.contentId)
        : storyTitleMap.get(entry.contentId)) || entry.contentId,
    createdAt: entry.createdAt,
  }));

  const quizAttempts = await avatarDB.queryAll<{
    id: string;
    score: unknown;
    created_at: string;
  }>`
    SELECT id, score, created_at
    FROM quiz_attempts
    WHERE child_id = ${childId}
      AND topic_id = ${params.topicId}
    ORDER BY created_at DESC
    LIMIT 10
  `;

  const recallTasks = await avatarDB.queryAll<{
    id: string;
    due_at: string;
    status: string;
    score: number | null;
    done_at: string | null;
    completed_at: string | null;
  }>`
    SELECT
      id,
      due_at,
      status,
      score,
      done_at,
      completed_at
    FROM recall_tasks
    WHERE child_id = ${childId}
      AND topic_id = ${params.topicId}
    ORDER BY created_at DESC
    LIMIT 10
  `;

  const contentDocsWithResolvedTitles = contentTimelineDocs.map((entry) => ({
    contentId: entry.contentId,
    type: entry.type,
    title:
      entry.rawTitle ||
      (entry.type === "doku"
        ? dokuTitleMap.get(entry.contentId)
        : storyTitleMap.get(entry.contentId)) ||
      entry.contentId,
    createdAt: entry.createdAt,
  }));

  const mergedDocs = [...contentDocsWithResolvedTitles, ...fallbackTimelineDocs]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 5);

  return {
    childId,
    topicId: params.topicId,
    docs: mergedDocs,
    quizAttempts: quizAttempts.map((attempt) => {
      const score = attempt.score && typeof attempt.score === "object"
        ? (attempt.score as Record<string, unknown>)
        : {};
      return {
        id: attempt.id,
        accuracy: clamp(toNumber(score.overallAccuracy, 0), 0, 1),
        correctCount: Math.max(0, Math.floor(toNumber(score.correctCount, 0))),
        totalCount: Math.max(0, Math.floor(toNumber(score.totalCount, 0))),
        createdAt: attempt.created_at,
      };
    }),
    recallTasks: recallTasks.map((task) => ({
      id: task.id,
      dueAt: task.due_at,
      status: task.status,
      score: task.score != null ? toNumber(task.score, 0) : null,
      doneAt: task.done_at || task.completed_at || null,
    })),
  };
}

export async function resolveDomainTopicForLegacy(params: {
  domainId: string;
  topicId?: string;
  topicTitle?: string;
}): Promise<{ domainId: CosmosDomainId; topicId: string }> {
  await ensureCosmosMvpSchema();
  const domainId = normalizeDomainId(params.domainId);
  const topicId = String(params.topicId || "").trim();
  if (topicId && isValidTopicId(topicId)) {
    await ensureTopicExists({
      topicId,
      domainId,
      topicKind: "longTail",
      topicTitle: params.topicTitle || topicId,
      aliases: [],
    });
    return { domainId, topicId };
  }

  const resolved = await resolveTopic({
    domainId,
    topic: {
      topicTitle: params.topicTitle || `${domainId}_topic`,
    },
    fallbackTitle: params.topicTitle || `${domainId} Thema`,
  });
  return { domainId, topicId: resolved.topicId };
}

function roundOne(value: number): number {
  return Math.round(toNumber(value, 0) * 10) / 10;
}
