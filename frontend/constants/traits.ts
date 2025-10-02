// Dynamic trait system with 9 main categories and AI-generated subcategories
export interface TraitCategory {
  id: string;
  icon: string;
  parentId?: string;
  labels: {
    de: string;
    en: string;
    ru: string;
  };
  subcategories?: TraitCategory[];
}

export interface TraitValue {
  traitId: string;
  value: number;
  subcategory?: string; // Dynamic subcategory created by AI
  reason?: string; // Reason/description for the points
  history?: Array<{
    timestamp: string;
    oldValue: number;
    newValue: number;
    reason: string;
    storyId?: string;
    subcategory?: string;
  }>;
}

// Base 9 main trait categories (subcategories are created dynamically by AI)
export const TRAIT_CATEGORIES: TraitCategory[] = [
  {
    id: 'knowledge',
    icon: '🧠',
    labels: {
      de: 'Wissen',
      en: 'Knowledge',
      ru: 'Знания'
    }
  },
  {
    id: 'creativity',
    icon: '🎨',
    labels: {
      de: 'Kreativität',
      en: 'Creativity',
      ru: 'Креативность'
    }
  },
  {
    id: 'vocabulary',
    icon: '🔤',
    labels: {
      de: 'Wortschatz',
      en: 'Vocabulary',
      ru: 'Словарный запас'
    }
  },
  {
    id: 'courage',
    icon: '🦁',
    labels: {
      de: 'Mut',
      en: 'Courage',
      ru: 'Смелость'
    }
  },
  {
    id: 'curiosity',
    icon: '🔍',
    labels: {
      de: 'Neugier',
      en: 'Curiosity',
      ru: 'Любопытство'
    }
  },
  {
    id: 'teamwork',
    icon: '🤝',
    labels: {
      de: 'Teamgeist',
      en: 'Teamwork',
      ru: 'Командный дух'
    }
  },
  {
    id: 'empathy',
    icon: '💗',
    labels: {
      de: 'Empathie',
      en: 'Empathy',
      ru: 'Эмпатия'
    }
  },
  {
    id: 'persistence',
    icon: '🧗',
    labels: {
      de: 'Ausdauer',
      en: 'Persistence',
      ru: 'Выносливость'
    }
  },
  {
    id: 'logic',
    icon: '🔢',
    labels: {
      de: 'Logik',
      en: 'Logic',
      ru: 'Логика'
    }
  }
];

// Helper functions
export const getTraitLabel = (traitId: string, language: 'de' | 'en' | 'ru' = 'de'): string => {
  const category = TRAIT_CATEGORIES.find(cat => cat.id === traitId);
  return category ? category.labels[language] : traitId;
};

export const getTraitIcon = (traitId: string): string => {
  const category = TRAIT_CATEGORIES.find(cat => cat.id === traitId);
  return category ? category.icon : '🔹';
};

// Get subcategory icon based on name (AI can suggest these)
export const getSubcategoryIcon = (subcategoryName: string): string => {
  const iconMap: Record<string, string> = {
    // Knowledge subcategories
    'physik': '⚡', 'physics': '⚡',
    'biologie': '🌱', 'biology': '🌱',
    'geschichte': '🏛️', 'history': '🏛️',
    'geografie': '🌍', 'geography': '🌍',
    'astronomie': '🌟', 'astronomy': '🌟',
    'mathematik': '🔢', 'mathematics': '🔢',
    'chemie': '🧪', 'chemistry': '🧪',

    // Creativity subcategories
    'malen': '🖌️', 'painting': '🖌️',
    'musik': '🎵', 'music': '🎵',
    'geschichten': '📝', 'storytelling': '📝',
    'basteln': '✂️', 'crafting': '✂️',

    // Vocabulary subcategories
    'deutsch': '🇩🇪', 'german': '🇩🇪',
    'englisch': '🇬🇧', 'english': '🇬🇧',
    'französisch': '🇫🇷', 'french': '🇫🇷',
    'fachbegriffe': '📚', 'technical': '📚',
  };

  const normalizedName = subcategoryName.toLowerCase();
  return iconMap[normalizedName] || '📌';
};

// AI Prompt template for trait updates
export const AI_TRAIT_PROMPT = `
Du bewertest Persönlichkeitsentwicklung basierend auf folgenden 9 Hauptkategorien:

1. Wissen 🧠 - Fakten, Wissenschaft, Bildung
2. Kreativität 🎨 - Künstlerischer Ausdruck, Imagination
3. Wortschatz 🔤 - Sprache, Kommunikation, Begriffe
4. Mut 🦁 - Tapferkeit, Risikobereitschaft, Selbstvertrauen
5. Neugier 🔍 - Interesse, Entdeckerdrang, Fragen stellen
6. Teamgeist 🤝 - Zusammenarbeit, Hilfsbereitschaft, Gemeinschaft
7. Empathie 💗 - Gefühle verstehen, Mitgefühl, Sozialkompetenz
8. Ausdauer 🧗 - Durchhaltevermögen, Geduld, Beständigkeit
9. Logik 🔢 - Problemlösung, Reasoning, analytisches Denken

IMPORTANT: Für jede Kategorie kannst du optional eine Unterkategorie erstellen, wenn der Inhalt spezifisch genug ist (z.B. "Biologie" unter Wissen, "Malen" unter Kreativität). Wenn nicht spezifisch genug, verwende nur die Hauptkategorie.

Antworte im Format:
{
  "traitUpdates": [
    {
      "mainCategory": "knowledge",
      "subcategory": "biologie", // optional, nur wenn spezifisch
      "points": 3,
      "reason": "Lernte über Meerestiere und ihre Lebensräume"
    }
  ]
}
`;

// Convert old German trait names to new main categories
export const convertGermanTraitToMainCategory = (germanName: string): string => {
  const mapping: Record<string, string> = {
    'Mut': 'courage',
    'Kreativität': 'creativity',
    'Empathie': 'empathy',
    'Intelligenz': 'knowledge',
    'Sozialität': 'teamwork',
    'Energie': 'persistence',
    'Neugier': 'curiosity',
    'Logik': 'logic',
    'Wortschatz': 'vocabulary'
  };
  return mapping[germanName] || germanName.toLowerCase();
};

// Get proper label for subcategories
export const getSubcategoryLabel = (subcategory: string, language: 'de' | 'en' | 'ru'): string => {
  const knowledgeSubcategoryLabels: Record<string, { de: string; en: string; ru: string }> = {
    'biology': { de: 'Biologie', en: 'Biology', ru: 'Биология' },
    'history': { de: 'Geschichte', en: 'History', ru: 'История' },
    'physics': { de: 'Physik', en: 'Physics', ru: 'Физика' },
    'geography': { de: 'Geographie', en: 'Geography', ru: 'География' },
    'astronomy': { de: 'Astronomie', en: 'Astronomy', ru: 'Астрономия' },
    'mathematics': { de: 'Mathematik', en: 'Mathematics', ru: 'Математика' },
    'chemistry': { de: 'Chemie', en: 'Chemistry', ru: 'Химия' }
  };

  return knowledgeSubcategoryLabels[subcategory]?.[language] ||
         subcategory.charAt(0).toUpperCase() + subcategory.slice(1);
};

// Convert backend PersonalityTraits object to frontend TraitValue array
export const convertBackendTraitsToFrontend = (personalityTraits: any): TraitValue[] => {
  console.log('🔄 convertBackendTraitsToFrontend - input:', personalityTraits);

  const traitValues: TraitValue[] = [];

  // First, add all main categories (always show them, even if 0)
  const mainCategories = ['knowledge', 'creativity', 'vocabulary', 'courage', 'curiosity', 'teamwork', 'empathy', 'persistence', 'logic'];

  mainCategories.forEach(categoryId => {
    if (personalityTraits[categoryId]) {
      const traitData = personalityTraits[categoryId];

      if (typeof traitData === 'object' && traitData !== null) {
        // New hierarchical format: { value: number, subcategories: {...} }
        let mainValue = traitData.value || 0;
        let totalSubcategoryValue = 0;

        // Add subcategories if they exist (show all, not just non-zero)
        if (traitData.subcategories) {
          console.log(`📚 Found subcategories for ${categoryId}:`, traitData.subcategories);
          Object.entries(traitData.subcategories).forEach(([subcategory, subcatValue]: [string, any]) => {
            const value = Number(subcatValue) || 0;
            totalSubcategoryValue += value;
            console.log(`  📌 Adding subcategory: ${categoryId}.${subcategory} = ${value}`);
            traitValues.push({
              traitId: categoryId,
              subcategory: subcategory,
              value: value,
              reason: value > 0 ? `${getSubcategoryLabel(subcategory, 'de')}: ${value} Punkte` : `Noch keine Punkte in ${getSubcategoryLabel(subcategory, 'de')}`
            });
          });
        } else {
          console.log(`📚 No subcategories found for ${categoryId}`);
        }

        // Main category shows the stored value (which should be the sum of subcategories)
        // But we ensure consistency by using the backend's stored value
        traitValues.push({
          traitId: categoryId,
          value: mainValue,
          reason: mainValue > 0 ? `Gesamt ${getTraitLabel(categoryId, 'de')}: ${mainValue} Punkte` : `Noch keine ${getTraitLabel(categoryId, 'de')} entwickelt`
        });
      } else {
        // Legacy number format
        const value = Number(traitData) || 0;
        traitValues.push({
          traitId: categoryId,
          value: value,
          reason: ''
        });
      }
    } else {
      // Category doesn't exist in backend, add with value 0
      traitValues.push({
        traitId: categoryId,
        value: 0,
        reason: ''
      });
    }
  });

  return traitValues;
};

// Legacy function - kept for compatibility
export const normalizeTraitValues = (traitValues: TraitValue[]): TraitValue[] => {
  return traitValues.map(trait => {
    // Check if traitId contains a dot (e.g., "knowledge.history")
    if (trait.traitId.includes('.')) {
      const [mainCategory, subcategory] = trait.traitId.split('.');
      return {
        ...trait,
        traitId: mainCategory,
        subcategory: subcategory
      };
    }
    return trait;
  });
};

// Build dynamic categories from trait values (including AI-generated subcategories)
export const buildDynamicCategories = (traitValues: TraitValue[]): TraitCategory[] => {
  // First normalize trait values to handle backend format (knowledge.history -> traitId: knowledge, subcategory: history)
  const normalizedTraits = normalizeTraitValues(traitValues);

  const dynamicCategories = TRAIT_CATEGORIES.map(mainCat => ({
    ...mainCat,
    subcategories: [] as TraitCategory[]
  }));

  // Add subcategories based on actual trait data
  normalizedTraits.forEach(trait => {
    if (trait.subcategory) {
      const mainCat = dynamicCategories.find(cat => cat.id === trait.traitId);
      if (mainCat && !mainCat.subcategories?.find(sub => sub.id === trait.subcategory)) {
        mainCat.subcategories = mainCat.subcategories || [];
        mainCat.subcategories.push({
          id: trait.subcategory,
          parentId: trait.traitId,
          icon: getSubcategoryIcon(trait.subcategory),
          labels: {
            de: getSubcategoryLabel(trait.subcategory, 'de'),
            en: getSubcategoryLabel(trait.subcategory, 'en'),
            ru: getSubcategoryLabel(trait.subcategory, 'ru')
          }
        });
      }
    }
  });

  return dynamicCategories;
};

// Content type to trait mapping for stories and dokus (for UI display purposes)
export const STORY_TRAIT_MAPPING = {
  'adventure': ['courage', 'persistence'],
  'mystery': ['logic', 'curiosity'],
  'fantasy': ['creativity', 'curiosity'],
  'friendship': ['empathy', 'teamwork'],
  'learning': ['knowledge', 'curiosity'],
  'comedy': ['creativity', 'empathy']
};

export const DOKU_TRAIT_MAPPING = {
  'animals': ['knowledge'],
  'science': ['knowledge', 'logic'],
  'history': ['knowledge', 'curiosity'],
  'nature': ['knowledge', 'curiosity'],
  'technology': ['knowledge', 'logic'],
  'art': ['creativity', 'knowledge']
};

export const getTraitsForStory = (storyType: string): string[] => {
  return STORY_TRAIT_MAPPING[storyType as keyof typeof STORY_TRAIT_MAPPING] || ['curiosity'];
};

export const getTraitsForDoku = (dokuType: string): string[] => {
  return DOKU_TRAIT_MAPPING[dokuType as keyof typeof DOKU_TRAIT_MAPPING] || ['knowledge'];
};