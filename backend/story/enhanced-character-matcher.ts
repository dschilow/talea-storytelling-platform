// Enhanced Character Matcher with Species, Gender, Age, and Profession filtering
// Replaces basic archetype-only matching with comprehensive role-based matching

import type { CharacterTemplate, CharacterRequirement } from "./types";

export interface FairyTaleRoleRequirement {
  roleName: string;
  roleType: string;
  speciesRequirement?: string;
  genderRequirement?: string;
  ageRequirement?: string;
  professionPreference?: string[];
  sizeRequirement?: string;
  socialClassRequirement?: string;
}

export class EnhancedCharacterMatcher {
  /**
   * Calculate comprehensive match score with species, gender, age, and profession
   * Returns 0-100 score
   */
  static calculateEnhancedMatchScore(
    character: CharacterTemplate,
    requirement: CharacterRequirement,
    fairyTaleRole?: FairyTaleRoleRequirement
  ): number {
    let score = 0;

    // WEIGHTS (total = 100)
    const weights = {
      species: 30,        // CRITICAL: Must match species
      gender: 20,         // HIGH: Gender appropriateness
      ageCategory: 15,    // HIGH: Age appropriateness
      profession: 15,     // MEDIUM: Profession fit
      socialClass: 10,    // MEDIUM: Social appropriateness
      archetype: 15,      // MEDIUM: Personality archetype
      emotionalNature: 10, // LOW: Emotional fit
      sizeCategory: 5,    // LOW: Physical size
      freshness: 20,      // BONUS: Usage diversity (Increased from 10)
    };

    // 1. SPECIES MATCHING (CRITICAL!)
    if (fairyTaleRole?.speciesRequirement) {
      const required = fairyTaleRole.speciesRequirement;
      const actual = character.species_category || this.inferSpeciesFromVisualProfile(character);

      if (required === 'any' || actual === 'any') {
        score += weights.species * 0.5; // Partial credit for 'any'
      } else if (required === actual) {
        score += weights.species; // Full points!
      } else {
        // PENALTY for wrong species (e.g., duck instead of human)
        score -= weights.species * 0.5;
      }
    } else {
      // Infer from role name if not explicitly specified
      const inferredSpecies = this.inferSpeciesFromRoleName(requirement.role, requirement.placeholder);
      const actualSpecies = character.species_category || 'any';

      if (inferredSpecies === actualSpecies || actualSpecies === 'any') {
        score += weights.species * 0.7; // Good match
      }
    }

    // 2. GENDER MATCHING
    if (fairyTaleRole?.genderRequirement) {
      const required = fairyTaleRole.genderRequirement;
      const actual = character.gender || this.inferGenderFromName(character.name);

      if (required === 'any' || actual === 'any') {
        score += weights.gender * 0.5;
      } else if (required === actual) {
        score += weights.gender;
      } else {
        score -= weights.gender * 0.3; // Penalty for mismatch
      }
    } else {
      // Infer gender from role name
      const inferredGender = this.inferGenderFromRoleName(requirement.placeholder || '');
      const actualGender = character.gender || 'any';

      if (inferredGender === actualGender || actualGender === 'any' || inferredGender === 'any') {
        score += weights.gender * 0.6;
      }
    }

    // 3. AGE CATEGORY MATCHING
    if (fairyTaleRole?.ageRequirement) {
      const required = fairyTaleRole.ageRequirement;
      const actual = character.age_category || 'adult';

      if (required === 'any' || actual === 'any') {
        score += weights.ageCategory * 0.5;
      } else if (required === actual) {
        score += weights.ageCategory;
      } else {
        // Partial credit for adjacent ages
        if (this.areAdjacentAgeCategories(required, actual)) {
          score += weights.ageCategory * 0.3;
        }
      }
    }

    // 4. PROFESSION MATCHING
    if (fairyTaleRole?.professionPreference && character.profession_tags) {
      const requiredTags = fairyTaleRole.professionPreference;
      const actualTags = character.profession_tags;

      const matchCount = requiredTags.filter(req =>
        actualTags.some(actual => actual.toLowerCase().includes(req.toLowerCase()))
      ).length;

      const matchRatio = requiredTags.length > 0 ? matchCount / requiredTags.length : 0;
      score += weights.profession * matchRatio;
    } else {
      // Infer profession from role
      const inferredProfession = this.inferProfessionFromRoleName(requirement.placeholder || '');
      if (inferredProfession && character.profession_tags?.includes(inferredProfession)) {
        score += weights.profession;
      }
    }

    // 5. SOCIAL CLASS MATCHING
    if (fairyTaleRole?.socialClassRequirement && character.social_class) {
      const required = fairyTaleRole.socialClassRequirement;
      const actual = character.social_class;

      if (required === 'any' || actual === 'any') {
        score += weights.socialClass * 0.5;
      } else if (required === actual) {
        score += weights.socialClass;
      } else {
        // Partial credit for compatible classes
        if (this.areCompatibleSocialClasses(required, actual)) {
          score += weights.socialClass * 0.4;
        }
      }
    }

    // 6. ARCHETYPE MATCHING (existing logic)
    if (requirement.archetype) {
      if (character.archetype === requirement.archetype) {
        score += weights.archetype;
      } else if (this.areCompatibleArchetypes(character.archetype, requirement.archetype)) {
        score += weights.archetype * 0.5;
      }
    }

    // 7. EMOTIONAL NATURE MATCHING (existing logic)
    if (requirement.emotionalNature && character.emotionalNature) {
      const reqEmotions = typeof requirement.emotionalNature === 'string'
        ? [requirement.emotionalNature]
        : [requirement.emotionalNature.dominant, ...(requirement.emotionalNature.secondary || [])];

      const charEmotions = typeof character.emotionalNature === 'string'
        ? [character.emotionalNature]
        : [character.emotionalNature.dominant, ...(character.emotionalNature.secondary || [])];

      const matchCount = reqEmotions.filter(req =>
        charEmotions.some(char => char.toLowerCase().includes(req.toLowerCase()))
      ).length;

      const matchRatio = reqEmotions.length > 0 ? matchCount / reqEmotions.length : 0;
      score += weights.emotionalNature * matchRatio;
    }

    // 8. SIZE CATEGORY MATCHING
    if (fairyTaleRole?.sizeRequirement && character.size_category) {
      if (fairyTaleRole.sizeRequirement === character.size_category) {
        score += weights.sizeCategory;
      }
    }

    // 9. FRESHNESS BONUS (usage diversity)
    const usageCount = character.totalUsageCount || 0;
    const recentUsageCount = character.recentUsageCount || 0;

    if (usageCount === 0) {
      score += weights.freshness * 2.0; // Huge Bonus for unused characters
    } else if (recentUsageCount === 0) {
      score += weights.freshness * 1.0; // Standard Bonus: Not used recently
    } else if (recentUsageCount < 2) {
      score += weights.freshness * 0.2; // Small Bonus: Used once recently
    } else {
      score -= weights.freshness * 0.5; // Penalty: Used frequently recently
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Infer species from role name
   */
  private static inferSpeciesFromRoleName(role: string, placeholder?: string): string {
    const roleText = (role + ' ' + (placeholder || '')).toLowerCase();

    if (roleText.includes('könig') || roleText.includes('königin') ||
        roleText.includes('prinz') || roleText.includes('prinzessin') ||
        roleText.includes('müller') || roleText.includes('bäcker') ||
        roleText.includes('schmied') || roleText.includes('hexe') ||
        roleText.includes('zauberer') || roleText.includes('räuber')) {
      return 'human';
    }

    if (roleText.includes('rumpelstilzchen') || roleText.includes('zwerg') ||
        roleText.includes('troll') || roleText.includes('goblin')) {
      return 'magical_creature';
    }

    if (roleText.includes('wolf') || roleText.includes('fuchs') ||
        roleText.includes('ente') || roleText.includes('eichhörnchen')) {
      return 'animal';
    }

    return 'any';
  }

  /**
   * Infer gender from role name
   */
  private static inferGenderFromRoleName(roleName: string): string {
    const lower = roleName.toLowerCase();

    // Male indicators
    if (lower.includes('könig') || lower.includes('prinz') ||
        lower.includes('müller') || lower.includes('zauberer') ||
        lower.includes('räuber') || lower.includes('schmied')) {
      return 'male';
    }

    // Female indicators
    if (lower.includes('königin') || lower.includes('prinzessin') ||
        lower.includes('tochter') || lower.includes('hexe') ||
        lower.includes('mutter') || lower.includes('magd')) {
      return 'female';
    }

    return 'any';
  }

  /**
   * Infer gender from character name
   */
  private static inferGenderFromName(name: string): string {
    const lower = name.toLowerCase();

    // Common female names/endings
    if (lower.endsWith('a') || lower.endsWith('e') ||
        lower.includes('emma') || lower.includes('rosa') ||
        lower.includes('isabella') || lower.includes('martha')) {
      return 'female';
    }

    // Common male names
    if (lower.includes('wilhelm') || lower.includes('hans') ||
        lower.includes('konrad') || lower.includes('friedrich') ||
        lower.includes('bernd') || lower.includes('paul')) {
      return 'male';
    }

    return 'neutral';
  }

  /**
   * Infer profession from role name
   */
  private static inferProfessionFromRoleName(placeholder: string): string | null {
    const lower = placeholder.toLowerCase();

    if (lower.includes('könig') || lower.includes('konig')) return 'royalty';
    if (lower.includes('müller') || lower.includes('muller')) return 'miller';
    if (lower.includes('schmied')) return 'blacksmith';
    if (lower.includes('bäcker') || lower.includes('baker')) return 'baker';
    if (lower.includes('hexe') || lower.includes('witch')) return 'witch';
    if (lower.includes('zauberer') || lower.includes('wizard')) return 'wizard';

    return null;
  }

  /**
   * Infer species from visual profile
   */
  private static inferSpeciesFromVisualProfile(character: CharacterTemplate): string {
    if (!character.visualProfile) return 'any';

    const species = character.visualProfile.species || '';
    const description = character.visualProfile.description || '';
    const combined = (species + ' ' + description).toLowerCase();

    if (combined.includes('human') || combined.includes('mensch')) return 'human';
    if (combined.includes('duck') || combined.includes('ente')) return 'animal';
    if (combined.includes('squirrel') || combined.includes('eichhörnchen')) return 'animal';
    if (combined.includes('fox') || combined.includes('fuchs')) return 'animal';
    if (combined.includes('golem') || combined.includes('magical')) return 'magical_creature';

    return 'any';
  }

  /**
   * Check if age categories are adjacent (for partial credit)
   */
  private static areAdjacentAgeCategories(age1: string, age2: string): boolean {
    const ageOrder = ['child', 'teenager', 'young_adult', 'adult', 'elder'];
    const idx1 = ageOrder.indexOf(age1);
    const idx2 = ageOrder.indexOf(age2);

    if (idx1 === -1 || idx2 === -1) return false;

    return Math.abs(idx1 - idx2) === 1;
  }

  /**
   * Check if social classes are compatible
   */
  private static areCompatibleSocialClasses(class1: string, class2: string): boolean {
    // Nobility and royalty are compatible
    if ((class1 === 'royalty' && class2 === 'nobility') ||
        (class1 === 'nobility' && class2 === 'royalty')) {
      return true;
    }

    // Merchant and craftsman are compatible
    if ((class1 === 'merchant' && class2 === 'craftsman') ||
        (class1 === 'craftsman' && class2 === 'merchant')) {
      return true;
    }

    // Craftsman and commoner are compatible
    if ((class1 === 'craftsman' && class2 === 'commoner') ||
        (class1 === 'commoner' && class2 === 'craftsman')) {
      return true;
    }

    return false;
  }

  /**
   * Check if archetypes are compatible
   */
  private static areCompatibleArchetypes(arch1: string, arch2: string): boolean {
    const compatibilityMap: Record<string, string[]> = {
      'hero': ['protagonist', 'innocent', 'brave_hero'],
      'villain': ['antagonist', 'trickster_villain', 'evil'],
      'helper': ['sidekick', 'mentor', 'companion'],
      'mentor': ['wise', 'elder', 'guide'],
    };

    for (const [key, compatible] of Object.entries(compatibilityMap)) {
      if (arch1 === key && compatible.includes(arch2)) return true;
      if (arch2 === key && compatible.includes(arch1)) return true;
    }

    return false;
  }
}
