// Public character showcase for the logged-out landing page.
// Read-only, unauthenticated, exposes only marketing-safe fields.

import { api } from "encore.dev/api";
import { storyDB } from "./db";
import { resolveImageUrlForClient } from "../helpers/bucket-storage";

export interface ShowcaseCharacter {
  id: string;
  name: string;
  role: string;
  archetype: string;
  imageUrl: string;
}

export interface CharacterShowcaseResponse {
  characters: ShowcaseCharacter[];
}

export const characterShowcase = api(
  { expose: true, method: "GET", path: "/story/character-showcase", auth: false },
  async (): Promise<CharacterShowcaseResponse> => {
    try {
      const rows = await storyDB.queryAll<{
        id: string;
        name: string;
        role: string;
        archetype: string;
        image_url: string;
      }>`
        SELECT id, name, role, archetype, image_url
        FROM character_pool
        WHERE is_active = true
          AND image_url IS NOT NULL
          AND image_url <> ''
        ORDER BY total_usage_count DESC, name ASC
        LIMIT 12
      `;

      const characters = await Promise.all(
        rows.map(async (row) => ({
          id: row.id,
          name: row.name,
          role: row.role,
          archetype: row.archetype,
          imageUrl: (await resolveImageUrlForClient(row.image_url)) ?? row.image_url,
        }))
      );

      return { characters: characters.filter((c) => !!c.imageUrl) };
    } catch (err) {
      // The landing page must never hard-fail for a logged-out visitor.
      console.error("[CharacterShowcase] Failed to load showcase:", err);
      return { characters: [] };
    }
  }
);
