import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import type { PersonalityTraits } from "./avatar";
import { upgradePersonalityTraits } from "./upgradePersonalityTraits";

const avatarDB = new SQLDatabase("avatar", {
  migrations: "./migrations",
});

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

    // Apply trait changes
    for (const change of changes) {
      const traitIdentifier = change.trait;

      // Handle hierarchical traits (e.g. "knowledge.physics")
      if (traitIdentifier.includes('.')) {
        const [baseKey, subcategory] = traitIdentifier.split('.');

        if (baseKey in updatedTraits) {
          const baseTrait = updatedTraits[baseKey];

          // Ensure we have the hierarchical structure
          if (typeof baseTrait === 'number') {
            updatedTraits[baseKey] = { value: baseTrait, subcategories: {} };
          }

          const currentSubcategoryValue = updatedTraits[baseKey].subcategories[subcategory] || 0;
          const maxValue = 1000; // Higher limit for subcategories
          const newSubcategoryValue = Math.max(0, Math.min(maxValue, currentSubcategoryValue + change.change));

          // Update subcategory
          updatedTraits[baseKey].subcategories[subcategory] = newSubcategoryValue;

          // Update base value (sum of all subcategories + direct base value)
          const subcategorySum = Object.values(updatedTraits[baseKey].subcategories).reduce((sum, val) => sum + val, 0);
          const directValue = typeof currentTraits[baseKey] === 'number' ? currentTraits[baseKey] : currentTraits[baseKey].value;
          updatedTraits[baseKey].value = subcategorySum;

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
        // Handle direct base trait updates
        if (traitIdentifier in updatedTraits) {
          const currentTrait = updatedTraits[traitIdentifier];
          const oldValue = typeof currentTrait === 'number' ? currentTrait : currentTrait.value;

          const maxValue = 100; // Base traits have lower limit
          const newValue = Math.max(0, Math.min(maxValue, oldValue + change.change));

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

    console.log(`✅ Personality update complete for avatar ${id}`);

    return {
      success: true,
      updatedTraits,
      appliedChanges
    };
  }
);