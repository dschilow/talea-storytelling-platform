export interface DescribedTraitChange {
  trait: string;
  change: number;
  description: string;
}

/** "knowledge.History" and "knowledge.history" name the same subcategory. */
function traitKey(trait: string): string {
  return trait.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * Replaces each requested amount with the amount updatePersonality actually
 * wrote. Diminishing returns turn a requested +5 into +3 at higher values and
 * a trait at its ceiling gains nothing, so the finale and the memory must not
 * repeat the request. Descriptions stay; traits that gained nothing are dropped.
 *
 * The trait id becomes the one that was written (an existing subcategory's
 * spelling), and a reason that opens with the requested amount ("+3 Mut
 * durch …") is corrected to the written amount.
 */
export function withAppliedAmounts(
  requested: DescribedTraitChange[],
  applied: Array<{ trait: string; change: number }>,
): DescribedTraitChange[] {
  const appliedByKey = new Map<string, { trait: string; change: number }>();
  for (const entry of applied) {
    const key = traitKey(entry.trait);
    const existing = appliedByKey.get(key);
    appliedByKey.set(key, {
      trait: existing?.trait ?? entry.trait,
      change: (existing?.change ?? 0) + entry.change,
    });
  }
  const used = new Set<string>();
  return requested.flatMap((change) => {
    const key = traitKey(change.trait);
    const written = appliedByKey.get(key);
    if (!written || written.change === 0 || used.has(key)) return [];
    used.add(key);
    const sign = written.change > 0 ? "+" : "−";
    const description = change.description.replace(
      /^\s*[+−-]\s*\d+(?=\s)/,
      `${sign}${Math.abs(written.change)}`,
    );
    return [{ trait: written.trait, change: written.change, description }];
  });
}
