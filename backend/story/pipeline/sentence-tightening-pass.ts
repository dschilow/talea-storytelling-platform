/**
 * Sprint 4 (S4.5) — Sentence-Tightening Pass.
 *
 * Cheap mechanical post-pass that runs ONLY on chapters where AGE_FIT_SENTENCE_LENGTH
 * fired. Goal: split sentences > 12 words, replace subjunctives with indicatives,
 * cap at most 1 subordinate clause per sentence. Plot, dialogue, and meaning stay
 * 1:1 — only the syntactic shell changes.
 *
 * Why this exists: logs of "Angstbannstab" 2026-04-27 showed AGE_FIT firing on
 * all 5 chapters but the story was still published because the surgery prompt
 * is content-focused, not syntax-focused. The full surgery rewrite is also
 * 5-6× more expensive than this targeted nano pass.
 *
 * Cost profile (per chapter that needs tightening):
 *   - Gemini 3.1 flash-lite: ~$0.0006 in + $0.0008 out → ≈ $0.0015
 *   - Runs on ≤ 5 chapters → max ≈ $0.008/story
 *   - Replaces ~$0.02 of full hard-rewrite surgery → net SAVINGS
 */

import { GEMINI_SUPPORT_MODEL, isGeminiFamilyModel } from "./model-routing";
import {
  buildLlmCostEntry,
  mergeNormalizedTokenUsage,
  normalizeTokenUsage,
} from "./cost-ledger";
import type {
  StoryCostEntry,
  StoryDraft,
  TokenUsage,
} from "./types";

export interface SentenceTighteningResult {
  draft: StoryDraft;
  changed: boolean;
  tightenedChapters: number[];
  usage?: TokenUsage;
  costEntries?: StoryCostEntry[];
}

export interface SentenceTighteningInput {
  storyId: string;
  language: string;
  ageMax: number;
  draft: StoryDraft;
  /** Only chapters in this set get tightened. Pass empty / undefined to skip. */
  chaptersNeedingTightening: ReadonlySet<number>;
  /** Default GEMINI_SUPPORT_MODEL — always nano/flash-lite tier for cost. */
  model?: string;
}

const MAX_TIGHTEN_TOKENS = 1100;
const TEMPERATURE = 0.2;

export async function applySentenceTightening(
  input: SentenceTighteningInput,
): Promise<SentenceTighteningResult> {
  if (input.chaptersNeedingTightening.size === 0) {
    return { draft: input.draft, changed: false, tightenedChapters: [] };
  }

  const model = input.model || GEMINI_SUPPORT_MODEL;
  const isGemini = isGeminiFamilyModel(model);
  const chapters = input.draft.chapters.map((ch) => ({ ...ch }));
  const tightenedChapters: number[] = [];
  let usage: TokenUsage | undefined;
  const costEntries: StoryCostEntry[] = [];
  let changed = false;

  for (const chapter of chapters) {
    if (!input.chaptersNeedingTightening.has(chapter.chapter)) continue;
    if (!chapter.text || chapter.text.trim().length < 50) continue;

    const prompt = buildTighteningPrompt({
      original: chapter.text,
      ageMax: input.ageMax,
      language: input.language,
    });
    const systemMessage = buildTighteningSystemPrompt(input.language);

    try {
      // Lazy-load LLM clients so this module can be imported by smoke tests
      // without triggering Encore secret() at top level.
      const result = isGemini
        ? await (async () => {
            const { generateWithGemini } = await import("../gemini-generation");
            const r = await generateWithGemini({
              systemPrompt: systemMessage,
              userPrompt: prompt,
              model,
              maxTokens: MAX_TIGHTEN_TOKENS,
              temperature: TEMPERATURE,
              thinkingBudget: 0, // syntax-only pass — no chain-of-thought needed
              logSource: "phase6-sentence-tightening-llm",
              logMetadata: { storyId: input.storyId, chapter: chapter.chapter },
            });
            return {
              content: r.content,
              usage: normalizeTokenUsage(
                {
                  promptTokens: r.usage.promptTokens,
                  completionTokens: r.usage.completionTokens,
                  totalTokens: r.usage.totalTokens,
                  model: r.model,
                },
                r.model,
              ) as TokenUsage,
            };
          })()
        : await (async () => {
            const { callChatCompletion } = await import("./llm-client");
            const r = await callChatCompletion({
              model,
              messages: [
                { role: "system", content: systemMessage },
                { role: "user", content: prompt },
              ],
              maxTokens: MAX_TIGHTEN_TOKENS,
              temperature: TEMPERATURE,
            });
            return {
              content: r.content,
              usage: r.usage as TokenUsage,
            };
          })();

      usage = mergeNormalizedTokenUsage(usage, result.usage);
      const costEntry = buildLlmCostEntry({
        phase: "phase6-sentence-tightening",
        step: "tighten",
        usage: result.usage,
        fallbackModel: model,
        chapter: chapter.chapter,
      });
      if (costEntry) costEntries.push(costEntry);

      const tightened = parseTightenedText(result.content);
      if (tightened && tightened.length > 30 && tightened !== chapter.text) {
        chapter.text = tightened;
        tightenedChapters.push(chapter.chapter);
        changed = true;
      }
    } catch (err) {
      // Tightening is best-effort. If it fails, the original text stays —
      // the AGE_FIT gate will still flag it on next pass.
      console.warn(
        `[sentence-tightening] chapter ${chapter.chapter} failed:`,
        (err as Error)?.message || err,
      );
    }
  }

  return {
    draft: { ...input.draft, chapters },
    changed,
    tightenedChapters,
    usage,
    costEntries,
  };
}

function buildTighteningSystemPrompt(language: string): string {
  if (language === "de") {
    return `Du bist ein präziser Lektor für Kinderbücher. Du straffst Sätze für Kinder von 6-8 Jahren, ohne den Inhalt zu ändern. Antworte NUR mit dem überarbeiteten Kapitel-Text als JSON-Objekt mit dem Feld "text". Keine Kommentare. Keine Erklärungen.`;
  }
  return `You are a precise children's-book editor. You tighten sentences for ages 6-8 without changing meaning. Respond ONLY with the revised chapter text as a JSON object with field "text". No comments. No explanations.`;
}

function buildTighteningPrompt(input: {
  original: string;
  ageMax: number;
  language: string;
}): string {
  const isDE = input.language === "de";
  if (isDE) {
    return `Straffe das folgende Kapitel für Kinder von 6-${input.ageMax} Jahren.

REGELN (HART):
- Trenne JEDEN Satz mit mehr als 12 Wörtern in zwei kurze Sätze.
- Maximal 1 Nebensatz pro Satz.
- Ersetze Konjunktive ("als wäre", "als hätte", "würde") durch Indikative wenn möglich.
- Keine literarischen Vergleiche, die ein Kind nicht sofort versteht.
- Behalte ALLE Figurenstimmen, Dialoge, Ortsangaben und Plot-Schritte 1:1.
- Behalte Refrains und wiederkehrende Sätze WORTGENAU.
- Behalte alle Eigennamen und konkreten Gegenstände.
- Behalte den Abschluss-Rhythmus des Kapitels (letzter Satz darf prägnant sein).
- Antworte NUR mit JSON: { "text": "<überarbeiteter Kapiteltext>" }

ORIGINAL KAPITEL:
"""
${input.original}
"""`;
  }
  return `Tighten the following chapter for ages 6-${input.ageMax}.

HARD RULES:
- Split every sentence > 12 words into two short sentences.
- Max 1 subordinate clause per sentence.
- Replace subjunctives ("would", "as if") with indicatives when possible.
- No literary similes a child cannot picture immediately.
- Preserve ALL character voices, dialogue, locations, and plot steps 1:1.
- Preserve refrains and recurring lines VERBATIM.
- Preserve all proper names and concrete objects.
- Respond ONLY with JSON: { "text": "<revised chapter text>" }

ORIGINAL CHAPTER:
"""
${input.original}
"""`;
}

function parseTightenedText(raw: string): string | null {
  if (!raw) return null;
  // Strip code fences if present
  const stripped = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(stripped);
    if (parsed && typeof parsed.text === "string" && parsed.text.trim().length > 0) {
      return parsed.text.trim();
    }
  } catch {
    // not JSON — fall through to raw extraction
  }
  // Best-effort: if model returned plain text, accept it directly.
  if (stripped.length > 30 && !stripped.startsWith("{")) {
    return stripped;
  }
  return null;
}

/**
 * Helper: extract chapter numbers that triggered AGE_FIT_SENTENCE_LENGTH
 * gate errors from a quality report's issues array.
 */
export function pickChaptersNeedingTightening(
  issues: Array<{ gate: string; chapter: number; severity: string; code: string }>,
): Set<number> {
  const set = new Set<number>();
  for (const issue of issues) {
    if (issue.severity !== "ERROR") continue;
    if (
      issue.gate === "AGE_FIT_SENTENCE_LENGTH"
      || issue.code === "AVG_SENTENCE_TOO_LONG_HARD"
      || issue.code === "SENTENCE_HARD_CAP_EXCEEDED"
      || issue.code === "COMPLEX_CLAUSE_OVERUSE"
    ) {
      if (issue.chapter > 0) set.add(issue.chapter);
    }
  }
  return set;
}
