/**
 * Cost-bounded adaptive visual-QA selection.
 *
 * The native image model currently accepts at most two character references,
 * so reference count alone cannot identify a risky interior. Select the cover
 * plus the highest-risk interior from scene complexity instead.
 */

export interface AdaptiveVisualQaCandidate {
  kind: "cover" | "chapter";
  order?: number;
  expectedCharacterCount: number;
  referenceCount: number;
  scenePrompt: string;
}

const FURNITURE_OR_OCCLUSION = /\b(?:chair|chairs|seat|seated|sitting|table|desk|bench|bed|sofa|couch|stool|furniture|behind|between|through|under|stuhl|stuehle|sitz|sitzt|sitzen|tisch|bank|bett|sofa|moebel|hinter|zwischen|unter)\b/i;
const PHYSICAL_INTERACTION = /\b(?:hold|holding|hug|hugging|carry|carrying|catch|catching|pull|pulling|push|pushing|reach|reaching|grab|grabbing|climb|climbing|jump|jumping|run|running|dance|dancing|fight|fighting|handshake|hand-in-hand|haelt|halten|umarm|traegt|tragen|fang|zieh|schieb|greif|kletter|spring|renn|tanz|kaempf)\w*/i;
const CROWDING_OR_LAYERING = /\b(?:crowd|crowded|group|cluster|foreground|background|overlap|partly hidden|partially hidden|enge|gedraenge|gruppe|vordergrund|hintergrund|ueberlapp|verdeckt)\b/i;

export function visualQaRiskScore(candidate: AdaptiveVisualQaCandidate): number {
  const expectedCount = Math.max(0, Math.floor(Number(candidate.expectedCharacterCount) || 0));
  const referenceCount = Math.max(0, Math.floor(Number(candidate.referenceCount) || 0));
  const prompt = String(candidate.scenePrompt || "");
  let score = expectedCount * 12 + referenceCount * 4;
  if (expectedCount >= 2) score += 12;
  if (FURNITURE_OR_OCCLUSION.test(prompt)) score += 36;
  if (PHYSICAL_INTERACTION.test(prompt)) score += 24;
  if (CROWDING_OR_LAYERING.test(prompt)) score += 18;
  return score;
}

/**
 * Default budget: exactly two QA calls when possible (cover + one interior).
 * Ties resolve by page order, which keeps selection deterministic.
 */
export function selectAdaptiveVisualQaCandidates<T extends AdaptiveVisualQaCandidate>(
  candidates: T[],
  maxJobs = 2
): T[] {
  const limit = Math.max(0, Math.floor(Number(maxJobs) || 0));
  if (limit === 0 || candidates.length === 0) return [];

  const cover = candidates.find((candidate) => candidate.kind === "cover");
  const interiors = candidates
    .filter((candidate) => candidate.kind === "chapter")
    .map((candidate, index) => ({ candidate, index, score: visualQaRiskScore(candidate) }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const leftOrder = Number.isFinite(Number(left.candidate.order))
        ? Number(left.candidate.order)
        : Number.MAX_SAFE_INTEGER;
      const rightOrder = Number.isFinite(Number(right.candidate.order))
        ? Number(right.candidate.order)
        : Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.index - right.index;
    })
    .map((entry) => entry.candidate);

  if (!cover) return interiors.slice(0, limit);
  return [cover, ...interiors.slice(0, Math.max(0, limit - 1))];
}
