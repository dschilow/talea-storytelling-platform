import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { generateStoryContent } from "./ai-generation";
import { convertAvatarDevelopmentsToPersonalityChanges } from "./traitMapping";
import { avatar } from "~encore/clients";
import { storyDB } from "./db";
import { logTopic } from "../log/logger";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { avatarDB } from "../avatar/db";
import { upgradePersonalityTraits } from "../avatar/upgradePersonalityTraits";
import { getAuthData } from "~encore/auth";
import { addAvatarMemoryViaMcp, validateAvatarDevelopments } from "../helpers/mcpClient";

const mcpServerApiKey = secret("MCPServerAPIKey");

type AvatarDevelopmentValidationResult = {
  isValid?: boolean;
  errors?: unknown;
  normalized?: any[];
};

// Avatar DB is already available through the avatar service client

export interface StoryConfig {
  avatarIds: string[];
  genre: string;
  setting: string;
  length: "short" | "medium" | "long";
  complexity: "simple" | "medium" | "complex";
  learningMode?: LearningMode;
  ageGroup: "3-5" | "6-8" | "9-12" | "13+";
}

export interface LearningMode {
  enabled: boolean;
  subjects: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  learningObjectives: string[];
  assessmentType: "quiz" | "interactive" | "discussion";
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  order: number;
}

export interface Story {
  id: string;
  userId: string;
  title: string;
  description: string;
  coverImageUrl?: string;
  config: StoryConfig;
  chapters: Chapter[];
  status: "generating" | "complete" | "error";
  avatarDevelopments?: any[];
  metadata?: {
    tokensUsed?: {
      prompt: number;
      completion: number;
      total: number;
    };
    model?: string;
    processingTime?: number;
    imagesGenerated?: number;
    totalCost?: {
      text: number;
      images: number;
      total: number;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export type StorySummary = Omit<Story, 'chapters'>;

interface GenerateStoryRequest {
  userId: string;
  config: StoryConfig;
}

// Generates a new story based on the provided configuration.
export const generate = api<GenerateStoryRequest, Story>(
  { expose: true, method: "POST", path: "/story/generate", auth: true },
  async (req) => {
    const id = crypto.randomUUID();
    const now = new Date();
    const auth = getAuthData();
    const currentUserId = auth?.userID ?? req.userId;

    if (!currentUserId) {
      throw APIError.unauthenticated("Missing authenticated user for story generation");
    }

    if (auth?.userID && req.userId && auth.userID !== req.userId) {
      console.warn("[story.generate] Auth user mismatch detected", {
        authUserId: auth.userID,
        requestUserId: req.userId,
        storyId: id,
      });
    }

    const clerkToken = auth?.clerkToken;
    if (!clerkToken) {
      throw APIError.unauthenticated("Missing Clerk token for MCP operations");
    }
    const mcpApiKey = mcpServerApiKey();

    const safe = (obj: any) => {
      try {
        return JSON.stringify(obj).slice(0, 2000);
      } catch {
        return String(obj).slice(0, 2000);
      }
    };

    console.log("[story.generate] Incoming request:", {
      storyId: id,
      userId: currentUserId,
      config: req?.config ? {
        avatarIdsCount: req.config.avatarIds?.length ?? 0,
        genre: req.config.genre,
        setting: req.config.setting,
        length: req.config.length,
        complexity: req.config.complexity,
        ageGroup: req.config.ageGroup,
        learningMode: req.config.learningMode ? {
          enabled: req.config.learningMode.enabled,
          subjectsCount: req.config.learningMode.subjects?.length ?? 0,
          difficulty: req.config.learningMode.difficulty,
          objectivesCount: req.config.learningMode.learningObjectives?.length ?? 0,
          assessmentType: req.config.learningMode.assessmentType,
        } : undefined,
      } : undefined,
    });

    // Create initial story record
    await storyDB.exec`
      INSERT INTO stories (
        id, user_id, title, description, config, status, created_at, updated_at
      ) VALUES (
        ${id}, ${currentUserId}, 'Wird generiert...', 'Deine Geschichte wird erstellt...', 
        ${JSON.stringify(req.config)}, 'generating', ${now}, ${now}
      )
    `;

    try {
      console.log("[story.generate] Loading avatar details...", { count: req.config.avatarIds.length });
      // Fetch avatar details directly from the avatar database to avoid cross-service auth issues
      const avatarDetails: Array<{
        id: string;
        name: string;
        description?: string;
        physicalTraits: any;
        personalityTraits: any;
        imageUrl?: string;
        visualProfile?: any;
        creationType: "ai-generated" | "photo-upload";
        isPublic: boolean;
      }> = [];

      for (const avatarId of req.config.avatarIds) {
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
        }>`
          SELECT id, user_id, name, description, physical_traits, personality_traits, image_url, visual_profile, creation_type, is_public
          FROM avatars
          WHERE id = ${avatarId}
        `;

        if (!row) {
          throw APIError.notFound(`Avatar ${avatarId} not found`);
        }

        if (row.user_id !== currentUserId) {
          throw APIError.permissionDenied("Avatar does not belong to current user");
        }

        const physicalTraits = row.physical_traits ? JSON.parse(row.physical_traits) : {};
        const rawPersonalityTraits = row.personality_traits ? JSON.parse(row.personality_traits) : {};
        const upgradedPersonalityTraits = upgradePersonalityTraits(rawPersonalityTraits);

        if (Object.keys(upgradedPersonalityTraits).length > Object.keys(rawPersonalityTraits).length) {
          try {
            await avatarDB.exec`
              UPDATE avatars
              SET personality_traits = ${JSON.stringify(upgradedPersonalityTraits)},
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ${avatarId}
            `;
          } catch (upgradeError) {
            console.warn("[story.generate] Failed to persist upgraded traits", { avatarId, upgradeError });
          }
        }

        avatarDetails.push({
          id: row.id,
          name: row.name,
          description: row.description || undefined,
          physicalTraits,
          personalityTraits: upgradedPersonalityTraits,
          imageUrl: row.image_url || undefined,
          visualProfile: row.visual_profile ? JSON.parse(row.visual_profile) : undefined,
          creationType: row.creation_type,
          isPublic: row.is_public,
        });
      }

      console.log("[story.generate] Avatar details for story generation:", avatarDetails.map(a => ({ 
        name: a.name, 
        hasImage: !!a.imageUrl,
        hasVisualProfile: !!a.visualProfile
      })));

      // Generate story content using AI with avatar canonical appearance
      console.log("[story.generate] Calling generateStoryContent with MCP context...");
      const generatedStory = await generateStoryContent({
        config: req.config,
        avatarDetails,
        clerkToken,
      });
      console.log("[story.generate] Story content generated:", {
        title: generatedStory?.title,
        descLen: generatedStory?.description?.length,
        chapters: generatedStory?.chapters?.length,
        coverImageUrlLen: generatedStory?.coverImageUrl?.length,
        devCount: generatedStory?.avatarDevelopments?.length ?? 0,
        tokens: generatedStory?.metadata?.tokensUsed,
      });

      let validatedDevelopments = generatedStory.avatarDevelopments ?? [];
      try {
        const validation = await validateAvatarDevelopments(
          validatedDevelopments,
          mcpApiKey
        ) as AvatarDevelopmentValidationResult;
        if (validation?.isValid === false) {
          throw new Error(`Avatar developments invalid: ${JSON.stringify(validation.errors ?? {})}`);
        }
        if (Array.isArray(validation?.normalized)) {
          validatedDevelopments = validation.normalized as typeof validatedDevelopments;
        }
      } catch (validationError) {
        console.warn("[story.generate] Avatar development validation warning:", validationError);
      }

      // Update story with generated content
      console.log("[story.generate] Persisting story header into DB...");
      await storyDB.exec`
        UPDATE stories
        SET title = ${generatedStory.title},
            description = ${generatedStory.description},
            cover_image_url = ${generatedStory.coverImageUrl},
            avatar_developments = ${JSON.stringify(validatedDevelopments || [])},
            metadata = ${JSON.stringify(generatedStory.metadata)},
            status = 'complete',
            updated_at = ${new Date()}
        WHERE id = ${id}
      `;

      // Insert chapters
      console.log("[story.generate] Inserting chapters...", { count: generatedStory.chapters.length });
      for (const chapter of generatedStory.chapters) {
        const chapterId = crypto.randomUUID();
        console.log("[story.generate] Insert chapter:", {
          id: chapterId,
          title: chapter?.title,
          titleLen: chapter?.title?.length,
          contentLen: chapter?.content?.length,
          imageUrlLen: chapter?.imageUrl?.length,
          order: chapter?.order,
        });
        await storyDB.exec`
          INSERT INTO chapters (
            id, story_id, title, content, image_url, chapter_order, created_at
          ) VALUES (
            ${chapterId}, ${id}, ${chapter.title}, ${chapter.content}, 
            ${chapter.imageUrl}, ${chapter.order}, ${now}
          )
        `;
      }

      // NEW AI-DRIVEN SYSTEM: Apply personality updates based on story analysis
      console.log("[AI-DRIVEN SYSTEM] Applying trait updates to ALL user avatars...");

      // Load ALL avatars for this user directly from the database
      const allUserAvatarRows = await avatarDB.queryAll<{ id: string; name: string }>`
        SELECT id, name FROM avatars WHERE user_id = ${currentUserId}
      `;
      const allUserAvatars = allUserAvatarRows.map(row => ({ id: row.id, name: row.name }));

      console.log(`[story.generate] Found ${allUserAvatars.length} total avatars for user ${currentUserId}`);

      if (validatedDevelopments.length > 0 && allUserAvatars.length > 0) {
        // Convert AI-generated avatar developments to personality changes
        const convertedDevelopments = convertAvatarDevelopmentsToPersonalityChanges(validatedDevelopments);

        // Determine which avatars actively participated
        const participatingAvatarIds = new Set(req.config.avatarIds);

        // Apply updates to ALL avatars
        for (const userAvatar of allUserAvatars) {
          const isParticipating = participatingAvatarIds.has(userAvatar.id);

          // Find AI-generated development for this avatar
          const aiDevelopment = convertedDevelopments.find(dev => dev.name === userAvatar.name);

          let changes: any[] = [];
          let experienceDescription = "";

          if (aiDevelopment && aiDevelopment.changedTraits && aiDevelopment.changedTraits.length > 0) {
            // AI-generated specific trait changes for this avatar with detailed descriptions
            changes = aiDevelopment.changedTraits.map((change: any) => {
              const adjustedChange = isParticipating ? change.change : Math.max(1, Math.floor(change.change / 2));
              const modeText = isParticipating ? 'aktive Teilnahme' : 'Lesen';

              // Create detailed description based on trait type
              let description = '';
              if (change.trait.startsWith('knowledge.')) {
                const subject = change.trait.split('.')[1];
                description = `+${adjustedChange} ${subject} durch ${modeText} der ${req.config.genre}-Geschichte "${generatedStory.title}"`;
              } else {
                description = `+${adjustedChange} ${change.trait} durch ${modeText} in "${generatedStory.title}" entwickelt`;
              }

              return {
                trait: change.trait,
                change: adjustedChange,
                description: description
              };
            });
            experienceDescription = isParticipating
              ? `Ich war aktiver Teilnehmer in der Geschichte "${generatedStory.title}". Genre: ${req.config.genre}.`
              : `Ich habe die Geschichte "${generatedStory.title}" gelesen. Genre: ${req.config.genre}.`;
          } else {
            // Fallback: Genre-based updates when AI doesn't provide specific developments
            const baseTraits = req.config.genre === 'adventure' ? ['courage', 'curiosity'] :
                              req.config.genre === 'educational' ? ['intelligence', 'curiosity'] :
                              req.config.genre === 'mystery' ? ['curiosity', 'intelligence'] :
                              req.config.genre === 'friendship' ? ['empathy', 'teamwork'] :
                              ['empathy', 'curiosity'];
            changes = baseTraits.map(trait => {
              const points = isParticipating ? 2 : 1;
              const modeText = isParticipating ? 'aktive Teilnahme' : 'Lesen';
              return {
                trait,
                change: points,
                description: `+${points} ${trait} durch ${modeText} in ${req.config.genre}-Geschichte`
              };
            });
            experienceDescription = `Geschichte "${generatedStory.title}" (${req.config.genre}) erlebt.`;
          }

          if (changes.length > 0) {
            console.log(`[story.generate] Updating ${userAvatar.name} (${isParticipating ? 'participant' : 'reader'}):`, changes);

            try {
              // Apply personality updates with content context
              await avatar.updatePersonality({
                id: userAvatar.id,
                changes: changes,
                storyId: id,
                contentTitle: generatedStory.title,
                contentType: 'story'
              });

              // Create detailed development description
              const developmentSummary = changes
                .map(c => c.description || `${c.trait}: +${c.change}`)
                .join(', ');

              // Add memory with detailed personality changes
              await avatar.addMemory({
                id: userAvatar.id,
                storyId: id,
                storyTitle: generatedStory.title,
                experience: experienceDescription,
                emotionalImpact: 'positive',
                personalityChanges: changes,
                developmentDescription: `Persoenliche Entwicklung: ${developmentSummary}`,
                contentType: 'story'
              });

              try {
                await addAvatarMemoryViaMcp(userAvatar.id, clerkToken, mcpApiKey, {
                  storyId: id,
                  storyTitle: generatedStory.title,
                  experience: experienceDescription,
                  emotionalImpact: "positive",
                  personalityChanges: changes.map((change: any) => ({
                    trait: change.trait,
                    change: change.change,
                  })),
                });
              } catch (mcpMemoryError) {
                console.warn("[story.generate] Failed to sync memory to MCP", {
                  avatarId: userAvatar.id,
                  error: mcpMemoryError,
                });
              }

              console.log(`[story.generate] Updated personality and memory for ${userAvatar.name}`);
            } catch (updateError) {
              console.error(`[story.generate] Failed to update ${userAvatar.name}:`, updateError);
            }
          }
        }

        console.log(`[story.generate] Applied AI-driven trait updates to all ${allUserAvatars.length} user avatars`);
      } else {
        console.log("[story.generate] No AI-generated avatar developments to apply or no avatars found");
      }

      // Return the complete story
      console.log("[story.generate] Loading full story payload to return...");
      const story = await getCompleteStory(id);
      console.log("[story.generate] Done. Returning story:", {
        id: story.id,
        title: story.title,
        chapters: story.chapters?.length,
        status: story.status,
      });
      return story;

    } catch (error) {
      // Update story status to error
      console.error("[story.generate] ERROR:", error);
      await storyDB.exec`
        UPDATE stories
        SET status = 'error',
            updated_at = ${new Date()}
        WHERE id = ${id}
      `;
      try {
        await publishWithTimeout(logTopic, {
          source: 'openai-story-generation',
          timestamp: new Date(),
          request: { storyId: id, userId: currentUserId, config: req.config },
          response: { error: String((error as any)?.message || error), stack: (error as any)?.stack?.slice(0, 2000) }
        });
      } catch (e) {
        console.warn("[story.generate] Failed to publish error log:", e);
      }

      throw error;
    }
  }
);

async function getCompleteStory(storyId: string): Promise<Story> {
  const storyRow = await storyDB.queryRow<{
    id: string;
    user_id: string;
    title: string;
    description: string;
    cover_image_url: string | null;
    config: string;
    avatar_developments: string | null;
    metadata: string | null;
    status: "generating" | "complete" | "error";
    created_at: Date;
    updated_at: Date;
  }>`
    SELECT * FROM stories WHERE id = ${storyId}
  `;

  if (!storyRow) {
    throw new Error("Story not found");
  }

  const chapterRows = await storyDB.queryAll<{
    id: string;
    title: string;
    content: string;
    image_url: string | null;
    chapter_order: number;
  }>`
    SELECT id, title, content, image_url, chapter_order 
    FROM chapters 
    WHERE story_id = ${storyId} 
    ORDER BY chapter_order
  `;

  return {
    id: storyRow.id,
    userId: storyRow.user_id,
    title: storyRow.title,
    description: storyRow.description,
    coverImageUrl: storyRow.cover_image_url || undefined,
    config: JSON.parse(storyRow.config),
    avatarDevelopments: storyRow.avatar_developments ? JSON.parse(storyRow.avatar_developments) : undefined,
    metadata: storyRow.metadata ? JSON.parse(storyRow.metadata) : undefined,
    chapters: chapterRows.map(ch => ({
      id: ch.id,
      title: ch.title,
      content: ch.content,
      imageUrl: ch.image_url || undefined,
      order: ch.chapter_order,
    })),
    status: storyRow.status,
    createdAt: storyRow.created_at,
    updatedAt: storyRow.updated_at,
  };
}




