import type { DevModeQualityMode } from "./potential-thresholds";

export interface DevModeGatePolicyInput {
  qualityMode?: DevModeQualityMode;
  strictQualityGates?: boolean;
  strictReleaseGateMode?: "warn" | "block" | string | null;
  debug?: boolean;
}

export type IllustrationEligibilityReason =
  | "eligible"
  | "debug"
  | "strict_text_gate"
  | "unrenderable_text"
  | "page_count_mismatch";

export interface IllustrationEligibilityInput {
  debug?: boolean;
  strictTextGateBlocked?: boolean;
  hardIssues?: string[];
  actualPageCount?: number;
  expectedPageCount?: number;
}

export interface IllustrationEligibilityDecision {
  eligible: boolean;
  reason: IllustrationEligibilityReason;
}

/**
 * Editorial quality and illustration safety are deliberately separate.
 * A complete 8.x story may still need editorial work, but returning it to a
 * child without any pictures is worse product behaviour and wastes the whole
 * generation. Only debug runs, structurally incomplete output, or
 * serialization corruption may suppress illustrations. A strict editorial
 * release gate controls publication state, not whether a completed child
 * receives the illustrations that were requested and paid for.
 */
export function decideIllustrationEligibility(
  input: IllustrationEligibilityInput,
): IllustrationEligibilityDecision {
  if (input.debug === true) return { eligible: false, reason: "debug" };

  const actual = Number(input.actualPageCount ?? 0);
  const expected = Number(input.expectedPageCount ?? 0);
  if (actual <= 0 || (expected > 0 && actual !== expected)) {
    return { eligible: false, reason: "page_count_mismatch" };
  }

  const unrenderablePattern =
    /Kaputte Platzhalter|\[object Object\]|Serialisierungsartefakt|JSON-Struktur|unparseable|malformed JSON|missing title/i;
  if ((input.hardIssues || []).some((issue) => unrenderablePattern.test(String(issue)))) {
    return { eligible: false, reason: "unrenderable_text" };
  }

  return { eligible: true, reason: "eligible" };
}
export function shouldBlockPremiumPotentialGateFailure(input: DevModeGatePolicyInput): boolean {
  const mode = input.qualityMode || "premium";
  if (mode !== "premium") return false;
  // Debug keeps failed candidates inspectable, but it is never a release lane.
  if (input.debug === true) return false;
  return input.strictQualityGates === true || input.strictReleaseGateMode === "block";
}
