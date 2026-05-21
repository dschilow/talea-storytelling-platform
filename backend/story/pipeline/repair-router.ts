/**
 * v12 §O — pure repair-strategy router.
 *
 * Lives in its own module (no Encore deps) so smoke tests can import it
 * directly. `dev-mode-generation.ts` re-exports the strategies + router for
 * back-compat with existing call sites.
 *
 * The router takes a deterministic diagnostics snapshot and classifies it
 * into the cheapest strategy that could plausibly fix the remaining gates.
 * Strategy order is root-cause first (raw JSON > forbidden motif > page
 * count > expansion > scene-card > compression > agency > dialog > voice >
 * moralizing > pull > orthography > targeted > fallback).
 */
import type { DevModeQualityMode } from "./potential-thresholds";

// ──────────────────────────────────────────────────────────────────────────
// Diagnostics shape (intentionally minimal — only what the router reads)
// ──────────────────────────────────────────────────────────────────────────
export interface ChapterDiagnosticShape {
  dialogPct: number;
  issues: string[];
}

export interface RepairRouterDiagnostics {
  hardIssueCount: number;
  softIssueCount: number;
  totalWords: number;
  dialogPct: number;
  chapterDiagnostics: ChapterDiagnosticShape[];
  hardIssues: string[];
  softIssues: string[];
}

// ──────────────────────────────────────────────────────────────────────────
// Constants — picked to match the existing dev-mode-generation.ts thresholds.
// Keep these in sync if the orchestrator constants change.
// ──────────────────────────────────────────────────────────────────────────
export const ROUTER_MIN_DIALOG_PCT = 25;
export const ROUTER_MIN_CHAPTER_DIALOG_PCT = 18;
export const ROUTER_MIN_WORDS = 900;
export const ROUTER_VOICE_DISTINCTIVENESS_FLOOR = 8;

// ──────────────────────────────────────────────────────────────────────────
// Strategy enum
// ──────────────────────────────────────────────────────────────────────────
export type DevModeRepairStrategy =
  | "none"
  | "metadata_sanitize"
  | "title_promise_micro_repair"
  | "whole_story_compression_repair"
  | "whole_story_pull_repair"
  | "whole_story_dialog_rebalance"
  | "targeted_chapter_repair_with_context"
  | "page_count_repair"
  | "expansion_repair"
  | "scene_card_repair_then_rewrite"
  | "parse_output_repair"
  | "regenerate_from_plan_or_idea"
  | "agency_repair"
  | "voice_punchup"
  | "ending_image_repair"
  | "orthography_autofix"
  | "whole_story_repair";

export interface RepairRouterContext {
  totalWordsOverMax?: boolean;
  requiredPageCount?: number;
  actualPageCount?: number;
  totalWords?: number;
  missingIrreversibleMiddle?: boolean;
  missingPersonalCost?: boolean;
  forbiddenMotifInCorePlan?: boolean;
  helperExplainsSolution?: boolean;
  voiceDistinctiveness?: number;
  finalMoralizing?: boolean;
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────
function hasRawJsonLeak(diagnostics: RepairRouterDiagnostics): boolean {
  const hard = diagnostics.hardIssues || [];
  return hard.some((issue) => /\[object Object\]|raw JSON|RoheJSON|JSON-Fragment|brokenJson|broken JSON/i.test(issue));
}

function hasOnlyOrthographyIssues(diagnostics: RepairRouterDiagnostics): boolean {
  const all = [...(diagnostics.hardIssues || []), ...(diagnostics.softIssues || [])];
  if (all.length === 0) return false;
  return all.every((issue) =>
    /ASCII|Umlaut|gross|hoeher|Fluegel|Aermel|Großschreibung|Grossschreibung|orthograph|Rechtschreib/i.test(issue),
  );
}

function detectFinalMoralizingFromDiagnostics(diagnostics: RepairRouterDiagnostics): boolean {
  const all = [...(diagnostics.hardIssues || []), ...(diagnostics.softIssues || [])];
  return all.some((issue) => /ausgesprochene Lehre|wie eine Lehre|erklaerte Moral|erklärte Moral|moralisch|moralizing|Finale.*Lehre/i.test(issue));
}

// ──────────────────────────────────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────────────────────────────────
export function chooseRepairStrategy(
  diagnostics: RepairRouterDiagnostics | undefined,
  opts?: RepairRouterContext,
): { strategy: DevModeRepairStrategy; reason: string } {
  if (!diagnostics) return { strategy: "none", reason: "no diagnostics" };
  const hard = diagnostics.hardIssues || [];
  const soft = diagnostics.softIssues || [];
  if (hard.length === 0 && soft.length === 0) {
    return { strategy: "none", reason: "all gates clean" };
  }

  // 1. raw JSON in prose — parse repair.
  if (hasRawJsonLeak(diagnostics)) {
    return { strategy: "parse_output_repair", reason: "raw JSON / [object Object] leaked into prose" };
  }
  // 2. incomplete title.
  const hardIsTitleOnly = hard.length === 1
    && /Titel-Versprechen unerfuellt|incomplete title|Titel unvollständig|Titel unvollstaendig/i.test(hard[0]);
  if (hardIsTitleOnly) {
    return { strategy: "title_promise_micro_repair", reason: "only title-promise unresolved" };
  }
  // 3. forbidden motif baked into plan.
  if (opts?.forbiddenMotifInCorePlan) {
    return { strategy: "regenerate_from_plan_or_idea", reason: "forbidden motif in core plan — regenerate idea or plan" };
  }
  // 4. metadata-only sanitize.
  const hardIsDescriptionOnly = hard.length === 1
    && /Verbotenes|Novelty|Wiederholungs/i.test(hard[0])
    && !hard.some((h) => /Kapitel|chapter|dialog|Absaetze|Laenge|Lange/i.test(h));
  if (hardIsDescriptionOnly) {
    return { strategy: "metadata_sanitize", reason: "only novelty/forbidden motif in description" };
  }
  // 5. page count mismatch.
  if (
    typeof opts?.requiredPageCount === "number"
    && typeof opts?.actualPageCount === "number"
    && opts.requiredPageCount !== opts.actualPageCount
  ) {
    return {
      strategy: "page_count_repair",
      reason: `pageCount mismatch: required=${opts.requiredPageCount}, actual=${opts.actualPageCount}`,
    };
  }
  // 6. under-length expansion.
  if (typeof opts?.totalWords === "number" && opts.totalWords < ROUTER_MIN_WORDS) {
    return {
      strategy: "expansion_repair",
      reason: `underlength: totalWords=${opts.totalWords} < ${ROUTER_MIN_WORDS}`,
    };
  }
  // 7. structural anchor missing.
  if (opts?.missingIrreversibleMiddle || opts?.missingPersonalCost) {
    return {
      strategy: "scene_card_repair_then_rewrite",
      reason: `missing structural anchor: irreversibleMiddle=${!!opts.missingIrreversibleMiddle}, personalCost=${!!opts.missingPersonalCost}`,
    };
  }
  // 8. over-length compression.
  const tooLongChapters = diagnostics.chapterDiagnostics.filter(
    (c) => c.issues.some((i) => /deutlich zu lang|zu lang/i.test(i))
  ).length;
  const tooShortChapters = diagnostics.chapterDiagnostics.filter(
    (c) => c.issues.some((i) => /deutlich zu kurz|zu kurz/i.test(i))
  ).length;
  if (opts?.totalWordsOverMax || tooLongChapters >= 2) {
    return { strategy: "whole_story_compression_repair", reason: `over-length: chapters=${tooLongChapters}, storyOverMax=${!!opts?.totalWordsOverMax}` };
  }
  // 9. agency repair.
  if (opts?.helperExplainsSolution) {
    return { strategy: "agency_repair", reason: "helper explains or solves the finale — needs hero-driven rewrite" };
  }
  // 10. dialogue rebalance.
  const lowDialogChapters = diagnostics.chapterDiagnostics.filter(
    (c) => c.dialogPct < ROUTER_MIN_CHAPTER_DIALOG_PCT
  ).length;
  if (diagnostics.dialogPct < ROUTER_MIN_DIALOG_PCT || lowDialogChapters >= 2) {
    return { strategy: "whole_story_dialog_rebalance", reason: `dialogPct=${diagnostics.dialogPct}, lowChapters=${lowDialogChapters}` };
  }
  // 11. voice punchup.
  if (typeof opts?.voiceDistinctiveness === "number" && opts.voiceDistinctiveness < ROUTER_VOICE_DISTINCTIVENESS_FLOOR) {
    return { strategy: "voice_punchup", reason: `voiceDistinctiveness=${opts.voiceDistinctiveness} < ${ROUTER_VOICE_DISTINCTIVENESS_FLOOR}` };
  }
  // 12. ending-image repair.
  if (opts?.finalMoralizing || detectFinalMoralizingFromDiagnostics(diagnostics)) {
    return { strategy: "ending_image_repair", reason: "final line moralizes instead of being a closing image" };
  }
  // 13. pull repair.
  const weakPullCount = soft.filter((s) =>
    /wenig Weiterlese-Sog|schwacher Pull|ohne klaren Pull|Kapitelende ohne Sog/i.test(s)
  ).length;
  if (weakPullCount >= 2) {
    return { strategy: "whole_story_pull_repair", reason: `weakPullCount=${weakPullCount}` };
  }
  // 14. orthography-only autofix.
  if (hasOnlyOrthographyIssues(diagnostics)) {
    return { strategy: "orthography_autofix", reason: "only orthography/umlaut issues remain" };
  }
  // 15. single-chapter targeted repair.
  const hardFailChapters = diagnostics.chapterDiagnostics.filter((c) => c.issues.length > 0).length;
  if (hardFailChapters === 1) {
    return { strategy: "targeted_chapter_repair_with_context", reason: "single chapter with hard issues" };
  }
  return {
    strategy: "whole_story_repair",
    reason: `fallback: hard=${hard.length}, soft=${soft.length}, badChapters=${hardFailChapters}, tooLong=${tooLongChapters}, tooShort=${tooShortChapters}`,
  };
}

/** Strategies the orchestrator can fully resolve without spending an LLM call. */
export function isDeterministicRepairStrategy(strategy: DevModeRepairStrategy): boolean {
  return (
    strategy === "metadata_sanitize"
    || strategy === "title_promise_micro_repair"
    || strategy === "parse_output_repair"
    || strategy === "orthography_autofix"
  );
}

/** v12 §O cap: premium=2, efficient=1. */
export function maxRepairAttemptsFor(mode: DevModeQualityMode | undefined): number {
  return (mode || "premium") === "premium" ? 2 : 1;
}
