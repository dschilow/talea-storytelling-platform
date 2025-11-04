import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { fairytalesDB } from "./db";
import { avatarDB } from "../avatar/db";
import type {
  GenerateStoryRequest,
  GenerateStoryResponse,
  GetGeneratedStoryRequest,
  GetGeneratedStoryResponse,
  ValidateCharacterMappingRequest,
  ValidateCharacterMappingResponse,
  GeneratedStory,
  GeneratedStoryScene,
  ResolvedCharacter,
  ValidationError,
} from "./types";

// =====================================================
// STORY GENERATION APIs
// =====================================================

/**
 * Validate that character mappings are compatible with tale roles
 */
export const validateCharacterMapping = api<ValidateCharacterMappingRequest, ValidateCharacterMappingResponse>(
  { expose: true, method: "POST", path: "/fairytales/:taleId/validate-mapping", auth: true },
  async (req) => {
    console.log("[StoryGen] Validating character mapping for tale:", req.taleId);

    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [] as any;

    // Get tale roles
    const roles = await fairytalesDB.queryAll<any>`
      SELECT 
        id, role_type, role_name, role_count, description,
        required, archetype_preference, age_range_min, age_range_max,
        profession_preference
      FROM fairy_tale_roles
      WHERE tale_id = ${req.taleId}
    `;

    if (roles.length === 0) {
      errors.push({
        roleType: '',
        message: `Tale ${req.taleId} has no roles defined`,
        severity: 'error',
      });
      return { isValid: false, errors, warnings };
    }

    // Check each required role is mapped
    for (const role of roles) {
      if (role.required && !req.characterMappings[role.role_type]) {
        errors.push({
          roleType: role.role_type,
          message: `Required role "${role.role_type}" is not mapped`,
          severity: 'error',
        });
        continue;
      }

      const avatarId = req.characterMappings[role.role_type];
      if (!avatarId) continue;

      // Check if avatar exists
      const avatar = await avatarDB.queryRow<any>`
        SELECT id, name, personality_traits FROM avatars WHERE id = ${avatarId}
      `;

      if (!avatar) {
        errors.push({
          roleType: role.role_type,
          avatarId,
          message: `Avatar ${avatarId} not found`,
          severity: 'error',
        });
        continue;
      }

      // Get visual profile to check age
      const visualProfile = await avatarDB.queryRow<any>`
        SELECT age, profession FROM avatar_visual_profiles WHERE avatar_id = ${avatarId}
      `;

      // Check age compatibility
      if (visualProfile && role.age_range_min && role.age_range_max) {
        const age = visualProfile.age;
        if (age < role.age_range_min || age > role.age_range_max) {
          (warnings as any).push({
            roleType: role.role_type,
            avatarId,
            message: `Avatar age ${age} is outside recommended range ${role.age_range_min}-${role.age_range_max}`,
            severity: 'warning',
            recommendation: `Consider choosing an avatar within the ${role.age_range_min}-${role.age_range_max} age range`,
          });
        }
      }

      // Check profession compatibility
      if (visualProfile && role.profession_preference && role.profession_preference.length > 0) {
        const profession = visualProfile.profession;
        const prefs = Array.isArray(role.profession_preference) ? role.profession_preference : [];
        
        if (profession && prefs.length > 0 && !prefs.includes(profession)) {
          (warnings as any).push({
            roleType: role.role_type,
            avatarId,
            message: `Avatar profession "${profession}" is not in recommended list: ${prefs.join(', ')}`,
            severity: 'warning',
            recommendation: `Recommended professions: ${prefs.join(', ')}`,
          });
        }
      }
    }

    console.log(`[StoryGen] Validation complete: ${errors.length} errors, ${warnings.length} warnings`);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
);

/**
 * Generate a personalized story from a fairy tale template
 */
export const generateStory = api<GenerateStoryRequest, GenerateStoryResponse>(
  { expose: true, method: "POST", path: "/fairytales/:taleId/generate", auth: true },
  async (req) => {
    console.log("[StoryGen] Generating story for tale:", req.taleId);

    const auth = getAuthData()!;

    // Validate character mappings first
    const validation = await validateCharacterMapping({
      taleId: req.taleId,
      characterMappings: req.characterMappings,
    });

    if (!validation.isValid) {
      throw APIError.invalidArgument(
        `Character mapping validation failed: ${validation.errors.map(e => e.message).join(', ')}`
      );
    }

    // Get tale
    const tale = await fairytalesDB.queryRow<any>`
      SELECT id, title, summary, age_recommendation, duration_minutes
      FROM fairy_tales
      WHERE id = ${req.taleId} AND is_active = TRUE
    `;

    if (!tale) {
      throw APIError.notFound(`Fairy tale ${req.taleId} not found`);
    }

    // Resolve character data
    const resolvedCharacters = await resolveCharacters(req.characterMappings);

    // Generate story ID
    const storyId = generateUUID();

    // Create story record
    await fairytalesDB.exec`
      INSERT INTO generated_stories (
        id, user_id, tale_id, title, character_mappings,
        generation_params, status
      ) VALUES (
        ${storyId}, ${auth.userID}, ${req.taleId}, ${tale.title},
        ${JSON.stringify(req.characterMappings)}, ${JSON.stringify(req.params || {})},
        'generating'
      )
    `;

    // Start async generation process
    generateStoryAsync(storyId, req.taleId, resolvedCharacters, req.params).catch(err => {
      console.error(`[StoryGen] Async generation failed for ${storyId}:`, err);
    });

    console.log(`[StoryGen] Story generation started: ${storyId}`);

    return {
      storyId,
      title: tale.title,
      status: 'generating',
      estimatedTimeSeconds: tale.duration_minutes * 60,
    };
  }
);

/**
 * Get a generated story with all scenes
 */
export const getGeneratedStory = api<GetGeneratedStoryRequest, GetGeneratedStoryResponse>(
  { expose: true, method: "GET", path: "/stories/:storyId", auth: true },
  async (req) => {
    console.log("[StoryGen] Getting story:", req.storyId);

    const auth = getAuthData()!;

    // Get story
    const storyRow = await fairytalesDB.queryRow<any>`
      SELECT 
        id, user_id, tale_id, title, story_text, character_mappings,
        generation_params, status, error_message, created_at, updated_at
      FROM generated_stories
      WHERE id = ${req.storyId}
    `;

    if (!storyRow) {
      throw APIError.notFound(`Story ${req.storyId} not found`);
    }

    // Check permission
    if (storyRow.user_id !== auth.userID && auth.role !== 'admin') {
      throw APIError.permissionDenied("You don't have permission to view this story");
    }

    const story: GeneratedStory = {
      id: storyRow.id,
      userId: storyRow.user_id,
      taleId: storyRow.tale_id,
      title: storyRow.title,
      storyText: storyRow.story_text,
      characterMappings: storyRow.character_mappings,
      generationParams: storyRow.generation_params,
      status: storyRow.status,
      errorMessage: storyRow.error_message,
      createdAt: storyRow.created_at.toISOString(),
      updatedAt: storyRow.updated_at.toISOString(),
    };

    const response: GetGeneratedStoryResponse = { story };

    // Include scenes if requested
    if (req.includeScenes) {
      const sceneRows = await fairytalesDB.queryAll<any>`
        SELECT 
          id, story_id, scene_number, scene_text, image_url,
          image_prompt, image_generation_status, consistency_score,
          created_at, updated_at
        FROM generated_story_scenes
        WHERE story_id = ${req.storyId}
        ORDER BY scene_number ASC
      `;

      response.scenes = sceneRows.map(row => ({
        id: row.id,
        storyId: row.story_id,
        sceneNumber: row.scene_number,
        sceneText: row.scene_text,
        imageUrl: row.image_url,
        imagePrompt: row.image_prompt,
        imageGenerationStatus: row.image_generation_status,
        consistencyScore: row.consistency_score,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      }));
    }

    // Include tale info
    if (req.includeScenes) {
      const taleRow = await fairytalesDB.queryRow<any>`
        SELECT 
          id, title, source, age_recommendation, genre_tags, moral_lesson
        FROM fairy_tales
        WHERE id = ${story.taleId}
      `;

      if (taleRow) {
        response.tale = {
          id: taleRow.id,
          title: taleRow.title,
          source: taleRow.source,
          originalLanguage: '',
          cultureRegion: '',
          ageRecommendation: taleRow.age_recommendation,
          durationMinutes: 10,
          genreTags: taleRow.genre_tags || [],
          moralLesson: taleRow.moral_lesson,
          isActive: true,
          createdAt: '',
          updatedAt: '',
        };
      }
    }

    console.log(`[StoryGen] Retrieved story ${req.storyId} with ${response.scenes?.length || 0} scenes`);

    return response;
  }
);

// =====================================================
// HELPER FUNCTIONS
// =====================================================

async function resolveCharacters(characterMappings: Record<string, string>): Promise<ResolvedCharacter[]> {
  const resolved: ResolvedCharacter[] = [];

  for (const [roleType, avatarId] of Object.entries(characterMappings)) {
    const avatar = await avatarDB.queryRow<any>`
      SELECT id, name, personality_traits FROM avatars WHERE id = ${avatarId}
    `;

    if (!avatar) {
      throw APIError.notFound(`Avatar ${avatarId} not found`);
    }

    const visualProfile = await avatarDB.queryRow<any>`
      SELECT * FROM avatar_visual_profiles WHERE avatar_id = ${avatarId}
    `;

    resolved.push({
      roleType: roleType as any,
      avatarId,
      name: avatar.name,
      age: visualProfile?.age || 10,
      appearance: visualProfile?.description_ui || avatar.name,
      profession: visualProfile?.profession || 'character',
      visualProfile,
    });
  }

  return resolved;
}

async function generateStoryAsync(
  storyId: string,
  taleId: string,
  characters: ResolvedCharacter[],
  params: any
): Promise<void> {
  try {
    // Get all scenes for the tale
    const scenes = await fairytalesDB.queryAll<any>`
      SELECT 
        id, scene_number, scene_description, dialogue_template,
        character_variables, setting, mood, illustration_prompt_template
      FROM fairy_tale_scenes
      WHERE tale_id = ${taleId}
      ORDER BY scene_number ASC
    `;

    if (scenes.length === 0) {
      throw new Error(`No scenes found for tale ${taleId}`);
    }

    // Generate story text by processing each scene
    let fullStoryText = '';
    
    for (const scene of scenes) {
      let sceneText = scene.scene_description;

      // Replace character placeholders
      for (const char of characters) {
        const placeholder = scene.character_variables?.[char.roleType.toUpperCase()];
        if (placeholder) {
          sceneText = sceneText.replace(new RegExp(`\\[${placeholder}\\]`, 'g'), char.name);
        }
      }

      fullStoryText += `\n\n${sceneText}`;

      // Create scene record
      await fairytalesDB.exec`
        INSERT INTO generated_story_scenes (
          story_id, scene_number, scene_text, image_generation_status
        ) VALUES (
          ${storyId}, ${scene.scene_number}, ${sceneText}, 'pending'
        )
      `;
    }

    // Update story with generated text
    await fairytalesDB.exec`
      UPDATE generated_stories
      SET story_text = ${fullStoryText.trim()}, status = 'ready'
      WHERE id = ${storyId}
    `;

    console.log(`[StoryGen] Story ${storyId} generation complete`);
  } catch (error) {
    console.error(`[StoryGen] Story generation failed for ${storyId}:`, error);
    
    await fairytalesDB.exec`
      UPDATE generated_stories
      SET status = 'failed', error_message = ${String(error)}
      WHERE id = ${storyId}
    `;
  }
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
