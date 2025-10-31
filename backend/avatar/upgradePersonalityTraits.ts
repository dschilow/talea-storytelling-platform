import { api } from "encore.dev/api";
import type { PersonalityTraits } from "./avatar";
import { BASE_PERSONALITY_TRAITS, KNOWLEDGE_SUBCATEGORIES } from "../constants/personalityTraits";
import { avatarDB } from "./db";

// Erweitert und normalisiert Persönlichkeits-Traits zu hierarchischem System
function upgradePersonalityTraits(existingTraits: any): PersonalityTraits {
  const upgraded: any = {};

  // Initialisiere alle 9 Basis-Traits mit 0
  BASE_PERSONALITY_TRAITS.forEach(trait => {
    upgraded[trait.id] = { value: 0, subcategories: {} };
  });

  // Verarbeite existierende Traits
  Object.entries(existingTraits).forEach(([key, value]) => {
    let normalizedValue = 0;
    let subcategories = {};

    // Normalisiere Werte und bewahre Subcategories
    if (value === null || value === undefined) {
      normalizedValue = 0;
    } else if (typeof value === 'object' && (value as any).value !== undefined) {
      normalizedValue = Number((value as any).value) || 0;
      // WICHTIG: Bewahre existierende Subcategories!
      subcategories = (value as any).subcategories || {};
    } else {
      normalizedValue = Number(value) || 0;
    }

    // Handle hierarchische Traits (z.B. knowledge.physics)
    if (key.includes('.')) {
      const [baseKey, subcategory] = key.split('.');
      if (upgraded[baseKey]) {
        upgraded[baseKey].subcategories[subcategory] = normalizedValue;
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
  });

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