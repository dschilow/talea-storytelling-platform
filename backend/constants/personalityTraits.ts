// EINDEUTIGE PERSÖNLICHKEITS-MERKMAL-DEFINITIONEN
// Diese IDs bleiben konstant für Mehrsprachigkeit
import type { PersonalityTraits } from "../avatar/avatar";

export interface PersonalityTraitDefinition {
  id: string; // Eindeutige ID (unveränderlich)
  category: 'base' | 'knowledge' | 'skill' | 'social';
  baseKey: string; // Basis-Merkmal für Hierarchie
  subcategory?: string; // Optional für knowledge.biology etc.
  defaultValue: number;
  minValue: number;
  maxValue: number;
  displayNames: {
    de: string;
    en: string;
  };
  description: {
    de: string;
    en: string;
  };
}

/**
 * Ceiling for a BASE trait value (the number shown on the trait ring), and the
 * single source of truth for it.
 *
 * There used to be three disagreeing answers: the `maxValue` fields above said
 * 100 for non-knowledge traits, updatePersonality clamped direct changes to
 * 250, and the subcategory rollup (`base.value = max(value, sum(subcategories))`)
 * clamped nothing at all — so the same trait had a different ceiling depending
 * on whether the AI awarded `courage` or `courage.public_speaking`. The mastery
 * tiers in avatar/progression.ts are the tie-breaker: they run to 250 at tier 8
 * with tier 9 open-ended, so 250 is the real rule for non-knowledge traits.
 */
export const BASE_TRAIT_MAX_VALUE = 250;
export const KNOWLEDGE_TRAIT_MAX_VALUE = 1000;
export const SUBCATEGORY_MAX_VALUE = 1000;

export function baseTraitMaxValue(traitId: string): number {
  return isKnowledgeTrait(traitId) ? KNOWLEDGE_TRAIT_MAX_VALUE : BASE_TRAIT_MAX_VALUE;
}

// DIE 9 HAUPTKATEGORIEN - Alle starten bei 0!
export const BASE_PERSONALITY_TRAITS: PersonalityTraitDefinition[] = [
  {
    id: 'knowledge', // 🧠
    category: 'base',
    baseKey: 'knowledge',
    defaultValue: 0,
    minValue: 0,
    maxValue: 1000,
    displayNames: { de: 'Wissen', en: 'Knowledge' },
    description: { de: 'Wissensakkumulation in verschiedenen Bereichen', en: 'Knowledge accumulation in various areas' }
  },
  {
    id: 'creativity', // 🎨
    category: 'base',
    baseKey: 'creativity',
    defaultValue: 0,
    minValue: 0,
    maxValue: BASE_TRAIT_MAX_VALUE,
    displayNames: { de: 'Kreativität', en: 'Creativity' },
    description: { de: 'Kreative Problemlösung und Fantasie', en: 'Creative problem solving and imagination' }
  },
  {
    id: 'vocabulary', // 🔤
    category: 'base',
    baseKey: 'vocabulary',
    defaultValue: 0,
    minValue: 0,
    maxValue: BASE_TRAIT_MAX_VALUE,
    displayNames: { de: 'Wortschatz', en: 'Vocabulary' },
    description: { de: 'Sprachlicher Ausdruck und Kommunikation', en: 'Linguistic expression and communication' }
  },
  {
    id: 'courage', // 🦁
    category: 'base',
    baseKey: 'courage',
    defaultValue: 0,
    minValue: 0,
    maxValue: BASE_TRAIT_MAX_VALUE,
    displayNames: { de: 'Mut', en: 'Courage' },
    description: { de: 'Bereitschaft Risiken einzugehen', en: 'Willingness to take risks' }
  },
  {
    id: 'curiosity', // 🔍
    category: 'base',
    baseKey: 'curiosity',
    defaultValue: 0,
    minValue: 0,
    maxValue: BASE_TRAIT_MAX_VALUE,
    displayNames: { de: 'Neugier', en: 'Curiosity' },
    description: { de: 'Wissensdurst und Entdeckergeist', en: 'Thirst for knowledge and exploration' }
  },
  {
    id: 'teamwork', // 🤝
    category: 'base',
    baseKey: 'teamwork',
    defaultValue: 0,
    minValue: 0,
    maxValue: BASE_TRAIT_MAX_VALUE,
    displayNames: { de: 'Teamgeist', en: 'Teamwork' },
    description: { de: 'Zusammenarbeit und Kooperation', en: 'Collaboration and cooperation' }
  },
  {
    id: 'empathy', // 💗
    category: 'base',
    baseKey: 'empathy',
    defaultValue: 0,
    minValue: 0,
    maxValue: BASE_TRAIT_MAX_VALUE,
    displayNames: { de: 'Empathie', en: 'Empathy' },
    description: { de: 'Mitgefühl und Verständnis für andere', en: 'Compassion and understanding for others' }
  },
  {
    id: 'persistence', // 🧗
    category: 'base',
    baseKey: 'persistence',
    defaultValue: 0,
    minValue: 0,
    maxValue: BASE_TRAIT_MAX_VALUE,
    displayNames: { de: 'Ausdauer', en: 'Persistence' },
    description: { de: 'Durchhaltevermögen und Beharrlichkeit', en: 'Endurance and perseverance' }
  },
  {
    id: 'logic', // 🔢
    category: 'base',
    baseKey: 'logic',
    defaultValue: 0,
    minValue: 0,
    maxValue: BASE_TRAIT_MAX_VALUE,
    displayNames: { de: 'Logik', en: 'Logic' },
    description: { de: 'Analytisches Denken und Schlussfolgerung', en: 'Analytical thinking and reasoning' }
  }
];

// Funktion um Standard-Traits für neue Avatare zu erstellen
export const getDefaultPersonalityTraits = (): PersonalityTraits => {
  return Object.fromEntries(
    BASE_PERSONALITY_TRAITS.map((trait) => [
      trait.id,
      { value: trait.defaultValue, subcategories: {} },
    ])
  ) as PersonalityTraits;
};

// WISSENS-HAUPTKATEGORIE
export const KNOWLEDGE_BASE_TRAIT: PersonalityTraitDefinition = {
  id: 'knowledge',
  category: 'knowledge',
  baseKey: 'knowledge',
  defaultValue: 0,
  minValue: 0,
  maxValue: 1000, // Unbegrenzt für Wissensakkumulation
  displayNames: { de: 'Wissen', en: 'Knowledge' },
  description: { de: 'Gesammeltes Wissen', en: 'Accumulated knowledge' }
};

// WISSENS-UNTERKATEGORIEN (werden dynamisch erstellt)
export const KNOWLEDGE_SUBCATEGORIES: Record<string, PersonalityTraitDefinition> = {
  biology: {
    id: 'knowledge.biology',
    category: 'knowledge',
    baseKey: 'knowledge',
    subcategory: 'biology',
    defaultValue: 0,
    minValue: 0,
    maxValue: 1000,
    displayNames: { de: 'Biologie', en: 'Biology' },
    description: { de: 'Wissen über Lebewesen', en: 'Knowledge about living beings' }
  },
  history: {
    id: 'knowledge.history', 
    category: 'knowledge',
    baseKey: 'knowledge',
    subcategory: 'history',
    defaultValue: 0,
    minValue: 0,
    maxValue: 1000,
    displayNames: { de: 'Geschichte', en: 'History' },
    description: { de: 'Historisches Wissen', en: 'Historical knowledge' }
  },
  physics: {
    id: 'knowledge.physics',
    category: 'knowledge', 
    baseKey: 'knowledge',
    subcategory: 'physics',
    defaultValue: 0,
    minValue: 0,
    maxValue: 1000,
    displayNames: { de: 'Physik', en: 'Physics' },
    description: { de: 'Physikalisches Verständnis', en: 'Physical understanding' }
  },
  geography: {
    id: 'knowledge.geography',
    category: 'knowledge',
    baseKey: 'knowledge', 
    subcategory: 'geography',
    defaultValue: 0,
    minValue: 0,
    maxValue: 1000,
    displayNames: { de: 'Geografie', en: 'Geography' },
    description: { de: 'Geografisches Wissen', en: 'Geographic knowledge' }
  },
  astronomy: {
    id: 'knowledge.astronomy',
    category: 'knowledge',
    baseKey: 'knowledge',
    subcategory: 'astronomy', 
    defaultValue: 0,
    minValue: 0,
    maxValue: 1000,
    displayNames: { de: 'Astronomie', en: 'Astronomy' },
    description: { de: 'Wissen über das Weltall', en: 'Knowledge about space' }
  },
  mathematics: {
    id: 'knowledge.mathematics',
    category: 'knowledge',
    baseKey: 'knowledge',
    subcategory: 'mathematics',
    defaultValue: 0,
    minValue: 0,
    maxValue: 1000,
    displayNames: { de: 'Mathematik', en: 'Mathematics' },
    description: { de: 'Mathematisches Verständnis', en: 'Mathematical understanding' }
  },
  chemistry: {
    id: 'knowledge.chemistry',
    category: 'knowledge',
    baseKey: 'knowledge',
    subcategory: 'chemistry',
    defaultValue: 0,
    minValue: 0,
    maxValue: 1000,
    displayNames: { de: 'Chemie', en: 'Chemistry' },
    description: { de: 'Chemisches Verständnis', en: 'Chemical understanding' }
  }
};

// HILFSFUNKTIONEN
export function getAllTraitDefinitions(): PersonalityTraitDefinition[] {
  return [
    ...BASE_PERSONALITY_TRAITS,
    KNOWLEDGE_BASE_TRAIT,
    ...Object.values(KNOWLEDGE_SUBCATEGORIES)
  ];
}

export function getTraitById(id: string): PersonalityTraitDefinition | null {
  const allTraits = getAllTraitDefinitions();
  return allTraits.find(trait => trait.id === id) || null;
}

export function getBaseTraitIds(): string[] {
  return BASE_PERSONALITY_TRAITS.map(trait => trait.id);
}

export function isKnowledgeTrait(traitId: string): boolean {
  return traitId.startsWith('knowledge');
}


/**
 * Rolls a base trait's value up from its subcategories, respecting the base
 * ceiling. Subcategories individually cap at 1000, so an uncapped sum could
 * push a base trait far past any tier the progression system defines.
 */
export function rollUpBaseTraitValue(
  traitId: string,
  currentValue: number,
  subcategoryTotal: number,
): number {
  const raw = Math.max(currentValue || 0, subcategoryTotal || 0);
  return Math.max(0, Math.min(baseTraitMaxValue(traitId), raw));
}

export function parseKnowledgeTrait(traitId: string): { baseKey: string; subcategory?: string } {
  if (traitId === 'knowledge') {
    return { baseKey: 'knowledge' };
  }
  
  const parts = traitId.split('.');
  if (parts.length === 2 && parts[0] === 'knowledge') {
    return { baseKey: 'knowledge', subcategory: parts[1] };
  }
  
  throw new Error(`Invalid knowledge trait ID: ${traitId}`);
}

// AI-PROMPT KONSTANTEN
export const AI_PERSONALITY_SYSTEM_PROMPT = `
PERSÖNLICHKEITS-UPDATE-SYSTEM:

Du erhältst eine Liste von BASIS-MERKMALEN.
Analysiere die generierte Geschichte und entscheide welche Merkmale sich entwickeln sollen.

BASIS-MERKMALE (ID verwenden, 1-5 Punkte):
${BASE_PERSONALITY_TRAITS.filter(t => t.id !== 'knowledge').map(t => `- ${t.id}: ${t.displayNames.de}`).join('\n')}

WICHTIG: Wissens-Bereiche (knowledge.*) werden NUR durch Doku-Lektüre vergeben, NICHT durch Geschichten!

ANTWORT-FORMAT:
[
  { "name": "Avatar-Name", "changedTraits": [{ "trait": "MERKMAL_ID", "change": PUNKTE }] }
]

REGELN:
- Verwende IMMER die exakten IDs (z.B. "courage", "creativity", "persistence")
- Basis-Merkmale: 1-5 Punkte pro Update
- Nur Merkmale updaten die zur Geschichte passen
- Mitmach-Avatare bekommen mehr Punkte als Lese-Avatare
- NIEMALS knowledge.* Merkmale in Geschichten vergeben
`;
