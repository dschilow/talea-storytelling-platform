import { api } from "encore.dev/api";
import type { PersonalityTraits, PersonalityTrait } from "./avatar";
import { BASE_PERSONALITY_TRAITS } from "../constants/personalityTraits";
import { avatarDB } from "./db";

type RawTraitValue =
  | null
  | undefined
  | number
  | string
  | { value?: unknown; subcategories?: Record<string, number> };

// Erweitert und normalisiert Persönlichkeits-Traits zu hierarchischem System
function upgradePersonalityTraits(existingTraits: Record<string, RawTraitValue>): PersonalityTraits {
  const upgraded: Record<string, PersonalityTrait> = {};

  // Initialisiere alle 9 Basis-Traits mit 0
  for (const trait of BASE_PERSONALITY_TRAITS) {
    upgraded[trait.id] = { value: 0, subcategories: {} };
  }

  // Verarbeite existierende Traits
  for (const [key, value] of Object.entries(existingTraits)) {
    let normalizedValue = 0;
    let subcategories: Record<string, number> = {};

    // Normalisiere Werte und bewahre Subcategories
    if (value === null || value === undefined) {
      normalizedValue = 0;
    } else if (typeof value === 'object' && value.value !== undefined) {
      normalizedValue = Number(value.value) || 0;
      // WICHTIG: Bewahre existierende Subcategories!
      subcategories = value.subcategories ?? {};
    } else {
      normalizedValue = Number(value) || 0;
    }

    // Handle hierarchische Traits (z.B. knowledge.physics)
    if (key.includes('.')) {
      const [baseKey, subcategory] = key.split('.');
      if (upgraded[baseKey]) {
        upgraded[baseKey].subcategories ??= {};
        upgraded[baseKey].subcategories![subcategory] = normalizedValue;
        // Addiere zum Gesamtwert der Basis-Kategorie
        upgraded[baseKey].value += normalizedValue;
      }
    } else {
      // Basis-Trait direkt - bewahre Subcategories
      if (upgraded[key]) {
        upgraded[key].value = normalizedValue;
        // Merge mit existierenden subcategories
        upgraded[key].subcategories = { ...upgraded[key].subcategories, ...subcategories };
      }
    }
  }

  return upgraded as PersonalityTraits;
}

// API zum Upgrade aller Avatare (für Migration)
export const upgradeAllPersonalityTraits = api(
  { expose: true, method: "POST", path: "/avatar/upgrade-traits", auth: true },
  async (): Promise<{ updated: number }> => {
    console.log("🔄 Starting personality traits upgrade for all avatars...");

    // Lade alle Avatare
    const avatars = await avatarDB.queryAll<{
      id: string;
      personality_traits: string;
    }>`SELECT id, personality_traits FROM avatars`;

    let updatedCount = 0;

    for (const avatar of avatars) {
      try {
        const currentTraits = JSON.parse(avatar.personality_traits);
        const upgradedTraits = upgradePersonalityTraits(currentTraits);

        // Prüfe ob Updates nötig sind
        const hasNewTraits = Object.keys(upgradedTraits).length > Object.keys(currentTraits).length;

        if (hasNewTraits) {
          await avatarDB.exec`
            UPDATE avatars
            SET personality_traits = ${JSON.stringify(upgradedTraits)},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${avatar.id}
          `;

          console.log(`✅ Upgraded traits for avatar ${avatar.id}: added ${Object.keys(upgradedTraits).length - Object.keys(currentTraits).length} new traits`);
          updatedCount++;
        }
      } catch (error) {
        console.error(`❌ Failed to upgrade avatar ${avatar.id}:`, error);
      }
    }

    console.log(`🎉 Personality traits upgrade complete: ${updatedCount} avatars updated`);
    return { updated: updatedCount };
  }
);

// Hilfsfunktion für andere Services
export { upgradePersonalityTraits };