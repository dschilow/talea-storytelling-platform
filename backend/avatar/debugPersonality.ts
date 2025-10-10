import { api, APIError } from "encore.dev/api";
import { upgradePersonalityTraits } from "./upgradePersonalityTraits";
import { avatarDB } from "./db";

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
    const { id } = req;

    console.log(`🔍 Debugging personality for avatar ${id}`);

    // Get current stored personality traits
    const avatarRow = await avatarDB.queryRow<{
      id: string;
      personality_traits: string;
    }>`
      SELECT id, personality_traits FROM avatars WHERE id = ${id}
    `;

    if (!avatarRow) {
      throw APIError.notFound("Avatar not found");
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
            const key = baseKey as keyof typeof expectedTraits;
            // Ensure hierarchical structure exists
            if (typeof expectedTraits[key] === 'number') {
              expectedTraits[key] = { value: expectedTraits[key] as number, subcategories: {} };
            }

            const traitObj = expectedTraits[key] as { value: number; subcategories: Record<string, number> };
            const currentSubcategoryValue = traitObj.subcategories?.[subcategory] || 0;
            const newSubcategoryValue = Math.max(0, currentSubcategoryValue + change.change);

            if (!traitObj.subcategories) traitObj.subcategories = {};
            traitObj.subcategories[subcategory] = newSubcategoryValue;

            // Update main category value (sum of subcategories)
            const subcategorySum = Object.values(traitObj.subcategories).reduce((sum: number, val: number) => sum + val, 0);
            traitObj.value = subcategorySum;

            console.log(`  📈 ${baseKey}.${subcategory}: ${currentSubcategoryValue} → ${newSubcategoryValue} (main total: ${subcategorySum})`);
          }
        } else {
          // Handle direct base trait updates
          if (traitIdentifier in expectedTraits) {
            const key = traitIdentifier as keyof typeof expectedTraits;
            const currentTrait = expectedTraits[key];
            const oldValue = typeof currentTrait === 'number' ? currentTrait : currentTrait.value;
            const newValue = Math.max(0, oldValue + change.change);

            if (typeof currentTrait === 'object') {
              (expectedTraits[key] as { value: number; subcategories?: Record<string, number> }).value = newValue;
            } else {
              expectedTraits[key] = { value: newValue, subcategories: {} };
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
      const key = category as keyof PersonalityTraits;
      const storedTrait = storedTraits[key];
      const expectedTrait = expectedTraits[key];
      const storedValue = typeof storedTrait === 'object' ? storedTrait.value : (storedTrait || 0);
      const expectedValue = typeof expectedTrait === 'object' ? expectedTrait.value : (expectedTrait || 0);

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