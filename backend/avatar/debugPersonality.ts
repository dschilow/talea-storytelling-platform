import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { upgradePersonalityTraits } from "./upgradePersonalityTraits";

const avatarDB = new SQLDatabase("avatar", {
  migrations: "./migrations",
});

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
            // Ensure hierarchical structure exists
            if (typeof expectedTraits[baseKey] === 'number') {
              expectedTraits[baseKey] = { value: expectedTraits[baseKey], subcategories: {} };
            }

            const currentSubcategoryValue = expectedTraits[baseKey].subcategories[subcategory] || 0;
            const newSubcategoryValue = Math.max(0, currentSubcategoryValue + change.change);

            expectedTraits[baseKey].subcategories[subcategory] = newSubcategoryValue;

            // Update main category value (sum of subcategories)
            const subcategorySum = Object.values(expectedTraits[baseKey].subcategories).reduce((sum, val) => sum + val, 0);
            expectedTraits[baseKey].value = subcategorySum;

            console.log(`  📈 ${baseKey}.${subcategory}: ${currentSubcategoryValue} → ${newSubcategoryValue} (main total: ${subcategorySum})`);
          }
        } else {
          // Handle direct base trait updates
          if (traitIdentifier in expectedTraits) {
            const currentTrait = expectedTraits[traitIdentifier];
            const oldValue = typeof currentTrait === 'number' ? currentTrait : currentTrait.value;
            const newValue = Math.max(0, oldValue + change.change);

            if (typeof currentTrait === 'object') {
              expectedTraits[traitIdentifier].value = newValue;
            } else {
              expectedTraits[traitIdentifier] = { value: newValue, subcategories: {} };
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