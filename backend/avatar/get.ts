import { api, APIError } from "encore.dev/api";
import type { Avatar, AvatarVisualProfile } from "./avatar";
import { getAuthData } from "~encore/auth";
import { upgradePersonalityTraits } from "./upgradePersonalityTraits";
import { avatarDB } from "./db";
import { buildAvatarImageUrlForClient } from "../helpers/image-proxy";
import { buildAvatarProgressionSummary } from "./progression";
import { ensureAvatarSharingTables, findAvatarShareForIdentity, getUserProfileById } from "./sharing";

interface GetAvatarParams {
  id: string;
}

// Retrieves a specific avatar by ID.
export const get = api<GetAvatarParams, Avatar>(
  { expose: true, method: "GET", path: "/avatar/:id", auth: true },
  async ({ id }) => {
    try {
      const auth = getAuthData()!;
      await ensureAvatarSharingTables();
      const row = await avatarDB.queryRow<{
        id: string;
        user_id: string;
        name: string;
        description: string | null;
        physical_traits: string;
        personality_traits: string;
        image_url: string | null;
        visual_profile: string | null;
        creation_type: "ai-generated" | "photo-upload";
        is_public: boolean;
        original_avatar_id: string | null;
        created_at: Date;
        updated_at: Date;
        inventory: string;
        skills: string;
      }>`
        SELECT * FROM avatars WHERE id = ${id}
      `;

      if (!row) {
        throw APIError.notFound("Avatar not found");
      }

      const isOwner = row.user_id === auth.userID;
      let shareMatch = null;

      if (!isOwner && auth.role !== "admin" && !row.is_public) {
        shareMatch = await findAvatarShareForIdentity({
          avatarId: id,
          userId: auth.userID,
          email: auth.email,
        });

        if (!shareMatch) {
          throw APIError.permissionDenied("You do not have permission to view this avatar.");
        }
      } else if (!isOwner) {
        shareMatch = await findAvatarShareForIdentity({
          avatarId: id,
          userId: auth.userID,
          email: auth.email,
        });
      }

      let rawPersonalityTraits;
      try {
        rawPersonalityTraits = JSON.parse(row.personality_traits);
      } catch {
        throw APIError.internal("Failed to parse avatar personality traits");
      }

      const baseTraits = [
        "knowledge",
        "creativity",
        "vocabulary",
        "courage",
        "curiosity",
        "teamwork",
        "empathy",
        "persistence",
        "logic",
      ];
      const needsUpgrade = !baseTraits.every((trait) => trait in rawPersonalityTraits);

      let upgradedPersonalityTraits = rawPersonalityTraits;
      if (needsUpgrade) {
        try {
          upgradedPersonalityTraits = upgradePersonalityTraits(rawPersonalityTraits);

          await avatarDB.exec`
            UPDATE avatars
            SET personality_traits = ${JSON.stringify(upgradedPersonalityTraits)},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${id}
          `;
        } catch {
          upgradedPersonalityTraits = rawPersonalityTraits;
        }
      }

      let parsedPhysicalTraits;
      try {
        parsedPhysicalTraits = JSON.parse(row.physical_traits);
      } catch {
        throw APIError.internal("Failed to parse avatar physical traits");
      }

      let parsedVisualProfile: AvatarVisualProfile | undefined;
      try {
        parsedVisualProfile = row.visual_profile ? (JSON.parse(row.visual_profile) as AvatarVisualProfile) : undefined;
      } catch {
        parsedVisualProfile = undefined;
      }

      const imageUrl = await buildAvatarImageUrlForClient(row.id, row.image_url || undefined);

      const progressionStats = await avatarDB.queryRow<{
        stories_read: number;
        dokus_read: number;
        memory_count: number;
      }>`
        SELECT
          (SELECT COUNT(*)::int FROM avatar_story_read WHERE avatar_id = ${id}) AS stories_read,
          (SELECT COUNT(*)::int FROM avatar_doku_read WHERE avatar_id = ${id}) AS dokus_read,
          (SELECT COUNT(*)::int FROM avatar_memories WHERE avatar_id = ${id}) AS memory_count
      `;

      const progression = buildAvatarProgressionSummary({
        traits: upgradedPersonalityTraits as any,
        stats: {
          storiesRead: progressionStats?.stories_read ?? 0,
          dokusRead: progressionStats?.dokus_read ?? 0,
          memoryCount: progressionStats?.memory_count ?? 0,
        },
      });

      const activeShareRows = isOwner
        ? await avatarDB.queryAll<{
            contact_id: string;
            contact_email: string;
            display_name: string;
            is_trusted: boolean;
            created_at: Date;
          }>`
            SELECT
              s.contact_id,
              c.contact_email,
              c.display_name,
              c.is_trusted,
              s.created_at
            FROM avatar_shares s
            INNER JOIN avatar_share_contacts c ON c.id = s.contact_id
            WHERE s.avatar_id = ${id}
              AND s.owner_user_id = ${auth.userID}
            ORDER BY c.display_name ASC
          `
        : [];

      const sharedByProfile = !isOwner && shareMatch ? await getUserProfileById(row.user_id) : null;

      return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        description: row.description || undefined,
        physicalTraits: parsedPhysicalTraits,
        personalityTraits: upgradedPersonalityTraits,
        imageUrl,
        visualProfile: parsedVisualProfile,
        creationType: row.creation_type,
        isPublic: row.is_public,
        isShared: isOwner ? activeShareRows.length > 0 : Boolean(shareMatch),
        isOwnedByCurrentUser: isOwner,
        sharedBy:
          !isOwner && shareMatch
            ? {
                userId: row.user_id,
                name: sharedByProfile?.name ?? undefined,
                email: sharedByProfile?.email ?? undefined,
                sharedAt: shareMatch.sharedAt.toISOString(),
              }
            : undefined,
        sharedWithCount: isOwner ? activeShareRows.length : undefined,
        activeShareRecipients: isOwner
          ? activeShareRows.map((entry) => ({
              contactId: entry.contact_id,
              contactEmail: entry.contact_email,
              contactLabel: entry.display_name,
              trusted: entry.is_trusted,
              sharedAt: entry.created_at.toISOString(),
            }))
          : undefined,
        originalAvatarId: row.original_avatar_id || undefined,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        inventory: row.inventory ? JSON.parse(row.inventory) : [],
        skills: row.skills ? JSON.parse(row.skills) : [],
        progression,
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }

      throw APIError.internal(`Failed to load avatar: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);
