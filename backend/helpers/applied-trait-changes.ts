export interface DescribedTraitChange {
  trait: string;
  change: number;
  description: string;
}

/**
 * Replaces each requested amount with the amount updatePersonality actually
 * wrote. Diminishing returns turn a requested +5 into +3 at higher values and
 * a trait at its ceiling gains nothing, so the finale and the memory must not
 * repeat the request. Descriptions stay; traits that gained nothing are dropped.
 */
export function withAppliedAmounts(
  requested: DescribedTraitChange[],
  applied: Array<{ trait: string; change: number }>,
): DescribedTraitChange[] {
  const appliedByTrait = new Map<string, number>();
  for (const entry of applied) {
    appliedByTrait.set(entry.trait, (appliedByTrait.get(entry.trait) ?? 0) + entry.change);
  }
  return requested.flatMap((change) => {
    const amount = appliedByTrait.get(change.trait) ?? 0;
    return amount === 0 ? [] : [{ ...change, change: amount }];
  });
}
