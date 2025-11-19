import { storyDB } from "./db";
import type { CharacterTemplate } from "./types";
import crypto from "crypto";

/**
 * Utility to save a generated character to the character_pool.
 * Used when no suitable match is found and a new character is created on-the-fly.
 */
export async function saveGeneratedCharacterToPool(character: CharacterTemplate): Promise<void> {
  const now = new Date();

  console.log(`[CharacterPool] 💾 Saving generated character to pool: ${character.name} (${character.id})`);

  try {
    // First, ensure the visual_profile column exists (it should, but safe to check)
    // In a real production env, this check should be handled by migrations, 
    // but here we just proceed to insert.

    await storyDB.exec`
      INSERT INTO character_pool (
        id, 
        name, 
        role, 
        archetype, 
        emotional_nature, 
        visual_profile, 
        image_url,
        max_screen_time, 
        available_chapters, 
        canon_settings,
        recent_usage_count, 
        total_usage_count, 
        is_active,
        created_at, 
        updated_at,
        
        -- Enhanced matching fields
        gender,
        age_category,
        species_category,
        profession_tags,
        size_category,
        social_class,
        personality_keywords,
        physical_description,
        backstory
      ) VALUES (
        ${character.id},
        ${character.name},
        ${character.role},
        ${character.archetype},
        ${JSON.stringify(character.emotionalNature)},
        ${JSON.stringify(character.visualProfile)},
        ${character.imageUrl || null},
        ${character.maxScreenTime},
        ${character.availableChapters},
        ${character.canonSettings || []},
        1, -- Starts with usage 1 (since it's being used immediately)
        1, -- Starts with usage 1
        true, -- Active by default
        ${now},
        ${now},

        -- Enhanced matching fields
        ${character.gender || null},
        ${character.age_category || null},
        ${character.species_category || null},
        ${character.profession_tags || []},
        ${character.size_category || null},
        ${character.social_class || null},
        ${character.personality_keywords || []},
        ${character.physical_description || null},
        ${character.backstory || null}
      )
    `;

    console.log(`[CharacterPool] ✅ Successfully saved character: ${character.name}`);
  } catch (error) {
    console.error(`[CharacterPool] ❌ Failed to save generated character ${character.name}:`, error);
    // Non-blocking error - we still want the story to proceed even if saving to pool fails
  }
}

