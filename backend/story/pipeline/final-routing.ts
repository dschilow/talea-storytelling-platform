/**
 * v12 §S — final-validation classifier.
 *
 * Given the deterministic + validator outcomes of a finished story run,
 * returns:
 *   - `failureClass`  — which stage owns the problem
 *   - `recommendedRoute` — what the caller should do next
 *   - `mustFixBeforeRelease` — concrete issue strings the caller must address
 *
 * Pure: no Encore deps, importable from smoke tests. The shape mirrors the
 * spec §S contract; `dev-mode-generation.ts` calls this once at the end of
 * the pipeline and merges the result into `metadata`.
 */
import type { DevModeRepairStrategy } from "./repair-router";

export type FinalFailureClass =
  | "none"
  | "plan_failure"
  | "draft_failure"
  | "form_failure"
  | "image_not_started";

export type FinalRecommendedRoute =
  | "release"
  | "local_fix"
  | "targeted_repair"
  | "rewrite_from_scene_cards"
  | "regenerate_idea";

export interface FinalRoutingInput {
  releaseReady: boolean;
  hardIssues: string[];
  softIssues: string[];
  /** Hard issues that point to the screenplay plan, not the prose. */
  releaseDimensionFailures: string[];
  /** True if the image pipeline could not start (text gate failed first). */
  imagesSkipped: boolean;
  /** Optional: the last router strategy chosen for this run. */
  routerStrategy?: DevModeRepairStrategy;
  /** Optional: dimension scores from the validator (emotionalPayoff etc.). */
  dimensionScores?: {
    emotionalPayoff?: number;
    readOnPull?: number;
    causalChain?: number;
    voiceDistinctiveness?: number;
    childComprehension?: number;
  };
}

export interface FinalRoutingResult {
  failureClass: FinalFailureClass;
  recommendedRoute: FinalRecommendedRoute;
  mustFixBeforeRelease: string[];
}

const DIMENSION_FLOOR = 8;

const FORM_ISSUE_REGEX = /\[object Object\]|raw JSON|RoheJSON|JSON-Fragment|brokenJson|broken JSON|Seitenzahl|pageCount|page count|Restseite|Orphan|orphan page|Titel-Versprechen unerfuellt|ASCII|Umlaut|Großschreibung|Grossschreibung|orthograph|Rechtschreib|deutlich zu lang|deutlich zu kurz|Absätze|Absaetze/i;

const PLAN_ISSUE_REGEX = /keine sichtbare irreversible Mitte|kein persönlicher Einsatz|kein persoenlicher Einsatz|Verbotenes Motiv|forbidden motif|Helper-Explains-Gate|erklaert die Loesung|erklärt die Lösung|nimmt die finale Handlung|Finale wiederholt|Payoff wiederholt|ausgesprochene Lehre|wie eine Lehre|erklaerte Moral|erklärte Moral/i;

function classifyIssueAsPlan(issue: string): boolean {
  return PLAN_ISSUE_REGEX.test(issue);
}

function classifyIssueAsForm(issue: string): boolean {
  return FORM_ISSUE_REGEX.test(issue);
}

function hasLowDimension(scores: FinalRoutingInput["dimensionScores"]): boolean {
  if (!scores) return false;
  const dims = [scores.emotionalPayoff, scores.readOnPull, scores.causalChain, scores.voiceDistinctiveness];
  return dims.some((s) => typeof s === "number" && Number.isFinite(s) && (s as number) < DIMENSION_FLOOR);
}

/**
 * The strategy-driven route lookup mirrors spec §S. Strategies that touch
 * plot/structure → `rewrite_from_scene_cards`; deterministic fixes →
 * `local_fix`; everything else → `targeted_repair`.
 */
function routeForStrategy(strategy: DevModeRepairStrategy | undefined): FinalRecommendedRoute | undefined {
  if (!strategy || strategy === "none") return undefined;
  switch (strategy) {
    case "regenerate_from_plan_or_idea":
      return "regenerate_idea";
    case "scene_card_repair_then_rewrite":
      return "rewrite_from_scene_cards";
    case "metadata_sanitize":
    case "title_promise_micro_repair":
    case "parse_output_repair":
    case "orthography_autofix":
      return "local_fix";
    default:
      return "targeted_repair";
  }
}

export function classifyFinalRouting(input: FinalRoutingInput): FinalRoutingResult {
  // 1. Clean release — short-circuit.
  if (input.releaseReady && input.hardIssues.length === 0 && input.releaseDimensionFailures.length === 0) {
    return {
      failureClass: "none",
      recommendedRoute: "release",
      mustFixBeforeRelease: [],
    };
  }

  // 2. Plan failure — dimension floor breached or plan-shaped issues present.
  const hasPlanIssue =
    input.hardIssues.some(classifyIssueAsPlan)
    || input.softIssues.some(classifyIssueAsPlan)
    || input.releaseDimensionFailures.length > 0
    || hasLowDimension(input.dimensionScores);

  // 3. Form failure — issues that don't change plot but block release.
  const hardFormCount = input.hardIssues.filter(classifyIssueAsForm).length;
  const hardNonFormNonPlan = input.hardIssues.filter((i) => !classifyIssueAsForm(i) && !classifyIssueAsPlan(i));

  // Plan trumps form: a plan failure stays a plan failure even when there
  // is also a form issue, because polish cannot fix the structural gap.
  if (hasPlanIssue) {
    const route =
      routeForStrategy(input.routerStrategy)
      ?? "rewrite_from_scene_cards";
    const mustFix = [
      ...input.hardIssues.filter(classifyIssueAsPlan),
      ...input.releaseDimensionFailures,
    ].slice(0, 6);
    return {
      failureClass: "plan_failure",
      recommendedRoute: route === "release" ? "rewrite_from_scene_cards" : route,
      mustFixBeforeRelease: mustFix,
    };
  }

  // 4. Form-only failure — local fix is enough.
  if (hardFormCount > 0 && hardNonFormNonPlan.length === 0) {
    return {
      failureClass: "form_failure",
      recommendedRoute: "local_fix",
      mustFixBeforeRelease: input.hardIssues.filter(classifyIssueAsForm).slice(0, 6),
    };
  }

  // 5. Image-not-started — text gate already failed, image stage was skipped.
  // Reported as a status only when there is no underlying text problem to
  // route on; otherwise the underlying class wins.
  if (input.imagesSkipped && input.hardIssues.length === 0 && input.releaseDimensionFailures.length === 0) {
    return {
      failureClass: "image_not_started",
      recommendedRoute: "release",
      mustFixBeforeRelease: [],
    };
  }

  // 6. Draft failure — hard issues remain but neither plan nor form maps
  // cleanly. Targeted chapter repair is the right next step.
  if (input.hardIssues.length > 0 || input.softIssues.length > 0) {
    const route = routeForStrategy(input.routerStrategy) ?? "targeted_repair";
    return {
      failureClass: "draft_failure",
      recommendedRoute: route === "release" ? "targeted_repair" : route,
      mustFixBeforeRelease: input.hardIssues.slice(0, 6),
    };
  }

  // 7. Not release-ready but no issues to point at — fall back to targeted
  // repair so the caller can poke at it manually.
  return {
    failureClass: "draft_failure",
    recommendedRoute: "targeted_repair",
    mustFixBeforeRelease: [],
  };
}
