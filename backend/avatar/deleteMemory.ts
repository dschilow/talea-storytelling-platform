import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { avatarDB } from "./db";

export interface DeleteMemoryRequest {
  avatarId: string;
  memoryId: string;
}

export interface DeleteMemoryResponse {
  success: boolean;
  deletedMemoryId: string;
  recalculatedTraits?: any; // Updated personality traits after recalculation
}

// Deletes a specific memory and recalculates personality traits
export const deleteMemory = api(
  { expose: true, method: "DELETE", path: "/avatar/:avatarId/memory/:memoryId", auth: true },
  async (req: DeleteMemoryRequest): Promise<DeleteMemoryResponse> => {
    const auth = getAuthData()!;
    const { avatarId, memoryId } = req;

    console.log(`🗑️ Deleting memory ${memoryId} for avatar ${avatarId}`);

    // Verify avatar ownership
    const avatar = await avatarDB.queryRow<{
      id: string;
      user_id: string;
      personality_traits: string;
    }>`
      SELECT id, user_id, personality_traits FROM avatars WHERE id = ${avatarId}
    `;

    if (!avatar) {
      throw APIError.notFound("Avatar not found");
    }

    if (avatar.user_id !== auth.userID && auth.role !== 'admin') {
      throw APIError.permissionDenied("You do not have permission to modify this avatar");
    }

    // Get the memory to be deleted (to reverse its personality changes)
    const memoryToDelete = await avatarDB.queryRow<{
      id: string;
      personality_changes: string;
      story_title: string;
    }>`
      SELECT id, personality_changes, story_title FROM avatar_memories
      WHERE id = ${memoryId} AND avatar_id = ${avatarId}
    `;

    if (!memoryToDelete) {
      throw APIError.notFound("Memory not found");
    }

    console.log(`🔍 Found memory to delete: ${memoryToDelete.story_title}`);

    // Parse the personality changes to reverse them
    const personalityChanges = JSON.parse(memoryToDelete.personality_changes);
    console.log(`📊 Reversing personality changes:`, personalityChanges);

    // Reverse the personality changes
    const currentTraits = JSON.parse(avatar.personality_traits);
    const updatedTraits = { ...currentTraits };

    personalityChanges.forEach((change: any) => {
      const traitIdentifier = change.trait;
      const reversedChange = -change.change; // Reverse the change

      console.log(`🔄 Reversing ${traitIdentifier}: ${change.change} → ${reversedChange}`);

      if (traitIdentifier.includes('.')) {
        // Handle hierarchical traits (e.g., "knowledge.physics")
        const [baseKey, subcategory] = traitIdentifier.split('.');

        if (baseKey in updatedTraits && updatedTraits[baseKey].subcategories) {
          const currentSubcategoryValue = updatedTraits[baseKey].subcategories[subcategory] || 0;
          const newSubcategoryValue = Math.max(0, currentSubcategoryValue + reversedChange);

          if (newSubcategoryValue > 0) {
            updatedTraits[baseKey].subcategories[subcategory] = newSubcategoryValue;
          } else {
            // Remove subcategory if it reaches 0
            delete updatedTraits[baseKey].subcategories[subcategory];
            console.log(`  🗑️ Removed empty subcategory after memory deletion: ${baseKey}.${subcategory}`);
          }

          // Update main category value (sum of subcategories)
          const subcategorySum = Object.values(updatedTraits[baseKey].subcategories).reduce((sum: number, val: any) => sum + val, 0);
          updatedTraits[baseKey].value = subcategorySum;

          console.log(`  📉 ${baseKey}.${subcategory}: ${currentSubcategoryValue} → ${newSubcategoryValue} (main total: ${subcategorySum})`);
        }
      } else {
        // Handle direct base trait updates
        if (traitIdentifier in updatedTraits) {
          const oldValue = typeof updatedTraits[traitIdentifier] === 'object'
            ? updatedTraits[traitIdentifier].value
            : updatedTraits[traitIdentifier];
          const newValue = Math.max(0, oldValue + reversedChange);

          if (typeof updatedTraits[traitIdentifier] === 'object') {
            updatedTraits[traitIdentifier].value = newValue;
          } else {
            updatedTraits[traitIdentifier] = { value: newValue, subcategories: {} };
          }

          console.log(`  📉 ${traitIdentifier}: ${oldValue} → ${newValue}`);
        }
      }
    });

    // Delete the memory from database
    await avatarDB.exec`
      DELETE FROM avatar_memories WHERE id = ${memoryId} AND avatar_id = ${avatarId}
    `;

    // If this memory was from a doku, also remove the doku read tracking
    // so the user can re-read the doku and get the personality changes again
    try {
      if (memoryToDelete.story_title) {
        const dokuReadResult = await avatarDB.exec`
          DELETE FROM avatar_doku_read
          WHERE avatar_id = ${avatarId} AND doku_title = ${memoryToDelete.story_title}
        `;

        if (dokuReadResult.rowsAffected && dokuReadResult.rowsAffected > 0) {
          console.log(`🗑️ Also removed doku read tracking for "${memoryToDelete.story_title}"`);
        }
      }
    } catch (dokuTrackingError) {
      console.log(`⚠️ Could not remove doku read tracking: ${dokuTrackingError}`);
      // Don't fail the entire operation if doku tracking removal fails
    }

    // Update avatar's personality traits
    await avatarDB.exec`
      UPDATE avatars
      SET personality_traits = ${JSON.stringify(updatedTraits)},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${avatarId}
    `;

    console.log(`✅ Memory ${memoryId} deleted and personality traits recalculated for avatar ${avatarId}`);

    return {
      success: true,
      deletedMemoryId: memoryId,
      recalculatedTraits: updatedTraits
    };
  }
);