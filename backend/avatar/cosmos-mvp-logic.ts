export type CosmosDomainId = string;

export type AgeBand = "4-6" | "7-12";
export type TopicKind = "canonical" | "longTail";
export type TopicStage = "discovered" | "understood" | "apply" | "retained";

export type SkillType = "remember" | "understand" | "compare" | "apply" | "transfer";

export interface CanonicalTopicCandidate {
  topicId: string;
  title: string;
  aliases?: string[];
}

export interface TopicMatchResult {
  topicId: string;
  topicKind: TopicKind;
  topicTitle: string;
  sourceTitle: string;
  titleNormalized: string;
  matching: {
    strategy: "alias_exact" | "alias_lookup" | "string_similarity_v1" | "manual";
    score: number;
    threshold: number;
    resolvedKind: TopicKind;
    resolvedTopicId?: string;
  };
}

export interface SkillAccuracyStat {
  correct: number;
  total: number;
}

export interface TopicStatsState {
  quizSessionsCount: number;
  recallPassedCount: number;
  understandStreak: number;
  applyStreak: number;
  dokuCompletedCount: number;
  understandAccWindow: number[];
  applyTransferAccWindow: number[];
}

export interface TopicStageContext {
  ageBand: AgeBand;
  quizSessionsCount: number;
  understandRollingAvg: number;
  applyTransferSessionsCount: number;
  applyTransferRollingAvg: number;
  recallPassedCount: number;
  confidence: number;
  hasAnyActivity: boolean;
}

export const CORE_DOMAIN_IDS: CosmosDomainId[] = [
  "space",
  "nature",
  "history",
  "tech",
  "body",
  "earth",
  "arts",
  "logic",
];

const SKILL_WEIGHTS: Record<SkillType, number> = {
  remember: 0.6,
  understand: 1.0,
  compare: 0.9,
  apply: 1.1,
  transfer: 1.2,
};

export const DEFAULT_TOPIC_STATS: TopicStatsState = {
  quizSessionsCount: 0,
  recallPassedCount: 0,
  understandStreak: 0,
  applyStreak: 0,
  dokuCompletedCount: 0,
  understandAccWindow: [],
  applyTransferAccWindow: [],
};

export function normalizeDomainId(input: string | null | undefined): CosmosDomainId {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return "history";
  const value = raw === "art" ? "arts" : raw;
  const sanitized = value
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_")
    .slice(0, 40);
  return sanitized || "history";
}

export function normalizeTitle(value: string | null | undefined): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_")
    .slice(0, 72);
}

export function buildLongTailTopicId(domainId: CosmosDomainId, title: string): string {
  const normalized = normalizeTitle(title) || "topic";
  return `${domainId}_${normalized}`;
}

function normalizeForMatching(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i += 1) {
    const gram = a.slice(i, i + 2);
    bigrams.set(gram, (bigrams.get(gram) || 0) + 1);
  }

  let hits = 0;
  for (let i = 0; i < b.length - 1; i += 1) {
    const gram = b.slice(i, i + 2);
    const count = bigrams.get(gram) || 0;
    if (count > 0) {
      bigrams.set(gram, count - 1);
      hits += 1;
    }
  }

  return (2 * hits) / (a.length - 1 + (b.length - 1));
}

export function matchTopicV1(params: {
  domainId: string;
  requestedTitle: string;
  candidates: CanonicalTopicCandidate[];
  threshold?: number;
}): TopicMatchResult {
  const domainId = normalizeDomainId(params.domainId);
  const sourceTitle = String(params.requestedTitle || "").trim();
  const titleNormalized = normalizeTitle(sourceTitle);
  const threshold = params.threshold ?? 0.72;

  const normalizedSource = normalizeForMatching(sourceTitle);
  let bestCandidate: CanonicalTopicCandidate | null = null;
  let bestScore = 0;
  let bestStrategy: TopicMatchResult["matching"]["strategy"] = "string_similarity_v1";

  for (const candidate of params.candidates) {
    if (!candidate?.topicId || !candidate?.title) continue;
    const normalizedTitle = normalizeForMatching(candidate.title);
    if (!normalizedTitle) continue;

    if (normalizedTitle === normalizedSource) {
      return {
        topicId: candidate.topicId,
        topicKind: "canonical",
        topicTitle: candidate.title,
        sourceTitle,
        titleNormalized,
        matching: {
          strategy: "alias_exact",
          score: 1,
          threshold,
          resolvedKind: "canonical",
          resolvedTopicId: candidate.topicId,
        },
      };
    }

    const aliases = Array.isArray(candidate.aliases) ? candidate.aliases : [];
    for (const alias of aliases) {
      const normalizedAlias = normalizeForMatching(alias);
      if (!normalizedAlias) continue;
      if (normalizedAlias === normalizedSource) {
        return {
          topicId: candidate.topicId,
          topicKind: "canonical",
          topicTitle: candidate.title,
          sourceTitle,
          titleNormalized,
          matching: {
            strategy: "alias_lookup",
            score: 1,
            threshold,
            resolvedKind: "canonical",
            resolvedTopicId: candidate.topicId,
          },
        };
      }
    }

    const titleScore = diceCoefficient(normalizedSource, normalizedTitle);
    let localBest = titleScore;
    for (const alias of aliases) {
      const aliasScore = diceCoefficient(normalizedSource, normalizeForMatching(alias));
      if (aliasScore > localBest) {
        localBest = aliasScore;
      }
    }

    if (localBest > bestScore) {
      bestScore = localBest;
      bestCandidate = candidate;
      bestStrategy = "string_similarity_v1";
    }
  }

  if (bestCandidate && bestScore >= threshold) {
    return {
      topicId: bestCandidate.topicId,
      topicKind: "canonical",
      topicTitle: bestCandidate.title,
      sourceTitle,
      titleNormalized,
      matching: {
        strategy: bestStrategy,
        score: round(bestScore, 4),
        threshold,
        resolvedKind: "canonical",
        resolvedTopicId: bestCandidate.topicId,
      },
    };
  }

  const longTailTopicId = buildLongTailTopicId(domainId, sourceTitle || "topic");
  return {
    topicId: longTailTopicId,
    topicKind: "longTail",
    topicTitle: sourceTitle || titleNormalized || "Neues Thema",
    sourceTitle,
    titleNormalized,
    matching: {
      strategy: "string_similarity_v1",
      score: round(bestScore, 4),
      threshold,
      resolvedKind: "longTail",
    },
  };
}

export function computeQuizOverallAccuracy(correctCount: number, totalCount: number): number {
  if (!Number.isFinite(correctCount) || !Number.isFinite(totalCount) || totalCount <= 0) {
    return 0;
  }
  return clamp01(correctCount / totalCount);
}

export function computeMasteryDelta(params: {
  mastery: number;
  overallAccuracy: number;
  skillStats: Partial<Record<SkillType, SkillAccuracyStat>>;
}): number {
  const mastery = clamp(params.mastery, 0, 100);
  const overallAccuracy = clamp01(params.overallAccuracy);
  const base = 6 * overallAccuracy;
  const dampening = 1 - (mastery / 100) * 0.7;

  let weighted = 0;
  let total = 0;
  for (const [skillType, stat] of Object.entries(params.skillStats) as Array<[SkillType, SkillAccuracyStat | undefined]>) {
    if (!stat || stat.total <= 0) continue;
    const accuracy = clamp01(stat.correct / stat.total);
    weighted += accuracy * SKILL_WEIGHTS[skillType] * stat.total;
    total += stat.total;
  }

  const effectiveWeight = total > 0 ? weighted / total : 1;
  const delta = base * effectiveWeight * dampening;
  return round(clamp(delta, 0, 12), 4);
}

export function computeQuizConfidenceDelta(overallAccuracy: number): number {
  return round(clamp(1.5 * clamp01(overallAccuracy), 0, 1.5), 4);
}

export function computeRecallConfidenceDelta(overallAccuracy: number): number {
  const safeAccuracy = clamp01(overallAccuracy);
  let delta = clamp(10 * safeAccuracy, 0, 10);
  if (safeAccuracy < 0.7) {
    delta -= 4;
  }
  return round(delta, 4);
}

export function applyConfidenceDecay(confidence: number, overdueWeeks: number): number {
  if (!Number.isFinite(overdueWeeks) || overdueWeeks <= 0) {
    return clamp(confidence, 0, 100);
  }
  const decayed = confidence - overdueWeeks * 2;
  return round(clamp(decayed, 0, 100), 4);
}

export function updateRollingWindow(values: number[], nextValue: number, maxSize = 5): number[] {
  const clean = Array.isArray(values) ? values.filter((value) => Number.isFinite(value)).map((value) => clamp01(value)) : [];
  clean.push(clamp01(nextValue));
  while (clean.length > maxSize) {
    clean.shift();
  }
  return clean;
}

export function rollingAvg(values: number[]): number {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const total = values.reduce((sum, value) => sum + clamp01(value), 0);
  return total / values.length;
}

export function computeTopicStage(context: TopicStageContext): TopicStage {
  const hasActivity = context.hasAnyActivity || context.quizSessionsCount > 0;
  if (!hasActivity) return "discovered";

  const isRetained = context.recallPassedCount >= 1 && context.confidence >= 55;
  if (isRetained) return "retained";

  const isUnderstood = context.quizSessionsCount >= 1 && context.understandRollingAvg >= 0.65;

  if (context.ageBand === "7-12") {
    const canApply =
      context.applyTransferSessionsCount >= 1 &&
      context.applyTransferRollingAvg >= 0.7;
    if (canApply && isUnderstood) return "apply";
    if (isUnderstood) return "understood";
    return "discovered";
  }

  if (isUnderstood) return "understood";
  return "discovered";
}

function stageRank(stage: TopicStage, ageBand: AgeBand): number {
  if (ageBand === "4-6") {
    if (stage === "discovered") return 0;
    if (stage === "understood") return 1;
    if (stage === "retained") return 2;
    return 1;
  }
  if (stage === "discovered") return 0;
  if (stage === "understood") return 1;
  if (stage === "apply") return 2;
  return 3;
}

function stageBonus(stage: TopicStage): number {
  if (stage === "discovered") return 4;
  if (stage === "understood") return 10;
  if (stage === "apply") return 16;
  return 24;
}

export function computeStageTransitionEvolutionBonus(params: {
  previousStage: TopicStage;
  nextStage: TopicStage;
  ageBand: AgeBand;
}): number {
  const prevRank = stageRank(params.previousStage, params.ageBand);
  const nextRank = stageRank(params.nextStage, params.ageBand);
  if (nextRank <= prevRank) return 0;
  return stageBonus(params.nextStage);
}

export function computeQuizEvolutionDelta(overallAccuracy: number): number {
  const safe = clamp01(overallAccuracy);
  return Math.max(1, Math.round(3 * safe));
}

export function derivePlanetLevel(evolutionIndex: number): number {
  const safe = Math.max(0, Math.floor(Number.isFinite(evolutionIndex) ? evolutionIndex : 0));
  return clamp(Math.floor(safe / 25) + 1, 1, 50);
}

export function toAgeBandFromAge(age: number | null | undefined): AgeBand {
  if (Number.isFinite(age) && (age as number) <= 6) {
    return "4-6";
  }
  return "7-12";
}

export function sanitizeTopicStats(input: unknown): TopicStatsState {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    quizSessionsCount: toInt(source.quizSessionsCount),
    recallPassedCount: toInt(source.recallPassedCount),
    understandStreak: toInt(source.understandStreak),
    applyStreak: toInt(source.applyStreak),
    dokuCompletedCount: toInt(source.dokuCompletedCount),
    understandAccWindow: toNumberArray(source.understandAccWindow),
    applyTransferAccWindow: toNumberArray(source.applyTransferAccWindow),
  };
}

export function masteryLabel(mastery: number): "Erste Spur" | "Vertraut" | "Sicher" | "Experte" {
  if (mastery >= 80) return "Experte";
  if (mastery >= 55) return "Sicher";
  if (mastery >= 25) return "Vertraut";
  return "Erste Spur";
}

export function confidenceLabel(confidence: number): "Gerade entdeckt" | "Meist sicher" | "Sitzt" | "Sitzt wirklich" {
  if (confidence >= 70) return "Sitzt wirklich";
  if (confidence >= 45) return "Sitzt";
  if (confidence >= 20) return "Meist sicher";
  return "Gerade entdeckt";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function round(value: number, digits: number): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

function toInt(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry))
    .map((entry) => clamp01(entry));
}
