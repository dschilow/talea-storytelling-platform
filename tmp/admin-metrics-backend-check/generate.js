// @bun
// backend/story/generate.ts
import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { generateStoryContent } from "./ai-generation";
import { generateStoryDevMode, pickDevModePoolCharacters, recordDevModePoolCharacterUsage } from "./dev-mode-generation";
import { generateStoryStandardMode } from "./standard-mode-generation";
import { convertAvatarDevelopmentsToPersonalityChanges } from "./traitMapping";
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
import { extractParticipantProfileIds, extractRequestedProfileId } from "../helpers/profile-context";
import {
  assertParentalDailyLimit,
  buildGenerationGuidanceFromControls,
  getParentalControlsForUser,
  sanitizeTextWithBlockedTerms
} from "../helpers/parental-controls";
import {
  createStructuredMemory,
  filterPersonalityChangesWithCooldown,
  loadPersonalityShiftCooldowns,
  summarizeMemoryCategory
} from "./memory-categorization";
import { StoryPipelineOrchestrator } from "./pipeline/orchestrator";
import { buildImageCostEntry, buildLlmCostEntry, summarizeStoryCostEntries } from "./pipeline/cost-ledger";
import { GEMINI_MAIN_STORY_MODEL } from "./pipeline/model-routing";
import { normalizeOpenRouterModel } from "./openrouter-generation";
import {
  assertProfilesBelongToUser,
  getProfileForUser,
  resolveRequestedProfileId
} from "../helpers/profiles";
import { ensureAvatarProfileLinksTable, hasAvatarProfileLinkForAny } from "../avatar/profile-links";
import {
  ageToAgeGroup,
  buildStoryProfilePrompt
} from "../helpers/child-profile-personalization";
import { enrichStoryForTTS } from "./tts-enrichment";
import { reserveStoryGenerationCapacity } from "./generation-capacity";
var mcpServerApiKey = secret("MCPServerAPIKey");
var DEV_MODE_IMAGE_MODEL = "runware:400@2";
var DEV_MODE_IMAGE_COST_USD = 0.00078;
function localizedModeText(lang, participating) {
  const l = lang ?? "de";
  const modes = {
    de: ["aktive Teilnahme", "Lesen"],
    en: ["active participation", "reading"],
    fr: ["participation active", "lecture"],
    es: ["participaci\xF3n activa", "lectura"],
    it: ["partecipazione attiva", "lettura"],
    nl: ["actieve deelname", "lezen"],
    ru: ["\u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0435 \u0443\u0447\u0430\u0441\u0442\u0438\u0435", "\u0447\u0442\u0435\u043D\u0438\u0435"]
  };
  return modes[l][participating ? 0 : 1];
}
function localizedTraitDescription(lang, trait, points, modeText, genre, storyTitle) {
  const l = lang ?? "de";
  if (trait.startsWith("knowledge.")) {
    const subject = trait.split(".")[1];
    const templates2 = {
      de: `+${points} ${subject} durch ${modeText} der ${genre}-Geschichte "${storyTitle}"`,
      en: `+${points} ${subject} through ${modeText} of ${genre} story "${storyTitle}"`,
      fr: `+${points} ${subject} gr\xE2ce \xE0 ${modeText} de l'histoire ${genre} "${storyTitle}"`,
      es: `+${points} ${subject} mediante ${modeText} de la historia ${genre} "${storyTitle}"`,
      it: `+${points} ${subject} attraverso ${modeText} della storia ${genre} "${storyTitle}"`,
      nl: `+${points} ${subject} via ${modeText} van ${genre}-verhaal "${storyTitle}"`,
      ru: `+${points} ${subject} \u0447\u0435\u0440\u0435\u0437 ${modeText} \u0438\u0441\u0442\u043E\u0440\u0438\u0438 ${genre} "${storyTitle}"`
    };
    return templates2[l];
  }
  const templates = {
    de: `+${points} ${trait} durch ${modeText} in "${storyTitle}" entwickelt`,
    en: `+${points} ${trait} developed through ${modeText} in "${storyTitle}"`,
    fr: `+${points} ${trait} d\xE9velopp\xE9 via ${modeText} dans "${storyTitle}"`,
    es: `+${points} ${trait} desarrollado mediante ${modeText} en "${storyTitle}"`,
    it: `+${points} ${trait} sviluppato attraverso ${modeText} in "${storyTitle}"`,
    nl: `+${points} ${trait} ontwikkeld via ${modeText} in "${storyTitle}"`,
    ru: `+${points} ${trait} \u0440\u0430\u0437\u0432\u0438\u0442\u043E \u0447\u0435\u0440\u0435\u0437 ${modeText} \u0432 "${storyTitle}"`
  };
  return templates[l];
}
function localizedExperienceDescription(lang, participating, genre, storyTitle) {
  const l = lang ?? "de";
  const templates = {
    de: [`Ich war aktiver Teilnehmer in der Geschichte "${storyTitle}". Genre: ${genre}.`, `Ich habe die Geschichte "${storyTitle}" gelesen. Genre: ${genre}.`],
    en: [`I was an active participant in the story "${storyTitle}". Genre: ${genre}.`, `I read the story "${storyTitle}". Genre: ${genre}.`],
    fr: [`J'ai particip\xE9 activement \xE0 l'histoire "${storyTitle}". Genre: ${genre}.`, `J'ai lu l'histoire "${storyTitle}". Genre: ${genre}.`],
    es: [`Particip\xE9 activamente en la historia "${storyTitle}". G\xE9nero: ${genre}.`, `Le\xED la historia "${storyTitle}". G\xE9nero: ${genre}.`],
    it: [`Ho partecipato attivamente alla storia "${storyTitle}". Genere: ${genre}.`, `Ho letto la storia "${storyTitle}". Genere: ${genre}.`],
    nl: [`Ik nam actief deel aan het verhaal "${storyTitle}". Genre: ${genre}.`, `Ik las het verhaal "${storyTitle}". Genre: ${genre}.`],
    ru: [`\u042F \u0430\u043A\u0442\u0438\u0432\u043D\u043E \u0443\u0447\u0430\u0441\u0442\u0432\u043E\u0432\u0430\u043B \u0432 \u0438\u0441\u0442\u043E\u0440\u0438\u0438 "${storyTitle}". \u0416\u0430\u043D\u0440: ${genre}.`, `\u042F \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u043B \u0438\u0441\u0442\u043E\u0440\u0438\u044E "${storyTitle}". \u0416\u0430\u043D\u0440: ${genre}.`]
  };
  return templates[l][participating ? 0 : 1];
}
function resolveClientProvidedStoryId(storyId) {
  const trimmed = storyId?.trim();
  if (!trimmed) {
    return crypto.randomUUID();
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    throw APIError.invalidArgument("storyId must be a valid UUID");
  }
  return trimmed;
}
function uniqueTrimmed(values) {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}
function mergePromptBlocks(...blocks) {
  const merged = blocks.map((block) => block?.trim()).filter((block) => Boolean(block)).join(`

`);
  return merged.length > 0 ? merged : undefined;
}
var generate = api({ expose: true, method: "POST", path: "/story/generate", auth: true }, async (req) => {
  const id = resolveClientProvidedStoryId(req.storyId);
  const now = new Date;
  const auth = getAuthData();
  const currentUserId = auth?.userID;
  if (!currentUserId) {
    throw APIError.unauthenticated("Missing authenticated user for story generation");
  }
  if (req.userId && auth?.userID && req.userId !== auth.userID) {
    throw APIError.permissionDenied("userId mismatch: request userId does not match authenticated user");
  }
  const clerkToken = auth?.clerkToken;
  if (!clerkToken) {
    throw APIError.unauthenticated("Missing Clerk token for MCP operations");
  }
  const parentalControls = await getParentalControlsForUser(currentUserId);
  const dayStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayUsage = await storyDB.queryRow`
      SELECT COUNT(*)::int AS count
      FROM stories
      WHERE user_id = ${currentUserId}
        AND created_at >= ${dayStartUtc}
    `;
  assertParentalDailyLimit({
    controls: parentalControls,
    kind: "story",
    usedToday: todayUsage?.count ?? 0
  });
  const parentalGuidance = buildGenerationGuidanceFromControls(parentalControls);
  const requestedAiModel = req.config.aiModel;
  const requestedAiProvider = req.config.aiProvider === "openrouter" ? "openrouter" : "native";
  const requestedOpenRouterModel = requestedAiProvider === "openrouter" ? normalizeOpenRouterModel(req.config.openRouterModel) : undefined;
  const defaultAiModel = "gemini-3-flash-preview";
  const effectiveAiModel = requestedAiModel ?? defaultAiModel;
  if (requestedAiProvider === "openrouter" || requestedAiModel && requestedAiModel !== defaultAiModel) {
    console.log("[story.generate] Model override from wizard applied", {
      userId: currentUserId,
      requestedAiProvider,
      requestedAiModel,
      requestedOpenRouterModel,
      defaultAiModel
    });
  }
  const blockedTerms = parentalControls.enabled ? parentalControls.blockedTerms : [];
  const requestedPrimaryProfileId = req.profileId ?? extractRequestedProfileId(req);
  const primaryProfileId = await resolveRequestedProfileId({
    userId: currentUserId,
    requestedProfileId: requestedPrimaryProfileId,
    fallbackName: auth?.email ?? undefined
  });
  const primaryProfile = await getProfileForUser({
    userId: currentUserId,
    profileId: primaryProfileId
  });
  const requestedParticipants = extractParticipantProfileIds(req);
  const participantProfileIds = uniqueTrimmed([
    primaryProfileId,
    ...requestedParticipants.length > 0 ? await assertProfilesBelongToUser(currentUserId, requestedParticipants) : []
  ]);
  const inferredAgeGroup = ageToAgeGroup(primaryProfile.age);
  const profilePrompt = buildStoryProfilePrompt(primaryProfile);
  const config = {
    ...req.config,
    ageGroup: req.config.ageGroup || inferredAgeGroup || "6-8",
    aiModel: effectiveAiModel,
    aiProvider: requestedAiProvider,
    openRouterModel: requestedOpenRouterModel,
    parentalGuidance: parentalGuidance || undefined,
    customPrompt: req.config.developerMode ? req.config.customPrompt : mergePromptBlocks(req.config.customPrompt, profilePrompt)
  };
  await ensureAvatarProfileLinksTable();
  const mcpApiKey = mcpServerApiKey();
  console.log("[story.generate] Incoming request:", {
    storyId: id,
    userId: currentUserId,
    config: req?.config ? {
      avatarIdsCount: config.avatarIds?.length ?? 0,
      genre: config.genre,
      setting: config.setting,
      length: config.length,
      complexity: config.complexity,
      ageGroup: config.ageGroup,
      aiModel: config.aiModel ?? "not-set",
      aiProvider: config.aiProvider ?? "native",
      openRouterModel: config.openRouterModel,
      stylePreset: config.stylePreset,
      tone: config.tone,
      language: config.language,
      allowRhymes: config.allowRhymes ?? false,
      suspenseLevel: config.suspenseLevel ?? 1,
      humorLevel: config.humorLevel ?? 2,
      pacing: config.pacing ?? "balanced",
      pov: config.pov ?? "personale",
      hooksCount: config.hooks?.length ?? 0,
      hasTwist: config.hasTwist ?? false,
      learningMode: config.learningMode ? {
        enabled: config.learningMode.enabled,
        subjectsCount: config.learningMode.subjects?.length ?? 0,
        difficulty: config.learningMode.difficulty,
        objectivesCount: config.learningMode.learningObjectives?.length ?? 0,
        assessmentType: config.learningMode.assessmentType
      } : undefined,
      hasParentalGuidance: Boolean(config.parentalGuidance)
    } : undefined
  });
  await reserveStoryGenerationCapacity({
    userId: currentUserId,
    createReservation: async (tx) => {
      const reserved = await tx.queryRow`
          INSERT INTO stories (
            id, user_id, primary_profile_id, title, description, config, status, created_at, updated_at
          ) VALUES (
            ${id}, ${currentUserId}, ${primaryProfileId},
            ${config.language === "en" ? "Generating..." : config.language === "fr" ? "En cours de g\xE9n\xE9ration..." : config.language === "es" ? "Generando..." : config.language === "it" ? "Generazione in corso..." : config.language === "nl" ? "Wordt gegenereerd..." : config.language === "ru" ? "\u0413\u0435\u043D\u0435\u0440\u0430\u0446\u0438\u044F..." : "Wird generiert..."},
            ${config.language === "en" ? "Your story is being created..." : config.language === "fr" ? "Votre histoire est en cours de cr\xE9ation..." : config.language === "es" ? "Tu historia est\xE1 siendo creada..." : config.language === "it" ? "La tua storia \xE8 in fase di creazione..." : config.language === "nl" ? "Jouw verhaal wordt aangemaakt..." : config.language === "ru" ? "\u0412\u0430\u0448\u0430 \u0438\u0441\u0442\u043E\u0440\u0438\u044F \u0441\u043E\u0437\u0434\u0430\u0451\u0442\u0441\u044F..." : "Deine Geschichte wird erstellt..."},
            ${JSON.stringify(config)}, 'generating', ${now}, ${now}
          )
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        `;
      if (!reserved) {
        throw APIError.alreadyExists("F\xFCr diese Geschichte l\xE4uft bereits eine Generierung.");
      }
    }
  });
  try {
    await claimGenerationUsage({
      userId: currentUserId,
      kind: "story",
      profileId: primaryProfileId,
      contentRef: id,
      clerkToken
    });
    await Promise.all(participantProfileIds.flatMap((participantProfileId) => [
      storyDB.exec`
            INSERT INTO story_participants (
              id,
              story_id,
              profile_id,
              avatar_ids,
              created_at
            )
            VALUES (
              ${crypto.randomUUID()},
              ${id},
              ${participantProfileId},
              ${JSON.stringify(config.avatarIds || [])}::jsonb,
              ${now}
            )
            ON CONFLICT (story_id, profile_id) DO UPDATE
            SET avatar_ids = EXCLUDED.avatar_ids
          `,
      storyDB.exec`
            INSERT INTO story_profile_state (
              profile_id,
              story_id,
              is_favorite,
              progress_pct,
              completion_state,
              created_at,
              updated_at
            )
            VALUES (
              ${participantProfileId},
              ${id},
              FALSE,
              0,
              'not_started',
              ${now},
              ${now}
            )
            ON CONFLICT (profile_id, story_id) DO NOTHING
          `
    ]));
    console.log("[story.generate] Loading avatar details...", { count: config.avatarIds.length });
    const avatarRows = await avatarDB.queryAll`
        SELECT id, user_id, profile_id, name, description, physical_traits, personality_traits, image_url, visual_profile, creation_type, is_public, inventory, skills
        FROM avatars
        WHERE id = ANY(${config.avatarIds})
      `;
    const avatarRowMap = new Map(avatarRows.map((r) => [r.id, r]));
    for (const avatarId of config.avatarIds) {
      if (!avatarRowMap.has(avatarId)) {
        throw APIError.notFound(`Avatar ${avatarId} not found`);
      }
    }
    for (const row of avatarRows) {
      if (row.user_id !== currentUserId) {
        if (!row.is_public) {
          throw APIError.permissionDenied("Avatar is not available. Copy it into your profile first.");
        }
      } else if (row.profile_id && !participantProfileIds.includes(row.profile_id)) {
        const linkedToAnyParticipant = await hasAvatarProfileLinkForAny({
          avatarId: row.id,
          userId: currentUserId,
          profileIds: participantProfileIds
        });
        if (!linkedToAnyParticipant) {
          throw APIError.permissionDenied("Avatar belongs to another child profile.");
        }
      }
    }
    const traitUpgradePromises = [];
    const avatarDetails = config.avatarIds.map((avatarId) => avatarRowMap.get(avatarId)).map((row) => {
      const physicalTraits = row.physical_traits ? JSON.parse(row.physical_traits) : {};
      const rawPersonalityTraits = row.personality_traits ? JSON.parse(row.personality_traits) : {};
      const upgradedPersonalityTraits = upgradePersonalityTraits(rawPersonalityTraits);
      if (Object.keys(upgradedPersonalityTraits).length > Object.keys(rawPersonalityTraits).length) {
        traitUpgradePromises.push(avatarDB.exec`
                UPDATE avatars
                SET personality_traits = ${JSON.stringify(upgradedPersonalityTraits)},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${row.id}
              `.catch((upgradeError) => {
          console.warn("[story.generate] Failed to persist upgraded traits", { avatarId: row.id, upgradeError });
        }));
      }
      let inventory = [];
      let skills = [];
      try {
        inventory = row.inventory ? JSON.parse(row.inventory) : [];
      } catch (parseInvErr) {
        console.warn("[story.generate] Failed to parse inventory JSON; defaulting to []", { avatarId: row.id, parseInvErr });
      }
      try {
        skills = row.skills ? JSON.parse(row.skills) : [];
      } catch (parseSkillsErr) {
        console.warn("[story.generate] Failed to parse skills JSON; defaulting to []", { avatarId: row.id, parseSkillsErr });
      }
      return {
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
        skills
      };
    });
    if (traitUpgradePromises.length > 0) {
      Promise.all(traitUpgradePromises);
    }
    console.log("[story.generate] Avatar details for story generation:", avatarDetails.map((a) => ({
      name: a.name,
      hasImage: !!a.imageUrl,
      hasVisualProfile: !!a.visualProfile
    })));
    const useCharacterPool = config.useCharacterPool ?? true;
    let generatedStory;
    let pipelineResult;
    if (config.developerMode === true) {
      console.log("[story.generate] \uD83E\uDDEA DEVELOPER MODE \u2014 adaptive polish cost-optimized quality path (support model for planning/judging, selected model for prose, images enabled, NO personality updates)");
      const poolCharacters = await pickDevModePoolCharacters({
        setting: config.setting,
        genre: config.genre,
        ageGroup: config.ageGroup,
        userId: currentUserId,
        excludeNames: new Set(avatarDetails.map((a) => a.name.toLowerCase())),
        heroCount: avatarDetails.length
      });
      console.log("[story.generate] \uD83E\uDDEA Dev mode auto-cast:", {
        poolCount: poolCharacters.length,
        names: poolCharacters.map((c) => c.name)
      });
      const devResult = await generateStoryDevMode({
        config,
        userId: currentUserId,
        storyId: id,
        avatars: avatarDetails.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          imageUrl: a.imageUrl,
          visualProfile: a.visualProfile,
          physicalTraits: a.physicalTraits,
          personalityTraits: a.personalityTraits
        })),
        poolCharacters,
        primaryProfileAge: primaryProfile.age
      });
      await recordDevModePoolCharacterUsage({
        storyId: id,
        poolCharacters,
        selectedSupportingCast: devResult.metadata.selectedSupportingCast
      });
      if (devResult.metadata?.status === "quality_gate_failed" || devResult.metadata?.releaseReady === false) {
        console.warn("[story.generate] Dev-mode story returned with quality gate fail \u2014 treating as debug candidate", {
          storyId: id,
          status: devResult.metadata?.status,
          releaseReady: devResult.metadata?.releaseReady,
          qualityGateFailureReason: devResult.metadata?.qualityGateFailureReason,
          hardIssueList: devResult.metadata?.hardIssueList?.slice(0, 6),
          imagesSkippedDueToQualityGate: devResult.metadata?.imagesSkippedDueToQualityGate,
          qualityScore: devResult.metadata?.qualityScore
        });
      }
      generatedStory = devResult;
    } else if (config.useLegacyPipelineV2 === true && useCharacterPool) {
      console.log("[story.generate] Using legacy Story Pipeline v2 (explicit useLegacyPipelineV2 flag)...");
      const orchestrator = new StoryPipelineOrchestrator;
      pipelineResult = await orchestrator.run({
        storyId: id,
        userId: currentUserId,
        config,
        avatars: avatarDetails,
        enableVisionValidation: Boolean(config.enableVisionValidation)
      });
      const imageByChapter = new Map(pipelineResult.images.map((img) => [img.chapter, img.imageUrl]));
      const promptByChapter = new Map(pipelineResult.imageSpecs.map((spec) => [spec.chapter, spec.finalPromptText || ""]));
      const scenicImageByChapter = new Map(pipelineResult.images.map((img) => [img.chapter, img.scenicImageUrl]));
      const scenicPromptByChapter = new Map(pipelineResult.images.map((img) => [img.chapter, img.scenicPrompt || ""]));
      const chapters = pipelineResult.storyDraft.chapters.map((ch) => ({
        id: crypto.randomUUID(),
        title: String(ch.title || "").trim() || (config.language === "en" ? `Chapter ${ch.chapter}` : config.language === "fr" ? `Chapitre ${ch.chapter}` : config.language === "es" ? `Cap\xEDtulo ${ch.chapter}` : config.language === "it" ? `Capitolo ${ch.chapter}` : config.language === "nl" ? `Hoofdstuk ${ch.chapter}` : config.language === "ru" ? `\u0413\u043B\u0430\u0432\u0430 ${ch.chapter}` : `Kapitel ${ch.chapter}`),
        content: ch.text,
        imageUrl: imageByChapter.get(ch.chapter),
        scenicImageUrl: scenicImageByChapter.get(ch.chapter),
        scenicImagePrompt: scenicPromptByChapter.get(ch.chapter),
        order: ch.chapter,
        imagePrompt: promptByChapter.get(ch.chapter),
        imageModel: "runware"
      }));
      const chapterVisuals = Object.fromEntries(chapters.filter((chapter) => chapter.scenicImageUrl || chapter.scenicImagePrompt).map((chapter) => [
        String(chapter.order),
        {
          scenicImageUrl: chapter.scenicImageUrl,
          scenicImagePrompt: chapter.scenicImagePrompt
        }
      ]));
      const tokenUsage = pipelineResult.tokenUsage ? {
        prompt: pipelineResult.tokenUsage.promptTokens,
        completion: pipelineResult.tokenUsage.completionTokens,
        total: pipelineResult.tokenUsage.totalTokens,
        inputCostUSD: pipelineResult.tokenUsage.inputCostUSD,
        outputCostUSD: pipelineResult.tokenUsage.outputCostUSD,
        totalCostUSD: pipelineResult.tokenUsage.totalCostUSD,
        modelUsed: pipelineResult.tokenUsage.model || config.aiModel || GEMINI_MAIN_STORY_MODEL
      } : { prompt: 0, completion: 0, total: 0 };
      const pendingArtifact = pipelineResult.artifactMeta ? {
        id: pipelineResult.artifactMeta.id,
        name: config.language === "de" ? pipelineResult.artifactMeta.name.de : pipelineResult.artifactMeta.name.en,
        nameEn: pipelineResult.artifactMeta.name.en,
        description: config.language === "de" ? pipelineResult.artifactMeta.description.de : pipelineResult.artifactMeta.description.en,
        category: pipelineResult.artifactMeta.category,
        rarity: pipelineResult.artifactMeta.rarity,
        storyRole: pipelineResult.artifactMeta.storyRole,
        visualKeywords: pipelineResult.artifactMeta.visualKeywords,
        imageUrl: await buildArtifactImageUrlForClient(pipelineResult.artifactMeta.id, pipelineResult.artifactMeta.imageUrl),
        discoveryChapter: 2,
        usageChapter: 4,
        locked: true
      } : undefined;
      const characterPoolUsed = pipelineResult.castSet.poolCharacters.map((character) => ({
        characterId: character.characterId,
        characterName: character.displayName
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
          imagesGenerated: pipelineResult.images.filter((img) => img.imageUrl).length + pipelineResult.images.filter((img) => img.scenicImageUrl).length + (pipelineResult.coverImage?.imageUrl ? 1 : 0),
          characterPoolUsed,
          chapterVisuals,
          quality: pipelineResult.criticReport ? {
            criticScore: pipelineResult.criticReport.overallScore,
            criticSummary: pipelineResult.criticReport.summary,
            releaseReady: pipelineResult.criticReport.releaseReady
          } : undefined,
          releasePipeline: pipelineResult.releaseReport,
          costBreakdown: pipelineResult.costEntries?.length ? summarizeStoryCostEntries(pipelineResult.costEntries, {
            selectedCandidateTag: pipelineResult.releaseReport?.selectedCandidateIndex ? `cand-${pipelineResult.releaseReport.selectedCandidateIndex}` : undefined
          }) : undefined
        }
      };
    } else if (!useCharacterPool) {
      console.log("[story.generate] Using legacy story generation (no character pool)...");
      console.log("[story.generate] Calling generateStoryContent with MCP context...");
      generatedStory = await generateStoryContent({
        config,
        avatarDetails,
        clerkToken
      });
    } else {
      console.log("[story.generate] Using standard quality pipeline (dev-mode engine + product features)...");
      generatedStory = await generateStoryStandardMode({
        config,
        userId: currentUserId,
        storyId: id,
        avatars: avatarDetails.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          imageUrl: a.imageUrl,
          visualProfile: a.visualProfile,
          physicalTraits: a.physicalTraits,
          personalityTraits: a.personalityTraits
        })),
        primaryProfileAge: primaryProfile.age
      });
    }
    console.log("[story.generate] Story content generated:", {
      title: generatedStory?.title,
      descLen: generatedStory?.description?.length,
      chapters: generatedStory?.chapters?.length,
      coverImageUrlLen: generatedStory?.coverImageUrl?.length,
      devCount: generatedStory?.avatarDevelopments?.length ?? 0,
      tokens: generatedStory?.metadata?.tokensUsed
    });
    let validatedDevelopments = generatedStory.avatarDevelopments ?? [];
    if (!config.developerMode) {
      try {
        const validation = await validateAvatarDevelopments(validatedDevelopments, mcpApiKey);
        if (validation?.isValid === false) {
          throw new Error(`Avatar developments invalid: ${JSON.stringify(validation.errors ?? {})}`);
        }
        if (Array.isArray(validation?.normalized)) {
          const originalDescriptions = new Map;
          for (const dev of validatedDevelopments) {
            for (const traitChange of Array.isArray(dev?.changedTraits) ? dev.changedTraits : []) {
              if (typeof traitChange?.description === "string" && traitChange.description.trim()) {
                originalDescriptions.set(`${String(dev?.name || "").toLowerCase()}|${traitChange.trait}`, traitChange.description);
              }
            }
          }
          validatedDevelopments = validation.normalized.map((dev) => ({
            ...dev,
            changedTraits: Array.isArray(dev?.changedTraits) ? dev.changedTraits.map((traitChange) => ({
              ...traitChange,
              description: traitChange?.description || originalDescriptions.get(`${String(dev?.name || "").toLowerCase()}|${traitChange?.trait}`)
            })) : dev?.changedTraits
          }));
        }
      } catch (validationError) {
        console.warn("[story.generate] Avatar development validation warning:", validationError);
      }
    }
    let parentalFilterReplacements = 0;
    if (blockedTerms.length > 0) {
      const sanitizedTitle = sanitizeTextWithBlockedTerms(generatedStory.title ?? "", blockedTerms);
      const sanitizedDescription = sanitizeTextWithBlockedTerms(generatedStory.description ?? "", blockedTerms);
      parentalFilterReplacements += sanitizedTitle.replacements + sanitizedDescription.replacements;
      generatedStory = {
        ...generatedStory,
        title: sanitizedTitle.text,
        description: sanitizedDescription.text,
        chapters: Array.isArray(generatedStory.chapters) ? generatedStory.chapters.map((chapter) => {
          const chapterTitle = sanitizeTextWithBlockedTerms(chapter?.title ?? "", blockedTerms);
          const chapterContent = sanitizeTextWithBlockedTerms(chapter?.content ?? "", blockedTerms);
          parentalFilterReplacements += chapterTitle.replacements + chapterContent.replacements;
          return {
            ...chapter,
            title: chapterTitle.text,
            content: chapterContent.text
          };
        }) : generatedStory.chapters
      };
    }
    const metadataUsage = generatedStory.metadata?.tokensUsed;
    const devModeStages = Array.isArray(generatedStory.metadata?.devModeStages) ? generatedStory.metadata.devModeStages : [];
    const stagePipelinePhase = config.developerMode === true ? "dev-mode-generation" : "standard-mode-generation";
    const devModeCostEntries = devModeStages.length > 0 ? devModeStages.map((stage) => {
      const usage = stage?.usage;
      if (!usage)
        return null;
      const model = stage?.modelUsed || metadataUsage?.modelUsed || config.aiModel || GEMINI_MAIN_STORY_MODEL;
      return buildLlmCostEntry({
        phase: stagePipelinePhase,
        step: String(stage?.stage || "unknown-stage"),
        usage: {
          promptTokens: Number(usage.prompt || 0),
          completionTokens: Number(usage.completion || 0),
          totalTokens: Number(usage.total || 0),
          model
        },
        fallbackModel: model,
        success: true,
        metadata: {
          durationMs: stage?.durationMs,
          score: stage?.score,
          pipeline: generatedStory.metadata?.generationMode || generatedStory.metadata?.devModePipeline || "adaptive-polish-cost-optimized",
          modelRole: stage?.modelRole
        }
      });
    }).filter(Boolean) : [];
    const devModeImagesGenerated = devModeStages.length > 0 ? Number(generatedStory.metadata?.imagesGenerated || 0) : 0;
    const devModeImageCostEntries = devModeImagesGenerated > 0 ? [buildImageCostEntry({
      phase: stagePipelinePhase,
      step: "runware-images",
      provider: "runware",
      model: DEV_MODE_IMAGE_MODEL,
      success: true,
      itemCount: devModeImagesGenerated,
      providerCostUSD: Number((devModeImagesGenerated * DEV_MODE_IMAGE_COST_USD).toFixed(6)),
      metadata: {
        estimated: true,
        unitCostUSD: DEV_MODE_IMAGE_COST_USD,
        source: "dev-mode-image-count"
      }
    })] : [];
    const fallbackUsage = pipelineResult?.tokenUsage ? pipelineResult.tokenUsage : metadataUsage ? {
      promptTokens: metadataUsage.prompt || 0,
      completionTokens: metadataUsage.completion || 0,
      totalTokens: metadataUsage.total || 0,
      model: metadataUsage.modelUsed || config.aiModel || GEMINI_MAIN_STORY_MODEL
    } : undefined;
    const fallbackCostEntries = devModeCostEntries.length > 0 ? devModeCostEntries : fallbackUsage ? [
      buildLlmCostEntry({
        phase: "story-generation",
        step: "legacy-total",
        usage: fallbackUsage,
        fallbackModel: fallbackUsage.model || config.aiModel || GEMINI_MAIN_STORY_MODEL
      })
    ].filter(Boolean) : [];
    const storyCostEntries = pipelineResult?.costEntries?.length ? pipelineResult.costEntries : [...fallbackCostEntries, ...devModeImageCostEntries];
    const selectedCandidateTag = pipelineResult?.releaseReport?.selectedCandidateIndex ? `cand-${pipelineResult.releaseReport.selectedCandidateIndex}` : undefined;
    const costSummary = summarizeStoryCostEntries(storyCostEntries.filter(Boolean), {
      selectedCandidateTag
    });
    const tokensUsed = generatedStory.metadata?.tokensUsed || { prompt: 0, completion: 0, total: 0 };
    const inputCost = costSummary.totals.llm.inputCostUSD || 0;
    const outputCost = costSummary.totals.llm.outputCostUSD || 0;
    const totalCost = costSummary.totals.overall.trackedCostUSD || 0;
    const modelUsed = generatedStory.metadata?.tokensUsed?.modelUsed || config.aiModel || GEMINI_MAIN_STORY_MODEL;
    const mcpCost = 0;
    console.log("[story.generate] Cost tracking:", {
      model: modelUsed,
      tokens: costSummary.totals.llm,
      inputCost: `$${inputCost.toFixed(6)}`,
      outputCost: `$${outputCost.toFixed(6)}`,
      totalCost: `$${totalCost.toFixed(6)}`
    });
    await publishWithTimeout(logTopic, {
      source: "story-generation-costs",
      timestamp: new Date,
      request: {
        storyId: id,
        userId: currentUserId,
        model: modelUsed
      },
      response: {
        title: generatedStory.title,
        summary: costSummary.summary,
        sections: costSummary.sections,
        tokens: {
          input: costSummary.totals.llm.inputTokens || tokensUsed.prompt || 0,
          cached_input: costSummary.totals.llm.cachedInputTokens || 0,
          output: costSummary.totals.llm.outputTokens || tokensUsed.completion || 0,
          total: costSummary.totals.llm.totalTokens || tokensUsed.total || 0
        },
        costs: {
          cached_input_usd: costSummary.totals.llm.cachedInputCostUSD || 0,
          input_usd: inputCost,
          output_usd: outputCost,
          total_usd: totalCost,
          llm_total_usd: costSummary.totals.llm.totalCostUSD || 0,
          image_total_usd: costSummary.totals.images.providerCostUSD || 0,
          image_total_credits: costSummary.totals.images.providerCostCredits || 0,
          mcp_usd: mcpCost
        },
        totals: costSummary.totals,
        breakdown: costSummary.breakdown,
        debug: costSummary.debug
      }
    });
    const persistedStages = Array.isArray(generatedStory.metadata?.devModeStages) ? generatedStory.metadata.devModeStages : [];
    const pipelineDurationMs = persistedStages.reduce((sum, stage) => sum + Math.max(0, Number(stage?.durationMs || 0)), 0);
    const toAdminMetricRows = (rows = []) => rows.map((row) => ({
      key: String(row?.key || "unknown"),
      calls: Number(row?.calls || 0),
      inputTokens: Number(row?.inputTokens || 0),
      outputTokens: Number(row?.outputTokens || 0),
      totalTokens: Number(row?.totalTokens || 0),
      totalCostUSD: Number(((row?.totalCostUSD || 0) + (row?.providerCostUSD || 0)).toFixed(6))
    }));
    const adminGenerationMetrics = {
      version: 1,
      currency: "USD",
      calculatedAt: new Date().toISOString(),
      tokens: {
        input: costSummary.totals.llm.inputTokens || tokensUsed.prompt || 0,
        cachedInput: costSummary.totals.llm.cachedInputTokens || 0,
        output: costSummary.totals.llm.outputTokens || tokensUsed.completion || 0,
        total: costSummary.totals.llm.totalTokens || tokensUsed.total || 0
      },
      costs: {
        cachedInputUSD: costSummary.totals.llm.cachedInputCostUSD || 0,
        inputUSD: inputCost,
        outputUSD: outputCost,
        storyUSD: costSummary.totals.llm.totalCostUSD || 0,
        imagesUSD: costSummary.totals.images.providerCostUSD || 0,
        totalUSD: totalCost,
        imageCredits: costSummary.totals.images.providerCostCredits || 0
      },
      calls: {
        llm: costSummary.totals.llm.calls || 0,
        images: costSummary.totals.images.successCount || costSummary.totals.images.calls || 0
      },
      durationMs: pipelineDurationMs,
      imageCostEstimated: storyCostEntries.some((entry) => entry?.kind === "image" && entry?.metadata?.estimated === true),
      stages: toAdminMetricRows(costSummary.breakdown.byStep),
      models: toAdminMetricRows(costSummary.breakdown.byModel)
    };
    const enrichedMetadata = {
      ...generatedStory.metadata,
      processingTime: generatedStory.metadata?.processingTime || pipelineDurationMs,
      totalCost: {
        text: adminGenerationMetrics.costs.storyUSD,
        images: adminGenerationMetrics.costs.imagesUSD,
        total: adminGenerationMetrics.costs.totalUSD
      },
      adminGenerationMetrics,
      newArtifact: generatedStory.newArtifact || undefined,
      pendingArtifact: generatedStory.pendingArtifact || undefined,
      parentalFilters: parentalFilterReplacements > 0 ? {
        active: true,
        replacements: parentalFilterReplacements
      } : undefined
    };
    console.log("[story.generate] \uD83C\uDF81 artifact in response:", {
      hasNewArtifact: !!generatedStory.newArtifact,
      newArtifactName: generatedStory.newArtifact?.name || "none",
      hasPendingArtifact: !!generatedStory.pendingArtifact,
      pendingArtifactName: generatedStory.pendingArtifact?.name || "none"
    });
    console.log("[story.generate] Persisting story header into DB...");
    await storyDB.exec`
        UPDATE stories
        SET title = ${generatedStory.title},
            description = ${generatedStory.description},
            cover_image_url = ${generatedStory.coverImageUrl},
            avatar_developments = ${JSON.stringify(validatedDevelopments || [])},
            metadata = ${JSON.stringify(enrichedMetadata)},
            status = 'complete',
            updated_at = ${new Date}
        WHERE id = ${id}
      `;
    console.log("[story.generate] Inserting chapters...", { count: generatedStory.chapters.length });
    const insertedChapters = [];
    for (const chapter of generatedStory.chapters) {
      const chapterId = crypto.randomUUID();
      console.log("[story.generate] Insert chapter:", {
        id: chapterId,
        title: chapter?.title,
        titleLen: chapter?.title?.length,
        contentLen: chapter?.content?.length,
        imageUrlLen: chapter?.imageUrl?.length,
        order: chapter?.order
      });
      await storyDB.exec`
          INSERT INTO chapters (
            id, story_id, title, content, image_url, chapter_order, created_at
          ) VALUES (
            ${chapterId}, ${id}, ${chapter.title}, ${chapter.content},
            ${chapter.imageUrl}, ${chapter.order}, ${now}
          )
        `;
      insertedChapters.push({
        id: chapterId,
        title: chapter.title,
        content: chapter.content,
        order: chapter.order
      });
    }
    if (!config.developerMode) {
      enrichStoryForTTS({
        storyId: id,
        chapters: insertedChapters,
        aiModel: config.aiModel
      }).catch((error) => {
        console.error(`[story.generate] TTS enrichment failed (non-blocking): ${error instanceof Error ? error.message : String(error)}`);
      });
    } else {
      console.log("[story.generate] \uD83E\uDDEA Developer mode \u2014 skipping TTS enrichment.");
    }
    if (config.developerMode) {
      console.log("[story.generate] \uD83E\uDDEA Developer mode \u2014 skipping personality/memory updates.");
    }
    console.log("[AI-DRIVEN SYSTEM] Applying trait updates to selected avatars...");
    const selectedAvatarIds = config.developerMode ? [] : uniqueTrimmed(config.avatarIds || []);
    const selectedAvatarRows = selectedAvatarIds.length > 0 ? await avatarDB.queryAll`
            SELECT id, name
            FROM avatars
            WHERE id = ANY(${selectedAvatarIds})
          ` : [];
    const selectedAvatarMap = new Map(selectedAvatarRows.map((row) => [row.id, row]));
    const selectedAvatars = selectedAvatarIds.map((avatarId) => selectedAvatarMap.get(avatarId)).filter((row) => Boolean(row));
    console.log(`[story.generate] Found ${selectedAvatars.length} participating avatars for story ${id}`);
    if (validatedDevelopments.length > 0 && selectedAvatars.length > 0) {
      const convertedDevelopments = convertAvatarDevelopmentsToPersonalityChanges(validatedDevelopments);
      const modeText = localizedModeText(config.language, true);
      for (const userAvatar of selectedAvatars) {
        const aiDevelopment = convertedDevelopments.find((dev) => dev.name === userAvatar.name);
        let changes = [];
        let experienceDescription = "";
        if (aiDevelopment && aiDevelopment.changedTraits && aiDevelopment.changedTraits.length > 0) {
          changes = aiDevelopment.changedTraits.map((change) => {
            const aiDescription = typeof change.description === "string" && change.description.trim().length > 0 ? change.description.trim() : undefined;
            const description = aiDescription ?? localizedTraitDescription(config.language, change.trait, change.change, modeText, config.genre, generatedStory.title);
            return { trait: change.trait, change: change.change, description };
          });
          experienceDescription = localizedExperienceDescription(config.language, true, config.genre, generatedStory.title);
        } else {
          const baseTraits = config.genre === "adventure" ? ["courage", "curiosity"] : config.genre === "educational" ? ["logic", "curiosity"] : config.genre === "mystery" ? ["curiosity", "logic"] : config.genre === "friendship" ? ["empathy", "teamwork"] : ["empathy", "curiosity"];
          changes = baseTraits.map((trait) => {
            const points = 2;
            const description = localizedTraitDescription(config.language, trait, points, modeText, config.genre, generatedStory.title);
            return { trait, change: points, description };
          });
          experienceDescription = localizedExperienceDescription(config.language, true, config.genre, generatedStory.title);
        }
        if (changes.length > 0) {
          console.log(`[story.generate] Updating ${userAvatar.name} (participant):`, changes);
          try {
            const structuredMemory = createStructuredMemory(experienceDescription, changes, id, generatedStory.title, "story", "positive");
            console.log(`[story.generate] \uD83D\uDCDD Memory category: ${structuredMemory.category} (${summarizeMemoryCategory(structuredMemory.category)})`);
            let lastShifts = [];
            try {
              lastShifts = await loadPersonalityShiftCooldowns(avatarDB, userAvatar.id);
            } catch (cooldownLoadError) {
              console.warn(`[story.generate] Failed to load cooldown history for ${userAvatar.name}; applying without cooldown`, cooldownLoadError);
            }
            const { allowedChanges, blockedChanges } = filterPersonalityChangesWithCooldown(structuredMemory.category, changes, lastShifts);
            if (blockedChanges.length > 0) {
              console.warn(`[story.generate] \u23F3 ${blockedChanges.length} personality shifts blocked by cooldown:`, blockedChanges.map((b) => `${b.trait} (${b.remainingHours}h remaining)`));
            }
            if (allowedChanges.length > 0) {
              await avatar.updatePersonality({
                id: userAvatar.id,
                changes: allowedChanges,
                storyId: id,
                contentTitle: generatedStory.title,
                contentType: "story"
              });
              console.log(`[story.generate] \u2705 Applied ${allowedChanges.length} personality changes (${blockedChanges.length} blocked)`);
            }
            await avatar.addMemory({
              id: userAvatar.id,
              storyId: id,
              storyTitle: generatedStory.title,
              experience: experienceDescription,
              emotionalImpact: structuredMemory.emotionalImpact,
              personalityChanges: allowedChanges,
              developmentDescription: structuredMemory.developmentDescription,
              contentType: "story"
            });
            try {
              await addAvatarMemoryViaMcp(userAvatar.id, clerkToken, mcpApiKey, {
                storyId: id,
                storyTitle: generatedStory.title,
                experience: experienceDescription,
                emotionalImpact: structuredMemory.emotionalImpact,
                personalityChanges: allowedChanges.map((change) => ({
                  trait: change.trait,
                  change: change.change
                }))
              });
            } catch (mcpMemoryError) {
              console.warn("[story.generate] Failed to sync memory to MCP", {
                avatarId: userAvatar.id,
                error: mcpMemoryError
              });
            }
            console.log(`[story.generate] Updated personality and memory for ${userAvatar.name}`);
            try {
              await avatarDB.exec`
                  INSERT INTO avatar_story_read (avatar_id, story_id, story_title)
                  VALUES (${userAvatar.id}, ${id}, ${generatedStory.title})
                  ON CONFLICT (avatar_id, story_id) DO NOTHING
                `;
              console.log(`[story.generate] \u2705 Marked story as read for ${userAvatar.name}`);
            } catch (markReadError) {
              console.warn(`[story.generate] Failed to mark story as read:`, markReadError);
            }
            console.log(`[story.generate] \uD83D\uDCE6 Artifact generation handled by Phase 4.5/4.6 (AI-themed artifacts)`);
          } catch (updateError) {
            console.error(`[story.generate] Failed to update ${userAvatar.name}:`, updateError);
          }
        }
      }
      console.log(`[story.generate] Applied AI-driven trait updates to ${selectedAvatars.length} participating avatars`);
    } else {
      console.log("[story.generate] No AI-generated avatar developments to apply or no participating avatars found");
    }
    console.log("[story.generate] Loading full story payload to return...");
    const story = await getCompleteStory(id);
    console.log("[story.generate] Done. Returning story:", {
      id: story.id,
      title: story.title,
      chapters: story.chapters?.length,
      status: story.status
    });
    return story;
  } catch (error) {
    console.error("[story.generate] ERROR:", error);
    const errorMessage = String(error?.message || error);
    const errorStack = error?.stack ? String(error.stack).slice(0, 2000) : undefined;
    const errorMetadata = {
      error: {
        message: errorMessage,
        stack: errorStack,
        storyId: id,
        at: new Date().toISOString()
      }
    };
    await storyDB.exec`
        UPDATE stories
        SET status = 'error',
            metadata = ${JSON.stringify(errorMetadata)},
            updated_at = ${new Date}
        WHERE id = ${id}
      `;
    try {
      await updateStoryInstanceStatus(id, "error", String(error?.message || error));
    } catch (pipelineStatusError) {
      console.warn("[story.generate] Failed to update story_instances status:", pipelineStatusError);
    }
    try {
      await publishWithTimeout(logTopic, {
        source: "openai-story-generation",
        timestamp: new Date,
        request: { storyId: id, userId: currentUserId, config },
        response: { error: String(error?.message || error), stack: error?.stack?.slice(0, 2000) }
      });
    } catch (e) {
      console.warn("[story.generate] Failed to publish error log:", e);
    }
    if (error instanceof APIError) {
      throw error;
    }
    if (errorMessage.startsWith("Story quality gates failed:")) {
      const failedCodes = errorMessage.replace("Story quality gates failed:", "").trim();
      throw APIError.failedPrecondition(`Die Geschichte wurde nicht veroeffentlicht, weil die Qualitaetspruefung fehlgeschlagen ist. Bitte erneut generieren. Codes: ${failedCodes}`);
    }
    throw APIError.internal(`Story generation failed (storyId=${id}): ${errorMessage}`);
  }
});
async function getCompleteStory(storyId) {
  const storyRow = await storyDB.queryRow`
    SELECT * FROM stories WHERE id = ${storyId}
  `;
  if (!storyRow) {
    throw new Error("Story not found");
  }
  const chapterRows = await storyDB.queryAll`
    SELECT id, title, content, image_url, chapter_order 
    FROM chapters 
    WHERE story_id = ${storyId} 
    ORDER BY chapter_order
  `;
  const participantRows = await storyDB.queryAll`
    SELECT profile_id
    FROM story_participants
    WHERE story_id = ${storyId}
    ORDER BY created_at ASC
  `;
  const parsedMetadata = parseJsonObject(storyRow.metadata);
  const chapterVisuals = parsedMetadata?.chapterVisuals && typeof parsedMetadata.chapterVisuals === "object" ? parsedMetadata.chapterVisuals : {};
  const coverImageUrl = await resolveImageUrlForClient(storyRow.cover_image_url || undefined);
  const chapters = await Promise.all(chapterRows.map(async (ch) => {
    const scenicRawUrl = chapterVisuals[String(ch.chapter_order)]?.scenicImageUrl || undefined;
    const scenicResolvedUrl = scenicRawUrl ? await resolveImageUrlForClient(scenicRawUrl) : undefined;
    return {
      id: ch.id,
      title: String(ch.title || "").trim() || `Kapitel ${ch.chapter_order}`,
      content: ch.content,
      imageUrl: await buildStoryChapterImageUrlForClient(storyId, ch.chapter_order, ch.image_url || undefined),
      scenicImageUrl: scenicResolvedUrl || scenicRawUrl,
      scenicImagePrompt: chapterVisuals[String(ch.chapter_order)]?.scenicImagePrompt || undefined,
      order: ch.chapter_order
    };
  }));
  return {
    id: storyRow.id,
    userId: storyRow.user_id,
    primaryProfileId: storyRow.primary_profile_id || undefined,
    participantProfileIds: participantRows.map((row) => row.profile_id),
    title: storyRow.title,
    description: storyRow.description,
    coverImageUrl,
    config: JSON.parse(storyRow.config),
    avatarDevelopments: storyRow.avatar_developments ? JSON.parse(storyRow.avatar_developments) : undefined,
    metadata: parsedMetadata || undefined,
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
    updatedAt: storyRow.updated_at
  };
}
function parseJsonObject(value) {
  if (!value)
    return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
export {
  generate
};
