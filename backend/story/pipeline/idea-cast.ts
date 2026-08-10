/**
 * Which supporting cast belongs to the idea the pipeline actually writes.
 *
 * Two independent decisions meet here and used to disagree silently:
 *
 *   1. WHICH IDEA wins. The potential-filter model returns `chosenIdeaId`, but
 *      the deterministic audit re-ranks and may pick a different candidate —
 *      on purpose: logs showed the support model favouring poetic premises over
 *      concrete, child-playable ones.
 *   2. WHICH CAST goes with it. The model returns one flat
 *      `selectedSupportingCast`, written for ITS pick.
 *
 * When (1) overrides the model, taking (2) anyway staples one story's premise
 * to another story's cast. Run 5d8696ee shipped that way: premise c2 ("Aufzug
 * zum Pfannkuchen", core conflict "den Teig für ROSALINDES Pfannkuchen
 * vertauscht") with c3's cast (Nebelhexe + Müller Hans). Rosalinde was the
 * person the hero wronged and was forbidden to appear. The prose named her
 * anyway, the validator called it a publishability blocker, and a chapter
 * repair swapped her for "Müller Hans' Tochter" — equally unauthorised, so the
 * story shipped blocked after paying for the whole cascade.
 *
 * Encore-free so the contract can be unit-tested without the pipeline's
 * dependency graph (same pattern as potential-thresholds.ts / stake-owner.ts).
 */

/** Ceiling after a premise-named character is added back; see resolveIdeaCast. */
export const MAX_IDEA_NAMED_CAST = 3;

export interface IdeaCastCandidate {
  id?: string;
  title?: string;
  oneLineHook?: string;
  centralObjectOrPlace?: string;
  wonderRule?: string;
  emotionalEngine?: string;
  coreConflict?: string;
  recommendedSupportingCast?: string[];
}

function normalize(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The cast the chosen idea should run with.
 *
 * - `modelCast` is used only when the model's own pick survived the audit.
 * - Otherwise the chosen candidate's own recommendation wins.
 * - Either way, any pool character the chosen premise NAMES is added back: the
 *   prose will name them regardless, so excluding them only converts the
 *   story's own premise into a cast violation.
 */
export function resolveIdeaCast(input: {
  chosenCandidate?: IdeaCastCandidate;
  modelChosenIdeaId?: string;
  auditChosenIdeaId?: string;
  modelCast?: string[];
  poolNames?: readonly string[];
}): string[] {
  const { chosenCandidate } = input;
  const modelPick = String(input.modelChosenIdeaId || "").trim();
  const auditPick = String(input.auditChosenIdeaId || "").trim();
  const auditOverrodeModelPick = Boolean(modelPick && auditPick && modelPick !== auditPick);

  const base = (auditOverrodeModelPick
    ? chosenCandidate?.recommendedSupportingCast
    : input.modelCast
  ) || [];
  const cast = base.map((name) => String(name || "").trim()).filter(Boolean);

  if (!chosenCandidate) return cast;
  const pool = (input.poolNames || []).map((name) => String(name || "").trim()).filter(Boolean);
  if (pool.length === 0) return cast;

  const ideaText = normalize([
    chosenCandidate.oneLineHook,
    chosenCandidate.centralObjectOrPlace,
    chosenCandidate.wonderRule,
    chosenCandidate.emotionalEngine,
    chosenCandidate.coreConflict,
  ].filter(Boolean).join(" "));
  if (!ideaText) return cast;

  const already = new Set(cast.map(normalize));
  const merged = [...cast];
  for (const poolName of pool) {
    if (merged.length >= MAX_IDEA_NAMED_CAST) break;
    const normalized = normalize(poolName);
    if (!normalized || already.has(normalized)) continue;
    // Match the distinctive part ("rosalinde", not "prinzessin") so a shared
    // title never drags an unrelated character in.
    const distinctive = normalized.split(" ").filter((part) => part.length >= 4).pop();
    if (!distinctive || !ideaText.includes(distinctive)) continue;
    merged.push(poolName);
    already.add(normalized);
  }
  return merged;
}
