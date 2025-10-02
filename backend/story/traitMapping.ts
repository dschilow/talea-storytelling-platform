// NEUES SYSTEM: Trait-ID Validierung und Normalisierung
export function validateTraitId(traitId: string): string | null {
  // Import wird zur Laufzeit gemacht um zirkuläre Abhängigkeiten zu vermeiden
  const { getTraitById } = require('../constants/personalityTraits');
  
  // Direkte ID-Übereinstimmung
  const trait = getTraitById(traitId);
  if (trait) {
    return trait.id;
  }
  
  // Fallback: Versuche alte Namen auf neue IDs zu mappen
  const legacyMapping: Record<string, string> = {
    // Deutsche Namen
    'mut': 'courage',
    'intelligenz': 'intelligence', 
    'kreativität': 'creativity',
    'empathie': 'empathy',
    'stärke': 'strength',
    'humor': 'humor',
    'abenteuerlust': 'adventure',
    'geduld': 'patience',
    'neugier': 'curiosity',
    'führungsqualität': 'leadership',
    'sozialität': 'teamwork',
    'teamwork': 'teamwork',
    
    // Englische Namen
    'courage': 'courage',
    'intelligence': 'intelligence',
    'creativity': 'creativity', 
    'empathy': 'empathy',
    'strength': 'strength',
    'adventure': 'adventure',
    'patience': 'patience',
    'curiosity': 'curiosity',
    'leadership': 'leadership',
    'bravery': 'courage',
    'brave': 'courage',
    'smart': 'intelligence',
    'clever': 'intelligence',
    'wisdom': 'intelligence',
    'imaginative': 'creativity',
    'artistic': 'creativity',
    'compassion': 'empathy',
    'kindness': 'empathy',
    'caring': 'empathy',
    'physical_strength': 'strength',
    'strong': 'strength',
    'funny': 'humor',
    'wit': 'humor',
    'adventurous': 'adventure',
    'exploration': 'adventure',
    'patient': 'patience',
    'calm': 'patience',
    'curious': 'curiosity',
    'inquisitive': 'curiosity',
    'leader': 'leadership',
    'leading': 'leadership',
    
    // Wissens-Mappings
    'geschichte': 'knowledge.history',
    'history': 'knowledge.history',
    'biologie': 'knowledge.biology',
    'biology': 'knowledge.biology',
    'physik': 'knowledge.physics',
    'physics': 'knowledge.physics',
    'geografie': 'knowledge.geography',
    'geography': 'knowledge.geography',
    'astronomie': 'knowledge.astronomy',
    'astronomy': 'knowledge.astronomy',
    'mathematik': 'knowledge.mathematics',
    'mathematics': 'knowledge.mathematics',
    'math': 'knowledge.mathematics',
    'chemie': 'knowledge.chemistry',
    'chemistry': 'knowledge.chemistry',
  };
  
  const normalizedId = legacyMapping[traitId.toLowerCase()];
  if (normalizedId && getTraitById(normalizedId)) {
    return normalizedId;
  }
  
  console.warn(`⚠️ Unknown trait ID: ${traitId}`);
  return null;
}

// VERALTETES MAPPING - NUR FÜR BACKWARDS COMPATIBILITY
export const mapEnglishTraitToPersonalityKey = (englishTrait: string): string | null => {
  console.warn('⚠️ Using deprecated mapEnglishTraitToPersonalityKey - switch to validateTraitId!');
  return validateTraitId(englishTrait);
};

// Convert avatar developments using new trait ID system
export const convertAvatarDevelopmentsToPersonalityChanges = (developments: any[]) => {
  return developments.map(development => {
    let convertedChanges: any[] = [];

    if (development.changedTraits) {
      // Handle both object and array formats
      if (Array.isArray(development.changedTraits)) {
        // Array format mit neuen Trait-IDs
        convertedChanges = development.changedTraits
          .map((change: any) => {
            const validTraitId = validateTraitId(change.trait);
            if (validTraitId) {
              return {
                trait: validTraitId,
                change: change.change
              };
            }
            console.warn(`⚠️ Could not validate trait ID "${change.trait}"`);
            return null;
          })
          .filter(Boolean);
      } else if (typeof development.changedTraits === 'object') {
        // Object format - convert to array mit neuen IDs
        convertedChanges = Object.entries(development.changedTraits)
          .map(([traitName, traitData]: [string, any]) => {
            const validTraitId = validateTraitId(traitName);
            if (validTraitId && traitData && typeof traitData === 'object') {
              return {
                trait: validTraitId,
                change: traitData.after - traitData.before
              };
            }
            console.warn(`⚠️ Could not validate trait ID "${traitName}" or invalid data format`);
            return null;
          })
          .filter(Boolean);
      }
    }

    return {
      ...development,
      changedTraits: convertedChanges
    };
  });
};