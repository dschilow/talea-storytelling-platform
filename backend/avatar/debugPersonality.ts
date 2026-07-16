import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { upgradePersonalityTraits } from "./upgradePersonalityTraits";
import { avatarDB } from "./db";
import type { PersonalityTraits } from "./avatar";

export interface DebugPersonalityRequest {
  id: string; // avatar ID
}

export interface DebugPersonalityResponse {
  avatarId: string;
  storedTraits: any;
  expectedTraitsFromMemories: any;
  memorySummary: Array<{
    memoryId: string;
    storyTitle: string;
    changes: Array<{ trait: string; change: number }>;
    createdAt: string;
  }>;
  discrepancies: Array<{
    trait: string;
    stored: number;
    expected: number;
    difference: number;
  }>;
}

// Debug endpoint to compare stored personality traits vs what they should be based on memories
export const debugPersonality = api(
  { expose: true, method: "GET", path: "/avatar/:id/debug-personality", auth: true },
  async (req: DebugPersonalityRequest): Promise<DebugPersonalityResponse> => {
    const auth = getAuthData()!;
    const { id } = req;

    console.log(`🔍 Debugging personality for avatar ${id}`);

    // Get current stored personality traits
    const avatarRow = await avatarDB.queryRow<{
      id: string;
      user_id: string;
      personality_traits: string;
    }>`
      SELECT id, user_id, personality_traits FROM avatars WHERE id = ${id}
    `;

    if (!avatarRow) {
      throw APIError.notFound("Avatar not found");
    }


    if (avatarRow.user_id !== auth.userID && auth.role !== "admin") {
      throw APIError.permissionDenied("You do not have permission to inspect this avatar.");
    }
    const storedTraits = JSON.parse(avatarRow.personality_traits);
    console.log(`📦 Stored traits:`, JSON.stringify(storedTraits, null, 2));

    // Get all memories to calculate expected traits
    const memoryRowsGenerator = await avatarDB.query<{
      id: string;
      story_title: string;
      personality_changes: string;
      created_at: string;
    }>`
      SELECT id, story_title, personality_changes, created_at
      FROM avatar_memories
      WHERE avatar_id = ${id}
      ORDER BY created_at ASC
    `;

    const memoryRows: any[] = [];
    for await (const row of memoryRowsGenerator) {
      memoryRows.push(row);
    }

    console.log(`📊 Found ${memoryRows.length} memory records`);

    // Calculate what traits should be based on all memory changes
    const expectedTraits = upgradePersonalityTraits({}); // Start with empty/default traits
    const memorySummary: DebugPersonalityResponse['memorySummary'] = [];

    for (const memoryRow of memoryRows) {
      const changes = JSON.parse(memoryRow.personality_changes);
      memorySummary.push({
        memoryId: memoryRow.id,
        storyTitle: memoryRow.story_title,
        changes: changes,
        createdAt: memoryRow.created_at
      });

      console.log(`🔄 Processing memory: ${memoryRow.story_title} (${changes.length} changes)`);

      // Apply each change to expected traits
      for (const change of changes) {
        const traitIdentifier = change.trait;

        if (traitIdentifier.includes('.')) {
          // Handle hierarchical traits (e.g., "knowledge.physics")
          const [baseKey, subcategory] = traitIdentifier.split('.');

          if (baseKey in expectedTraits) {
            const traitKey = baseKey as keyof PersonalityTraits;
            // Ensure hierarchical structure exists
            if (typeof expectedTraits[traitKey] === 'number') {
              expectedTraits[traitKey] = { value: expectedTraits[traitKey] as number, subcategories: {} };
            }

            const traitValue = expectedTraits[traitKey] as { value: number; subcategories?: Record<string, number> };
            const currentSubcategoryValue = traitValue.subcategories?.[subcategory] || 0;
            const newSubcategoryValue = Math.max(0, currentSubcategoryValue + change.change);

            if (!traitValue.subcategories) {
              traitValue.subcategories = {};
            }
            traitValue.subcategories[subcategory] = newSubcategoryValue;

            // Update main category value (sum of subcategories)
            const subcategorySum = Object.values(traitValue.subcategories).reduce((sum: number, val: number) => sum + val, 0);
            traitValue.value = subcategorySum;

            console.log(`  📈 ${baseKey}.${subcategory}: ${currentSubcategoryValue} → ${newSubcategoryValue} (main total: ${subcategorySum})`);
          }
        } else {
          // Handle direct base trait updates
          const traitKey = traitIdentifier as keyof PersonalityTraits;
          if (traitKey in expectedTraits) {
            const currentTrait = expectedTraits[traitKey];
            const oldValue = typeof currentTrait === 'number' ? currentTrait : currentTrait.value;
            const newValue = Math.max(0, oldValue + change.change);

            if (typeof currentTrait === 'object') {
              currentTrait.value = newValue;
            } else {
              expectedTraits[traitKey] = { value: newValue, subcategories: {} };
            }

            console.log(`  📈 ${traitIdentifier}: ${oldValue} → ${newValue}`);
          }
        }
      }
    }

    console.log(`🎯 Expected traits:`, JSON.stringify(expectedTraits, null, 2));

    // Find discrepancies
    const discrepancies: DebugPersonalityResponse['discrepancies'] = [];

    const mainCategories = ['knowledge', 'creativity', 'vocabulary', 'courage', 'curiosity', 'teamwork', 'empathy', 'persistence', 'logic'];

    for (const category of mainCategories) {
      const storedValue = typeof storedTraits[category] === 'object' ? storedTraits[category].value : (storedTraits[category] || 0);
      const expectedValue = typeof expectedTraits[category] === 'object' ? expectedTraits[category].value : (expectedTraits[category] || 0);

      if (storedValue !== expectedValue) {
        discrepancies.push({
          trait: category,
          stored: storedValue,
          expected: expectedValue,
          difference: expectedValue - storedValue
        });
      }
    }

    console.log(`⚠️ Found ${discrepancies.length} discrepancies:`, discrepancies);

    return {
      avatarId: id,
      storedTraits,
      expectedTraitsFromMemories: expectedTraits,
      memorySummary,
      discrepancies
    };
  }
);