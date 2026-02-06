import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { generateStoryContent } from "./ai-generation";
import { convertAvatarDevelopmentsToPersonalityChanges } from "./traitMapping";
import type { Avatar, InventoryItem, Skill } from "../avatar/avatar";
import { avatar } from "~encore/clients";
import { storyDB } from "./db";
import { logTopic } from "../log/logger";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { avatarDB } from "../avatar/db";
import { upgradePersonalityTraits } from "../avatar/upgradePersonalityTraits";
import { getAuthData } from "~encore/auth";
import { addAvatarMemoryViaMcp, validateAvatarDevelopments } from "../helpers/mcpClient";
import { resolveImageUrlForClient } from "../helpers/bucket-storage";
import { buildStoryChapterImageUrlForClient, buildArtifactImageUrlForClient } from "../helpers/image-proxy";
import { updateStoryInstanceStatus } from "./pipeline/repository";
import { claimGenerationUsage } from "../helpers/billing";
import {
  createStructuredMemory,
  filterPersonalityChangesWithCooldown,
  summarizeMemoryCategory,
  type PersonalityShiftCooldown,
} from "./memory-categorization";
import { StoryPipelineOrchestrator } from "./pipeline/orchestrator";
import type {
  StorySoulKey,
  EmotionalFlavorKey,
  StoryTempoKey,
  SpecialIngredientKey,
} from "./story-experience";

const mcpServerApiKey = secret("MCPServerAPIKey");

type AvatarDevelopmentValidationResult = {
  isValid?: boolean;
  errors?: unknown;
  normalized?: any[];
};

// Avatar DB is already available through the avatar service client

export type StylePresetKey =
  | "rhymed_playful"
  | "gentle_minimal"
  | "wild_imaginative"
  | "philosophical_warm"
  | "mischief_empowering"
  | "adventure_epic"
  | "quirky_dark_sweet"
  | "cozy_friendly"
  | "classic_fantasy"
  | "whimsical_logic"
  | "mythic_allegory"
  | "road_fantasy"
  | "imaginative_meta"
  | "pastoral_heart"
  | "bedtime_soothing";

export type StoryTone =
  | "warm"
  | "witty"
  | "epic"
  | "soothing"
  | "mischievous"
  | "wonder";

export type StoryLanguage = "de" | "en" | "fr" | "es" | "it" | "nl" | "ru";
export type StoryPacing = "slow" | "balanced" | "fast";
export type StoryPOV = "ich" | "personale";
export type PlotHookKey =
  | "secret_door"
  | "riddle_puzzle"
  | "lost_map"
  | "mysterious_guide"
  | "time_glitch"
  | "friend_turns_foe"
  | "foe_turns_friend"
  | "moral_choice";

export type AIModel =
  | "gpt-5-nano"
  | "gpt-5-mini"
  | "gpt-5"
  | "gpt-5.2"
  | "gpt-5-pro"
  | "gpt-4.1-nano"
  | "gpt-4.1-mini"
  | "gpt-4.1"
  | "o4-mini"
  | "gemini-3-flash-preview";

export interface StoryConfig {
  avatarIds: string[];
  genre: string;
  setting: string;
  length: "short" | "medium" | "long";
  complexity: "simple" | "medium" | "complex";
  learningMode?: LearningMode;
  ageGroup: "3-5" | "6-8" | "9-12" | "13+";

  // Optional advanced styling parameters from StoryWizard
  stylePreset?: StylePresetKey;
  allowRhymes?: boolean;
  tone?: StoryTone;
  language?: StoryLanguage;
  suspenseLevel?: 0 | 1 | 2 | 3;
  humorLevel?: 0 | 1 | 2 | 3;
  pacing?: StoryPacing;
  pov?: StoryPOV;
  hooks?: PlotHookKey[];
  hasTwist?: boolean;
  customPrompt?: string;
  storySoul?: StorySoulKey;
  emotionalFlavors?: EmotionalFlavorKey[];
  storyTempo?: StoryTempoKey;
  specialIngredients?: SpecialIngredientKey[];

  // AI Model selection for story generation
  aiModel?: AIModel;

  // 4-Phase System: Enable character pool system
  useCharacterPool?: boolean;

  // Fairy Tale System: Enable fairy tale template mode
  preferences?: {
    useFairyTaleTemplate?: boolean;
  };
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
  imagePrompt?: string;
  imageSeed?: number;
  imageModel?: string;
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
    // ðŸŽ Artifact earned from this story
    newArtifact?: {
      name: string;
      description: string;
      type: string;
      storyEffect?: string;
      visualDescriptorKeywords?: string[];
      imageUrl?: string;
    };
    // Pending artifact from pool (unlock after reading)
    pendingArtifact?: any;
  };
  // Cost tracking properties
  tokensInput?: number;
  tokensOutput?: number;
  tokensTotal?: number;
  costInputUSD?: number;
  costOutputUSD?: number;
  costTotalUSD?: number;
  costMcpUSD?: number;
  modelUsed?: string;
  // Cost tracking is now logged to files instead of DB
  createdAt: Date;
  updatedAt: Date;
}

export type StorySummary = Omit<Story, 'chapters'>;

interface McpAvatarMemory {
  id: string;
  avatarId: string;
  storyId: string;
  storyTitle: string;
  experience: string;
  emotionalImpact: "positive" | "negative" | "neutral";
  personalityChanges: Array<{ trait: string; change: number }>;
  createdAt: string;
}

type StoryAvatar = Omit<Avatar, "userId" | "isShared" | "originalAvatarId" | "createdAt" | "updatedAt"> & {
  // Optional memories field keeps compatibility with ExtendedAvatarDetails in ai-generation
  memories?: McpAvatarMemory[];
};

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

    await claimGenerationUsage({
      userId: currentUserId,
      kind: "story",
      clerkToken,
    });
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
        aiModel: req.config.aiModel ?? 'not-set',
        stylePreset: req.config.stylePreset,
        tone: req.config.tone,
        language: req.config.language,
        allowRhymes: req.config.allowRhymes ?? false,
        suspenseLevel: req.config.suspenseLevel ?? 1,
        humorLevel: req.config.humorLevel ?? 2,
        pacing: req.config.pacing ?? "balanced",
        pov: req.config.pov ?? "personale",
        hooksCount: req.config.hooks?.length ?? 0,
        hasTwist: req.config.hasTwist ?? false,
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
      const avatarDetails: StoryAvatar[] = [];

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
          inventory: string | null;
          skills: string | null;
        }>`
          SELECT id, user_id, name, description, physical_traits, personality_traits, image_url, visual_profile, creation_type, is_public, inventory, skills
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

        let inventory: InventoryItem[] = [];
        let skills: Skill[] = [];

        try {
          inventory = row.inventory ? (JSON.parse(row.inventory) as InventoryItem[]) : [];
        } catch (parseInvErr) {
          console.warn("[story.generate] Failed to parse inventory JSON; defaulting to []", { avatarId, parseInvErr });
        }

        try {
          skills = row.skills ? (JSON.parse(row.skills) as Skill[]) : [];
        } catch (parseSkillsErr) {
          console.warn("[story.generate] Failed to parse skills JSON; defaulting to []", { avatarId, parseSkillsErr });
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
          inventory,
          skills,
        });
      }

      console.log("[story.generate] Avatar details for story generation:", avatarDetails.map(a => ({
        name: a.name,
        hasImage: !!a.imageUrl,
        hasVisualProfile: !!a.visualProfile
      })));

      // Check if we should use the Story Pipeline v2
      const useCharacterPool = req.config.useCharacterPool ?? true; // Default to true
      let generatedStory: any;

      if (useCharacterPool) {
        console.log("[story.generate] Using Story Pipeline v2...");
        const orchestrator = new StoryPipelineOrchestrator();

        const pipelineResult = await orchestrator.run({
          storyId: id,
          userId: currentUserId,
          config: req.config,
          avatars: avatarDetails,
          enableVisionValidation: Boolean((req.config as any).enableVisionValidation),
        });

        const imageByChapter = new Map(
          pipelineResult.images.map((img) => [img.chapter, img.imageUrl])
        );
        const promptByChapter = new Map(
          pipelineResult.imageSpecs.map((spec: any) => [spec.chapter, spec.finalPromptText || ""])
        );

        const chapters = pipelineResult.storyDraft.chapters.map((ch) => ({
          id: crypto.randomUUID(),
          title: ch.title,
          content: ch.text,
          imageUrl: imageByChapter.get(ch.chapter),
          order: ch.chapter,
          imagePrompt: promptByChapter.get(ch.chapter),
          imageModel: "runware",
        }));

        const tokenUsage = pipelineResult.tokenUsage
          ? {
              prompt: pipelineResult.tokenUsage.promptTokens,
              completion: pipelineResult.tokenUsage.completionTokens,
              total: pipelineResult.tokenUsage.totalTokens,
              inputCostUSD: pipelineResult.tokenUsage.inputCostUSD,
              outputCostUSD: pipelineResult.tokenUsage.outputCostUSD,
              totalCostUSD: pipelineResult.tokenUsage.totalCostUSD,
              modelUsed: pipelineResult.tokenUsage.model || req.config.aiModel || "gpt-5-mini",
            }
          : { prompt: 0, completion: 0, total: 0 };

        const pendingArtifact = pipelineResult.artifactMeta
          ? {
              id: pipelineResult.artifactMeta.id,
              name: req.config.language === "en" ? pipelineResult.artifactMeta.name.en : pipelineResult.artifactMeta.name.de,
              nameEn: pipelineResult.artifactMeta.name.en,
              description: req.config.language === "en" ? pipelineResult.artifactMeta.description.en : pipelineResult.artifactMeta.description.de,
              category: pipelineResult.artifactMeta.category,
              rarity: pipelineResult.artifactMeta.rarity,
              storyRole: pipelineResult.artifactMeta.storyRole,
              visualKeywords: pipelineResult.artifactMeta.visualKeywords,
              imageUrl: await buildArtifactImageUrlForClient(
                pipelineResult.artifactMeta.id,
                pipelineResult.artifactMeta.imageUrl
              ),
              discoveryChapter: 2,
              usageChapter: 4,
              locked: true,
            }
          : undefined;

        const characterPoolUsed = pipelineResult.castSet.poolCharacters.map((character) => ({
          characterId: character.characterId,
          characterName: character.displayName,
        }));

        const coverImageUrl = pipelineResult.coverImage?.imageUrl || imageByChapter.get(1);
        generatedStory = {
          title: pipelineResult.storyDraft.title,
          description: pipelineResult.storyDraft.description,
          coverImageUrl,
          chapters,
          avatarDevelopments: [],
          pendingArtifact,
          metadata: {
            tokensUsed: tokenUsage,
            model: tokenUsage.modelUsed,
            imagesGenerated: pipelineResult.images.length + (pipelineResult.coverImage?.imageUrl ? 1 : 0),
            characterPoolUsed,
          },
        };
      } else {
        console.log("[story.generate] Using legacy story generation (no character pool)...");
        // Generate story content using AI with avatar canonical appearance
        console.log("[story.generate] Calling generateStoryContent with MCP context...");
        generatedStory = await generateStoryContent({
          config: req.config,
          avatarDetails,
          clerkToken,
        });
      }

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

      // Extract cost data from metadata (now properly calculated in four-phase-orchestrator)
      const tokensUsed = generatedStory.metadata?.tokensUsed || { prompt: 0, completion: 0, total: 0 };
      const inputCost = (generatedStory.metadata?.tokensUsed as any)?.inputCostUSD || 0;
      const outputCost = (generatedStory.metadata?.tokensUsed as any)?.outputCostUSD || 0;
      const totalCost = (generatedStory.metadata?.tokensUsed as any)?.totalCostUSD || 0;
      const modelUsed = (generatedStory.metadata?.tokensUsed as any)?.modelUsed || req.config.aiModel || 'gpt-5-mini';
      const mcpCost = 0; // TODO: Track MCP costs separately

      console.log("[story.generate] Cost tracking:", {
        model: modelUsed,
        tokens: tokensUsed,
        inputCost: `$${inputCost.toFixed(6)}`,
        outputCost: `$${outputCost.toFixed(6)}`,
        totalCost: `$${totalCost.toFixed(6)}`,
      });

      // Write cost data to log file
      await publishWithTimeout(logTopic, {
        source: "story-generation-costs" as any, // Custom log source for cost tracking
        timestamp: new Date(),
        request: {
          storyId: id,
          userId: req.userId,
          model: modelUsed,
        },
        response: {
          tokens: {
            input: tokensUsed.prompt || 0,
            output: tokensUsed.completion || 0,
            total: tokensUsed.total || 0,
          },
          costs: {
            input_usd: inputCost,
            output_usd: outputCost,
            total_usd: totalCost,
            mcp_usd: mcpCost,
          },
          title: generatedStory.title,
        },
      });

      // ðŸŽ Add artifact metadata so it's persisted and returned to frontend
      const enrichedMetadata = {
        ...generatedStory.metadata,
        newArtifact: generatedStory.newArtifact || undefined,
        pendingArtifact: generatedStory.pendingArtifact || undefined,
      };
      
      console.log("[story.generate] ðŸŽ artifact in response:", {
        hasNewArtifact: !!generatedStory.newArtifact,
        newArtifactName: generatedStory.newArtifact?.name || 'none',
        hasPendingArtifact: !!generatedStory.pendingArtifact,
        pendingArtifactName: generatedStory.pendingArtifact?.name || 'none',
      });

      // Update story with generated content
      console.log("[story.generate] Persisting story header into DB...");
      await storyDB.exec`
        UPDATE stories
        SET title = ${generatedStory.title},
            description = ${generatedStory.description},
            cover_image_url = ${generatedStory.coverImageUrl},
            avatar_developments = ${JSON.stringify(validatedDevelopments || [])},
            metadata = ${JSON.stringify(enrichedMetadata)},
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
              const isEnglish = req.config.language === 'en';
              const modeText = isParticipating
                ? (isEnglish ? 'active participation' : 'aktive Teilnahme')
                : (isEnglish ? 'reading' : 'Lesen');

              // Create detailed description based on trait type
              let description = '';
              if (change.trait.startsWith('knowledge.')) {
                const subject = change.trait.split('.')[1];
                description = isEnglish
                  ? `+${adjustedChange} ${subject} through ${modeText} of ${req.config.genre} story "${generatedStory.title}"`
                  : `+${adjustedChange} ${subject} durch ${modeText} der ${req.config.genre}-Geschichte "${generatedStory.title}"`;
              } else {
                description = isEnglish
                  ? `+${adjustedChange} ${change.trait} developed through ${modeText} in "${generatedStory.title}"`
                  : `+${adjustedChange} ${change.trait} durch ${modeText} in "${generatedStory.title}" entwickelt`;
              }

              return {
                trait: change.trait,
                change: adjustedChange,
                description: description
              };
            });
            const isEnglish = req.config.language === 'en';
            experienceDescription = isParticipating
              ? (isEnglish
                ? `I was an active participant in the story "${generatedStory.title}". Genre: ${req.config.genre}.`
                : `Ich war aktiver Teilnehmer in der Geschichte "${generatedStory.title}". Genre: ${req.config.genre}.`)
              : (isEnglish
                ? `I read the story "${generatedStory.title}". Genre: ${req.config.genre}.`
                : `Ich habe die Geschichte "${generatedStory.title}" gelesen. Genre: ${req.config.genre}.`);
          } else {
            // Fallback: Genre-based updates when AI doesn't provide specific developments
            const baseTraits = req.config.genre === 'adventure' ? ['courage', 'curiosity'] :
              req.config.genre === 'educational' ? ['intelligence', 'curiosity'] :
                req.config.genre === 'mystery' ? ['curiosity', 'intelligence'] :
                  req.config.genre === 'friendship' ? ['empathy', 'teamwork'] :
                    ['empathy', 'curiosity'];
            changes = baseTraits.map(trait => {
              const points = isParticipating ? 2 : 1;
              const isEnglish = req.config.language === 'en';
              const modeText = isParticipating
                ? (isEnglish ? 'active participation' : 'aktive Teilnahme')
                : (isEnglish ? 'reading' : 'Lesen');

              return {
                trait,
                change: points,
                description: isEnglish
                  ? `+${points} ${trait} through ${modeText} in ${req.config.genre} story`
                  : `+${points} ${trait} durch ${modeText} in ${req.config.genre}-Geschichte`
              };
            });
            const isEnglish = req.config.language === 'en';
            experienceDescription = isEnglish
              ? `Experienced story "${generatedStory.title}" (${req.config.genre}).`
              : `Geschichte "${generatedStory.title}" (${req.config.genre}) erlebt.`;
          }

          if (changes.length > 0) {
            console.log(`[story.generate] Updating ${userAvatar.name} (${isParticipating ? 'participant' : 'reader'}):`, changes);

            try {
              // OPTIMIZATION v1.0: Create structured memory with categorization
              const structuredMemory = createStructuredMemory(
                experienceDescription,
                changes,
                id,
                generatedStory.title,
                'story',
                'positive'
              );

              console.log(`[story.generate] ðŸ“ Memory category: ${structuredMemory.category} (${summarizeMemoryCategory(structuredMemory.category)})`);

              // TODO: Fetch last personality shifts from database for cooldown check
              // For now, we skip cooldown (all changes allowed) - implement in future iteration
              const lastShifts: PersonalityShiftCooldown[] = [];

              const { allowedChanges, blockedChanges } = filterPersonalityChangesWithCooldown(
                structuredMemory.category,
                changes,
                lastShifts
              );

              if (blockedChanges.length > 0) {
                console.warn(`[story.generate] â³ ${blockedChanges.length} personality shifts blocked by cooldown:`,
                  blockedChanges.map(b => `${b.trait} (${b.remainingHours}h remaining)`)
                );
              }

              // Apply only allowed personality updates
              if (allowedChanges.length > 0) {
                await avatar.updatePersonality({
                  id: userAvatar.id,
                  changes: allowedChanges,
                  storyId: id,
                  contentTitle: generatedStory.title,
                  contentType: 'story'
                });

                console.log(`[story.generate] âœ… Applied ${allowedChanges.length} personality changes (${blockedChanges.length} blocked)`);
              }

              // Add memory with categorization info
              await avatar.addMemory({
                id: userAvatar.id,
                storyId: id,
                storyTitle: generatedStory.title,
                experience: experienceDescription,
                emotionalImpact: structuredMemory.emotionalImpact as "positive" | "negative" | "neutral",
                personalityChanges: allowedChanges, // Only allowed changes
                developmentDescription: structuredMemory.developmentDescription,
                contentType: 'story'
              });

              try {
                await addAvatarMemoryViaMcp(userAvatar.id, clerkToken, mcpApiKey, {
                  storyId: id,
                  storyTitle: generatedStory.title,
                  experience: experienceDescription,
                  emotionalImpact: structuredMemory.emotionalImpact as "positive" | "negative" | "neutral",
                  personalityChanges: allowedChanges.map((change: any) => ({
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
              
              // Mark story as read by this avatar (prevents duplicate rewards in mark-read)
              try {
                await avatarDB.exec`
                  INSERT INTO avatar_story_read (avatar_id, story_id, story_title)
                  VALUES (${userAvatar.id}, ${id}, ${generatedStory.title})
                  ON CONFLICT (avatar_id, story_id) DO NOTHING
                `;
                console.log(`[story.generate] âœ… Marked story as read for ${userAvatar.name}`);
              } catch (markReadError) {
                console.warn(`[story.generate] Failed to mark story as read:`, markReadError);
              }
              
              // Note: Artifacts are created during Phase 4.5/4.6 with thematic AI-generated content
              // The old evaluateStoryRewards system (generic artifacts) is disabled
              console.log(`[story.generate] ðŸ“¦ Artifact generation handled by Phase 4.5/4.6 (AI-themed artifacts)`);
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
      const errorMessage = String((error as any)?.message || error);
      const errorStack = (error as any)?.stack ? String((error as any).stack).slice(0, 2000) : undefined;
      const errorMetadata = {
        error: {
          message: errorMessage,
          stack: errorStack,
          storyId: id,
          at: new Date().toISOString(),
        },
      };
      await storyDB.exec`
        UPDATE stories
        SET status = 'error',
            metadata = ${JSON.stringify(errorMetadata)},
            updated_at = ${new Date()}
        WHERE id = ${id}
      `;
      try {
        await updateStoryInstanceStatus(id, "error", String((error as any)?.message || error));
      } catch (pipelineStatusError) {
        console.warn("[story.generate] Failed to update story_instances status:", pipelineStatusError);
      }
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

      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal(`Story generation failed (storyId=${id}): ${errorMessage}`);
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
    tokens_input: number | null;
    tokens_output: number | null;
    tokens_total: number | null;
    cost_input_usd: number | null;
    cost_output_usd: number | null;
    cost_total_usd: number | null;
    cost_mcp_usd: number | null;
    model_used: string | null;
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

  const coverImageUrl = await resolveImageUrlForClient(storyRow.cover_image_url || undefined);
  const chapters = await Promise.all(chapterRows.map(async (ch) => ({
    id: ch.id,
    title: ch.title,
    content: ch.content,
    imageUrl: await buildStoryChapterImageUrlForClient(storyId, ch.chapter_order, ch.image_url || undefined),
    order: ch.chapter_order,
  })));

  return {
    id: storyRow.id,
    userId: storyRow.user_id,
    title: storyRow.title,
    description: storyRow.description,
    coverImageUrl,
    config: JSON.parse(storyRow.config),
    avatarDevelopments: storyRow.avatar_developments ? JSON.parse(storyRow.avatar_developments) : undefined,
    metadata: storyRow.metadata ? JSON.parse(storyRow.metadata) : undefined,
    chapters,
    status: storyRow.status,
    tokensInput: storyRow.tokens_input || undefined,
    tokensOutput: storyRow.tokens_output || undefined,
    tokensTotal: storyRow.tokens_total || undefined,
    costInputUSD: storyRow.cost_input_usd || undefined,
    costOutputUSD: storyRow.cost_output_usd || undefined,
    costTotalUSD: storyRow.cost_total_usd || undefined,
    costMcpUSD: storyRow.cost_mcp_usd || undefined,
    modelUsed: storyRow.model_used || undefined,
    createdAt: storyRow.created_at,
    updatedAt: storyRow.updated_at,
  };
}





