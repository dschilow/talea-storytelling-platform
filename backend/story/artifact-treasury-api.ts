// Artifact Treasury API ("Schatzkammer 2.0")
//
// User-facing endpoints for the artifact museum:
//   - treasuryOverview: sets, silhouettes, shard balance, journal highlights
//   - artifactJournal: full travel journal of one artifact
//   - bringableArtifacts: owned artifacts a wizard run can take along
//   - createShardOffer / redeemShardOffer: 5 Fundstücke → pick 1 of 3

import * as crypto from "crypto";
import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { storyDB } from "./db";
import { avatarDB } from "../avatar/db";
import { buildArtifactImageUrlForClient } from "../helpers/image-proxy";
import {
  SHARDS_PER_CHOICE,
  SHARD_OFFER_SIZE,
  findCompletedSetGrants,
  getOwnedPoolIdsByAvatar,
  getShardBalance,
  grantArtifactToAvatar,
  journeysUntilNextLevel,
  levelForJourneys,
  loadArtifactTemplateById,
  loadCrownArtifactIds,
  loadJourneyCounts,
  spendShards,
} from "./artifact-treasury";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function assertAvatarAccess(avatarId: string): Promise<{ id: string; name: string }> {
  const auth = getAuthData()!;
  const row = await avatarDB.queryRow<{ id: string; name: string; user_id: string }>`
    SELECT id, name, user_id FROM avatars WHERE id = ${avatarId} LIMIT 1
  `;
  if (!row) throw APIError.notFound("Avatar not found.");
  if (row.user_id !== auth.userID && auth.role !== "admin") {
    throw APIError.permissionDenied("Avatar belongs to another user.");
  }
  return { id: row.id, name: row.name };
}

export interface TreasuryArtifactView {
  id: string;
  name: string;
  nameEn?: string;
  description: string;
  category: string;
  rarity: string;
  emoji?: string;
  imageUrl?: string;
  storyRole?: string;
  owned: boolean;
  isCrown: boolean;
  level: number;
  journeys: number;
  journeysUntilNextLevel?: number;
  nextLevel?: number;
}

export interface TreasurySetView {
  id: string;
  name: string;
  nameEn?: string;
  description: string;
  emoji?: string;
  accentColor?: string;
  ownedCount: number;
  totalCount: number;
  crownArtifactId?: string;
  crownOwned: boolean;
  completed: boolean;
  artifacts: TreasuryArtifactView[];
}

export interface TreasuryOverviewResponse {
  avatarId: string;
  avatarName: string;
  shards: number;
  shardsForChoice: number;
  choiceReady: boolean;
  totalOwned: number;
  totalArtifacts: number;
  sets: TreasurySetView[];
  /** Artifacts without a set assignment (legacy/admin additions). */
  unsortedArtifacts: TreasuryArtifactView[];
  pendingOffer?: ShardOfferView;
}

interface PoolRow {
  id: string;
  name_de: string;
  name_en: string;
  description_de: string;
  description_en: string;
  category: string;
  rarity: string;
  story_role: string;
  emoji: string | null;
  image_url: string | null;
  set_id: string | null;
}

async function buildArtifactView(args: {
  row: PoolRow;
  owned: boolean;
  isCrown: boolean;
  journeys: number;
  includeImage: boolean;
}): Promise<TreasuryArtifactView> {
  const { row, owned, isCrown, journeys } = args;
  const imageUrl = args.includeImage
    ? (await buildArtifactImageUrlForClient(row.id, row.image_url || undefined)) || undefined
    : undefined;
  const next = journeysUntilNextLevel(journeys);
  const level = owned ? Math.max(1, levelForJourneys(journeys)) : 0;
  return {
    id: row.id,
    name: row.name_de || row.name_en,
    nameEn: row.name_en || undefined,
    description: row.description_de || row.description_en,
    category: row.category,
    rarity: row.rarity,
    emoji: row.emoji || undefined,
    imageUrl,
    storyRole: row.story_role || undefined,
    owned,
    isCrown,
    level,
    journeys,
    journeysUntilNextLevel: owned && next ? next.missing : undefined,
    nextLevel: owned && next ? next.nextLevel : undefined,
  };
}

// ---------------------------------------------------------------------------
// Treasury overview (museum)
// ---------------------------------------------------------------------------

export const treasuryOverview = api<{ avatarId: string }, TreasuryOverviewResponse>(
  { expose: true, method: "GET", path: "/artifacts/treasury/:avatarId", auth: true },
  async ({ avatarId }) => {
    const avatarInfo = await assertAvatarAccess(avatarId);

    const [ownedByAvatar, crownIds, journeyCounts, balance] = await Promise.all([
      getOwnedPoolIdsByAvatar([avatarId]),
      loadCrownArtifactIds(),
      loadJourneyCounts(avatarId),
      getShardBalance(avatarId),
    ]);
    const owned = ownedByAvatar.get(avatarId) || new Set<string>();

    const setRows = await storyDB.queryAll<{
      id: string;
      name_de: string;
      name_en: string;
      description_de: string;
      description_en: string;
      emoji: string | null;
      accent_color: string | null;
      crown_artifact_id: string | null;
      sort_order: number;
    }>`
      SELECT id, name_de, name_en, description_de, description_en, emoji, accent_color, crown_artifact_id, sort_order
      FROM artifact_sets
      ORDER BY sort_order ASC, id ASC
    `;

    const poolRows = await storyDB.queryAll<PoolRow>`
      SELECT id, name_de, name_en, description_de, description_en, category, rarity, story_role, emoji, image_url, set_id
      FROM artifact_pool
      WHERE is_active = TRUE
      ORDER BY rarity DESC, name_de ASC
    `;

    const sets: TreasurySetView[] = [];
    for (const setRow of setRows) {
      const members = poolRows.filter((row) => row.set_id === setRow.id);
      if (members.length === 0) continue;

      const artifacts: TreasuryArtifactView[] = [];
      for (const member of members) {
        const isOwned = owned.has(member.id);
        artifacts.push(
          await buildArtifactView({
            row: member,
            owned: isOwned,
            isCrown: member.id === setRow.crown_artifact_id,
            journeys: journeyCounts.get(member.id) || 0,
            // Locked artifacts stay silhouettes: no image URL leaves the API.
            includeImage: isOwned,
          })
        );
      }
      // Crown last, then owned before locked, then rarity.
      artifacts.sort((a, b) => {
        if (a.isCrown !== b.isCrown) return a.isCrown ? 1 : -1;
        if (a.owned !== b.owned) return a.owned ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      const nonCrown = artifacts.filter((entry) => !entry.isCrown);
      const crownOwned = artifacts.some((entry) => entry.isCrown && entry.owned);
      sets.push({
        id: setRow.id,
        name: setRow.name_de,
        nameEn: setRow.name_en || undefined,
        description: setRow.description_de,
        emoji: setRow.emoji || undefined,
        accentColor: setRow.accent_color || undefined,
        ownedCount: nonCrown.filter((entry) => entry.owned).length,
        totalCount: nonCrown.length,
        crownArtifactId: setRow.crown_artifact_id || undefined,
        crownOwned,
        completed: crownOwned,
        artifacts,
      });
    }

    const unsorted: TreasuryArtifactView[] = [];
    for (const row of poolRows.filter((entry) => !entry.set_id)) {
      const isOwned = owned.has(row.id);
      // Unsorted artifacts only appear once owned (keeps test/legacy rows hidden).
      if (!isOwned) continue;
      unsorted.push(
        await buildArtifactView({
          row,
          owned: true,
          isCrown: crownIds.has(row.id),
          journeys: journeyCounts.get(row.id) || 0,
          includeImage: true,
        })
      );
    }

    const pendingOffer = await loadPendingOffer(avatarId);

    return {
      avatarId,
      avatarName: avatarInfo.name,
      shards: balance.shards,
      shardsForChoice: SHARDS_PER_CHOICE,
      choiceReady: balance.shards >= SHARDS_PER_CHOICE,
      totalOwned: owned.size,
      totalArtifacts: poolRows.filter((row) => row.set_id).length,
      sets,
      unsortedArtifacts: unsorted,
      pendingOffer,
    };
  }
);

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

export interface ArtifactJournalEntryView {
  id: string;
  event: string;
  note?: string;
  storyId?: string;
  storyTitle?: string;
  createdAt: string;
}

export const artifactJournal = api<
  { avatarId: string; artifactId: string },
  { entries: ArtifactJournalEntryView[] }
>(
  { expose: true, method: "GET", path: "/artifacts/journal/:avatarId/:artifactId", auth: true },
  async ({ avatarId, artifactId }) => {
    await assertAvatarAccess(avatarId);
    const rows = await storyDB.queryAll<{
      id: string;
      event: string;
      note: string | null;
      story_id: string | null;
      story_title: string | null;
      created_at: Date;
    }>`
      SELECT id, event, note, story_id, story_title, created_at
      FROM artifact_journal
      WHERE avatar_id = ${avatarId} AND artifact_id = ${artifactId}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    return {
      entries: rows.map((row) => ({
        id: row.id,
        event: row.event,
        note: row.note || undefined,
        storyId: row.story_id || undefined,
        storyTitle: row.story_title || undefined,
        createdAt: new Date(row.created_at).toISOString(),
      })),
    };
  }
);

// ---------------------------------------------------------------------------
// Bringable artifacts (wizard "Mitnehmen" slot)
// ---------------------------------------------------------------------------

export interface BringableArtifactView {
  artifactId: string;
  avatarId: string;
  avatarName: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  emoji?: string;
  imageUrl?: string;
  storyRole?: string;
  level: number;
  journeys: number;
  journeysUntilNextLevel?: number;
  nextLevel?: number;
}

export const bringableArtifacts = api<
  { avatarIds: string[] },
  { artifacts: BringableArtifactView[] }
>(
  { expose: true, method: "POST", path: "/artifacts/bringable", auth: true },
  async ({ avatarIds }) => {
    const ids = Array.from(new Set((avatarIds || []).filter(Boolean))).slice(0, 6);
    if (ids.length === 0) return { artifacts: [] };

    const auth = getAuthData()!;
    const avatarRows = await avatarDB.queryAll<{ id: string; name: string; user_id: string }>`
      SELECT id, name, user_id FROM avatars WHERE id = ANY(${ids})
    `;
    const accessible = avatarRows.filter(
      (row) => row.user_id === auth.userID || auth.role === "admin"
    );
    if (accessible.length === 0) return { artifacts: [] };

    const ownedByAvatar = await getOwnedPoolIdsByAvatar(accessible.map((row) => row.id));
    const artifacts: BringableArtifactView[] = [];

    for (const avatarRow of accessible) {
      const owned = Array.from(ownedByAvatar.get(avatarRow.id) || []);
      if (owned.length === 0) continue;
      const journeyCounts = await loadJourneyCounts(avatarRow.id);

      const poolRows = await storyDB.queryAll<PoolRow>`
        SELECT id, name_de, name_en, description_de, description_en, category, rarity, story_role, emoji, image_url, set_id
        FROM artifact_pool
        WHERE id = ANY(${owned})
      `;

      for (const row of poolRows) {
        const journeys = journeyCounts.get(row.id) || 0;
        const next = journeysUntilNextLevel(journeys);
        artifacts.push({
          artifactId: row.id,
          avatarId: avatarRow.id,
          avatarName: avatarRow.name,
          name: row.name_de || row.name_en,
          description: row.description_de || row.description_en,
          category: row.category,
          rarity: row.rarity,
          emoji: row.emoji || undefined,
          imageUrl: (await buildArtifactImageUrlForClient(row.id, row.image_url || undefined)) || undefined,
          storyRole: row.story_role || undefined,
          level: levelForJourneys(journeys),
          journeys,
          journeysUntilNextLevel: next?.missing,
          nextLevel: next?.nextLevel,
        });
      }
    }

    artifacts.sort((a, b) => b.journeys - a.journeys || a.name.localeCompare(b.name));
    return { artifacts };
  }
);

// ---------------------------------------------------------------------------
// Shard offers (5 Fundstücke → pick 1 of 3)
// ---------------------------------------------------------------------------

export interface ShardOfferArtifactView {
  id: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  emoji?: string;
  imageUrl?: string;
  storyRole?: string;
  setId?: string;
  setName?: string;
}

export interface ShardOfferView {
  offerId: string;
  artifacts: ShardOfferArtifactView[];
  cost: number;
}

async function loadPendingOffer(avatarId: string): Promise<ShardOfferView | undefined> {
  const row = await storyDB.queryRow<{ id: string; artifact_ids: string[] }>`
    SELECT id, artifact_ids
    FROM artifact_shard_offers
    WHERE avatar_id = ${avatarId} AND redeemed_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (!row) return undefined;
  const artifacts = await hydrateOfferArtifacts(row.artifact_ids || []);
  if (artifacts.length === 0) return undefined;
  return { offerId: row.id, artifacts, cost: SHARDS_PER_CHOICE };
}

async function hydrateOfferArtifacts(artifactIds: string[]): Promise<ShardOfferArtifactView[]> {
  if (artifactIds.length === 0) return [];
  const rows = await storyDB.queryAll<PoolRow & { set_name_de: string | null }>`
    SELECT ap.id, ap.name_de, ap.name_en, ap.description_de, ap.description_en,
           ap.category, ap.rarity, ap.story_role, ap.emoji, ap.image_url, ap.set_id,
           s.name_de AS set_name_de
    FROM artifact_pool ap
    LEFT JOIN artifact_sets s ON ap.set_id = s.id
    WHERE ap.id = ANY(${artifactIds})
  `;
  const byId = new Map(rows.map((row) => [row.id, row]));
  const result: ShardOfferArtifactView[] = [];
  for (const id of artifactIds) {
    const row = byId.get(id);
    if (!row) continue;
    result.push({
      id: row.id,
      name: row.name_de || row.name_en,
      description: row.description_de || row.description_en,
      category: row.category,
      rarity: row.rarity,
      emoji: row.emoji || undefined,
      imageUrl: (await buildArtifactImageUrlForClient(row.id, row.image_url || undefined)) || undefined,
      storyRole: row.story_role || undefined,
      setId: row.set_id || undefined,
      setName: row.set_name_de || undefined,
    });
  }
  return result;
}

/**
 * Creates (or returns the existing) pick-1-of-3 offer. Offers avoid owned
 * artifacts, crowns and legendaries; they prefer artifacts that close set
 * gaps so collecting stays goal-driven.
 */
export const createShardOffer = api<{ avatarId: string }, ShardOfferView>(
  { expose: true, method: "POST", path: "/artifacts/shards/offer", auth: true },
  async ({ avatarId }) => {
    await assertAvatarAccess(avatarId);

    const existing = await loadPendingOffer(avatarId);
    if (existing) return existing;

    const balance = await getShardBalance(avatarId);
    if (balance.shards < SHARDS_PER_CHOICE) {
      throw APIError.failedPrecondition(
        `Nicht genug Fundstücke: ${balance.shards}/${SHARDS_PER_CHOICE}.`
      );
    }

    const [ownedByAvatar, crownIds] = await Promise.all([
      getOwnedPoolIdsByAvatar([avatarId]),
      loadCrownArtifactIds(),
    ]);
    const owned = ownedByAvatar.get(avatarId) || new Set<string>();

    const candidates = await storyDB.queryAll<{ id: string; rarity: string; set_id: string | null }>`
      SELECT id, rarity, set_id
      FROM artifact_pool
      WHERE is_active = TRUE AND rarity <> 'legendary' AND set_id IS NOT NULL
    `;
    const available = candidates.filter(
      (row) => !owned.has(row.id) && !crownIds.has(row.id)
    );
    if (available.length === 0) {
      throw APIError.failedPrecondition("Alle Schätze sind bereits gesammelt!");
    }

    // Weight: artifacts in sets where the avatar already owns something get a
    // boost, so choices help close sets instead of scattering.
    const ownedSetCounts = new Map<string, number>();
    for (const row of candidates) {
      if (row.set_id && owned.has(row.id)) {
        ownedSetCounts.set(row.set_id, (ownedSetCounts.get(row.set_id) || 0) + 1);
      }
    }
    const weighted = available.map((row) => ({
      id: row.id,
      weight: 1 + (row.set_id ? Math.min(3, ownedSetCounts.get(row.set_id) || 0) : 0),
    }));

    const picked: string[] = [];
    const poolCopy = [...weighted];
    while (picked.length < Math.min(SHARD_OFFER_SIZE, poolCopy.length + picked.length) && poolCopy.length > 0) {
      const totalWeight = poolCopy.reduce((sum, entry) => sum + entry.weight, 0);
      let roll = Math.random() * totalWeight;
      let index = 0;
      for (let i = 0; i < poolCopy.length; i += 1) {
        roll -= poolCopy[i].weight;
        if (roll <= 0) {
          index = i;
          break;
        }
      }
      picked.push(poolCopy[index].id);
      poolCopy.splice(index, 1);
    }

    const offerId = `so_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    await storyDB.exec`
      INSERT INTO artifact_shard_offers (id, avatar_id, artifact_ids)
      VALUES (${offerId}, ${avatarId}, ${picked})
    `;

    const artifacts = await hydrateOfferArtifacts(picked);
    return { offerId, artifacts, cost: SHARDS_PER_CHOICE };
  }
);

export interface RedeemShardOfferResponse {
  success: boolean;
  shards: number;
  artifact: ShardOfferArtifactView;
  completedSets: Array<{
    setId: string;
    setName: string;
    setEmoji?: string;
    crown: ShardOfferArtifactView;
  }>;
}

export const redeemShardOffer = api<
  { avatarId: string; offerId: string; artifactId: string },
  RedeemShardOfferResponse
>(
  { expose: true, method: "POST", path: "/artifacts/shards/redeem", auth: true },
  async ({ avatarId, offerId, artifactId }) => {
    await assertAvatarAccess(avatarId);

    const offer = await storyDB.queryRow<{ id: string; artifact_ids: string[] }>`
      SELECT id, artifact_ids
      FROM artifact_shard_offers
      WHERE id = ${offerId} AND avatar_id = ${avatarId} AND redeemed_at IS NULL
      LIMIT 1
    `;
    if (!offer) throw APIError.notFound("Angebot nicht gefunden oder bereits eingelöst.");
    if (!(offer.artifact_ids || []).includes(artifactId)) {
      throw APIError.invalidArgument("Dieses Artefakt ist nicht Teil des Angebots.");
    }

    const spent = await spendShards(avatarId, SHARDS_PER_CHOICE);
    if (!spent) {
      throw APIError.failedPrecondition("Nicht genug Fundstücke.");
    }

    // Mark redeemed atomically-ish; a failure after spendShards keeps the
    // offer open, so the child never loses shards without a treasure.
    const marked = await storyDB.queryRow<{ id: string }>`
      UPDATE artifact_shard_offers
      SET redeemed_at = NOW(), redeemed_artifact_id = ${artifactId}
      WHERE id = ${offerId} AND redeemed_at IS NULL
      RETURNING id
    `;
    if (!marked) {
      // Someone redeemed concurrently — refund.
      await storyDB.exec`
        UPDATE avatar_artifact_shards
        SET shards = shards + ${SHARDS_PER_CHOICE}, updated_at = CURRENT_TIMESTAMP
        WHERE avatar_id = ${avatarId}
      `;
      throw APIError.failedPrecondition("Angebot wurde bereits eingelöst.");
    }

    const template = await loadArtifactTemplateById(artifactId);
    if (!template) throw APIError.notFound("Artefakt nicht gefunden.");

    await grantArtifactToAvatar({
      artifact: template,
      avatarId,
      storyId: `shard_choice_${offerId}`,
      journalEvent: "shard_choice",
      journalNote: `Aus ${SHARDS_PER_CHOICE} Fundstücken gewählt.`,
    });

    // Set completion check after the new treasure landed.
    const ownedAfter = (await getOwnedPoolIdsByAvatar([avatarId])).get(avatarId) || new Set<string>();
    const setGrants = await findCompletedSetGrants(ownedAfter);
    const completedSets: RedeemShardOfferResponse["completedSets"] = [];
    for (const setGrant of setGrants) {
      const added = await grantArtifactToAvatar({
        artifact: setGrant.crown,
        avatarId,
        storyId: `set_crown_${setGrant.setId}`,
        journalEvent: "set_crown",
        journalNote: `Belohnung für das vollendete Set "${setGrant.setNameDe}".`,
      });
      if (!added) continue;
      completedSets.push({
        setId: setGrant.setId,
        setName: setGrant.setNameDe,
        setEmoji: setGrant.setEmoji,
        crown: {
          id: setGrant.crown.id,
          name: setGrant.crown.name.de || setGrant.crown.name.en,
          description: setGrant.crown.description.de || setGrant.crown.description.en,
          category: setGrant.crown.category,
          rarity: setGrant.crown.rarity,
          emoji: setGrant.crown.emoji,
          imageUrl:
            (await buildArtifactImageUrlForClient(setGrant.crown.id, setGrant.crown.imageUrl)) ||
            setGrant.crown.imageUrl,
        },
      });
    }

    const balance = await getShardBalance(avatarId);
    const [artifactView] = await hydrateOfferArtifacts([artifactId]);
    return {
      success: true,
      shards: balance.shards,
      artifact: artifactView,
      completedSets,
    };
  }
);
