import { callChatCompletion } from "./llm-client";
import type { CastSet, SceneDirective, StoryDraft, TokenUsage } from "./types";
import { GEMINI_SUPPORT_MODEL, isMiniMaxFamilyModel } from "./model-routing";
import { generateWithGemini } from "../gemini-generation";
import { generateWithRunwareText, isRunwareConfigured } from "../runware-text-generation";

export interface SemanticCriticIssue {
  chapter: number;
  code: string;
  severity: "ERROR" | "WARNING";
  message: string;
  patchInstruction?: string;
}

export interface SemanticCriticPatchTask {
  chapter: number;
  priority: 1 | 2 | 3;
  objective: string;
  instruction: string;
}

export type SemanticCriticVerdict = "publish" | "acceptable" | "revision_needed" | "reject";

export interface SemanticCriticRubricScore {
  score: number;
  reasoning: string;
  example?: string;
}

export interface SemanticCriticRubricScores {
  character_voice: SemanticCriticRubricScore;
  scenic_presence: SemanticCriticRubricScore;
  tension_arc: SemanticCriticRubricScore;
  humor: SemanticCriticRubricScore;
  age_appropriateness: SemanticCriticRubricScore;
  chapter_coherence: SemanticCriticRubricScore;
  readability: SemanticCriticRubricScore;
  emotional_arc: SemanticCriticRubricScore;
  iconic_scene: SemanticCriticRubricScore;
  chapter5_quality: SemanticCriticRubricScore;
}

export interface SemanticCriticReport {
  model: string;
  overallScore: number;
  dimensionScores: {
    craft: number;
    narrative: number;
    childFit: number;
    humor: number;
    warmth: number;
  };
  rubricScores: SemanticCriticRubricScores;
  verdict: SemanticCriticVerdict;
  releaseReady: boolean;
  summary: string;
  issues: SemanticCriticIssue[];
  patchTasks: SemanticCriticPatchTask[];
  criticalFailures: string[];
  strengths: string[];
  revisionHints: string[];
  usage?: TokenUsage;
}

const RUBRIC_KEYS = [
  "character_voice",
  "scenic_presence",
  "tension_arc",
  "humor",
  "age_appropriateness",
  "chapter_coherence",
  "readability",
  "emotional_arc",
  "iconic_scene",
  "chapter5_quality",
] as const;

type RubricKey = (typeof RUBRIC_KEYS)[number];

export async function runSemanticCritic(input: {
  storyId: string;
  draft: StoryDraft;
  directives: SceneDirective[];
  cast: CastSet;
  blueprint?: unknown;
  language: string;
  ageRange: { min: number; max: number };
  humorLevel?: number;
  model?: string;
  targetMinScore?: number;
  warnFloor?: number;
}): Promise<SemanticCriticReport> {
  const model = input.model || GEMINI_SUPPORT_MODEL;
  const targetMinScore = clampNumber(input.targetMinScore ?? 8.0, 0, 10);
  const warnFloor = clampNumber(input.warnFloor ?? 6.5, 0, targetMinScore);
  const humorLevel = clampNumber(input.humorLevel ?? 2, 0, 3);

  const fallback = buildFallbackReport({
    model,
    targetMinScore,
    warnFloor,
    draft: input.draft,
    language: input.language,
  });

  try {
    const castNames = [
      ...input.cast.avatars.map((a) => a.displayName),
      ...input.cast.poolCharacters.map((c) => c.displayName),
    ].filter(Boolean);

    const directiveSummary = input.directives.map((d) => ({
      chapter: d.chapter,
      setting: d.setting,
      goal: trimText(d.goal, 96),
      conflict: trimText(d.conflict, 96),
      outcome: trimText(d.outcome, 96),
      charactersOnStage: d.charactersOnStage,
    }));

    const chapters = input.draft.chapters.map((ch) => ({
      chapter: ch.chapter,
      title: ch.title,
      text: compressChapter(ch.text, 180),
    }));

    const systemPrompt = `You are an experienced children's-book editor for ages 6-8.
Benchmark against strong published trade children's fiction, not against typical AI output.
Evaluate quality only. Never rewrite the full story.
Use a clear 10-point rubric and name concrete strengths, critical failures, and actionable revisions.
Score calibration:
- 8.0 means clearly publishable professional quality
- 9.0 means exceptional and memorable
- 10.0 is rare
If the draft clearly misses basic trade-book requirements such as chapter length, dialogue presence, concrete early stakes, or the child mistake/repair arc, it must NOT score above 5.9.
If a blueprint is provided, treat missing on-page realization of its humor beats, mini-conflicts, callbacks, and emotional turns as real misses.
Check structural fidelity and emotional payoff without demanding literal wording.
If the story language is German, judge the German prose on native German children's-book quality.
No generic praise. Return compact JSON only.
Return at most 7 issues and at most 5 patchTasks.`;

    const userPayload = {
      language: input.language,
      ageRange: input.ageRange,
      humorLevel,
      publishThreshold: targetMinScore,
      acceptableThreshold: warnFloor,
      castNames,
      artifact: input.cast.artifact?.name || null,
      blueprint: input.blueprint || null,
      directiveSummary,
      chapters,
      rubric: {
        character_voice: "Can each main figure be recognized by tone alone?",
        scenic_presence: "Does each chapter contain at least one concrete, visible scene?",
        tension_arc: "Is there escalation, a real low point, and payoff?",
        humor: "Are there at least 2 genuine smile moments from behavior or situation?",
        age_appropriateness: "Is the language and emotional framing right for ages 6-8?",
        chapter_coherence: "Do callbacks, continuity, and locks stay consistent across chapters?",
        readability: "Does the story read aloud smoothly with varied rhythm?",
        emotional_arc: "Does the child's inner journey feel earned and visible?",
        iconic_scene: "Is there a strong playable / quotable scene children would replay?",
        chapter5_quality: "Is Chapter 5 as full, rich, and earned as the others?",
      },
      focusChecks: [
        "Chapter 1 must orient WHO + WHERE + WHAT by paragraph 2.",
        "Chapter 3 must contain an active child mistake with visible consequence and body reaction.",
        "Chapter 4 must contain a real inner low point and an internally earned turn.",
        "Chapter 5 must deliver concrete win + small price + callback + warm ending image.",
        "Artifact or adults may not solve the core inner problem.",
        "Usually keep 2 foreground figures; flag overload only when staging becomes muddy.",
        "Flag only genuine read-aloud stumbles, not sentence length by itself.",
      ],
      outputBudget: {
        maxIssues: 7,
        maxPatchTasks: 5,
        maxMessageChars: 140,
      },
      outputSchema: {
        overall_score: "number 0..10",
        verdict: "publish | acceptable | revision_needed | reject",
        scores: {
          character_voice: { score: "number 0..10", reasoning: "string", example: "string optional" },
          scenic_presence: { score: "number 0..10", reasoning: "string", example: "string optional" },
          tension_arc: { score: "number 0..10", reasoning: "string", example: "string optional" },
          humor: { score: "number 0..10", reasoning: "string", example: "string optional" },
          age_appropriateness: { score: "number 0..10", reasoning: "string", example: "string optional" },
          chapter_coherence: { score: "number 0..10", reasoning: "string", example: "string optional" },
          readability: { score: "number 0..10", reasoning: "string", example: "string optional" },
          emotional_arc: { score: "number 0..10", reasoning: "string", example: "string optional" },
          iconic_scene: { score: "number 0..10", reasoning: "string", example: "string optional" },
          chapter5_quality: { score: "number 0..10", reasoning: "string", example: "string optional" },
        },
        critical_failures: ["string"],
        strengths: ["string"],
        revision_hints: ["string"],
        summary: "string max 140 chars",
        issues: [
          {
            chapter: "number (0 for global)",
            code: "string",
            severity: "ERROR | WARNING",
            message: "string",
            patchInstruction: "string optional",
          },
        ],
        patchTasks: [
          {
            chapter: "number",
            priority: "1 | 2 | 3",
            objective: "string",
            instruction: "string",
          },
        ],
      },
    };

    const result = isMiniMaxFamilyModel(model)
      ? await (async () => {
          if (!isRunwareConfigured()) {
            throw new Error("RunwareApiKey is not configured. MiniMax models run through the Runware API.");
          }
          const runwareResult = await generateWithRunwareText({
            systemPrompt,
            userPrompt: JSON.stringify(userPayload),
            model,
            maxTokens: 2200,
            temperature: 0.2,
          });
          return {
            content: runwareResult.content,
            usage: {
              promptTokens: runwareResult.usage.promptTokens,
              completionTokens: runwareResult.usage.completionTokens,
              totalTokens: runwareResult.usage.totalTokens,
              model: runwareResult.model,
            } as TokenUsage,
          };
        })()
      : model.startsWith("gemini-")
      ? await (async () => {
          const geminiResult = await generateWithGemini({
            systemPrompt,
            userPrompt: JSON.stringify(userPayload),
            model,
            maxTokens: 2200,
            temperature: 0.2,
            thinkingBudget: 96,
            logSource: "phase6-story-critic-llm",
            logMetadata: { storyId: input.storyId, chapters: chapters.length },
          });
          return {
            content: geminiResult.content,
            usage: {
              promptTokens: geminiResult.usage.promptTokens,
              completionTokens: geminiResult.usage.completionTokens,
              totalTokens: geminiResult.usage.totalTokens,
              model: geminiResult.model,
            } as TokenUsage,
          };
        })()
      : await callChatCompletion({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: JSON.stringify(userPayload) },
          ],
          responseFormat: "json_object",
          maxTokens: 2200,
          reasoningEffort: "minimal",
          temperature: 0.2,
          context: "story-semantic-critic",
          logSource: "phase6-story-critic-llm",
          logMetadata: { storyId: input.storyId, chapters: chapters.length },
        });

    const parsed = safeJson(result.content);
    if (!parsed || typeof parsed !== "object") {
      return fallback;
    }

    const normalized = normalizeCriticReport(parsed, {
      model,
      targetMinScore,
      warnFloor,
      directives: input.directives,
      language: input.language,
    });
    normalized.usage = result.usage;
    return normalized;
  } catch (error) {
    console.warn("[semantic-critic] Critic failed, falling back to deterministic report", error);
    return fallback;
  }
}

export function normalizeCriticReport(
  raw: any,
  ctx: {
    model: string;
    targetMinScore: number;
    warnFloor: number;
    directives: SceneDirective[];
    language: string;
  },
): SemanticCriticReport {
  const chapterSet = new Set(ctx.directives.map((d) => d.chapter));

  const rawRubricScores = normalizeRubricScores(raw?.scores || raw?.rubricScores);
  const legacyDimensionScores = normalizeLegacyDimensionScores(raw?.dimensionScores || {});
  const preliminaryOverall = clampNumber(Number(raw?.overall_score ?? raw?.overallScore ?? 0), 0, 10);

  const rubricScores = hasMeaningfulRubricScores(rawRubricScores)
    ? rawRubricScores
    : buildFallbackRubricFromLegacy({
        overallScore: preliminaryOverall,
        dimensionScores: legacyDimensionScores,
      });

  const derivedDimensionScores = deriveDimensionScores(rubricScores);
  const dimensionScores = {
    craft: clampNumber(legacyDimensionScores.craft || derivedDimensionScores.craft, 0, 10),
    narrative: clampNumber(legacyDimensionScores.narrative || derivedDimensionScores.narrative, 0, 10),
    childFit: clampNumber(legacyDimensionScores.childFit || derivedDimensionScores.childFit, 0, 10),
    humor: clampNumber(legacyDimensionScores.humor || derivedDimensionScores.humor, 0, 10),
    warmth: clampNumber(legacyDimensionScores.warmth || derivedDimensionScores.warmth, 0, 10),
  };

  const weighted = Number(
    (
      dimensionScores.craft * 0.25
      + dimensionScores.narrative * 0.25
      + dimensionScores.childFit * 0.2
      + dimensionScores.humor * 0.12
      + dimensionScores.warmth * 0.18
    ).toFixed(2),
  );
  const rubricAverage = Number((averageRubricScores(rubricScores)).toFixed(2));
  const overallScore = clampNumber(
    Number(raw?.overall_score ?? raw?.overallScore ?? (rubricAverage > 0 ? rubricAverage : weighted)),
    0,
    10,
  );

  const issues = Array.isArray(raw?.issues)
    ? raw.issues
        .map((issue: any) => {
          const chapter = normalizeChapter(issue?.chapter, chapterSet);
          const severity = issue?.severity === "ERROR" ? "ERROR" : "WARNING";
          const code = String(issue?.code || "CRITIC_ISSUE").slice(0, 80);
          const message = trimText(String(issue?.message || ""), 160);
          const patchInstruction = trimText(String(issue?.patchInstruction || ""), 180);
          if (!message) return null;
          return {
            chapter,
            code,
            severity,
            message,
            patchInstruction: patchInstruction || undefined,
          } as SemanticCriticIssue;
        })
        .filter((v: SemanticCriticIssue | null): v is SemanticCriticIssue => Boolean(v))
        .slice(0, 7)
    : [];

  const criticalFailures = normalizeStringList(raw?.critical_failures ?? raw?.criticalFailures, 5, 180);
  const strengths = normalizeStringList(raw?.strengths, 5, 180);
  const revisionHints = normalizeStringList(raw?.revision_hints ?? raw?.revisionHints, 6, 180);

  const patchTasks = Array.isArray(raw?.patchTasks)
    ? normalizePatchTasks(raw.patchTasks, chapterSet)
    : derivePatchTasksFromIssues(issues);

  const verdict = normalizeVerdict(raw?.verdict)
    ?? determineCriticVerdict({
      rubricScores,
      criticalFailures,
      publishThreshold: ctx.targetMinScore,
      acceptableThreshold: ctx.warnFloor,
    });
  const releaseReady = verdict === "publish";
  const summary = trimText(String(raw?.summary || ""), 140) || defaultSummary(ctx.language, overallScore, verdict);

  return {
    model: ctx.model,
    overallScore,
    dimensionScores,
    rubricScores,
    verdict,
    releaseReady,
    summary,
    issues,
    patchTasks,
    criticalFailures,
    strengths,
    revisionHints,
  };
}

export function determineCriticVerdict(input: {
  rubricScores: SemanticCriticRubricScores;
  criticalFailures: string[];
  publishThreshold: number;
  acceptableThreshold: number;
}): SemanticCriticVerdict {
  const values = RUBRIC_KEYS.map((key) => clampNumber(Number(input.rubricScores[key]?.score ?? 0), 0, 10));
  const average = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const minimum = values.length > 0 ? Math.min(...values) : 0;

  if (input.criticalFailures.length > 0) return "reject";
  if (minimum < 3) return "reject";
  if (average >= input.publishThreshold && minimum >= 6) return "publish";
  if (average >= input.acceptableThreshold && minimum >= 5) return "acceptable";
  return "revision_needed";
}

function normalizePatchTasks(rawTasks: any[], chapterSet: Set<number>): SemanticCriticPatchTask[] {
  return dedupePatchTasks(
    rawTasks
      .map((task: any) => {
        const chapter = normalizeChapter(task?.chapter, chapterSet);
        if (chapter <= 0) return null;
        const objective = trimText(String(task?.objective || ""), 110);
        const instruction = trimText(String(task?.instruction || ""), 180);
        if (!objective || !instruction) return null;
        const priorityRaw = Number(task?.priority);
        const priority: 1 | 2 | 3 = priorityRaw === 1 ? 1 : priorityRaw === 3 ? 3 : 2;
        return { chapter, priority, objective, instruction } as SemanticCriticPatchTask;
      })
      .filter((v: SemanticCriticPatchTask | null): v is SemanticCriticPatchTask => Boolean(v)),
  );
}

function derivePatchTasksFromIssues(issues: SemanticCriticIssue[]): SemanticCriticPatchTask[] {
  return dedupePatchTasks(
    issues
      .filter((issue) => issue.chapter > 0 && Boolean(issue.patchInstruction))
      .map((issue) => ({
        chapter: issue.chapter,
        priority: issue.severity === "ERROR" ? 1 : 2,
        objective: trimText(issue.message, 110),
        instruction: trimText(issue.patchInstruction || issue.message, 180),
      })),
  );
}

function dedupePatchTasks(tasks: SemanticCriticPatchTask[]): SemanticCriticPatchTask[] {
  const seen = new Set<string>();
  const out: SemanticCriticPatchTask[] = [];
  for (const task of tasks) {
    const key = `${task.chapter}:${task.objective.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(task);
  }
  return out
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 5);
}

function normalizeRubricScores(raw: any): SemanticCriticRubricScores {
  const readRubric = (key: RubricKey): SemanticCriticRubricScore => {
    const source = raw?.[key];
    if (source && typeof source === "object") {
      return {
        score: clampNumber(Number(source.score ?? 0), 0, 10),
        reasoning: trimText(String(source.reasoning || ""), 220),
        example: trimText(String(source.example || ""), 180) || undefined,
      };
    }

    if (Number.isFinite(Number(source))) {
      return {
        score: clampNumber(Number(source), 0, 10),
        reasoning: "",
      };
    }

    return { score: 0, reasoning: "" };
  };

  return {
    character_voice: readRubric("character_voice"),
    scenic_presence: readRubric("scenic_presence"),
    tension_arc: readRubric("tension_arc"),
    humor: readRubric("humor"),
    age_appropriateness: readRubric("age_appropriateness"),
    chapter_coherence: readRubric("chapter_coherence"),
    readability: readRubric("readability"),
    emotional_arc: readRubric("emotional_arc"),
    iconic_scene: readRubric("iconic_scene"),
    chapter5_quality: readRubric("chapter5_quality"),
  };
}

function normalizeLegacyDimensionScores(raw: any): {
  craft: number;
  narrative: number;
  childFit: number;
  humor: number;
  warmth: number;
} {
  return {
    craft: clampNumber(Number(raw?.craft ?? 0), 0, 10),
    narrative: clampNumber(Number(raw?.narrative ?? 0), 0, 10),
    childFit: clampNumber(Number(raw?.childFit ?? 0), 0, 10),
    humor: clampNumber(Number(raw?.humor ?? 0), 0, 10),
    warmth: clampNumber(Number(raw?.warmth ?? 0), 0, 10),
  };
}

function buildFallbackRubricFromLegacy(input: {
  overallScore: number;
  dimensionScores: {
    craft: number;
    narrative: number;
    childFit: number;
    humor: number;
    warmth: number;
  };
}): SemanticCriticRubricScores {
  const overall = clampNumber(input.overallScore || averageObjectValues(input.dimensionScores) || 7, 0, 10);
  const craft = input.dimensionScores.craft || overall;
  const narrative = input.dimensionScores.narrative || overall;
  const childFit = input.dimensionScores.childFit || overall;
  const humor = input.dimensionScores.humor || overall;
  const warmth = input.dimensionScores.warmth || overall;

  return {
    character_voice: { score: craft, reasoning: "" },
    scenic_presence: { score: craft, reasoning: "" },
    tension_arc: { score: narrative, reasoning: "" },
    humor: { score: humor, reasoning: "" },
    age_appropriateness: { score: childFit, reasoning: "" },
    chapter_coherence: { score: narrative, reasoning: "" },
    readability: { score: childFit, reasoning: "" },
    emotional_arc: { score: warmth, reasoning: "" },
    iconic_scene: { score: craft, reasoning: "" },
    chapter5_quality: { score: warmth, reasoning: "" },
  };
}

function deriveDimensionScores(rubricScores: SemanticCriticRubricScores): {
  craft: number;
  narrative: number;
  childFit: number;
  humor: number;
  warmth: number;
} {
  return {
    craft: mean([
      rubricScores.character_voice.score,
      rubricScores.scenic_presence.score,
      rubricScores.readability.score,
      rubricScores.iconic_scene.score,
    ]),
    narrative: mean([
      rubricScores.tension_arc.score,
      rubricScores.chapter_coherence.score,
      rubricScores.chapter5_quality.score,
    ]),
    childFit: mean([
      rubricScores.age_appropriateness.score,
      rubricScores.readability.score,
      rubricScores.emotional_arc.score,
    ]),
    humor: clampNumber(rubricScores.humor.score, 0, 10),
    warmth: mean([
      rubricScores.emotional_arc.score,
      rubricScores.chapter5_quality.score,
      rubricScores.scenic_presence.score,
    ]),
  };
}

function buildFallbackReport(input: {
  model: string;
  targetMinScore: number;
  warnFloor: number;
  draft: StoryDraft;
  language: string;
}): SemanticCriticReport {
  const text = input.draft.chapters.map((ch) => ch.text).join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  const sentenceCount = text.split(/[.!?]+/).filter(Boolean).length;
  const avgWordsPerSentence = sentenceCount > 0 ? words / sentenceCount : 0;
  const baseline = avgWordsPerSentence > 18 ? 6.8 : 7.4;
  const overallScore = clampNumber(Number(baseline.toFixed(2)), 0, 10);
  const rubricScores = buildFallbackRubricFromLegacy({
    overallScore,
    dimensionScores: {
      craft: overallScore,
      narrative: overallScore,
      childFit: clampNumber(overallScore + 0.2, 0, 10),
      humor: clampNumber(overallScore - 0.2, 0, 10),
      warmth: clampNumber(overallScore + 0.1, 0, 10),
    },
  });
  const verdict = determineCriticVerdict({
    rubricScores,
    criticalFailures: [],
    publishThreshold: input.targetMinScore,
    acceptableThreshold: input.warnFloor,
  });

  return {
    model: input.model,
    overallScore,
    dimensionScores: deriveDimensionScores(rubricScores),
    rubricScores,
    verdict,
    releaseReady: verdict === "publish",
    summary: defaultSummary(input.language, overallScore, verdict),
    issues: [],
    patchTasks: [],
    criticalFailures: [],
    strengths: [],
    revisionHints: [],
  };
}

function hasMeaningfulRubricScores(rubricScores: SemanticCriticRubricScores): boolean {
  return RUBRIC_KEYS.some((key) => rubricScores[key].score > 0);
}

function averageRubricScores(rubricScores: SemanticCriticRubricScores): number {
  return mean(RUBRIC_KEYS.map((key) => rubricScores[key].score));
}

function normalizeVerdict(value: unknown): SemanticCriticVerdict | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    normalized === "publish"
    || normalized === "acceptable"
    || normalized === "revision_needed"
    || normalized === "reject"
  ) {
    return normalized;
  }
  return null;
}

function normalizeStringList(value: unknown, maxItems: number, maxChars: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const text = trimText(String(item || ""), maxChars);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
}

function normalizeChapter(raw: unknown, chapterSet: Set<number>): number {
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return 0;
  const chapter = Math.round(numeric);
  if (chapter <= 0) return 0;
  if (chapterSet.has(chapter)) return chapter;
  return 0;
}

function defaultSummary(language: string, score: number, verdict: SemanticCriticVerdict): string {
  const isDE = language === "de";
  if (isDE) {
    if (verdict === "publish") return `Kritik: veroeffentlichbar (${score.toFixed(1)}/10), nur kleine Feinschliffe noetig.`;
    if (verdict === "acceptable") return `Kritik: brauchbar (${score.toFixed(1)}/10), aber mit klaren Verbesserungsfeldern.`;
    if (verdict === "reject") return `Kritik: deutliche Handwerksprobleme (${score.toFixed(1)}/10), so noch nicht tragfaehig.`;
    return `Kritik: Ueberarbeitung noetig (${score.toFixed(1)}/10), gezielte lokale Revision empfohlen.`;
  }
  if (verdict === "publish") return `Critic: publish-ready (${score.toFixed(1)}/10), only minor polish needed.`;
  if (verdict === "acceptable") return `Critic: acceptable (${score.toFixed(1)}/10), but clear improvements remain.`;
  if (verdict === "reject") return `Critic: major craft problems (${score.toFixed(1)}/10), not viable yet.`;
  return `Critic: revision needed (${score.toFixed(1)}/10), targeted local fixes recommended.`;
}

function compressChapter(text: string, maxWords: number): string {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return normalized;

  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length <= 2) {
    return words.slice(0, maxWords).join(" ");
  }

  const leadBudget = Math.max(30, Math.floor(maxWords * 0.7));
  const tailBudget = Math.max(12, maxWords - leadBudget);

  const lead: string[] = [];
  let leadWords = 0;
  for (const sentence of sentences) {
    const sentenceWords = sentence.split(/\s+/).filter(Boolean).length;
    if (lead.length > 0 && leadWords + sentenceWords > leadBudget) break;
    lead.push(sentence);
    leadWords += sentenceWords;
  }

  const tail: string[] = [];
  let tailWords = 0;
  for (let i = sentences.length - 1; i >= 0; i -= 1) {
    const sentence = sentences[i];
    if (lead.includes(sentence)) break;
    const sentenceWords = sentence.split(/\s+/).filter(Boolean).length;
    if (tail.length > 0 && tailWords + sentenceWords > tailBudget) break;
    tail.unshift(sentence);
    tailWords += sentenceWords;
  }

  return tail.length > 0
    ? `${lead.join(" ")} [... gekuerzt ...] ${tail.join(" ")}`
    : lead.join(" ");
}

function safeJson(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function trimText(value: string, maxChars: number): string {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return normalized.slice(0, Math.max(0, maxChars - 3)).trimEnd() + "...";
}

function mean(values: number[]): number {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (filtered.length === 0) return 0;
  return Number((filtered.reduce((sum, value) => sum + value, 0) / filtered.length).toFixed(2));
}

function averageObjectValues(values: Record<string, number>): number {
  return mean(Object.values(values));
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
