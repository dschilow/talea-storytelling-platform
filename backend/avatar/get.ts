import { api, APIError } from "encore.dev/api";
import type { Avatar, AvatarVisualProfile } from "./avatar";
import { getAuthData } from "~encore/auth";
import { upgradePersonalityTraits } from "./upgradePersonalityTraits";
import { avatarDB } from "./db";
import { buildAvatarImageUrlForClient } from "../helpers/image-proxy";
import { buildAvatarProgressionSummary } from "./progression";
import { ensureAvatarSharingTables } from "./sharing";
import { resolveRequestedProfileId } from "../helpers/profiles";
import { ensureAvatarProfileLinksTable, hasAvatarProfileLink } from "./profile-links";
import { ensureAvatarColumns, normalizeAvatarRole } from "./schema";

interface GetAvatarParams {
  id: string;
  profileId?: string;
}

// Retrieves a specific avatar by ID.
export const get = api<GetAvatarParams, Avatar>(
  { expose: true, method: "GET", path: "/avatar/:id", auth: true },
  async ({ id, profileId }) => {
    try {
      const auth = getAuthData()!;
      await ensureAvatarColumns();
      await ensureAvatarSharingTables();
      await ensureAvatarProfileLinksTable();
      const activeProfileId = await resolveRequestedProfileId({
        userId: auth.userID,
        requestedProfileId: profileId,
      });
      const row = await avatarDB.queryRow<{
        id: string;
        user_id: string;
        profile_id: string | null;
        name: string;
        description: string | null;
        physical_traits: string;
        personality_traits: string;
        image_url: string | null;
        visual_profile: string | null;
        creation_type: "ai-generated" | "photo-upload";
        is_public: boolean;
        source_type: string | null;
        avatar_role: string | null;
        source_avatar_id: string | null;
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

      if (isOwner && row.profile_id && row.profile_id !== activeProfileId && auth.role !== "admin") {
        const linkedToActive = await hasAvatarProfileLink({
          avatarId: id,
          userId: auth.userID,
          profileId: activeProfileId,
        });
        if (!linkedToActive) {
          throw APIError.permissionDenied("Avatar belongs to another child profile.");
        }
      }

      if (!isOwner && auth.role !== "admin" && !row.is_public) {
        throw APIError.permissionDenied("You do not have permission to view this avatar.");
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

      return {
        id: row.id,
        userId: row.user_id,
        profileId: isOwner ? activeProfileId : row.profile_id || undefined,
        name: row.name,
        description: row.description || undefined,
        physicalTraits: parsedPhysicalTraits,
        personalityTraits: upgradedPersonalityTraits,
        imageUrl,
        visualProfile: parsedVisualProfile,
        creationType: row.creation_type,
        isPublic: row.is_public,
        isShared: isOwner ? activeShareRows.length > 0 : false,
        isOwnedByCurrentUser: isOwner,
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
        avatarRole: normalizeAvatarRole(row.avatar_role),
        sourceType: (row.source_type as Avatar["sourceType"]) || "profile",
        sourceAvatarId: row.source_avatar_id || undefined,
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
