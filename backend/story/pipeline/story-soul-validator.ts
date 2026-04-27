/**
 * Story Soul Validator (Stage 1 - Soul gate before blueprint).
 *
 * Structure:
 * 1) Hard schema check from schemas/story-soul.ts.
 * 2) LLM rubric with child comprehension, premise, stakes, payoff, and voice.
 * 3) Fixed gate policy:
 *    - overall >= 8.4 and every dimension >= 7.0 -> approved
 *    - overall >= 8.0 -> acceptable_with_warnings
 *    - otherwise -> reject_with_fixes
 *    - schema errors -> reject_hard
 */

import { callChatCompletion } from "./llm-client";
import { generateWithGemini } from "../gemini-generation";
import {
  GEMINI_MAIN_STORY_MODEL,
  resolveSupportTaskModel,
} from "./model-routing";
import { buildLlmCostEntry, mergeNormalizedTokenUsage } from "./cost-ledger";
import {
  formatStorySoulForPrompt,
  formatStorySoulIssues,
  validateStorySoul,
  type StorySoul,
  type StorySoulValidationIssue,
} from "./schemas/story-soul";
import type {
  CastSet,
  NormalizedRequest,
  StoryCostEntry,
  TokenUsage,
} from "./types";

// ────────────────────────── Public Types ──────────────────────────

export type SoulGateVerdict =
  | "approved"
  | "acceptable_with_warnings"
  | "reject_with_fixes"
  | "reject_hard";

export interface SoulRubricScore {
  dimension: SoulRubricDimension;
  score: number; // 0..10
  reason: string;
  fix?: string;
}

export type SoulRubricDimension =
  | "premise_restatable"
  | "reader_contract_clear"
  | "emotional_hook"
  | "stakes_feelable"
  | "world_specificity"
  | "character_distinct"
  | "cover_cast_used"
  | "antagonism_real"
  | "payoff_feels"
  | "benchmark_matches"
  | "would_child_reread"
  | "originality";

export interface SoulGateResult {
  verdict: SoulGateVerdict;
  schemaValid: boolean;
  schemaIssues: StorySoulValidationIssue[];
  rubricScores: SoulRubricScore[];
  overallScore: number; // 0..10 (average of rubric)
  minDimensionScore: number;
  blockingDimensions: SoulRubricDimension[];
  repairInstruction: string; // can be fed back into the generator for retry
  model?: string;
  attempts: number;
  usage?: TokenUsage;
  costEntries: StoryCostEntry[];
}

export interface SoulGateInput {
  soul: StorySoul;
  normalizedRequest: NormalizedRequest;
  cast: CastSet;
  candidateTag?: string;
  /** Skip LLM rubric and only run schema check. Default false. */
  schemaOnly?: boolean;
  /** Expliziter Model-Override (sonst Auto-Resolve gegen Support-Modell). */
  modelOverride?: string;
}

/**
 * Policy thresholds. Based on STORY_QUALITY_RADICAL_PLAN.md:
 *  - overall >= 8.0 AND min dim >= 6.0 → approved
 *  - overall >= 7.5 → acceptable_with_warnings
 *  - else → reject_with_fixes (or reject_hard when schema invalid)
 */
export const SOUL_GATE_THRESHOLDS = {
  approvedOverall: 8.4,
  approvedMinDimension: 7.0,
  acceptableOverall: 8.0,
  rejectOverall: 0, // anything below acceptable is reject_with_fixes
} as const;

// ────────────────────────── Public API ──────────────────────────

export async function runSoulGate(input: SoulGateInput): Promise<SoulGateResult> {
  const { soul, normalizedRequest, cast } = input;

  const expectedAvatarNames = cast.avatars.map((a) => a.displayName).filter(Boolean);
  const requiredCoverCastNames = cast.poolCharacters.map((c) => c.displayName).filter(Boolean);

  // Step 1: structural schema check
  const schemaResult = validateStorySoul(soul, {
    chapterCount: normalizedRequest.chapterCount,
    expectedAvatarNames,
    requiredCoverCastNames,
  });

  if (!schemaResult.valid) {
    return {
      verdict: "reject_hard",
      schemaValid: false,
      schemaIssues: schemaResult.issues,
      rubricScores: [],
      overallScore: 0,
      minDimensionScore: 0,
      blockingDimensions: [],
      repairInstruction: buildSchemaRepairInstruction(schemaResult.issues),
      attempts: 0,
      costEntries: [],
    };
  }

  // Schema OK – early exit path for callers that only want structural validation
  if (input.schemaOnly) {
    return {
      verdict: "approved",
      schemaValid: true,
      schemaIssues: schemaResult.issues,
      rubricScores: [],
      overallScore: 10,
      minDimensionScore: 10,
      blockingDimensions: [],
      repairInstruction: "",
      attempts: 0,
      costEntries: [],
    };
  }

  // Step 2: LLM rubric scoring
  const rubric = await scoreSoulWithRubric({
    soul,
    normalizedRequest,
    cast,
    candidateTag: input.candidateTag,
    modelOverride: input.modelOverride,
  });

  // Step 3: gate decision
  const overall = computeOverallScore(rubric.scores);
  const minDim = computeMinDimension(rubric.scores);
  const blockingDimensions = rubric.scores
    .filter((s) => s.score < SOUL_GATE_THRESHOLDS.approvedMinDimension)
    .map((s) => s.dimension);

  const verdict = decideVerdict({ overall, minDim });
  const repairInstruction =
    verdict === "approved"
      ? ""
      : buildRubricRepairInstruction(rubric.scores, verdict);

  return {
    verdict,
    schemaValid: true,
    schemaIssues: schemaResult.issues,
    rubricScores: rubric.scores,
    overallScore: overall,
    minDimensionScore: minDim,
    blockingDimensions,
    repairInstruction,
    model: rubric.model,
    attempts: rubric.attempts,
    usage: rubric.usage,
    costEntries: rubric.costEntries,
  };
}

// ────────────────────────── Gate Decision ──────────────────────────

function decideVerdict(args: { overall: number; minDim: number }): SoulGateVerdict {
  const { overall, minDim } = args;
  if (
    overall >= SOUL_GATE_THRESHOLDS.approvedOverall
    && minDim >= SOUL_GATE_THRESHOLDS.approvedMinDimension
  ) {
    return "approved";
  }
  if (overall >= SOUL_GATE_THRESHOLDS.acceptableOverall) {
    return "acceptable_with_warnings";
  }
  return "reject_with_fixes";
}

function computeOverallScore(scores: SoulRubricScore[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((acc, s) => acc + clampScore(s.score), 0);
  return round1(sum / scores.length);
}

function computeMinDimension(scores: SoulRubricScore[]): number {
  if (scores.length === 0) return 0;
  return round1(
    scores.reduce((min, s) => Math.min(min, clampScore(s.score)), 10),
  );
}

function clampScore(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  if (raw < 0) return 0;
  if (raw > 10) return 10;
  return raw;
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

// ────────────────────────── LLM Rubric ──────────────────────────

const ALL_DIMENSIONS: SoulRubricDimension[] = [
  "premise_restatable",
  "reader_contract_clear",
  "emotional_hook",
  "stakes_feelable",
  "world_specificity",
  "character_distinct",
  "cover_cast_used",
  "antagonism_real",
  "payoff_feels",
  "benchmark_matches",
  "would_child_reread",
  "originality",
];

interface RubricCallResult {
  scores: SoulRubricScore[];
  model: string;
  attempts: number;
  usage?: TokenUsage;
  costEntries: StoryCostEntry[];
}

async function scoreSoulWithRubric(args: {
  soul: StorySoul;
  normalizedRequest: NormalizedRequest;
  cast: CastSet;
  candidateTag?: string;
  modelOverride?: string;
}): Promise<RubricCallResult> {
  const { soul, normalizedRequest } = args;
  const supportModel = resolveSupportTaskModel(
    String(normalizedRequest.rawConfig?.aiModel || ""),
  );
  const model = args.modelOverride && args.modelOverride.trim().length > 0
    ? args.modelOverride.trim()
    : resolveRubricModel(supportModel);

  const systemPrompt = buildRubricSystemPrompt(normalizedRequest.language);
  const userPrompt = buildRubricUserPrompt({ soul, normalizedRequest });

  let usage: TokenUsage | undefined;
  const costEntries: StoryCostEntry[] = [];
  let attempts = 0;

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attempts = attempt;
    let raw: { content: string; usage?: Partial<TokenUsage> };
    try {
      raw = await callRubricModel({
        model,
        systemPrompt,
        userPrompt,
        storyId: normalizedRequest.storyId,
        candidateTag: args.candidateTag,
        attempt,
      });
    } catch (error) {
      // Degrade gracefully: an LLM outage should not block the pipeline
      if (attempt >= maxAttempts) {
        return {
          scores: buildNeutralFallbackScores(error),
          model,
          attempts,
          usage,
          costEntries,
        };
      }
      continue;
    }

    const actualModel = raw.usage?.model || model;
    usage = mergeNormalizedTokenUsage(usage, raw.usage, actualModel);
    const costEntry = buildLlmCostEntry({
      phase: "phase5.7-soul-gate",
      step: "soul-rubric",
      usage: raw.usage,
      fallbackModel: actualModel,
      candidateTag: args.candidateTag,
      attempt,
    });
    if (costEntry) costEntries.push(costEntry);

    const parsed = parseRubricJson(raw.content);
    if (parsed) {
      return {
        scores: parsed,
        model: actualModel,
        attempts: attempt,
        usage,
        costEntries,
      };
    }
    // else: try again
  }

  // All retries failed to parse; emit neutral scores so pipeline doesn't stall
  return {
    scores: buildNeutralFallbackScores(null),
    model,
    attempts,
    usage,
    costEntries,
  };
}

// ────────────────────────── Prompts ──────────────────────────

function buildRubricSystemPrompt(language: string): string {
  const isGerman = String(language || "").toLowerCase().startsWith("de");
  if (!isGerman) {
    return [
      "You are a strict senior children's book editor.",
      "You evaluate a StorySoul (the pre-prose plan) before anyone writes a line of story.",
      "Be honest and concrete. Low scores are fine if deserved – but give a FIX per low score.",
      "Return only JSON (no markdown, no prose).",
    ].join("\n");
  }
  return [
    "Du bist eine strenge Senior-Kinderbuch-Lektorin.",
    "Du bewertest eine StorySoul (den Plan VOR der Prosa), bevor irgendwer eine Zeile schreibt.",
    "Sei ehrlich und konkret. Niedrige Scores sind okay, wenn sie verdient sind – aber liefere pro niedrigem Score einen FIX.",
    "Antworte NUR mit JSON (kein Markdown, keine Prosa drumherum).",
  ].join("\n");
}

function buildRubricUserPrompt(args: {
  soul: StorySoul;
  normalizedRequest: NormalizedRequest;
}): string {
  const { soul, normalizedRequest: req } = args;
  const isGerman = String(req.language || "de").toLowerCase().startsWith("de");

  const rubricList = isGerman
    ? [
        "1b. reader_contract_clear: Macht readerContract vorab klar: normale Welt, wer ist da, Mission in Kinderworten, Warum-jetzt, Regel? 'Spur/Hinweis finden' ohne konkrete Aufgabe = 3.",
        "1. premise_restatable: Kann ein 7-Jähriger die Premise nach einmal Hören wiedergeben? Namen, konkretes Ziel. (< 7 = FAIL)",
        "2. emotional_hook: Ist hookQuestion emotional/beziehungsbasiert, nicht nur informativ? ('Trauen sich...' = 9. 'Was ist hinter der Tür?' = 4)",
        "3. stakes_feelable: Verliert das Kind GEFÜHLT etwas (Ritual, Person, Beziehung)? Oder nur 'Rätsel lösen' = niedrig.",
        "4. world_specificity: Sind die 3 anchors konkret und kurios? 'Krümelwald hinter Omas Bäckerei' = 9. 'Zauberwald' = 2.",
        "5. character_distinct: Klingen die voiceExamples WIRKLICH verschieden oder austauschbar?",
        "6. cover_cast_used: Sind alle supportingCast-Figuren mit echter Funktion verbaut (nicht nur Prop)?",
        "7. antagonism_real: Gibt es echte Reibung (innere Wunde, Beziehung), nicht nur 'Rätsel finden'?",
        "8. payoff_feels: Ist payoffPromise.emotionalLanding spezifisch und warm ('stolz mit Kloß im Hals'), nicht 'glücklich'? Ist der callbackFromChapter1 konkret?",
        "9. benchmark_matches: Passt benchmarkBook wirklich oder ist es Lippenbekenntnis?",
        "10. would_child_reread: Würde ein Kind die Geschichte 3× hören wollen?",
        "11. originality: Ist die Premise FRISCH oder klingt sie wie ein Märchen-Remake? 'Hänsel & Gretel mit Amulett' = 2. 'Verirrt im Wald + Hexe im Zuckerhaus' = 3. 'Magisches Artefakt weist heim' = 3. Echter moderner/überraschender Konflikt = 8-10. Wenn die Geschichte wie eine bekannte Vorlage klingt → harte Penalty.",
      ]
    : [
        "1b. reader_contract_clear: Does readerContract make the normal world, who we meet, child-word mission, why-now, and one rule clear before conflict? Pure 'find/follow clue/trail' = 3.",
        "1. premise_restatable: Can a 7-year-old retell the premise after one hearing? Names, concrete goal. (< 7 = FAIL)",
        "2. emotional_hook: Is hookQuestion emotional/relational, not merely informational? ('Do they dare...' = 9. 'What is behind the door?' = 4)",
        "3. stakes_feelable: Does the child FEEL losing something (ritual, person, relationship)? Pure 'solve riddle' = low.",
        "4. world_specificity: Are the 3 anchors concrete and quirky? 'Crumb forest behind grandma's bakery' = 9. 'Magic forest' = 2.",
        "5. character_distinct: Do the voiceExamples REALLY sound different or interchangeable?",
        "6. cover_cast_used: Is every supportingCast figure wired with real function (not just prop)?",
        "7. antagonism_real: Is there real friction (inner wound, relationship), not merely 'find a clue'?",
        "8. payoff_feels: Is payoffPromise.emotionalLanding specific and warm ('proud with a lump in the throat'), not 'happy'? Is callbackFromChapter1 concrete?",
        "9. benchmark_matches: Does benchmarkBook actually fit or is it lip service?",
        "10. would_child_reread: Would a child want to hear this 3x?",
        "11. originality: Is the premise FRESH or does it sound like a fairy-tale remake? 'Hansel & Gretel with amulet' = 2. 'Lost in forest + witch in candy house' = 3. 'Magic artifact points home' = 3. Truly modern/surprising conflict = 8-10. If the story echoes a well-known template → hard penalty.",
    ];

  const instruction = isGerman
    ? [
        "Bewerte jede der 12 Dimensionen mit einer Zahl 0..10.",
        "Gib zu JEDER Dimension:",
        "  - score: 0..10 (Integer oder eine Nachkommastelle)",
        "  - reason: 1 Satz, KONKRET, mit Zitat aus der Soul wenn möglich",
        "  - fix: nur falls score < 7 – sonst weglassen. KONKRET, auf EIN Feld in der Soul bezogen.",
        "Antworte mit genau diesem JSON-Schema:",
        "{",
        '  "scores": [',
        '    { "dimension": "premise_restatable", "score": 8, "reason": "...", "fix": "..." },',
        '    { "dimension": "reader_contract_clear", "score": 8, "reason": "...", "fix": "..." },',
        "    ... (alle 12 Dimensionen, in der Reihenfolge oben)",
        "  ]",
        "}",
      ].join("\n")
    : [
        "Rate each of the 12 dimensions 0..10.",
        "For EACH dimension provide:",
        "  - score: 0..10 (integer or one decimal)",
        "  - reason: 1 sentence, CONCRETE, with a quote from the soul if possible",
        "  - fix: only if score < 7 – otherwise omit. CONCRETE, targeting ONE field in the soul.",
        "Reply with exactly this JSON shape:",
        "{",
        '  "scores": [',
        '    { "dimension": "premise_restatable", "score": 8, "reason": "...", "fix": "..." },',
        '    { "dimension": "reader_contract_clear", "score": 8, "reason": "...", "fix": "..." },',
        "    ... (all 12 dimensions, in the order above)",
        "  ]",
        "}",
    ].join("\n");

  return [
    isGerman ? "RUBRIK:" : "RUBRIC:",
    ...rubricList,
    "",
    instruction,
    "",
    isGerman ? "STORY SOUL ZU BEWERTEN:" : "STORY SOUL TO EVALUATE:",
    formatStorySoulForPrompt(soul),
  ].join("\n");
}

// ────────────────────────── LLM Dispatch ──────────────────────────

async function callRubricModel(input: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  storyId: string;
  candidateTag?: string;
  attempt: number;
}): Promise<{ content: string; usage?: Partial<TokenUsage> }> {
  const maxTokens = 2400;

  if (input.model.startsWith("gemini-")) {
    const geminiResult = await generateWithGemini({
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      model: input.model,
      maxTokens,
      temperature: 0.1,
      thinkingBudget: 64,
      logSource: "phase5.7-soul-gate-llm",
      logMetadata: {
        storyId: input.storyId,
        attempt: input.attempt,
        candidateTag: input.candidateTag,
      },
    });
    return {
      content: geminiResult.content,
      usage: {
        promptTokens: geminiResult.usage.promptTokens,
        completionTokens: geminiResult.usage.completionTokens,
        totalTokens: geminiResult.usage.totalTokens,
        model: geminiResult.model,
      },
    };
  }

  return callChatCompletion({
    model: input.model,
    messages: [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: input.userPrompt },
    ],
    responseFormat: "json_object",
    maxTokens,
    reasoningEffort: "low",
    temperature: 0.1,
    context: "story-soul-gate",
    logSource: "phase5.7-soul-gate-llm",
    logMetadata: {
      storyId: input.storyId,
      attempt: input.attempt,
      candidateTag: input.candidateTag,
    },
  });
}

function resolveRubricModel(supportModel: string): string {
  const normalized = String(supportModel || "").trim().toLowerCase();
  // gpt-5.4-nano is too weak for nuanced critique – bump to mini
  if (normalized.startsWith("gpt-5.4-nano")) return "gpt-5.4-mini";
  // MiniMax and nano fall back to Gemini (strong at editorial reasoning)
  if (normalized.startsWith("minimax-") || !normalized) {
    return GEMINI_MAIN_STORY_MODEL;
  }
  return supportModel;
}

// ────────────────────────── Parsers & Helpers ──────────────────────────

function parseRubricJson(raw: string): SoulRubricScore[] | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parsed = tryParseJsonObject(trimmed);
  if (!parsed) return null;

  const container = Array.isArray(parsed) ? { scores: parsed } : (parsed as any);
  const scoresRaw = Array.isArray(container?.scores) ? container.scores : null;
  if (!scoresRaw) return null;

  const byDim = new Map<SoulRubricDimension, SoulRubricScore>();
  for (const item of scoresRaw) {
    if (!item || typeof item !== "object") continue;
    const dim = String((item as any).dimension || "").trim() as SoulRubricDimension;
    if (!ALL_DIMENSIONS.includes(dim)) continue;
    const score = clampScore(Number((item as any).score));
    const reason = String((item as any).reason || "").trim() || "—";
    const rawFix = (item as any).fix;
    const fix = typeof rawFix === "string" && rawFix.trim().length > 0
      ? rawFix.trim()
      : undefined;
    byDim.set(dim, { dimension: dim, score, reason, fix });
  }

  if (byDim.size < ALL_DIMENSIONS.length / 2) {
    // Too few recognisable dimensions – treat as parse failure
    return null;
  }

  // Fill missing dimensions with a neutral placeholder so policy has full coverage
  return ALL_DIMENSIONS.map((dim) => {
    const existing = byDim.get(dim);
    if (existing) return existing;
    return {
      dimension: dim,
      score: 5,
      reason: "Dimension nicht im LLM-Output – neutraler Default.",
    } satisfies SoulRubricScore;
  });
}

function tryParseJsonObject(source: string): unknown {
  try {
    return JSON.parse(source);
  } catch {
    // try to strip a fenced code block
    const fenceMatch = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch?.[1]) {
      try {
        return JSON.parse(fenceMatch[1]);
      } catch {
        /* fallthrough */
      }
    }
    // find first balanced object
    const first = source.indexOf("{");
    const last = source.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(source.slice(first, last + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function buildNeutralFallbackScores(error: unknown): SoulRubricScore[] {
  const reason = error instanceof Error
    ? `Rubrik-LLM nicht auswertbar (${error.message}) – neutrale Bewertung.`
    : "Rubrik-LLM nicht auswertbar – neutrale Bewertung.";
  return ALL_DIMENSIONS.map((dim) => ({
    dimension: dim,
    score: 7,
    reason,
  }));
}

// ────────────────────────── Repair Instruction Builders ──────────────────────────

function buildSchemaRepairInstruction(issues: StorySoulValidationIssue[]): string {
  return [
    "Die Soul hat strukturelle Fehler, die vor dem Rubrik-Check behoben werden müssen:",
    formatStorySoulIssues(issues),
    "",
    "Korrigiere NUR diese Felder und gib die vollständige Soul wieder als JSON zurück.",
  ].join("\n");
}

function buildRubricRepairInstruction(
  scores: SoulRubricScore[],
  verdict: SoulGateVerdict,
): string {
  const low = scores.filter((s) => s.score < SOUL_GATE_THRESHOLDS.approvedMinDimension);
  const medium = scores.filter(
    (s) =>
      s.score >= SOUL_GATE_THRESHOLDS.approvedMinDimension
      && s.score < SOUL_GATE_THRESHOLDS.approvedOverall,
  );

  const lowBlock = low.length === 0
    ? ""
    : [
        "KRITISCHE Schwächen (müssen behoben werden):",
        ...low.map(
          (s) =>
            `- [${s.dimension}] ${s.score}/10 – ${s.reason}${s.fix ? `\n  FIX: ${s.fix}` : ""}`,
        ),
      ].join("\n");

  const mediumBlock = medium.length === 0
    ? ""
    : [
        "Weitere Schwächen (bitte anheben):",
        ...medium.map(
          (s) =>
            `- [${s.dimension}] ${s.score}/10 – ${s.reason}${s.fix ? `\n  FIX: ${s.fix}` : ""}`,
        ),
      ].join("\n");

  const headline = verdict === "acceptable_with_warnings"
    ? "Die Soul ist knapp akzeptabel, aber bitte noch diese Punkte schärfen:"
    : "Die Soul hat es nicht durch den Gate-Check. Überarbeite sie gezielt:";

  return [headline, "", lowBlock, mediumBlock].filter(Boolean).join("\n\n");
}
