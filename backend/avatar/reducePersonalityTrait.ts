import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { avatarDB } from "./db";

export interface ReducePersonalityTraitRequest {
  avatarId: string;
  trait: string; // e.g., "knowledge" or "knowledge.physics"
  amount: number; // Amount to reduce (positive number)
  reason?: string; // Optional reason for the reduction
}

export interface ReducePersonalityTraitResponse {
  success: boolean;
  updatedTraits: any;
  reduction: {
    trait: string;
    oldValue: number;
    newValue: number;
    amountReduced: number;
  };
}

// Manually reduce personality trait points (for corrections/deletions)
export const reducePersonalityTrait = api(
  { expose: true, method: "POST", path: "/avatar/:avatarId/reduce-trait", auth: true },
  async (req: ReducePersonalityTraitRequest): Promise<ReducePersonalityTraitResponse> => {
    const auth = getAuthData()!;
    const { avatarId, trait, amount, reason } = req;

    console.log(`🔻 Reducing trait ${trait} by ${amount} for avatar ${avatarId}${reason ? ` (${reason})` : ''}`);

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

    if (amount <= 0) {
      throw APIError.invalidArgument("Amount must be positive");
    }

    const currentTraits = JSON.parse(avatar.personality_traits);
    const updatedTraits = { ...currentTraits };

    let oldValue = 0;
    let newValue = 0;
    let actualReduction = 0;

    if (trait.includes('.')) {
      // Handle hierarchical traits (e.g., "knowledge.physics")
      const [baseKey, subcategory] = trait.split('.');

      if (!(baseKey in updatedTraits) || !updatedTraits[baseKey].subcategories) {
        throw APIError.invalidArgument(`Trait ${baseKey} or subcategory ${subcategory} not found`);
      }

      oldValue = updatedTraits[baseKey].subcategories[subcategory] || 0;
      newValue = Math.max(0, oldValue - amount);
      actualReduction = oldValue - newValue;

      if (newValue > 0) {
        updatedTraits[baseKey].subcategories[subcategory] = newValue;
      } else {
        // Remove subcategory if it reaches 0
        delete updatedTraits[baseKey].subcategories[subcategory];
        console.log(`  🗑️ Removed empty subcategory: ${baseKey}.${subcategory}`);
      }

      // Update main category value (sum of subcategories)
      const subcategorySum = Object.values(updatedTraits[baseKey].subcategories).reduce((sum: number, val: any) => sum + val, 0);
      updatedTraits[baseKey].value = subcategorySum;

      console.log(`  📉 ${baseKey}.${subcategory}: ${oldValue} → ${newValue} (reduced by ${actualReduction})`);
      console.log(`  📊 ${baseKey} total: ${updatedTraits[baseKey].value}`);
    } else {
      // Handle direct base trait updates
      if (!(trait in updatedTraits)) {
        throw APIError.invalidArgument(`Trait ${trait} not found`);
      }

      oldValue = typeof updatedTraits[trait] === 'object'
        ? updatedTraits[trait].value
        : updatedTraits[trait];
      newValue = Math.max(0, oldValue - amount);
      actualReduction = oldValue - newValue;

      if (typeof updatedTraits[trait] === 'object') {
        updatedTraits[trait].value = newValue;
      } else {
        updatedTraits[trait] = { value: newValue, subcategories: {} };
      }

      console.log(`  📉 ${trait}: ${oldValue} → ${newValue} (reduced by ${actualReduction})`);
    }

    // Update avatar's personality traits
    await avatarDB.exec`
      UPDATE avatars
      SET personality_traits = ${JSON.stringify(updatedTraits)},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${avatarId}
    `;

    console.log(`✅ Trait ${trait} reduced by ${actualReduction} for avatar ${avatarId}`);

    return {
      success: true,
      updatedTraits,
      reduction: {
        trait,
        oldValue,
        newValue,
        amountReduced: actualReduction
      }
    };
  }
);