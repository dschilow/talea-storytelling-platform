import { avatarDB } from "../avatar/db";
import { dokuDB } from "../doku/db";
import { storyDB } from "../story/db";
import { userDB } from "../user/db";

export type ProfileContentCleanupSummary = {
  avatarsDeleted: number;
  storiesDeleted: number;
  dokusDeleted: number;
  removedStoryParticipationRows: number;
  removedDokuParticipationRows: number;
  removedStoryStateRows: number;
  removedDokuStateRows: number;
  removedAudioDokuStateRows: number;
  removedStoryQuizRows: number;
  removedDokuQuizRows: number;
  removedQuotaLedgerRows: number;
  profileDeleted: boolean;
};

export type UserContentCleanupSummary = {
  avatarsDeleted: number;
  storiesDeleted: number;
  dokusDeleted: number;
  audioDokusDeleted: number;
  generatedAudioLibraryDeleted: number;
  profilesDeleted: number;
  userDeleted: boolean;
};

async function countByUser(db: typeof userDB, tableName: string, userId: string): Promise<number> {
  const row = await db.rawQueryRow<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM ${tableName} WHERE user_id = $1`,
    userId
  );
  return parseInt(row?.count ?? "0", 10);
}

async function countByUserAndProfile(
  db: typeof userDB,
  tableName: string,
  userId: string,
  profileId: string
): Promise<number> {
  const row = await db.rawQueryRow<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM ${tableName} WHERE user_id = $1 AND profile_id = $2`,
    userId,
    profileId
  );
  return parseInt(row?.count ?? "0", 10);
}

async function countByPrimaryProfile(
  db: typeof storyDB,
  tableName: string,
  userId: string,
  profileId: string
): Promise<number> {
  const row = await db.rawQueryRow<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM ${tableName} WHERE user_id = $1 AND primary_profile_id = $2`,
    userId,
    profileId
  );
  return parseInt(row?.count ?? "0", 10);
}

async function countByProfileOnly(
  db: typeof storyDB,
  tableName: string,
  profileId: string
): Promise<number> {
  const row = await db.rawQueryRow<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM ${tableName} WHERE profile_id = $1`,
    profileId
  );
  return parseInt(row?.count ?? "0", 10);
}

export async function cleanupProfileContent(params: {
  userId: string;
  profileId: string;
}): Promise<ProfileContentCleanupSummary> {
  const { userId, profileId } = params;

  const [
    avatarsDeleted,
    storiesDeleted,
    dokusDeleted,
    removedStoryParticipationRows,
    removedDokuParticipationRows,
    removedStoryStateRows,
    removedDokuStateRows,
    removedAudioDokuStateRows,
    removedStoryQuizRows,
    removedDokuQuizRows,
    removedQuotaLedgerRows,
  ] = await Promise.all([
    countByUserAndProfile(avatarDB, "avatars", userId, profileId),
    countByPrimaryProfile(storyDB, "stories", userId, profileId),
    countByPrimaryProfile(dokuDB, "dokus", userId, profileId),
    countByProfileOnly(storyDB, "story_participants", profileId),
    countByProfileOnly(dokuDB, "doku_participants", profileId),
    countByProfileOnly(storyDB, "story_profile_state", profileId),
    countByProfileOnly(dokuDB, "doku_profile_state", profileId),
    countByProfileOnly(dokuDB, "audio_doku_profile_state", profileId),
    countByProfileOnly(storyDB, "story_quiz_results", profileId),
    countByProfileOnly(dokuDB, "doku_quiz_results", profileId),
    countByProfileOnly(userDB, "quota_ledger", profileId),
  ]);

  // Remove all profile-scoped state/participation first, then hard-delete profile-created content.
  await storyDB.exec`
    DELETE FROM story_quiz_results
    WHERE profile_id = ${profileId}
  `;
  await storyDB.exec`
    DELETE FROM story_profile_state
    WHERE profile_id = ${profileId}
  `;
  await storyDB.exec`
    DELETE FROM story_participants
    WHERE profile_id = ${profileId}
  `;

  await dokuDB.exec`
    DELETE FROM doku_quiz_results
    WHERE profile_id = ${profileId}
  `;
  await dokuDB.exec`
    DELETE FROM doku_profile_state
    WHERE profile_id = ${profileId}
  `;
  await dokuDB.exec`
    DELETE FROM audio_doku_profile_state
    WHERE profile_id = ${profileId}
  `;
  await dokuDB.exec`
    DELETE FROM doku_participants
    WHERE profile_id = ${profileId}
  `;

  await userDB.exec`
    DELETE FROM quota_ledger
    WHERE user_id = ${userId}
      AND profile_id = ${profileId}
  `;

  await avatarDB.exec`
    DELETE FROM avatars
    WHERE user_id = ${userId}
      AND profile_id = ${profileId}
  `;
  await storyDB.exec`
    DELETE FROM stories
    WHERE user_id = ${userId}
      AND primary_profile_id = ${profileId}
  `;
  await dokuDB.exec`
    DELETE FROM dokus
    WHERE user_id = ${userId}
      AND primary_profile_id = ${profileId}
  `;

  const profileRow = await userDB.queryRow<{ id: string }>`
    DELETE FROM child_profiles
    WHERE id = ${profileId}
      AND user_id = ${userId}
    RETURNING id
  `;

  return {
    avatarsDeleted,
    storiesDeleted,
    dokusDeleted,
    removedStoryParticipationRows,
    removedDokuParticipationRows,
    removedStoryStateRows,
    removedDokuStateRows,
    removedAudioDokuStateRows,
    removedStoryQuizRows,
    removedDokuQuizRows,
    removedQuotaLedgerRows,
    profileDeleted: Boolean(profileRow?.id),
  };
}

export async function cleanupUserContent(userId: string): Promise<UserContentCleanupSummary> {
  const [
    avatarsDeleted,
    storiesDeleted,
    dokusDeleted,
    audioDokusDeleted,
    generatedAudioLibraryDeleted,
    profilesDeleted,
  ] = await Promise.all([
    countByUser(avatarDB, "avatars", userId),
    countByUser(storyDB, "stories", userId),
    countByUser(dokuDB, "dokus", userId),
    countByUser(dokuDB, "audio_dokus", userId),
    countByUser(storyDB, "generated_audio_library", userId),
    countByUser(userDB, "child_profiles", userId),
  ]);

  // Avatars and sharing data
  await avatarDB.exec`
    DELETE FROM avatar_shares
    WHERE owner_user_id = ${userId}
       OR target_user_id = ${userId}
  `;
  await avatarDB.exec`
    DELETE FROM avatar_share_contacts
    WHERE owner_user_id = ${userId}
       OR target_user_id = ${userId}
  `;
  await avatarDB.exec`
    DELETE FROM avatar_family_blueprints
    WHERE user_id = ${userId}
  `;
  await avatarDB.exec`
    DELETE FROM avatars
    WHERE user_id = ${userId}
  `;

  // Story and doku content
  await storyDB.exec`
    DELETE FROM generated_audio_library
    WHERE user_id = ${userId}
  `;
  await storyDB.exec`
    DELETE FROM stories
    WHERE user_id = ${userId}
  `;
  await dokuDB.exec`
    DELETE FROM dokus
    WHERE user_id = ${userId}
  `;
  await dokuDB.exec`
    DELETE FROM audio_dokus
    WHERE user_id = ${userId}
  `;

  // User-related quota counters that don't have FK constraints.
  await userDB.exec`
    DELETE FROM generation_usage
    WHERE user_id = ${userId}
  `;

  const deletedUser = await userDB.queryRow<{ id: string }>`
    DELETE FROM users
    WHERE id = ${userId}
    RETURNING id
  `;

  return {
    avatarsDeleted,
    storiesDeleted,
    dokusDeleted,
    audioDokusDeleted,
    generatedAudioLibraryDeleted,
    profilesDeleted,
    userDeleted: Boolean(deletedUser?.id),
  };
}
