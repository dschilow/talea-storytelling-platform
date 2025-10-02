// Utilities für hierarchische Persönlichkeits-Anzeige

export interface TraitDisplayData {
  id: string;
  name: string;
  value: number;
  category: 'base' | 'knowledge' | 'skill' | 'social';
  baseKey?: string;
  subcategory?: string;
  subcategoryName?: string;
  isMainCategory?: boolean;
  children?: TraitDisplayData[];
}

// Hierarchische Gruppierung der Persönlichkeitsmerkmale
export function groupTraitsHierarchically(personalityTraits: Record<string, number>): TraitDisplayData[] {
  const result: TraitDisplayData[] = [];
  const knowledgeSubcategories: TraitDisplayData[] = [];
  
  // Wissens-Hauptkategorie sammeln
  let knowledgeTotal = 0;
  
  Object.entries(personalityTraits).forEach(([key, value]) => {
    if (key.startsWith('knowledge.')) {
      // Wissens-Unterkategorie
      const subcategory = key.split('.')[1];
      const subcategoryName = getSubcategoryDisplayName(subcategory);
      
      knowledgeSubcategories.push({
        id: key,
        name: subcategoryName,
        value,
        category: 'knowledge',
        baseKey: 'knowledge',
        subcategory,
        subcategoryName,
        isMainCategory: false
      });
      
      knowledgeTotal += value;
    } else if (key === 'knowledge') {
      // Basis-Wissen (falls direkt vorhanden)
      knowledgeTotal += value;
    } else {
      // Basis-Merkmal
      const traitName = getTraitDisplayName(key);
      const category = getTraitCategory(key);
      
      result.push({
        id: key,
        name: traitName,
        value,
        category,
        isMainCategory: true
      });
    }
  });
  
  // Wissens-Hauptkategorie hinzufügen (wenn Unterkategorien vorhanden)
  if (knowledgeSubcategories.length > 0) {
    result.push({
      id: 'knowledge',
      name: 'Wissen',
      value: knowledgeTotal,
      category: 'knowledge',
      isMainCategory: true,
      children: knowledgeSubcategories.sort((a, b) => b.value - a.value) // Nach Wert sortieren
    });
  }
  
  // Nach Kategorie und Wert sortieren
  return result.sort((a, b) => {
    // Wissen immer zuerst, dann Basis-Merkmale
    if (a.category === 'knowledge' && b.category !== 'knowledge') return -1;
    if (b.category === 'knowledge' && a.category !== 'knowledge') return 1;
    
    // Innerhalb der Kategorie nach Wert sortieren
    return b.value - a.value;
  });
}

// Deutsche Anzeigenamen für Traits
function getTraitDisplayName(traitId: string): string {
  const displayNames: Record<string, string> = {
    'courage': 'Mut',
    'intelligence': 'Intelligenz',
    'creativity': 'Kreativität',
    'empathy': 'Empathie',
    'strength': 'Stärke',
    'humor': 'Humor',
    'adventure': 'Abenteuerlust',
    'patience': 'Geduld',
    'curiosity': 'Neugier',
    'leadership': 'Führungsqualität',
    'teamwork': 'Teamwork',
    'knowledge': 'Wissen'
  };
  
  return displayNames[traitId] || traitId;
}

// Deutsche Anzeigenamen für Wissens-Unterkategorien
function getSubcategoryDisplayName(subcategory: string): string {
  const subcategoryNames: Record<string, string> = {
    'biology': 'Biologie',
    'history': 'Geschichte',
    'physics': 'Physik',
    'geography': 'Geografie',
    'astronomy': 'Astronomie',
    'mathematics': 'Mathematik',
    'chemistry': 'Chemie'
  };
  
  return subcategoryNames[subcategory] || subcategory;
}

// Kategorie-Zuordnung
function getTraitCategory(traitId: string): 'base' | 'knowledge' | 'skill' | 'social' {
  if (traitId.startsWith('knowledge')) return 'knowledge';
  if (traitId === 'teamwork') return 'social';
  return 'base';
}

// Formatierte Anzeige für Wissens-Hierarchie
export function formatKnowledgeDisplay(knowledgeData: TraitDisplayData): string {
  if (!knowledgeData.children || knowledgeData.children.length === 0) {
    return `${knowledgeData.name}: ${knowledgeData.value}`;
  }
  
  const subcategoryTexts = knowledgeData.children
    .filter(child => child.value > 0)
    .map(child => `${child.name}: ${child.value}`)
    .join(', ');
  
  if (subcategoryTexts) {
    return `${knowledgeData.name}: ${knowledgeData.value} (${subcategoryTexts})`;
  }
  
  return `${knowledgeData.name}: ${knowledgeData.value}`;
}

// Emoji für Kategorien
export function getCategoryEmoji(category: string): string {
  const emojis: Record<string, string> = {
    'base': '⭐',
    'knowledge': '📚',
    'social': '👥',
    'skill': '🛠️'
  };
  
  return emojis[category] || '💫';
}

// Trait-Änderungen formatieren für Memory
export function formatTraitChanges(changes: Array<{trait: string, change: number}>): string {
  return changes
    .map(change => {
      const traitName = getTraitDisplayName(change.trait.split('.')[0]);
      const subcategory = change.trait.includes('.') ? 
        getSubcategoryDisplayName(change.trait.split('.')[1]) : null;
      
      const displayName = subcategory ? `${traitName} (${subcategory})` : traitName;
      const changeText = change.change > 0 ? `+${change.change}` : `${change.change}`;
      
      return `${displayName}: ${changeText}`;
    })
    .join(', ');
}

// Prüfe ob Trait existiert/gültig ist  
export function isValidTraitId(traitId: string): boolean {
  const validTraits = [
    'courage', 'intelligence', 'creativity', 'empathy', 'strength',
    'humor', 'adventure', 'patience', 'curiosity', 'leadership', 'teamwork',
    'knowledge.biology', 'knowledge.history', 'knowledge.physics',
    'knowledge.geography', 'knowledge.astronomy', 'knowledge.mathematics',
    'knowledge.chemistry'
  ];
  
  return validTraits.includes(traitId) || traitId === 'knowledge';
}
