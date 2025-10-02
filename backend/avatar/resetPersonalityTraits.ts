import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { getDefaultPersonalityTraits } from "../constants/personalityTraits";
import { avatarDB } from "./db";

interface ResetPersonalityTraitsResponse {
  success: boolean;
  updatedAvatars: number;
  message: string;
}

// Resets all personality traits of user's avatars to start at 0 (new system)
export const resetPersonalityTraits = api(
  { expose: true, method: "POST", path: "/avatar/reset-personality-traits", auth: true },
  async (): Promise<ResetPersonalityTraitsResponse> => {
    const auth = getAuthData()!;
    const userId = auth.userID;

    console.log(`🔄 Resetting personality traits for user ${userId} to new system (all start at 0)`);

    try {
      // Get all avatars for this user
      const userAvatars = await avatarDB.queryAll<{
        id: string;
        name: string;
        personality_traits: string;
      }>`
        SELECT id, name, personality_traits FROM avatars WHERE user_id = ${userId}
      `;

      console.log(`👥 Found ${userAvatars.length} avatars for user ${userId}`);

      const defaultTraits = getDefaultPersonalityTraits();
      let updatedCount = 0;

      for (const avatar of userAvatars) {
        try {
          console.log(`🔄 Updating ${avatar.name} (${avatar.id}) to new personality system`);

          // Update avatar with default traits (all 0)
          await avatarDB.exec`
            UPDATE avatars SET
              personality_traits = ${JSON.stringify(defaultTraits)},
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ${avatar.id}
          `;

          updatedCount++;
          console.log(`✅ Updated ${avatar.name} successfully`);

        } catch (error) {
          console.error(`❌ Failed to update ${avatar.name}:`, error);
        }
      }

      console.log(`🎉 Reset complete: ${updatedCount}/${userAvatars.length} avatars updated`);

      return {
        success: true,
        updatedAvatars: updatedCount,
        message: `Successfully reset ${updatedCount} avatar(s) to new personality system (all traits start at 0)`
      };

    } catch (error) {
      console.error(`💥 Error resetting personality traits:`, error);
      throw error;
    }
  }
);