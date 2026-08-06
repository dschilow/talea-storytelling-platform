/**
 * Stake-owner contract between the locked idea and the beat sheet.
 *
 * The idea stage decides WHOSE story this is and writes it into
 * `emotionalEngine`. Every later prompt receives that field verbatim, labelled
 * LOCKED — but the beat sheet is free to invent its own `personalObject` and
 * `mainWant`, and when the two disagree nothing downstream can tell which one
 * is authoritative. Later prompts simply follow the more concrete one (the beat
 * sheet), and the hero the idea was built around quietly becomes a bystander.
 *
 * Run 4848aa03 is the worked example. Locked idea:
 *
 *   "Alexander fürchtet, dass sein Lieblingsknopf nicht mehr zu ihm gehört;
 *    Adrian zögert, eine eigene kleine Schuld zuzugeben."
 *
 * The beat sheet then made the button "Adrians roter Lieblingsknopf", gave
 * Adrian the secret, the confession and the decisive action — and Alexander,
 * the child the book is named after, spent five reading pages holding a drawer
 * open for someone else. No gate fired, because every gate was checking form.
 *
 * This module is intentionally Encore-free so the gate can be unit-tested
 * without the pipeline's dependency graph (same pattern as
 * potential-thresholds.ts).
 */

export interface BeatSheetStakeShape {
  personalObject?: unknown;
  mainWant?: unknown;
}

/**
 * The first named hero mentioned in a piece of planning text.
 *
 * "First" is the right rule rather than "most frequent": both the idea's
 * `emotionalEngine` and the beat sheet's `whyPersonal` are written as
 * "<owner> <verb> ...", and a co-protagonist named later in the same sentence
 * usually carries the counter-thread, not the stake.
 */
export function resolveStakeOwner(text: string, heroNames: readonly string[]): string | undefined {
  const haystack = String(text || "").toLowerCase();
  if (!haystack) return undefined;
  let owner: string | undefined;
  let ownerIndex = Number.POSITIVE_INFINITY;
  for (const name of heroNames) {
    const needle = String(name || "").trim().toLowerCase();
    if (!needle) continue;
    const index = haystack.indexOf(needle);
    if (index >= 0 && index < ownerIndex) {
      ownerIndex = index;
      owner = name;
    }
  }
  return owner;
}

/**
 * Returns a repair instruction when the beat sheet moved the emotional stake to
 * a different hero than the locked idea, and an empty array otherwise.
 *
 * Deliberately silent when it cannot be sure: a single-hero story has no drift
 * to detect, and text that names no hero at all is a different defect that the
 * existing personal-object gates already cover.
 */
export function collectStakeOwnerDrift(input: {
  lockedEmotionalEngine?: string;
  beatSheet?: BeatSheetStakeShape;
  heroNames?: readonly string[];
}): string[] {
  const heroNames = (input.heroNames || []).filter((name) => String(name || "").trim());
  if (heroNames.length < 2) return [];

  const lockedOwner = resolveStakeOwner(String(input.lockedEmotionalEngine || ""), heroNames);
  if (!lockedOwner) return [];

  const personalObject = input.beatSheet?.personalObject as any;
  const beatSheetStakeText = [
    typeof personalObject === "string" ? personalObject : personalObject?.object,
    typeof personalObject === "object" && personalObject !== null ? personalObject?.whyPersonal : "",
    input.beatSheet?.mainWant,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");

  const beatSheetOwner = resolveStakeOwner(beatSheetStakeText, heroNames);
  if (!beatSheetOwner || beatSheetOwner === lockedOwner) return [];

  return [
    `stakeOwner drift: the locked idea gives the emotional stake to ${lockedOwner}, `
    + `but personalObject/mainWant belong to ${beatSheetOwner}. `
    + `Rewrite personalObject.object, personalObject.whyPersonal and mainWant so ${lockedOwner} owns the keepsake and the want. `
    + `${beatSheetOwner} keeps a separate visible stake of their own — never leave a named main avatar with nothing to lose.`,
  ];
}
