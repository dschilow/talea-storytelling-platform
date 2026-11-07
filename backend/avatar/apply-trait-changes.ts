/**
 * How trait points are written onto an avatar (Encore-free, tested).
 *
 * The rules the product promises:
 * - every avatar starts with the 9 base traits at 0;
 * - `courage +3` raises Mut by 3 (fewer at high values, see
 *   applyDiminishingReturns);
 * - `knowledge.history +2` creates the child "history" under Wissen if it does
 *   not exist yet, gives it 2 points, and Wissen grows by the same 2;
 * - a subcategory exists only because an update named it;
 * - every written change carries a reason (`description`).
 */
import type { PersonalityTraits } from "./avatar";
import {
  SUBCATEGORY_MAX_VALUE,
  baseTraitMaxValue,
  getBaseTraitIds,
  shiftBaseTraitBySubcategory,
} from "../constants/personalityTraits";

export interface TraitChange {
  trait: string;
  change: number;
  description?: string;
}

export interface AppliedTraitChange {
  trait: string;
  change: number;
  description: string;
}

const BASE_TRAITS = new Set(getBaseTraitIds());

type MutableTrait = { value: number; subcategories: Record<string, number> };

export function applyDiminishingReturns(currentValue: number, rawChange: number): number {
  if (rawChange <= 0) return rawChange;
  const scaleFactor = Math.max(0.12, 1 - currentValue / 220);
  return Math.max(1, Math.round(rawChange * scaleFactor));
}

function finiteNonNegative(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, raw) : 0;
}

function parseTraitValue(raw: unknown): number {
  if (raw && typeof raw === "object") {
    return finiteNonNegative((raw as { value?: unknown }).value);
  }
  return finiteNonNegative(raw);
}

/** Same subcategory however the AI spelled it: "History", "history", "human body" / "human_body". */
function subcategoryKey(name: string): string {
  return name.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/** The stored key for a subcategory: an existing one wins over a new spelling. */
function resolveSubcategoryKey(existing: Record<string, number>, requested: string): string {
  const wanted = subcategoryKey(requested);
  return Object.keys(existing).find((key) => subcategoryKey(key) === wanted) ?? wanted;
}

function ensureTrait(traits: Record<string, unknown>, traitId: string): MutableTrait {
  const raw = traits[traitId];
  const trait: MutableTrait = {
    value: parseTraitValue(raw),
    subcategories: {},
  };
  const rawSubcategories =
    raw && typeof raw === "object" ? (raw as { subcategories?: unknown }).subcategories : undefined;
  if (rawSubcategories && typeof rawSubcategories === "object") {
    for (const [key, value] of Object.entries(rawSubcategories as Record<string, unknown>)) {
      trait.subcategories[key] = finiteNonNegative(value);
    }
  }
  traits[traitId] = trait;
  return trait;
}

export function mergeDuplicateChanges(changes: TraitChange[]): TraitChange[] {
  const merged = new Map<string, TraitChange>();

  for (const change of changes) {
    if (!change.trait || !Number.isFinite(change.change) || change.change === 0) {
      continue;
    }

    const existing = merged.get(change.trait);
    if (!existing) {
      merged.set(change.trait, { ...change });
      continue;
    }

    existing.change += change.change;
    existing.description = [existing.description, change.description]
      .filter(Boolean)
      .join("; ");
  }

  return Array.from(merged.values());
}

/**
 * Applies trait changes to a copy of `currentTraits` (already upgraded to the
 * hierarchical shape) and reports exactly what was written. A change without
 * its own reason gets `fallbackDescription`.
 */
export function applyTraitChanges(
  currentTraits: PersonalityTraits,
  changes: TraitChange[],
  fallbackDescription: string,
): { updatedTraits: PersonalityTraits; appliedChanges: AppliedTraitChange[] } {
  const updatedTraits = JSON.parse(JSON.stringify(currentTraits)) as PersonalityTraits;
  const traits = updatedTraits as unknown as Record<string, unknown>;
  const appliedChanges: AppliedTraitChange[] = [];

  for (const change of mergeDuplicateChanges(changes)) {
    const description = change.description?.trim() || fallbackDescription;
    const [baseKey, subcategory, ...rest] = change.trait.split(".");
    if (!BASE_TRAITS.has(baseKey) || rest.length > 0) continue;

    if (subcategory !== undefined) {
      if (!subcategory.trim()) continue;
      const base = ensureTrait(traits, baseKey);
      const key = resolveSubcategoryKey(base.subcategories, subcategory);
      const current = base.subcategories[key] ?? 0;
      const next = Math.max(0, Math.min(SUBCATEGORY_MAX_VALUE, current + change.change));
      const actualChange = next - current;
      if (actualChange === 0) continue;

      base.subcategories[key] = next;
      const subcategoryTotal = Object.values(base.subcategories).reduce((sum, value) => sum + value, 0);
      base.value = shiftBaseTraitBySubcategory(baseKey, base.value, actualChange, subcategoryTotal);
      appliedChanges.push({ trait: `${baseKey}.${key}`, change: actualChange, description });
      continue;
    }

    const trait = ensureTrait(traits, baseKey);
    const current = trait.value;
    const effectiveChange = applyDiminishingReturns(current, change.change);
    const next = Math.max(0, Math.min(baseTraitMaxValue(baseKey), current + effectiveChange));
    const actualChange = next - current;
    if (actualChange === 0) continue;

    trait.value = next;
    appliedChanges.push({ trait: baseKey, change: actualChange, description });
  }

  return { updatedTraits, appliedChanges };
}
