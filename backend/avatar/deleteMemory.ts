import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { avatarDB } from "./db";

type MemoryContentType = "story" | "doku" | "quiz" | "activity";

export interface DeleteMemoryRequest {
  avatarId: string;
  memoryId: string;
}

export interface DeleteMemoryResponse {
  success: boolean;
  deletedMemoryId: string;
  recalculatedTraits?: any;
}

function normalizeContentType(value?: string): MemoryContentType {
  if (value === "doku" || value === "quiz" || value === "activity") {
    return value;
  }
  return "story";
}

export const deleteMemory = api(
  { expose: true, method: "DELETE", path: "/avatar/:avatarId/memory/:memoryId", auth: true },
  async (req: DeleteMemoryRequest): Promise<DeleteMemoryResponse> => {
    const auth = getAuthData()!;
    const { avatarId, memoryId } = req;

    const avatar = await avatarDB.queryRow<{
      id: string;
      user_id: string;
      personality_traits: string;
    }>`
      SELECT id, user_id, personality_traits
      FROM avatars
      WHERE id = ${avatarId}
    `;

    if (!avatar) {
      throw APIError.notFound("Avatar not found");
    }

    if (avatar.user_id !== auth.userID && auth.role !== "admin") {
      throw APIError.permissionDenied("You do not have permission to modify this avatar");
    }

    const memoryToDelete = await avatarDB.queryRow<{
      id: string;
      story_id: string | null;
      story_title: string;
      content_type: string | null;
      personality_changes: string;
    }>`
      SELECT id, story_id, story_title, content_type, personality_changes
      FROM avatar_memories
      WHERE id = ${memoryId} AND avatar_id = ${avatarId}
    `;

    if (!memoryToDelete) {
      throw APIError.notFound("Memory not found");
    }

    const personalityChanges = JSON.parse(memoryToDelete.personality_changes ?? "[]");
    const currentTraits = JSON.parse(avatar.personality_traits);
    const updatedTraits = { ...currentTraits };

    personalityChanges.forEach((change: any) => {
      if (!change || typeof change !== "object" || typeof change.trait !== "string") {
        return;
      }

      const traitIdentifier = change.trait;
      const rawChange = typeof change.change === "number" && Number.isFinite(change.change) ? change.change : 0;
      const reversedChange = -rawChange;

      if (traitIdentifier.includes(".")) {
        const [baseKey, subcategory] = traitIdentifier.split(".");

        if (baseKey in updatedTraits && updatedTraits[baseKey].subcategories) {
          const currentSubcategoryValue = updatedTraits[baseKey].subcategories[subcategory] || 0;
          const newSubcategoryValue = Math.max(0, currentSubcategoryValue + reversedChange);

          if (newSubcategoryValue > 0) {
            updatedTraits[baseKey].subcategories[subcategory] = newSubcategoryValue;
          } else {
            delete updatedTraits[baseKey].subcategories[subcategory];
          }

          const subcategorySum = Object.values(updatedTraits[baseKey].subcategories).reduce(
            (sum: number, value: any) => sum + Number(value || 0),
            0
          );
          updatedTraits[baseKey].value = subcategorySum;
        }
      } else if (traitIdentifier in updatedTraits) {
        const oldValue =
          typeof updatedTraits[traitIdentifier] === "object"
            ? updatedTraits[traitIdentifier].value
            : updatedTraits[traitIdentifier];

        const newValue = Math.max(0, oldValue + reversedChange);

        if (typeof updatedTraits[traitIdentifier] === "object") {
          updatedTraits[traitIdentifier].value = newValue;
        } else {
          updatedTraits[traitIdentifier] = { value: newValue, subcategories: {} };
        }
      }
    });

    await avatarDB.exec`
      DELETE FROM avatar_memories
      WHERE id = ${memoryId} AND avatar_id = ${avatarId}
    `;

    const contentType = normalizeContentType(memoryToDelete.content_type ?? undefined);
    const sourceId = memoryToDelete.story_id;

    try {
      if (contentType === "doku" && sourceId) {
        await avatarDB.exec`
          DELETE FROM avatar_doku_read
          WHERE avatar_id = ${avatarId}
            AND doku_id = ${sourceId}
        `;
      }

      if (contentType === "story" && sourceId) {
        await avatarDB.exec`
          DELETE FROM avatar_story_read
          WHERE avatar_id = ${avatarId}
            AND story_id = ${sourceId}
        `;
      }
    } catch (trackingError) {
      console.warn("Could not update content read tracking after memory delete", trackingError);
    }

    await avatarDB.exec`
      UPDATE avatars
      SET personality_traits = ${JSON.stringify(updatedTraits)},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${avatarId}
    `;

    return {
      success: true,
      deletedMemoryId: memoryId,
      recalculatedTraits: updatedTraits,
    };
  }
);
