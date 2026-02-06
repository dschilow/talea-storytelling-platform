import { api, APIError } from "encore.dev/api";
import type { PersonalityTraits } from "./avatar";
import { upgradePersonalityTraits } from "./upgradePersonalityTraits";
import { avatarDB } from "./db";

// ─── Trait Mastery Tiers ───────────────────────────────────────────────────
export const MASTERY_TIERS = [
  { level: 1, name: 'Anfänger',  nameEn: 'Beginner',   icon: '🌱', minValue: 0,  maxValue: 20 },
  { level: 2, name: 'Lehrling',  nameEn: 'Apprentice', icon: '🌿', minValue: 21, maxValue: 40 },
  { level: 3, name: 'Geselle',   nameEn: 'Journeyman', icon: '🌳', minValue: 41, maxValue: 60 },
  { level: 4, name: 'Meister',   nameEn: 'Master',     icon: '⭐', minValue: 61, maxValue: 80 },
  { level: 5, name: 'Legende',   nameEn: 'Legend',      icon: '👑', minValue: 81, maxValue: 100 },
] as const;

export function getMasteryTier(value: number) {
  for (let i = MASTERY_TIERS.length - 1; i >= 0; i--) {
    if (value >= MASTERY_TIERS[i].minValue) return MASTERY_TIERS[i];
  }
  return MASTERY_TIERS[0];
}

// Diminishing returns: the higher the trait, the less points you get
function applyDiminishingReturns(currentValue: number, rawChange: number): number {
  if (rawChange <= 0) return rawChange; // Reductions are always full
  // Scale factor: 1.0 at 0, 0.5 at 50, 0.25 at 75, 0.15 at 90
  const scaleFactor = Math.max(0.15, 1.0 - (currentValue / 130));
  return Math.max(1, Math.round(rawChange * scaleFactor));
}

interface TraitChange {
  trait: string;
  change: number;
  description?: string; // Reason for this trait development
}

interface UpdatePersonalityRequest {
  id: string;
  changes: TraitChange[];
  storyId?: string; // Track which story/content caused these updates
  contentTitle?: string; // Title of the story/doku that caused the development
  contentType?: 'story' | 'doku'; // Type of content
}

interface UpdatePersonalityResponse {
  success: boolean;
  updatedTraits: PersonalityTraits;
  appliedChanges: TraitChange[];
  masteryEvents: Array<{
    trait: string;
    traitDisplayName: string;
    oldTier: typeof MASTERY_TIERS[number];
    newTier: typeof MASTERY_TIERS[number];
    newValue: number;
  }>;
}

// Updates an avatar's personality traits with delta changes
export const updatePersonality = api(
  { expose: true, method: "POST", path: "/avatar/personality" },
  async (req: UpdatePersonalityRequest): Promise<UpdatePersonalityResponse> => {
    const { id, changes, storyId } = req;

    console.log(`🧠 Updating personality for avatar ${id} via ${req.contentType || 'content'} "${req.contentTitle || 'Unknown'}":`, changes.map(c => `${c.trait}: ${c.change > 0 ? '+' : ''}${c.change}`));

    const existingAvatar = await avatarDB.queryRow<{
      id: string;
      user_id: string;
      personality_traits: string;
    }>`
      SELECT id, user_id, personality_traits FROM avatars WHERE id = ${id}
    `;

    if (!existingAvatar) {
      throw APIError.notFound("Avatar not found");
    }

    const currentTraitsRaw = JSON.parse(existingAvatar.personality_traits);

    // Automatically upgrade and normalize traits to ensure all required traits exist
    const currentTraits = upgradePersonalityTraits(currentTraitsRaw);

    // Log if traits were upgraded
    const originalKeyCount = Object.keys(currentTraitsRaw).length;
    const upgradedKeyCount = Object.keys(currentTraits).length;
    if (upgradedKeyCount > originalKeyCount) {
      console.log(`🔧 Avatar ${id} traits upgraded: ${originalKeyCount} → ${upgradedKeyCount} traits`);
    }

    const updatedTraits = { ...currentTraits };
    const appliedChanges: TraitChange[] = [];
    const masteryEvents: UpdatePersonalityResponse['masteryEvents'] = [];

    // Trait display names for mastery events
    const traitDisplayNames: Record<string, string> = {
      courage: 'Mut', creativity: 'Kreativität', vocabulary: 'Wortschatz',
      curiosity: 'Neugier', teamwork: 'Teamgeist', empathy: 'Empathie',
      persistence: 'Ausdauer', logic: 'Logik', knowledge: 'Wissen',
    };

    // Apply trait changes
    for (const change of changes) {
      const traitIdentifier = change.trait;

      // Handle hierarchical traits (e.g. "knowledge.physics")
      if (traitIdentifier.includes('.')) {
        const [baseKey, subcategory] = traitIdentifier.split('.');

        if (baseKey in updatedTraits) {
          const traitKey = baseKey as keyof PersonalityTraits;
          const baseTrait = updatedTraits[traitKey];

          // Ensure we have the hierarchical structure
          if (typeof baseTrait === 'number') {
            updatedTraits[traitKey] = { value: baseTrait, subcategories: {} };
          }

          const traitValue = updatedTraits[traitKey] as { value: number; subcategories?: Record<string, number> };
          const currentSubcategoryValue = traitValue.subcategories?.[subcategory] || 0;
          const maxValue = 1000; // Higher limit for subcategories
          const newSubcategoryValue = Math.max(0, Math.min(maxValue, currentSubcategoryValue + change.change));

          // Update subcategory
          if (!traitValue.subcategories) {
            traitValue.subcategories = {};
          }
          traitValue.subcategories[subcategory] = newSubcategoryValue;

          // Update base value (sum of all subcategories + direct base value)
          const subcategorySum = Object.values(traitValue.subcategories).reduce((sum: number, val: number) => sum + val, 0);
          traitValue.value = subcategorySum;

          const actualChange = newSubcategoryValue - currentSubcategoryValue;
          appliedChanges.push({
            trait: traitIdentifier,
            change: actualChange,
            description: change.description || `Entwicklung durch ${req.contentType || 'Inhalt'}: ${req.contentTitle || 'Unbekannt'}`
          });

          const changeIcon = actualChange > 0 ? '📈' : '📉';
          const description = change.description ? ` (${change.description})` : '';
          console.log(`  ${changeIcon} ${baseKey}.${subcategory}: ${currentSubcategoryValue} → ${newSubcategoryValue} (${actualChange > 0 ? '+' : ''}${actualChange})${description}`);
          console.log(`  📊 ${baseKey} Gesamt: ${updatedTraits[baseKey].value}`);
        } else {
          console.warn(`⚠️ Unknown base trait: ${baseKey}`);
        }
      } else {
        // Handle direct base trait updates (with diminishing returns)
        if (traitIdentifier in updatedTraits) {
          const currentTrait = updatedTraits[traitIdentifier];
          const oldValue = typeof currentTrait === 'number' ? currentTrait : currentTrait.value;

          // Apply diminishing returns for base traits
          const effectiveChange = applyDiminishingReturns(oldValue, change.change);
          
          const maxValue = 100; // Base traits have lower limit
          const newValue = Math.max(0, Math.min(maxValue, oldValue + effectiveChange));

          // Check mastery tier change
          const oldTier = getMasteryTier(oldValue);
          const newTier = getMasteryTier(newValue);
          if (newTier.level > oldTier.level) {
            masteryEvents.push({
              trait: traitIdentifier,
              traitDisplayName: traitDisplayNames[traitIdentifier] || traitIdentifier,
              oldTier,
              newTier,
              newValue,
            });
            console.log(`  🏆 MASTERY UP! ${traitIdentifier}: ${oldTier.icon} ${oldTier.name} → ${newTier.icon} ${newTier.name}`);
          }

          // Preserve subcategories if they exist
          if (typeof currentTrait === 'object') {
            updatedTraits[traitIdentifier].value = newValue;
          } else {
            updatedTraits[traitIdentifier] = { value: newValue, subcategories: {} };
          }

          appliedChanges.push({
            trait: traitIdentifier,
            change: newValue - oldValue,
            description: change.description || `Entwicklung durch ${req.contentType || 'Inhalt'}: ${req.contentTitle || 'Unbekannt'}`
          });

          const changeIcon = newValue - oldValue > 0 ? '📈' : '📉';
          const description = change.description ? ` (${change.description})` : '';
          console.log(`  ${changeIcon} ${traitIdentifier}: ${oldValue} → ${newValue} (${newValue - oldValue > 0 ? '+' : ''}${newValue - oldValue})${description}`);
        } else {
          console.warn(`⚠️ Unknown trait: ${traitIdentifier}`);
        }
      }
    }

    // Update the database
    console.log(`💾 Saving updated traits to database:`, JSON.stringify(updatedTraits, null, 2));
    await avatarDB.exec`
      UPDATE avatars SET
        personality_traits = ${JSON.stringify(updatedTraits)},
        updated_at = ${new Date()}
      WHERE id = ${id}
    `;

    console.log(`✅ Personality update complete for avatar ${id}${masteryEvents.length > 0 ? ` (${masteryEvents.length} mastery-ups!)` : ''}`);

    return {
      success: true,
      updatedTraits,
      appliedChanges,
      masteryEvents,
    };
  }
);