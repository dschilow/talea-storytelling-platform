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
