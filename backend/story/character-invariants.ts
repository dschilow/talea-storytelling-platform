/**
 * Character Invariants System v1.0
 * ================================
 *
 * Professional-grade character consistency system for image generation.
 * Ensures distinctive features (tooth gaps, scars, accessories) remain
 * consistent across all story images.
 *
 * CRITICAL: This system solves the Adrian tooth gap inconsistency issue.
 *
 * Architecture by: Senior Software Developer Team + Prompt Engineers
 */

import type { AvatarVisualProfile } from "../avatar/avatar";

/**
 * Invariant Feature - A feature that MUST appear consistently across all images
 */
export interface InvariantFeature {
  /** Unique identifier for the feature */
  id: string;
  /** Category of the feature */
  category: 'facial' | 'body' | 'accessory' | 'clothing' | 'distinctive';
  /** English description for image prompts */
  promptDescription: string;
  /** Short token for MUST INCLUDE list */
  mustIncludeToken: string;
  /** What happens if this feature is missing */
  forbiddenAlternative?: string;
  /** Priority level (1 = highest, 3 = lowest) */
  priority: 1 | 2 | 3;
  /** German label for UI display */
  labelDe?: string;
}

/**
 * Character Invariants Profile
 * Contains all invariant features for consistent image generation
 */
export interface CharacterInvariants {
  /** Character name */
  name: string;
  /** Character type (human, animal, fantasy) */
  characterType: 'human' | 'animal' | 'fantasy';
  /** Explicit age in years */
  ageNumeric?: number;
  /** Explicit height in cm */
  heightCm?: number;
  /** Features that MUST appear in every image */
  mustIncludeFeatures: InvariantFeature[];
  /** Features that MUST NEVER appear */
  forbiddenFeatures: string[];
  /** Hair color - locked for consistency */
  lockedHairColor?: string;
  /** Eye color - locked for consistency */
  lockedEyeColor?: string;
  /** Skin tone - locked for consistency */
  lockedSkinTone?: string;
  /** Signature clothing item */
  signatureClothing?: string;
  /** Gender for pronoun consistency */
  gender?: 'male' | 'female' | 'neutral';
}

/**
 * Common invariant feature templates
 * Used for quick selection in avatar creation
 */
export const COMMON_INVARIANT_FEATURES: Record<string, Omit<InvariantFeature, 'id'>> = {
  // Facial Features
  'tooth_gap': {
    category: 'facial',
    promptDescription: 'prominent gap between front teeth, visible when smiling',
    mustIncludeToken: 'large tooth gap in front teeth',
    forbiddenAlternative: 'complete teeth, no gap',
    priority: 1,
    labelDe: 'Zahnlücke vorne'
  },
  'freckles': {
    category: 'facial',
    promptDescription: 'scattered freckles across nose and cheeks',
    mustIncludeToken: 'freckles on face',
    priority: 2,
    labelDe: 'Sommersprossen'
  },
  'dimples': {
    category: 'facial',
    promptDescription: 'cute dimples on cheeks when smiling',
    mustIncludeToken: 'dimples on cheeks',
    priority: 2,
    labelDe: 'Grübchen'
  },
  'prominent_ears': {
    category: 'facial',
    promptDescription: 'noticeably protruding ears, standing out from head',
    mustIncludeToken: 'prominent protruding ears',
    forbiddenAlternative: 'flat ears against head',
    priority: 1,
    labelDe: 'Abstehende Ohren'
  },
  'round_glasses': {
    category: 'accessory',
    promptDescription: 'round-framed glasses',
    mustIncludeToken: 'round glasses',
    priority: 1,
    labelDe: 'Runde Brille'
  },
  'square_glasses': {
    category: 'accessory',
    promptDescription: 'square-framed glasses',
    mustIncludeToken: 'square glasses',
    priority: 1,
    labelDe: 'Eckige Brille'
  },
  'birthmark_cheek': {
    category: 'facial',
    promptDescription: 'small birthmark on cheek',
    mustIncludeToken: 'birthmark on cheek',
    priority: 2,
    labelDe: 'Muttermal auf Wange'
  },
  'scar_forehead': {
    category: 'facial',
    promptDescription: 'small scar on forehead',
    mustIncludeToken: 'small scar on forehead',
    priority: 1,
    labelDe: 'Narbe auf Stirn'
  },

  // Body Features
  'tall_for_age': {
    category: 'body',
    promptDescription: 'notably tall for their age',
    mustIncludeToken: 'tall child',
    forbiddenAlternative: 'short child',
    priority: 2,
    labelDe: 'Groß für sein Alter'
  },
  'short_for_age': {
    category: 'body',
    promptDescription: 'notably short for their age',
    mustIncludeToken: 'short child',
    forbiddenAlternative: 'tall child',
    priority: 2,
    labelDe: 'Klein für sein Alter'
  },
  'chubby': {
    category: 'body',
    promptDescription: 'chubby, rounded body shape',
    mustIncludeToken: 'chubby child',
    forbiddenAlternative: 'thin child',
    priority: 2,
    labelDe: 'Rundlich'
  },
  'slim': {
    category: 'body',
    promptDescription: 'slim, slender body shape',
    mustIncludeToken: 'slim child',
    forbiddenAlternative: 'chubby child',
    priority: 2,
    labelDe: 'Schlank'
  },

  // Distinctive Items
  'red_cap': {
    category: 'accessory',
    promptDescription: 'always wears a red cap',
    mustIncludeToken: 'red cap on head',
    priority: 1,
    labelDe: 'Rote Mütze'
  },
  'blue_scarf': {
    category: 'accessory',
    promptDescription: 'always wears a blue scarf',
    mustIncludeToken: 'blue scarf around neck',
    priority: 1,
    labelDe: 'Blauer Schal'
  },
  'friendship_bracelet': {
    category: 'accessory',
    promptDescription: 'colorful friendship bracelet on wrist',
    mustIncludeToken: 'friendship bracelet on wrist',
    priority: 2,
    labelDe: 'Freundschaftsarmband'
  },
  'bandaid_knee': {
    category: 'accessory',
    promptDescription: 'band-aid on knee',
    mustIncludeToken: 'bandaid on knee',
    priority: 3,
    labelDe: 'Pflaster am Knie'
  }
};

/**
 * German to English translation map for common visual features
 * Used for automatic invariant extraction from ANY user description
 */
const GERMAN_TO_ENGLISH_FEATURES: Record<string, string> = {
  // Facial features
  'zahnlücke': 'tooth gap',
  'abstehende ohren': 'protruding ears',
  'sommersprossen': 'freckles',
  'grübchen': 'dimples',
  'muttermal': 'birthmark',
  'narbe': 'scar',
  'stupsnase': 'button nose',
  'große nase': 'large nose',
  'kleine nase': 'small nose',
  'spitze nase': 'pointed nose',
  'pausbacken': 'chubby cheeks',
  'hohe stirn': 'high forehead',
  'breites lächeln': 'wide smile',
  'schiefe zähne': 'crooked teeth',
  'große augen': 'large eyes',
  'kleine augen': 'small eyes',
  'mandelförmige augen': 'almond-shaped eyes',
  'buschige augenbrauen': 'bushy eyebrows',
  'dünne augenbrauen': 'thin eyebrows',
  'doppelkinn': 'double chin',
  'spitzes kinn': 'pointed chin',
  'rundes gesicht': 'round face',
  'ovales gesicht': 'oval face',
  'eckiges gesicht': 'square face',
  'herzförmiges gesicht': 'heart-shaped face',

  // Hair features
  'lockige haare': 'curly hair',
  'glatte haare': 'straight hair',
  'wellige haare': 'wavy hair',
  'kurze haare': 'short hair',
  'lange haare': 'long hair',
  'zöpfe': 'braids',
  'pferdeschwanz': 'ponytail',
  'dutt': 'bun hairstyle',
  'pony': 'bangs',
  'seitenscheitel': 'side part',
  'mittelscheitel': 'center part',
  'struppige haare': 'messy hair',
  'strubbelige haare': 'tousled hair',
  'glatze': 'bald head',
  'geheimratsecken': 'receding hairline',

  // Accessories
  'brille': 'glasses',
  'runde brille': 'round glasses',
  'eckige brille': 'square glasses',
  'sonnenbrille': 'sunglasses',
  'hut': 'hat',
  'mütze': 'cap',
  'stirnband': 'headband',
  'haarband': 'hair band',
  'haarspange': 'hair clip',
  'schleife': 'bow',
  'haarschleife': 'hair bow',
  'ohrring': 'earring',
  'ohrringe': 'earrings',
  'halskette': 'necklace',
  'armband': 'bracelet',
  'uhr': 'watch',
  'schal': 'scarf',
  'krone': 'crown',
  'diadem': 'tiara',

  // Body features
  'klein': 'short stature',
  'groß': 'tall stature',
  'dünn': 'slim build',
  'schlank': 'slender build',
  'kräftig': 'sturdy build',
  'rundlich': 'chubby build',
  'muskulös': 'muscular build',
  'sportlich': 'athletic build',

  // Clothing
  'kleid': 'dress',
  'rock': 'skirt',
  'hose': 'pants',
  'jeans': 'jeans',
  'shorts': 'shorts',
  't-shirt': 't-shirt',
  'pullover': 'sweater',
  'jacke': 'jacket',
  'mantel': 'coat',
  'hoodie': 'hoodie',
  'hemd': 'shirt',
  'bluse': 'blouse',
  'weste': 'vest',
  'overall': 'overalls',
  'latzhose': 'dungarees',
  'schnürschuhe': 'lace-up shoes',
  'turnschuhe': 'sneakers',
  'stiefel': 'boots',
  'sandalen': 'sandals',
  'gummistiefel': 'rain boots',

  // Colors (for compound features)
  'rot': 'red',
  'blau': 'blue',
  'grün': 'green',
  'gelb': 'yellow',
  'orange': 'orange',
  'lila': 'purple',
  'pink': 'pink',
  'rosa': 'pink',
  'braun': 'brown',
  'schwarz': 'black',
  'weiß': 'white',
  'grau': 'gray',
  'gold': 'golden',
  'silber': 'silver',
};

/**
 * Extracts invariant features from avatar description text
 * FULLY GENERIC: Works with ANY user-provided description in German or English
 *
 * @param description Free-text description of the avatar
 * @returns Array of detected invariant features
 */
export function extractInvariantsFromDescription(description: string): InvariantFeature[] {
  const invariants: InvariantFeature[] = [];
  const descLower = description.toLowerCase();
  const timestamp = Date.now();

  // ===== PHASE 1: Check for KNOWN invariant features (high confidence) =====

  // Tooth gap detection (German & English)
  if (descLower.includes('zahnlücke') || descLower.includes('tooth gap') || descLower.includes('gap in teeth')) {
    invariants.push({
      id: 'tooth_gap_' + timestamp,
      ...COMMON_INVARIANT_FEATURES['tooth_gap']
    });
  }

  // Protruding ears detection
  if (descLower.includes('abstehende ohren') || descLower.includes('protruding ears') || descLower.includes('sticking out ears')) {
    invariants.push({
      id: 'prominent_ears_' + timestamp,
      ...COMMON_INVARIANT_FEATURES['prominent_ears']
    });
  }

  // Freckles detection
  if (descLower.includes('sommersprossen') || descLower.includes('freckles')) {
    invariants.push({
      id: 'freckles_' + timestamp,
      ...COMMON_INVARIANT_FEATURES['freckles']
    });
  }

  // Glasses detection
  if (descLower.includes('brille') || descLower.includes('glasses')) {
    const isRound = descLower.includes('rund') || descLower.includes('round');
    const featureKey = isRound ? 'round_glasses' : 'square_glasses';
    invariants.push({
      id: featureKey + '_' + timestamp,
      ...COMMON_INVARIANT_FEATURES[featureKey]
    });
  }

  // Dimples detection
  if (descLower.includes('grübchen') || descLower.includes('dimples')) {
    invariants.push({
      id: 'dimples_' + timestamp,
      ...COMMON_INVARIANT_FEATURES['dimples']
    });
  }

  // Height detection
  if (descLower.includes('sehr groß') || descLower.includes('very tall') || descLower.includes('tall for')) {
    invariants.push({
      id: 'tall_for_age_' + timestamp,
      ...COMMON_INVARIANT_FEATURES['tall_for_age']
    });
  }

  if (descLower.includes('sehr klein') || descLower.includes('very short') || descLower.includes('short for')) {
    invariants.push({
      id: 'short_for_age_' + timestamp,
      ...COMMON_INVARIANT_FEATURES['short_for_age']
    });
  }

  // ===== PHASE 2: Extract ANY visual feature from description (GENERIC) =====
  // This catches ALL user-provided features, even unique ones

  // Translate German features to English
  let englishDescription = descLower;
  for (const [german, english] of Object.entries(GERMAN_TO_ENGLISH_FEATURES)) {
    englishDescription = englishDescription.replace(new RegExp(german, 'gi'), english);
  }

  // Extract feature phrases using pattern matching
  // Look for adjective + noun patterns that describe visual features
  const featurePatterns = [
    // Color + feature patterns
    /\b(red|blue|green|yellow|orange|purple|pink|brown|black|white|gray|golden|silver)\s+(hair|eyes|glasses|cap|hat|scarf|dress|shirt|bow|ribbon|band|shoes|boots)\b/gi,
    // Adjective + body part patterns
    /\b(large|small|big|little|wide|narrow|long|short|curly|straight|wavy|thick|thin|bushy|pointed|round|oval|square)\s+(eyes|nose|ears|mouth|chin|forehead|cheeks|eyebrows|lips|face|hair)\b/gi,
    // Distinctive features
    /\b(scar|birthmark|mole|freckles|dimples|wrinkles|tattoo)\s*(on|near|above|below)?\s*(the)?\s*(face|cheek|forehead|chin|nose|eye|arm|hand)?\b/gi,
    // Accessories
    /\b(wearing|with|has)\s+(a\s+)?(glasses|hat|cap|scarf|bow|ribbon|headband|earrings?|necklace|bracelet|watch|crown|tiara)\b/gi,
    // Hair styles
    /\b(braids?|ponytail|bun|bangs|pigtails|mohawk|afro|dreadlocks|cornrows)\b/gi,
    // Clothing items with colors
    /\b(striped|polka[- ]?dot|checkered|plaid|floral)\s+(shirt|dress|skirt|pants|sweater)\b/gi,
  ];

  const extractedFeatures = new Set<string>();

  for (const pattern of featurePatterns) {
    const matches = englishDescription.matchAll(pattern);
    for (const match of matches) {
      const feature = match[0].trim().toLowerCase();
      // Skip if already added as a known invariant
      if (!invariants.some(inv => inv.mustIncludeToken.toLowerCase().includes(feature))) {
        extractedFeatures.add(feature);
      }
    }
  }

  // Convert extracted features to invariants
  for (const feature of extractedFeatures) {
    // Determine category based on keywords
    let category: InvariantFeature['category'] = 'distinctive';
    if (feature.includes('hair') || feature.includes('braid') || feature.includes('ponytail') || feature.includes('bun') || feature.includes('bangs')) {
      category = 'facial'; // Hair is part of face for image gen
    } else if (feature.includes('eyes') || feature.includes('nose') || feature.includes('ear') || feature.includes('mouth') || feature.includes('face') || feature.includes('cheek') || feature.includes('chin')) {
      category = 'facial';
    } else if (feature.includes('glasses') || feature.includes('hat') || feature.includes('cap') || feature.includes('scarf') || feature.includes('earring') || feature.includes('necklace') || feature.includes('crown')) {
      category = 'accessory';
    } else if (feature.includes('shirt') || feature.includes('dress') || feature.includes('pants') || feature.includes('skirt') || feature.includes('shoes') || feature.includes('boots')) {
      category = 'clothing';
    }

    // Determine priority based on distinctiveness
    let priority: 1 | 2 | 3 = 2; // Default medium
    if (feature.includes('scar') || feature.includes('birthmark') || feature.includes('glasses') || feature.includes('crown') || feature.includes('tiara')) {
      priority = 1; // Very distinctive
    } else if (feature.includes('shirt') || feature.includes('pants') || feature.includes('normal')) {
      priority = 3; // Less distinctive
    }

    invariants.push({
      id: `extracted_${feature.replace(/\s+/g, '_')}_${timestamp}`,
      category,
      promptDescription: feature,
      mustIncludeToken: feature,
      priority,
      labelDe: feature // Keep English for now, could translate back
    });
  }

  // ===== PHASE 3: Extract raw distinctive phrases =====
  // Catch anything that looks like a distinctive physical description

  // Look for "has/with/wearing" + description patterns
  const rawPatterns = [
    /(?:has|with|wearing|trägt|hat)\s+(?:a\s+)?([^,\.]+(?:hair|eyes|nose|ears?|face|glasses|hat|cap|scarf|dress|shirt|bow|scar|birthmark|freckles|dimples))/gi,
    /(?:große?|kleine?|lange?|kurze?|runde?|spitze?)\s+(\w+)/gi, // German adjective patterns
  ];

  for (const pattern of rawPatterns) {
    const matches = descLower.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        let feature = match[1].trim();
        // Translate if German
        for (const [german, english] of Object.entries(GERMAN_TO_ENGLISH_FEATURES)) {
          feature = feature.replace(new RegExp(german, 'gi'), english);
        }

        // Skip if too generic or already captured
        if (feature.length > 3 &&
            !extractedFeatures.has(feature) &&
            !invariants.some(inv => inv.mustIncludeToken.toLowerCase().includes(feature.toLowerCase()))) {
          invariants.push({
            id: `raw_${feature.replace(/\s+/g, '_')}_${timestamp}`,
            category: 'distinctive',
            promptDescription: feature,
            mustIncludeToken: feature,
            priority: 2,
            labelDe: feature
          });
        }
      }
    }
  }

  console.log(`[character-invariants] Extracted ${invariants.length} invariants from description:`,
    invariants.map(i => i.mustIncludeToken).slice(0, 5));

  return invariants;
}

/**
 * Builds CharacterInvariants from visual profile
 */
export function buildInvariantsFromVisualProfile(
  name: string,
  visualProfile: AvatarVisualProfile,
  description?: string
): CharacterInvariants {
  const invariants: CharacterInvariants = {
    name,
    characterType: 'human', // Default, can be overridden
    ageNumeric: (visualProfile as any).ageNumeric,
    heightCm: (visualProfile as any).heightCm,
    mustIncludeFeatures: [],
    forbiddenFeatures: [],
    lockedHairColor: visualProfile.hair?.color,
    lockedEyeColor: visualProfile.eyes?.color,
    lockedSkinTone: visualProfile.skin?.tone,
    signatureClothing: visualProfile.clothingCanonical?.outfit ||
                       visualProfile.clothingCanonical?.top || undefined,
    gender: visualProfile.gender as any
  };

  // Extract from description if provided
  if (description) {
    invariants.mustIncludeFeatures = extractInvariantsFromDescription(description);
  }

  // Extract from visual profile distinctive features
  if (visualProfile.skin?.distinctiveFeatures) {
    for (const feature of visualProfile.skin.distinctiveFeatures) {
      const featureLower = feature.toLowerCase();

      if (featureLower.includes('freckles') || featureLower.includes('sommersprossen')) {
        invariants.mustIncludeFeatures.push({
          id: 'freckles_vp',
          ...COMMON_INVARIANT_FEATURES['freckles']
        });
      }

      if (featureLower.includes('birthmark') || featureLower.includes('muttermal')) {
        invariants.mustIncludeFeatures.push({
          id: 'birthmark_vp',
          ...COMMON_INVARIANT_FEATURES['birthmark_cheek']
        });
      }
    }
  }

  // Extract from face features
  if (visualProfile.face?.otherFeatures) {
    for (const feature of visualProfile.face.otherFeatures) {
      const featureLower = feature.toLowerCase();

      if (featureLower.includes('tooth gap') || featureLower.includes('zahnlücke')) {
        invariants.mustIncludeFeatures.push({
          id: 'tooth_gap_face',
          ...COMMON_INVARIANT_FEATURES['tooth_gap']
        });
      }

      if (featureLower.includes('dimple') || featureLower.includes('grübchen')) {
        invariants.mustIncludeFeatures.push({
          id: 'dimples_face',
          ...COMMON_INVARIANT_FEATURES['dimples']
        });
      }
    }
  }

  // Check accessories
  if (visualProfile.accessories) {
    for (const accessory of visualProfile.accessories) {
      const accLower = accessory.toLowerCase();

      if (accLower.includes('glasses') || accLower.includes('brille')) {
        const isRound = accLower.includes('round') || accLower.includes('rund');
        const featureKey = isRound ? 'round_glasses' : 'square_glasses';
        invariants.mustIncludeFeatures.push({
          id: featureKey + '_acc',
          ...COMMON_INVARIANT_FEATURES[featureKey]
        });
      }

      if (accLower.includes('cap') || accLower.includes('mütze')) {
        invariants.mustIncludeFeatures.push({
          id: 'cap_acc',
          category: 'accessory',
          promptDescription: accessory,
          mustIncludeToken: accessory,
          priority: 1
        });
      }
    }
  }

  // Build forbidden features based on what MUST be included
  // (if tooth gap is required, forbid "complete teeth")
  for (const feature of invariants.mustIncludeFeatures) {
    if (feature.forbiddenAlternative) {
      invariants.forbiddenFeatures.push(feature.forbiddenAlternative);
    }
  }

  // Add hair color protection
  if (invariants.lockedHairColor) {
    const hairLower = invariants.lockedHairColor.toLowerCase();
    if (hairLower.includes('blond') || hairLower.includes('gold')) {
      invariants.forbiddenFeatures.push('brown hair', 'black hair', 'red hair', 'brunette');
    } else if (hairLower.includes('brown') || hairLower.includes('brunette')) {
      invariants.forbiddenFeatures.push('blond hair', 'blonde hair', 'golden hair');
    } else if (hairLower.includes('black')) {
      invariants.forbiddenFeatures.push('blond hair', 'brown hair');
    } else if (hairLower.includes('red') || hairLower.includes('ginger')) {
      invariants.forbiddenFeatures.push('blond hair', 'black hair');
    }
  }

  // Add eye color protection
  if (invariants.lockedEyeColor) {
    const eyeLower = invariants.lockedEyeColor.toLowerCase();
    if (eyeLower.includes('blue')) {
      invariants.forbiddenFeatures.push('brown eyes', 'green eyes', 'amber eyes');
    } else if (eyeLower.includes('green')) {
      invariants.forbiddenFeatures.push('blue eyes', 'brown eyes');
    } else if (eyeLower.includes('brown') || eyeLower.includes('amber')) {
      invariants.forbiddenFeatures.push('blue eyes', 'green eyes');
    }
  }

  // Deduplicate
  invariants.forbiddenFeatures = [...new Set(invariants.forbiddenFeatures)];

  return invariants;
}

/**
 * Formats invariants as MUST INCLUDE / FORBID prompt sections
 * Used by character-block-builder
 */
export function formatInvariantsForPrompt(invariants: CharacterInvariants): {
  mustIncludeTokens: string[];
  forbidTokens: string[];
  summaryLine: string;
} {
  // Sort by priority (1 first)
  const sortedFeatures = [...invariants.mustIncludeFeatures]
    .sort((a, b) => a.priority - b.priority);

  const mustIncludeTokens = sortedFeatures.map(f => f.mustIncludeToken);

  // Add locked colors
  if (invariants.lockedHairColor) {
    mustIncludeTokens.unshift(`${invariants.lockedHairColor} hair`);
  }
  if (invariants.lockedEyeColor) {
    mustIncludeTokens.push(`${invariants.lockedEyeColor} eyes`);
  }
  if (invariants.lockedSkinTone) {
    mustIncludeTokens.push(`${invariants.lockedSkinTone} skin`);
  }

  // Add height/age if explicit
  if (invariants.heightCm) {
    mustIncludeTokens.push(`exactly ${invariants.heightCm}cm tall`);
  }
  if (invariants.ageNumeric) {
    mustIncludeTokens.push(`${invariants.ageNumeric} years old child`);
  }

  // Build summary line for quick reference
  const summaryParts = [invariants.name];
  if (invariants.ageNumeric) summaryParts.push(`${invariants.ageNumeric}yo`);
  if (invariants.heightCm) summaryParts.push(`${invariants.heightCm}cm`);
  if (invariants.lockedHairColor) summaryParts.push(invariants.lockedHairColor + ' hair');

  const distinctiveFeatures = sortedFeatures
    .filter(f => f.priority === 1)
    .map(f => f.labelDe || f.mustIncludeToken);

  if (distinctiveFeatures.length > 0) {
    summaryParts.push(`DISTINCTIVE: ${distinctiveFeatures.join(', ')}`);
  }

  return {
    mustIncludeTokens: [...new Set(mustIncludeTokens)],
    forbidTokens: [...new Set(invariants.forbiddenFeatures)],
    summaryLine: summaryParts.join(' | ')
  };
}

/**
 * Validates that invariants are present in generated image prompt
 */
export function validateInvariantsInPrompt(
  prompt: string,
  invariants: CharacterInvariants
): { valid: boolean; missing: string[]; warnings: string[] } {
  const promptLower = prompt.toLowerCase();
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check priority 1 features (CRITICAL)
  for (const feature of invariants.mustIncludeFeatures.filter(f => f.priority === 1)) {
    const tokenLower = feature.mustIncludeToken.toLowerCase();
    if (!promptLower.includes(tokenLower)) {
      missing.push(feature.mustIncludeToken);
    }
  }

  // Check priority 2 features (WARNING)
  for (const feature of invariants.mustIncludeFeatures.filter(f => f.priority === 2)) {
    const tokenLower = feature.mustIncludeToken.toLowerCase();
    if (!promptLower.includes(tokenLower)) {
      warnings.push(feature.mustIncludeToken);
    }
  }

  // Check locked colors
  if (invariants.lockedHairColor) {
    const hairLower = invariants.lockedHairColor.toLowerCase();
    if (!promptLower.includes(hairLower)) {
      missing.push(`${invariants.lockedHairColor} hair`);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings
  };
}

/**
 * Creates a canonical invariants string for cross-chapter reference
 * Used to maintain consistency across all images
 */
export function buildCanonicalInvariantsRef(invariants: CharacterInvariants): string {
  const parts: string[] = [];

  parts.push(`[${invariants.name}]`);

  if (invariants.characterType === 'human') {
    parts.push('HUMAN CHILD');
    if (invariants.ageNumeric) parts.push(`age ${invariants.ageNumeric}`);
    if (invariants.heightCm) parts.push(`${invariants.heightCm}cm`);
  } else {
    parts.push(invariants.characterType.toUpperCase());
  }

  if (invariants.gender) {
    parts.push(invariants.gender === 'male' ? 'boy' : invariants.gender === 'female' ? 'girl' : 'child');
  }

  if (invariants.lockedHairColor) parts.push(`${invariants.lockedHairColor} hair`);
  if (invariants.lockedEyeColor) parts.push(`${invariants.lockedEyeColor} eyes`);

  // Add CRITICAL invariants
  const criticalFeatures = invariants.mustIncludeFeatures
    .filter(f => f.priority === 1)
    .map(f => f.mustIncludeToken);

  if (criticalFeatures.length > 0) {
    parts.push(`MUST: ${criticalFeatures.join(', ')}`);
  }

  if (invariants.signatureClothing) {
    parts.push(`wearing ${invariants.signatureClothing}`);
  }

  return parts.join(' | ');
}

export default {
  COMMON_INVARIANT_FEATURES,
  extractInvariantsFromDescription,
  buildInvariantsFromVisualProfile,
  formatInvariantsForPrompt,
  validateInvariantsInPrompt,
  buildCanonicalInvariantsRef
};
