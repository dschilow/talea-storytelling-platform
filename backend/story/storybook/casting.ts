/**
 * Storybook Pipeline — database side of casting and artifacts.
 *
 * Pure selection lives in cast-selection.ts; this file only loads rows and
 * records usage. Every read is best-effort: an unavailable pool yields a story
 * without pool characters, never a failed story.
 */

import { APIError } from "encore.dev/api";
import { storyDB } from "../db";
import { getOwnedPoolIdsByAvatar, loadCrownArtifactIds } from "../artifact-treasury";
import { selectRewardArtifacts, shortlistCastCandidates, toArtifactOption } from "./cast-selection";
import type { AgeBand } from "./craft";
import type { ArtifactOption, CastCandidate } from "./types";

export async function loadCastCandidates(input: {
  enabled: boolean;
  genre?: string;
  setting?: string;
  band: AgeBand;
  excludeNames: Set<string>;
  seed: string;
}): Promise<CastCandidate[]> {
  if (!input.enabled) return [];
  try {
    const rows = await storyDB.queryAll<Record<string, any>>`
      SELECT id, name, image_url, role, archetype, emotional_nature, visual_profile,
             age_category, species_category, personality_keywords, physical_description,
             backstory, dominant_personality, secondary_traits, catchphrase, catchphrase_context,
             speech_style, emotional_triggers, quirk, canon_settings, recent_usage_count,
             total_usage_count, last_used_at, is_active
      FROM character_pool
      WHERE is_active = TRUE
    `;
    return shortlistCastCandidates({ rows, genre: input.genre, setting: input.setting, band: input.band, excludeNames: input.excludeNames, seed: input.seed });
  } catch (err) {
    console.warn("[storybook/casting] character_pool unavailable, continuing without pool characters:", err);
    return [];
  }
}

/** Records pool usage so the rotation actually rotates. Best-effort. */
export async function recordCastUsage(storyId: string | undefined, castIds: string[]): Promise<void> {
  if (!storyId || castIds.length === 0) return;
  for (const id of castIds) {
    try {
      await storyDB.exec`
        UPDATE character_pool
        SET recent_usage_count = COALESCE(recent_usage_count, 0) + 1,
            total_usage_count = COALESCE(total_usage_count, 0) + 1,
            last_used_at = NOW()
        WHERE id = ${id}
      `;
    } catch (err) {
      console.warn("[storybook/casting] failed to record pool usage", id, err);
    }
  }
}

/**
 * The wizard decides: a brought artifact (Mitnehmen-Loop) is mandatory and is
 * the only artifact in the story; otherwise up to three reward options the
 * concept may use when one fits.
 */
export async function loadArtifactOptions(input: {
  avatarIds: string[];
  brought?: { artifactId: string; avatarId: string };
  genre?: string;
  language?: string;
  seed: string;
}): Promise<ArtifactOption[]> {
  let rows: Array<Record<string, any>> = [];
  try {
    rows = await storyDB.queryAll<Record<string, any>>`SELECT * FROM artifact_pool WHERE is_active = TRUE`;
  } catch (err) {
    console.warn("[storybook/casting] artifact_pool unavailable:", err);
    if (input.brought) throw APIError.unavailable("Das mitgebrachte Artefakt konnte nicht geladen werden.");
    return [];
  }
  const ownedByAvatar = await getOwnedPoolIdsByAvatar(input.avatarIds);

  if (input.brought) {
    const { artifactId, avatarId } = input.brought;
    if (!input.avatarIds.includes(avatarId) || !ownedByAvatar.get(avatarId)?.has(artifactId)) {
      throw APIError.invalidArgument("Das mitgebrachte Artefakt gehört keinem der ausgewählten Avatare.");
    }
    const row = rows.find((entry) => entry.id === artifactId);
    const option = row ? toArtifactOption(row, input.language) : null;
    if (!option) throw APIError.invalidArgument("Das mitgebrachte Artefakt ist nicht verfügbar.");
    return [{ ...option, broughtBy: avatarId }];
  }

  const crowns = await loadCrownArtifactIds();
  const owned = new Set<string>([...ownedByAvatar.values()].flatMap((ids) => [...ids]));
  const options = selectRewardArtifacts({
    rows,
    genre: input.genre,
    excludeIds: new Set<string>([...owned, ...crowns]),
    seed: input.seed,
    language: input.language,
  });
  // imageUrl stays the stored URL: the adapter resolves it for the illustrator
  // and builds the locked client URL only for an awarded artifact.
  return options;
}
