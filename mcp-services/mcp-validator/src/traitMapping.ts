/**
 * Trait ID Validation and Normalization
 * Based on your existing traitMapping.ts
 */

const VALID_BASE_TRAITS = [
  'courage',
  'intelligence',
  'creativity',
  'empathy',
  'strength',
  'humor',
  'adventure',
  'patience',
  'curiosity',
  'leadership',
  'teamwork',
] as const;

const VALID_KNOWLEDGE_SUBCATEGORIES = [
  'history',
  'biology',
  'physics',
  'geography',
  'astronomy',
  'mathematics',
  'chemistry',
] as const;

// Legacy/Alternative name mappings
const LEGACY_MAPPING: Record<string, string> = {
  // German names
  mut: 'courage',
  intelligenz: 'intelligence',
  kreativität: 'creativity',
  empathie: 'empathy',
  stärke: 'strength',
  abenteuerlust: 'adventure',
  geduld: 'patience',
  neugier: 'curiosity',
  führungsqualität: 'leadership',
  sozialität: 'teamwork',

  // Alternative English names
  bravery: 'courage',
  brave: 'courage',
  smart: 'intelligence',
  clever: 'intelligence',
  wisdom: 'intelligence',
  imaginative: 'creativity',
  artistic: 'creativity',
  compassion: 'empathy',
  kindness: 'empathy',
  caring: 'empathy',
  physical_strength: 'strength',
  strong: 'strength',
  funny: 'humor',
  wit: 'humor',
  adventurous: 'adventure',
  exploration: 'adventure',
  patient: 'patience',
  calm: 'patience',
  curious: 'curiosity',
  inquisitive: 'curiosity',
  leader: 'leadership',
  leading: 'leadership',

  // Knowledge subcategories (German)
  geschichte: 'knowledge.history',
  biologie: 'knowledge.biology',
  physik: 'knowledge.physics',
  geografie: 'knowledge.geography',
  astronomie: 'knowledge.astronomy',
  mathematik: 'knowledge.mathematics',
  chemie: 'knowledge.chemistry',

  // Knowledge subcategories (English)
  history: 'knowledge.history',
  biology: 'knowledge.biology',
  physics: 'knowledge.physics',
  geography: 'knowledge.geography',
  astronomy: 'knowledge.astronomy',
  mathematics: 'knowledge.mathematics',
  math: 'knowledge.mathematics',
  chemistry: 'knowledge.chemistry',
};

/**
 * Validate and normalize trait ID
 */
export function validateTraitId(traitId: string): string | null {
  const normalized = traitId.toLowerCase().trim();

  // Check if it's a valid base trait
  if (VALID_BASE_TRAITS.includes(normalized as any)) {
    return normalized;
  }

  // Check if it's a valid knowledge subcategory
  const knowledgeMatch = normalized.match(/^knowledge\.(.+)$/);
  if (knowledgeMatch) {
    const subcategory = knowledgeMatch[1];
    if (VALID_KNOWLEDGE_SUBCATEGORIES.includes(subcategory as any)) {
      return normalized;
    }
  }

  // Try legacy mapping
  const mapped = LEGACY_MAPPING[normalized];
  if (mapped) {
    return mapped;
  }

  // Unknown trait
  return null;
}

/**
 * Normalize trait changes array
 */
export function normalizeTraitChanges(
  changes: Array<{ trait: string; change: number }>
): Array<{ trait: string; change: number; originalTrait?: string }> {
  return changes
    .map((change) => {
      const validTrait = validateTraitId(change.trait);

      if (!validTrait) {
        console.warn(`⚠️ Invalid trait ID: ${change.trait}`);
        return null;
      }

      return {
        trait: validTrait,
        change: change.change,
        ...(validTrait !== change.trait && { originalTrait: change.trait }),
      };
    })
    .filter((c): c is { trait: string; change: number; originalTrait?: string } => c !== null);
}

/**
 * Normalize avatar developments from OpenAI response
 */
export function normalizeAvatarDevelopments(developments: any[]): any[] {
  return developments.map((dev) => {
    // Handle both array and object format
    let normalizedChanges: Array<{ trait: string; change: number }> = [];

    if (Array.isArray(dev.changedTraits)) {
      // Array format - normalize directly
      normalizedChanges = normalizeTraitChanges(dev.changedTraits);
    } else if (typeof dev.changedTraits === 'object' && dev.changedTraits) {
      // Object format {trait: {before, after, reason}}
      normalizedChanges = Object.entries(dev.changedTraits)
        .map(([traitName, traitData]: [string, any]) => {
          const validTrait = validateTraitId(traitName);
          if (!validTrait || !traitData || typeof traitData !== 'object') {
            console.warn(`⚠️ Invalid trait format: ${traitName}`);
            return null;
          }

          return {
            trait: validTrait,
            change: traitData.after - traitData.before,
          };
        })
        .filter((c): c is { trait: string; change: number } => c !== null);
    }

    return {
      ...dev,
      changedTraits: normalizedChanges,
    };
  });
}
