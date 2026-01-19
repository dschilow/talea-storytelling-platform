/**
 * Age Consistency Guards
 *
 * Ensures avatars are rendered with correct age-appropriate proportions
 * Prevents issues like 5-year-olds looking like teenagers
 */

export interface AgeProportions {
  height: string;
  proportions: string;
  features: string;
  comparison: string;
  style: string;
}

export const AGE_PROMPTS: Record<string, AgeProportions> = {
  "age_3_5": {
    height: "very short, toddler height, small child",
    proportions: "large head relative to body (1:4 head-to-body ratio), chubby proportions",
    features: "chubby cheeks, button nose, very small hands, babylike features, round face",
    comparison: "half the height of an 8-year-old, toddler-sized",
    style: "toddler proportions, babylike features, preschool age child"
  },
  "age_5_7": {
    height: "short child height, comes up to adult's waist, kindergarten height",
    proportions: "slightly large head (1:5 head-to-body ratio), small body, child proportions",
    features: "round face, small nose, child-sized hands, young child features",
    comparison: "distinctly smaller than 10-year-old, young child size",
    style: "young child proportions, NOT pre-teen, kindergarten/early elementary age"
  },
  "age_8_10": {
    height: "medium child height, comes up to adult's chest, elementary school height",
    proportions: "more balanced head-to-body ratio (1:6), child anatomy",
    features: "less round face, normal child features, still childlike",
    comparison: "clearly child, NOT teenager, elementary school age",
    style: "child proportions, NOT adolescent, upper elementary age"
  },
  "age_11_13": {
    height: "taller child, comes up to adult's shoulder, pre-teen height",
    proportions: "adult-like proportions starting (1:7 ratio), pre-teen body",
    features: "more defined features, losing baby fat, pre-teen face",
    comparison: "pre-teen, NOT young child, NOT adult",
    style: "pre-teen proportions, early adolescent, middle school age"
  }
};

/**
 * Determines age group from avatar age
 */
export function getAgeGroup(age?: number): string {
  if (!age || age < 3) return "age_3_5";
  if (age >= 3 && age <= 5) return "age_3_5";
  if (age >= 5 && age <= 7) return "age_5_7";
  if (age >= 8 && age <= 10) return "age_8_10";
  if (age >= 11 && age <= 13) return "age_11_13";
  return "age_8_10"; // Default fallback
}

/**
 * Builds age-accurate character description
 */
export function buildAgeAccuratePrompt(
  characterName: string,
  age?: number,
  ageApprox?: string
): string {
  // Try to extract age from ageApprox if age not provided
  let finalAge = age;
  if (!finalAge && ageApprox) {
    const ageMatch = ageApprox.match(/(\d+)/);
    if (ageMatch) {
      finalAge = parseInt(ageMatch[1], 10);
    }
  }

  const ageGroup = getAgeGroup(finalAge);
  const agePrompt = AGE_PROMPTS[ageGroup];

  const ageDisplay = finalAge ? `age ${finalAge}` : ageApprox || "child";

  return `
${characterName} (HUMAN child, ${ageDisplay}):
  AGE-SPECIFIC PROPORTIONS:
    - Height: ${agePrompt.height}
    - Proportions: ${agePrompt.proportions}
    - Features: ${agePrompt.features}
    - Comparison: ${agePrompt.comparison}
    - Style: ${agePrompt.style}

  CRITICAL: This is a ${ageDisplay} child, NOT a teenager, NOT pre-teen.
  ${finalAge && finalAge < 8 ? `Must look DISTINCTLY YOUNGER than 10 years old.` : ''}
  `.trim();
}

/**
 * Builds relative height references for multi-character scenes
 */
export function buildRelativeHeightReferences(
  characters: Array<{ name: string; age?: number; ageApprox?: string; species: string }>
): string {
  const humans = characters.filter(c => c.species === 'human');
  if (humans.length < 2) return "";

  // Sort by age (youngest first)
  const sortedHumans = humans.sort((a, b) => {
    const ageA = a.age || extractAge(a.ageApprox) || 6;
    const ageB = b.age || extractAge(b.ageApprox) || 6;
    return ageA - ageB;
  });

  const references: string[] = [];

  // Build relative height descriptions
  for (let i = 0; i < sortedHumans.length - 1; i++) {
    const younger = sortedHumans[i];
    const older = sortedHumans[i + 1];
    const youngerAge = younger.age || extractAge(younger.ageApprox) || 6;
    const olderAge = older.age || extractAge(older.ageApprox) || 8;

    if (youngerAge < olderAge) {
      references.push(`${younger.name} (age ${youngerAge}): shoulder-height to ${older.name}`);
    }
  }

  if (references.length === 0) return "";

  return `
HEIGHT REFERENCES (CRITICAL):
 ${references.join('\n ')}

 CRITICAL: Maintain consistent height relationships!
 Younger children MUST be visibly shorter than older children.
  `.trim();
}

/**
 * Extracts age number from ageApprox string
 */
function extractAge(ageApprox?: string): number | null {
  if (!ageApprox) return null;
  const match = ageApprox.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extended character info with explicit height
 */
export interface CharacterWithHeight {
  name: string;
  age?: number;
  ageNumeric?: number; // NEW: Explicit numeric age from visual profile
  ageApprox?: string;
  heightCm?: number; // NEW: Explicit height in cm
  species: string;
}

/**
 * Builds relative height references with explicit height support
 * CRITICAL: This fixes the Adrian/Alexander age consistency issue by using
 * explicit height data from the visual profile
 */
export function buildRelativeHeightReferencesWithHeight(
  characters: CharacterWithHeight[]
): string {
  const humans = characters.filter(c => c.species === 'human');
  if (humans.length < 2) return "";

  // Sort by height (shortest first), fallback to age
  const sortedHumans = humans.sort((a, b) => {
    // Priority 1: Use explicit height
    if (a.heightCm && b.heightCm) {
      return a.heightCm - b.heightCm;
    }
    // Priority 2: Use explicit age
    const ageA = a.ageNumeric || a.age || extractAge(a.ageApprox) || 6;
    const ageB = b.ageNumeric || b.age || extractAge(b.ageApprox) || 6;
    return ageA - ageB;
  });

  const references: string[] = [];

  // Build explicit height descriptions
  sortedHumans.forEach((char, index) => {
    const age = char.ageNumeric || char.age || extractAge(char.ageApprox) || 6;
    const height = char.heightCm;

    if (height) {
      references.push(`${char.name}: exactly ${height}cm tall, age ${age}`);
    } else {
      references.push(`${char.name}: age ${age}, ${getAgeGroup(age).replace('_', '-')}`);
    }

    // Add relative comparison to next character
    if (index < sortedHumans.length - 1) {
      const nextChar = sortedHumans[index + 1];
      const nextHeight = nextChar.heightCm;
      const nextAge = nextChar.ageNumeric || nextChar.age || extractAge(nextChar.ageApprox) || 8;

      if (height && nextHeight && height < nextHeight) {
        const diff = nextHeight - height;
        references.push(`  -> ${char.name} is ${diff}cm SHORTER than ${nextChar.name}`);
      } else if (age < nextAge) {
        references.push(`  -> ${char.name} (${age}y) MUST be visibly shorter than ${nextChar.name} (${nextAge}y)`);
      }
    }
  });

  if (references.length === 0) return "";

  return `
HEIGHT REFERENCES (CRITICAL FOR CONSISTENCY):
${references.join('\n')}

CRITICAL RULES:
1. Younger/shorter characters MUST be visibly smaller in the image
2. Height differences must be consistent across ALL story images
3. A ${sortedHumans[0].name} at ${sortedHumans[0].heightCm || 'young age'}cm CANNOT appear taller than ${sortedHumans[sortedHumans.length - 1].name}
  `.trim();
}

/**
 * Builds age-accurate prompt with explicit height support
 * CRITICAL: Uses both age AND height from visual profile
 */
export function buildAgeAccuratePromptWithHeight(
  characterName: string,
  age?: number,
  ageApprox?: string,
  heightCm?: number
): string {
  // Try to extract age from ageApprox if age not provided
  let finalAge = age;
  if (!finalAge && ageApprox) {
    const ageMatch = ageApprox.match(/(\d+)/);
    if (ageMatch) {
      finalAge = parseInt(ageMatch[1], 10);
    }
  }

  const ageGroup = getAgeGroup(finalAge);
  const agePrompt = AGE_PROMPTS[ageGroup];

  const ageDisplay = finalAge ? `age ${finalAge}` : ageApprox || "child";
  const heightDisplay = heightCm ? `${heightCm}cm tall` : '';

  // Build height comparison reference
  let heightRef = '';
  if (heightCm && finalAge) {
    if (heightCm < 110) {
      heightRef = 'VERY SHORT child, comes up to adults knee/thigh level';
    } else if (heightCm < 130) {
      heightRef = 'SHORT child, comes up to adults waist';
    } else if (heightCm < 145) {
      heightRef = 'MEDIUM height child, comes up to adults chest';
    } else if (heightCm < 160) {
      heightRef = 'TALLER child, comes up to adults shoulder';
    } else {
      heightRef = 'TALL child/pre-teen height';
    }
  }

  return `
${characterName} (HUMAN child, ${ageDisplay}${heightCm ? `, ${heightCm}cm` : ''}):
  EXPLICIT MEASUREMENTS:
    ${heightCm ? `- Height: EXACTLY ${heightCm}cm (${heightRef})` : ''}
    - Age: EXACTLY ${finalAge || 'unknown'} years old

  AGE-SPECIFIC PROPORTIONS:
    - Body: ${agePrompt.proportions}
    - Features: ${agePrompt.features}
    - Comparison: ${agePrompt.comparison}
    - Style: ${agePrompt.style}

  CRITICAL:
    - This is a ${ageDisplay} child${heightCm ? ` at ${heightCm}cm` : ''}, NOT a teenager.
    ${finalAge && finalAge < 8 ? `- Must look DISTINCTLY YOUNGER than 10 years old.` : ''}
    ${heightCm && heightCm < 130 ? `- Must be CLEARLY SHORT for a child.` : ''}
  `.trim();
}

/**
 * OPTIMIZATION v3.0: Builds a COMPACT, HIGH-PRIORITY age block for prompt START
 * This should be placed at the VERY BEGINNING of any image prompt
 * Format: [AGE: Name=Xyo/Ycm | Name2=Xyo/Ycm]
 */
export function buildCompactAgeBlock(
  characters: CharacterWithHeight[]
): string {
  const humans = characters.filter(c => c.species === 'human');
  if (humans.length === 0) return "";

  // Sort by height/age for clear visual hierarchy
  const sorted = [...humans].sort((a, b) => {
    if (a.heightCm && b.heightCm) return a.heightCm - b.heightCm;
    const ageA = a.ageNumeric || a.age || extractAge(a.ageApprox) || 6;
    const ageB = b.ageNumeric || b.age || extractAge(b.ageApprox) || 6;
    return ageA - ageB;
  });

  const entries = sorted.map(c => {
    const age = c.ageNumeric || c.age || extractAge(c.ageApprox);
    const height = c.heightCm;
    const parts: string[] = [c.name];
    if (age) parts.push(`${age}yo`);
    if (height) parts.push(`${height}cm`);
    return parts.join('=');
  });

  // Add height relationship if we have 2+ characters with explicit data
  let relationship = "";
  if (sorted.length >= 2) {
    const shortest = sorted[0];
    const tallest = sorted[sorted.length - 1];
    if (shortest.heightCm && tallest.heightCm && shortest.heightCm < tallest.heightCm) {
      const diff = tallest.heightCm - shortest.heightCm;
      relationship = ` | ${shortest.name} ${diff}cm SHORTER than ${tallest.name}`;
    } else {
      const shortestAge = shortest.ageNumeric || shortest.age || extractAge(shortest.ageApprox) || 6;
      const tallestAge = tallest.ageNumeric || tallest.age || extractAge(tallest.ageApprox) || 8;
      if (shortestAge < tallestAge) {
        relationship = ` | ${shortest.name} YOUNGER/SHORTER than ${tallest.name}`;
      }
    }
  }

  return `[AGES: ${entries.join(' | ')}${relationship}]`;
}

/**
 * OPTIMIZATION v3.0: Builds explicit age enforcement text
 * This is a STRONG, unambiguous age statement for maximum model compliance
 */
export function buildExplicitAgeEnforcement(
  characters: CharacterWithHeight[]
): string {
  const humans = characters.filter(c => c.species === 'human');
  if (humans.length === 0) return "";

  const lines: string[] = ['⚠️ MANDATORY AGE REQUIREMENTS ⚠️'];

  humans.forEach(c => {
    const age = c.ageNumeric || c.age || extractAge(c.ageApprox);
    const height = c.heightCm;

    if (age) {
      let ageDescription: string;
      if (age <= 5) {
        ageDescription = `TODDLER/PRESCHOOLER (${age} years) - very small, chubby cheeks, large head ratio`;
      } else if (age <= 8) {
        ageDescription = `YOUNG CHILD (${age} years) - small, childish features, NOT pre-teen`;
      } else if (age <= 12) {
        ageDescription = `OLDER CHILD (${age} years) - child proportions, NOT teenager`;
      } else {
        ageDescription = `PRE-TEEN (${age} years)`;
      }

      lines.push(`${c.name}: ${ageDescription}${height ? `, exactly ${height}cm tall` : ''}`);
    }
  });

  // Add comparison rule for multiple characters
  if (humans.length >= 2) {
    const sorted = [...humans].sort((a, b) => {
      const ageA = a.ageNumeric || a.age || extractAge(a.ageApprox) || 6;
      const ageB = b.ageNumeric || b.age || extractAge(b.ageApprox) || 6;
      return ageA - ageB;
    });

    const youngest = sorted[0];
    const oldest = sorted[sorted.length - 1];
    lines.push(`RULE: ${youngest.name} MUST appear visibly YOUNGER and SMALLER than ${oldest.name}`);
  }

  return lines.join('\n');
}
