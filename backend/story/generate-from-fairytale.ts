import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { storyDB } from "./db";
import { avatarDB } from "../avatar/db";
import { fairytalesDB } from "../fairytales/db";
import type { Story, Chapter } from "./generate";
import crypto from "crypto";

// =====================================================
// FAIRY TALE STORY GENERATION
// =====================================================

interface GenerateFromFairyTaleRequest {
  userId: string;
  taleId: string;
  characterMappings: Record<string, string>; // roleType -> avatarId
  length?: 'short' | 'medium' | 'long';
  style?: 'classic' | 'modern' | 'humorous';
}

/**
 * Generate a personalized story from a fairy tale template
 * This replaces the old 4-phase generation system
 */
export const generateFromFairyTale = api<GenerateFromFairyTaleRequest, Story>(
  { expose: true, method: "POST", path: "/story/generate-from-fairytale", auth: true },
  async (req) => {
    const auth = getAuthData();
    const currentUserId = auth?.userID ?? req.userId;

    if (!currentUserId) {
      throw APIError.unauthenticated("Missing authenticated user");
    }

    console.log("[FairyTaleStory] Starting generation:", {
      taleId: req.taleId,
      userId: currentUserId,
      mappingsCount: Object.keys(req.characterMappings).length,
    });

    // 1. Validate the fairy tale exists
    const tale = await fairytalesDB.queryRow<any>`
      SELECT id, title, summary, age_recommendation, duration_minutes
      FROM fairy_tales
      WHERE id = ${req.taleId} AND is_active = TRUE
    `;

    if (!tale) {
      throw APIError.notFound(`Fairy tale ${req.taleId} not found`);
    }

    // 2. Get tale roles
    const roles = await fairytalesDB.queryAll<any>`
      SELECT 
        id, role_type, role_name, role_count, description,
        required, archetype_preference, age_range_min, age_range_max,
        profession_preference
      FROM fairy_tale_roles
      WHERE tale_id = ${req.taleId}
      ORDER BY required DESC, role_type
    `;

    console.log("[FairyTaleStory] Found tale:", {
      title: tale.title,
      rolesCount: roles.length,
    });

    // 3. Validate character mappings against roles
    const errors: string[] = [];
    const avatarIds = Object.values(req.characterMappings);

    // Check required roles are mapped
    for (const role of roles) {
      if (role.required && !req.characterMappings[role.role_type]) {
        errors.push(`Required role "${role.role_type}" is not mapped`);
      }
    }

    // Check all mapped avatars exist
    if (avatarIds.length > 0) {
      const avatars = await avatarDB.queryAll<any>`
        SELECT id, name FROM avatars WHERE id = ANY(${avatarIds})
      `;

      if (avatars.length !== avatarIds.length) {
        const foundIds = avatars.map((a: any) => a.id);
        const missingIds = avatarIds.filter(id => !foundIds.includes(id));
        errors.push(`Avatars not found: ${missingIds.join(', ')}`);
      }
    }

    if (errors.length > 0) {
      throw APIError.invalidArgument(`Validation failed: ${errors.join('; ')}`);
    }

    // 4. Get tale scenes
    const scenes = await fairytalesDB.queryAll<any>`
      SELECT 
        id, scene_number, scene_title, scene_description,
        dialogue_template, character_variables, setting, mood,
        illustration_prompt_template, duration_seconds
      FROM fairy_tale_scenes
      WHERE tale_id = ${req.taleId}
      ORDER BY scene_number
    `;

    console.log("[FairyTaleStory] Processing scenes:", { count: scenes.length });

    // 5. Create story record
    const storyId = crypto.randomUUID();
    const now = new Date();

    await storyDB.exec`
      INSERT INTO stories (
        id, user_id, title, description, config, status, created_at, updated_at
      ) VALUES (
        ${storyId}, 
        ${currentUserId}, 
        ${tale.title}, 
        ${tale.summary || 'Eine personalisierte Geschichte basierend auf einem klassischen Märchen'},
        ${JSON.stringify({ taleId: req.taleId, characterMappings: req.characterMappings, length: req.length, style: req.style })},
        'complete',
        ${now}, 
        ${now}
      )
    `;

    // 6. Load avatar details for personalization
    const avatarDetailsMap = new Map<string, any>();
    
    if (avatarIds.length > 0) {
      const avatars = await avatarDB.queryAll<any>`
        SELECT 
          a.id, 
          a.name, 
          a.description,
          avp.age,
          avp.profession,
          avp.species
        FROM avatars a
        LEFT JOIN avatar_visual_profiles avp ON avp.avatar_id = a.id
        WHERE a.id = ANY(${avatarIds})
      `;

      for (const avatar of avatars) {
        avatarDetailsMap.set(avatar.id, avatar);
      }
    }

    // 7. Create chapters from scenes with character substitution
    const chapters: Chapter[] = [];
    let chapterOrder = 1;

    for (const scene of scenes) {
      let sceneText = scene.scene_description || '';
      
      // Replace character variables with actual avatar names
      const charVars = typeof scene.character_variables === 'string' 
        ? JSON.parse(scene.character_variables)
        : scene.character_variables;

      if (charVars) {
        for (const [varName, roleType] of Object.entries(charVars)) {
          const avatarId = req.characterMappings[roleType as string];
          if (avatarId) {
            const avatar = avatarDetailsMap.get(avatarId);
            if (avatar) {
              // Replace {{VARIABLE}} with avatar name
              sceneText = sceneText.replace(
                new RegExp(`{{${varName}}}`, 'g'),
                avatar.name
              );
            }
          }
        }
      }

      const chapterId = crypto.randomUUID();
      const chapter: Chapter = {
        id: chapterId,
        order: chapterOrder++,
        title: scene.scene_title || `Szene ${scene.scene_number}`,
        content: sceneText,
        imageUrl: undefined, // Images will be generated separately if needed
      };

      chapters.push(chapter);

      // Insert chapter into DB
      await storyDB.exec`
        INSERT INTO chapters (
          id, story_id, "order", title, content, image_url, created_at, updated_at
        ) VALUES (
          ${chapterId}, ${storyId}, ${chapter.order}, ${chapter.title}, 
          ${chapter.content}, ${chapter.imageUrl}, ${now}, ${now}
        )
      `;
    }

    console.log("[FairyTaleStory] Story generated:", {
      storyId,
      chaptersCount: chapters.length,
    });

    // 8. Return complete story
    const story: Story = {
      id: storyId,
      userId: currentUserId,
      title: tale.title,
      description: tale.summary || '',
      coverImageUrl: undefined,
      config: {
        taleId: req.taleId,
        characterMappings: req.characterMappings,
        length: req.length || 'medium',
        style: req.style || 'classic',
      } as any,
      status: 'complete',
      chapters,
      createdAt: now,
      updatedAt: now,
    };

    return story;
  }
);

/**
 * Get list of available fairy tales for story selection
 */
export const listAvailableFairyTales = api(
  { expose: true, method: "GET", path: "/story/available-fairytales", auth: true },
  async () => {
    const tales = await fairytalesDB.queryAll<any>`
      SELECT 
        id, 
        title, 
        source,
        culture_region,
        age_recommendation,
        duration_minutes,
        genre_tags,
        moral_lesson,
        summary,
        created_at
      FROM fairy_tales
      WHERE is_active = TRUE
      ORDER BY title ASC
    `;

    console.log("[FairyTaleStory] Listed available tales:", { count: tales.length });

    return tales.map(t => ({
      id: t.id,
      title: t.title,
      source: t.source,
      cultureRegion: t.culture_region,
      ageRecommendation: t.age_recommendation,
      durationMinutes: t.duration_minutes,
      genreTags: Array.isArray(t.genre_tags) ? t.genre_tags : [],
      moralLesson: t.moral_lesson,
      summary: t.summary,
      createdAt: t.created_at,
    }));
  }
);

/**
 * Get details of a specific fairy tale including roles
 */
export const getFairyTaleDetails = api<{ taleId: string }>(
  { expose: true, method: "GET", path: "/story/fairytale/:taleId", auth: true },
  async (req) => {
    const tale = await fairytalesDB.queryRow<any>`
      SELECT 
        id, title, source, original_language, english_translation,
        culture_region, age_recommendation, duration_minutes,
        genre_tags, moral_lesson, summary, is_active,
        created_at, updated_at
      FROM fairy_tales
      WHERE id = ${req.taleId}
    `;

    if (!tale) {
      throw APIError.notFound(`Fairy tale ${req.taleId} not found`);
    }

    const roles = await fairytalesDB.queryAll<any>`
      SELECT 
        id, role_type, role_name, role_count, description,
        required, archetype_preference, age_range_min, age_range_max,
        profession_preference
      FROM fairy_tale_roles
      WHERE tale_id = ${req.taleId}
      ORDER BY required DESC, role_type
    `;

    const scenes = await fairytalesDB.queryAll<any>`
      SELECT 
        id, scene_number, scene_title, scene_description,
        character_variables, setting, mood, duration_seconds
      FROM fairy_tale_scenes
      WHERE tale_id = ${req.taleId}
      ORDER BY scene_number
    `;

    return {
      tale: {
        id: tale.id,
        title: tale.title,
        source: tale.source,
        originalLanguage: tale.original_language,
        englishTranslation: tale.english_translation,
        cultureRegion: tale.culture_region,
        ageRecommendation: tale.age_recommendation,
        durationMinutes: tale.duration_minutes,
        genreTags: Array.isArray(tale.genre_tags) ? tale.genre_tags : [],
        moralLesson: tale.moral_lesson,
        summary: tale.summary,
        isActive: tale.is_active,
        createdAt: tale.created_at,
        updatedAt: tale.updated_at,
      },
      roles: roles.map((r: any) => ({
        id: r.id,
        roleType: r.role_type,
        roleName: r.role_name,
        roleCount: r.role_count,
        description: r.description,
        required: r.required,
        archetypePreference: r.archetype_preference,
        ageRangeMin: r.age_range_min,
        ageRangeMax: r.age_range_max,
        professionPreference: Array.isArray(r.profession_preference) ? r.profession_preference : [],
      })),
      scenes: scenes.map((s: any) => ({
        id: s.id,
        sceneNumber: s.scene_number,
        sceneTitle: s.scene_title,
        sceneDescription: s.scene_description,
        characterVariables: typeof s.character_variables === 'string' ? JSON.parse(s.character_variables) : s.character_variables,
        setting: s.setting,
        mood: s.mood,
        durationSeconds: s.duration_seconds,
      })),
    };
  }
);
