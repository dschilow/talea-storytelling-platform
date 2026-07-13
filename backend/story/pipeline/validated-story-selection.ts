export interface ValidatedStorySignals {
  hardIssueCount: number;
  errorCount: number;
  blockerCount: number;
  releaseFailureCount: number;
  score: number;
}

function finiteNonNegative(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

/**
 * Returns a positive number when `candidate` is safer/better than `baseline`.
 * Technical and editorial blockers outrank a cosmetic score movement. This
 * prevents a rewrite that fixes nothing (or creates new continuity errors)
 * from replacing an already validated, higher-quality version.
 */
export function compareValidatedStorySignals(
  candidate: ValidatedStorySignals,
  baseline: ValidatedStorySignals,
): number {
  const lowerIsBetter: Array<keyof ValidatedStorySignals> = [
    "hardIssueCount",
    "errorCount",
    "blockerCount",
    "releaseFailureCount",
  ];
  for (const key of lowerIsBetter) {
    const left = finiteNonNegative(candidate[key]);
    const right = finiteNonNegative(baseline[key]);
    if (left !== right) return right - left;
  }

  const candidateScore = finiteNonNegative(candidate.score);
  const baselineScore = finiteNonNegative(baseline.score);
  return candidateScore - baselineScore;
}
