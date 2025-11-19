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
  archetypePreference?: string;
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
      species: 30,        // CRITICAL
      gender: 20,         // HIGH
      ageCategory: 15,    // HIGH
      profession: 15,     // MEDIUM
      socialClass: 10,    // MEDIUM
      archetype: 15,      // MEDIUM
      emotionalNature: 10, // LOW
      sizeCategory: 5,    // LOW
      freshness: 20,      // BONUS
    };

    // ---------------------------------------------------------
    // 🛑 REVOLUTIONARY: HARD VETO GATES (The "Gatekeeper")
    // If these critical requirements are missing, score is ZERO.
    // ---------------------------------------------------------

    // 1. STRICT SPECIES GATE
    if (fairyTaleRole?.speciesRequirement && fairyTaleRole.speciesRequirement !== 'any') {
      const required = fairyTaleRole.speciesRequirement.toLowerCase();
      const actual = (character.species_category || this.inferSpeciesFromVisualProfile(character)).toLowerCase();
      
      // Allow 'any' in character to pass (ambiguous), but specific mismatch is fatal
      if (actual !== 'any' && required !== actual) {
        // Check for compatible overlap (e.g. "frog" is an "animal")
        const isCompatible = this.areCompatibleSpecies(required, actual);
        
        if (!isCompatible) {
          console.log(`[Matcher] ⛔ VETO: Species mismatch. Req: ${required}, Got: ${actual}`);
          return 0; // HARD FAIL - Force Generation
        }
      }
    }

    // 2. STRICT GENDER GATE (Only for named roles like "Prince", "Queen")
    if (fairyTaleRole?.genderRequirement && fairyTaleRole.genderRequirement !== 'any') {
      const required = fairyTaleRole.genderRequirement.toLowerCase();
      const actual = (character.gender || this.inferGenderFromName(character.name)).toLowerCase();

      // Only veto if we are 100% sure it's wrong (e.g. Male vs Female). Ignore 'neutral'.
      if (actual !== 'neutral' && actual !== 'any' && required !== actual) {
         console.log(`[Matcher] ⛔ VETO: Gender mismatch. Req: ${required}, Got: ${actual}`);
         return 0; // HARD FAIL
      }
    }

    // 3. MODERNITY VETO (For Fantasy Settings)
    // If we are in a fairy tale, we do NOT want a "Bus Driver" or "Programmer"
    if (fairyTaleRole) {
       if (this.hasModernProfession(character)) {
         console.log(`[Matcher] ⛔ VETO: Modern profession in Fairy Tale.`);
         return 0;
       }
    }

    // ---------------------------------------------------------
    // ✅ SCORING (Only if Veto passed)
    // ---------------------------------------------------------

    // 1. SPECIES SCORING (Reward exact matches)
    if (fairyTaleRole?.speciesRequirement) {
      const required = fairyTaleRole.speciesRequirement;
      const actual = character.species_category || this.inferSpeciesFromVisualProfile(character);
      if (required === actual) score += weights.species;
      else if (actual === 'any') score += weights.species * 0.5;
    } else {
      // Infer from role
      const inferred = this.inferSpeciesFromRoleName(requirement.role, requirement.placeholder);
      const actual = character.species_category || 'any';
      if (inferred === actual || actual === 'any') score += weights.species * 0.7;
    }

    // 2. GENDER SCORING
    if (fairyTaleRole?.genderRequirement) {
      const required = fairyTaleRole.genderRequirement;
      const actual = character.gender || this.inferGenderFromName(character.name);
      if (required === actual) score += weights.gender;
      else if (actual === 'any') score += weights.gender * 0.5;
    } else {
      const inferred = this.inferGenderFromRoleName(requirement.placeholder || '');
      const actual = character.gender || 'any';
      if (inferred === actual) score += weights.gender * 0.6;
    }

    // 3. AGE CATEGORY MATCHING
    if (fairyTaleRole?.ageRequirement) {
      const required = fairyTaleRole.ageRequirement;
      const actual = character.age_category || 'adult';

      if (required === actual) {
        score += weights.ageCategory;
      } else if (this.areAdjacentAgeCategories(required, actual)) {
        score += weights.ageCategory * 0.5;
      } else {
        score -= weights.ageCategory; // Penalty for bad age match (Child vs Elder)
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
    }

    // 5. ARCHETYPE & EMOTIONAL (Contextual fit)
    if (requirement.archetype) {
      if (character.archetype === requirement.archetype) score += weights.archetype;
      else if (this.areCompatibleArchetypes(character.archetype, requirement.archetype)) score += weights.archetype * 0.5;
    }

    // 6. FRESHNESS (Tie-Breaker)
    const usageCount = character.totalUsageCount || 0;
    if (usageCount === 0) score += weights.freshness; // Boost new characters

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Check if species are compatible (e.g. frog is an animal)
   */
  private static areCompatibleSpecies(req: string, actual: string): boolean {
    const reqL = req.toLowerCase();
    const actL = actual.toLowerCase();
    
    if (reqL === actL) return true;
    if (reqL === 'animal' && ['frog', 'fox', 'cat', 'dog', 'bird', 'wolf', 'bear'].includes(actL)) return true;
    if (actL === 'animal' && ['frog', 'fox', 'cat', 'dog', 'bird', 'wolf', 'bear'].includes(reqL)) return true;
    
    // Magical creatures overlap often
    if (reqL === 'magical_creature' && ['dragon', 'fairy', 'goblin', 'troll', 'witch'].includes(actL)) return true;
    
    return false;
  }

  /**
   * Check for modern professions that break immersion
   */
  private static hasModernProfession(char: CharacterTemplate): boolean {
    const modernKeywords = [
      'police', 'polizist', 'programmer', 'developer', 'mechanic', 'mechaniker',
      'driver', 'busfahrer', 'pilot', 'doctor', 'arzt', 'engineer', 'ingenieur',
      'scientist', 'wissenschaftler'
    ];
    
    const desc = (char.visualProfile?.description || '').toLowerCase();
    const name = (char.name || '').toLowerCase();
    const tags = (char.profession_tags || []).map(t => t.toLowerCase()).join(' ');
    
    return modernKeywords.some(k => desc.includes(k) || name.includes(k) || tags.includes(k));
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
