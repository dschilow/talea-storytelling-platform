import { APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { avatarDB } from "./db";
import { ensureCosmosMvpSchema } from "./cosmos-mvp-schema";
import {
  AgeBand,
  CanonicalTopicCandidate,
  CosmosDomainId,
  DEFAULT_TOPIC_STATS,
  SkillAccuracyStat,
  SkillType,
  TopicKind,
  TopicStage,
  TopicStatsState,
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

const FIXED_DOMAINS: CosmosDomainId[] = [
  "space",
  "nature",
  "history",
  "tech",
  "body",
  "earth",
  "arts",
  "logic",
];

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
  selectedDomain?: {
    domainId: CosmosDomainId;
    activeIslands: TopicIslandDTO[];
    moreTopicsCount: number;
  };
}

function uuid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
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
  return /^(space|nature|history|tech|body|earth|arts|logic|art)_[a-z0-9][a-z0-9_\-]{2,72}$/i.test(value);
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
    await avatarDB.exec`
      INSERT INTO tracking_domain_state (child_id, domain_id, evolution_index, planet_level, updated_at)
      VALUES (${childId}, ${domainId}, 0, 1, CURRENT_TIMESTAMP)
      ON CONFLICT (child_id, domain_id) DO NOTHING
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
    return resolveRequestedProfileId({
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
      return resolveRequestedProfileId({
        userId: params.userId,
        requestedProfileId: avatar.profile_id,
      });
    }
  }

  const profile = await ensureDefaultProfileForUser(params.userId);
  return profile.id;
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
  sourceContentId?: string;
}): Promise<string> {
  const explicitTopicId = String(params.topicId || "").trim();
  if (explicitTopicId && isValidTopicId(explicitTopicId)) {
    await ensureTopicExists({
      topicId: explicitTopicId,
      domainId: params.domainId,
      topicKind: "longTail",
      topicTitle: explicitTopicId,
      aliases: [],
    });
    return explicitTopicId;
  }

  if (params.sourceContentId) {
    const content = await avatarDB.queryRow<{ topic_id: string }>`
      SELECT topic_id
      FROM content_items
      WHERE child_id = ${params.childId}
        AND content_id = ${params.sourceContentId}
      LIMIT 1
    `;
    if (content?.topic_id) return content.topic_id;
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

  const domainId = normalizeDomainId(params.domainId);
  const topicId = await resolveTopicFromQuizInput({
    childId,
    domainId,
    topicId: params.topicId,
    sourceContentId: params.sourceContentId || params.contentId,
  });

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
    sourceContentId: params.sourceContentId,
  });

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
    SELECT
      t.topic_id,
      t.title,
      t.kind,
      COALESCE(tts.mastery, 0) AS mastery,
      COALESCE(tts.confidence, 0) AS confidence,
      COALESCE(tts.stage, 'discovered') AS stage,
      tts.last_activity_at,
      COALESCE(tts.stats, '{}'::jsonb) AS stats,
      (
        SELECT MIN(rt.due_at)
        FROM recall_tasks rt
        WHERE rt.child_id = ${params.childId}
          AND rt.topic_id = t.topic_id
          AND rt.status = 'pending'
      ) AS recall_due_at,
      (
        SELECT COUNT(*)::int
        FROM content_items ci
        WHERE ci.child_id = ${params.childId}
          AND ci.topic_id = t.topic_id
      ) AS docs_count
    FROM topics t
    JOIN tracking_topic_state tts
      ON tts.topic_id = t.topic_id
     AND tts.child_id = ${params.childId}
    WHERE t.domain_id = ${params.domainId}
    ORDER BY tts.updated_at DESC
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
      topicTitle: row.title,
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
    WHERE d.domain_id = ANY(${FIXED_DOMAINS})
    ORDER BY array_position(${FIXED_DOMAINS}::text[], d.domain_id)
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

  return {
    childId,
    topicId: params.topicId,
    docs: docs.map((doc) => {
      const pkg = doc.package_json && typeof doc.package_json === "object"
        ? (doc.package_json as Record<string, unknown>)
        : {};
      return {
        contentId: doc.content_id,
        type: doc.type,
        title: String(pkg.title || pkg.contentTitle || doc.content_id),
        createdAt: doc.created_at,
      };
    }),
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
