import type { DevModeQualityMode } from "./potential-thresholds";

export interface DevModeGatePolicyInput {
  qualityMode?: DevModeQualityMode;
  strictQualityGates?: boolean;
  strictReleaseGateMode?: "warn" | "block" | string | null;
  debug?: boolean;
}

export function shouldBlockPremiumPotentialGateFailure(input: DevModeGatePolicyInput): boolean {
  const mode = input.qualityMode || "premium";
  if (mode !== "premium") return false;
  // Debug keeps failed candidates inspectable, but it is never a release lane.
  if (input.debug === true) return false;
  if (input.strictReleaseGateMode === "warn" && input.strictQualityGates !== true) return false;
  return true;
}
