import type { DevModeQualityMode } from "./potential-thresholds";

export interface DevModeGatePolicyInput {
  qualityMode?: DevModeQualityMode;
  strictQualityGates?: boolean;
  strictReleaseGateMode?: "warn" | "block" | string | null;
  debug?: boolean;
}

/**
 * Premium idea-candidate gates are a quality preference by default, not a
 * user-facing availability gate. We only hard-block when the caller
 * explicitly opts into strict release blocking.
 */
export function shouldBlockPremiumPotentialGateFailure(input: DevModeGatePolicyInput): boolean {
  const mode = input.qualityMode || "premium";
  if (mode !== "premium") return false;
  if (input.debug === true) return false;
  return input.strictQualityGates === true || input.strictReleaseGateMode === "block";
}
