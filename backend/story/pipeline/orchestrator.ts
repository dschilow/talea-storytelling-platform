import crypto from "crypto";
import type { AvatarDetail, CastSet, NormalizedRequest, PipelineDependencies, SceneDirective, StoryBible, StoryDraft, StoryOutline, StoryVariantPlan, WorldState } from "./types";
import { normalizeRequest } from "./normalizer";
import { loadStoryBlueprintBase } from "./dna-loader";
import { createVariantPlan } from "./variant-planner";
import { buildCastSet } from "./casting-engine";
import { repairCastSet } from "./castset-normalizer";
import { buildIntegrationPlan } from "./integration-planner";
import { buildSceneDirectives } from "./scene-directives";
import { LlmStoryWriter } from "./story-writer";
import { createStoryBible } from "./story-bible";
import { createStoryOutline } from "./outline-lock";
import { createInitialWorldState } from "./world-state";
import { TemplateImageDirector } from "./image-director";
import { RunwareImageGenerator } from "./image-generator";
import { SimpleVisionValidator } from "./vision-validator";
import { validateAndFixImageSpecs } from "./image-prompt-validator";
import { validateCastSet } from "./schema-validator";
import { validateStoryDraft } from "./story-validator";
import { resolveLengthTargets } from "./prompts";
import { computeWordBudget, buildLengthTargetsFromBudget } from "./word-budget";
import { loadPipelineConfig } from "./pipeline-config";
import { loadStylePack, formatStylePackPrompt } from "./style-pack";
import { publishWithTimeout } from "../../helpers/pubsubTimeout";
import { logTopic } from "../../log/logger";
import { storyDB } from "../db";
import {
  loadCastSet,
  loadIntegrationPlan,
  loadSceneDirectives,
  loadStoryText,
  loadImageSpecs,
  loadStoryBible,
  saveStoryBible,
  loadStoryOutline,
  saveStoryOutline,
  loadWorldStates,
  saveWorldState,
  saveCastSet,
  saveIntegrationPlan,
  saveSceneDirectives,
  saveStoryText,
  saveImageSpecs,
  saveStoryImages,
  saveValidationReport,
  upsertStoryInstance,
  updateStoryInstanceStatus,
  loadStoryImages,
} from "./repository";

export interface PipelineRunResult {
  normalizedRequest: NormalizedRequest;
  variantPlan: StoryVariantPlan;
  castSet: CastSet;
  sceneDirectives: SceneDirective[];
  storyDraft: StoryDraft;
  imageSpecs: any[];
  images: Array<{ chapter: number; imageUrl?: string; prompt: string; provider?: string }>;
  validationReport?: any;
  tokenUsage?: any;
  artifactMeta?: any;
  storyBible?: StoryBible;
  outline?: StoryOutline;
  worldStates?: WorldState[];
}

export class StoryPipelineOrchestrator {
  private storyWriter: LlmStoryWriter;
  private imageDirector: TemplateImageDirector;
  private imageGenerator: RunwareImageGenerator;
  private visionValidator: SimpleVisionValidator;

  constructor(private deps: PipelineDependencies = {}) {
    this.storyWriter = (deps.storyWriter as any) || new LlmStoryWriter();
    this.imageDirector = (deps.imageDirector as any) || new TemplateImageDirector();
    this.imageGenerator = (deps.imageGenerator as any) || new RunwareImageGenerator();
    this.visionValidator = (deps.visionValidator as any) || new SimpleVisionValidator();
  }

  async run(input: {
    storyId: string;
    userId: string;
    config: any;
    avatars: AvatarDetail[];
    enableVisionValidation?: boolean;
  }): Promise<PipelineRunResult> {
    const phase0Start = Date.now();
    const normalized = normalizeRequest({
      storyId: input.storyId,
      userId: input.userId,
      config: input.config,
      avatarIds: input.avatars.map(a => a.id),
    });
    const pipelineConfig = await loadPipelineConfig();
    normalized.wordBudget = computeWordBudget({
      lengthHint: normalized.lengthHint,
      chapterCount: normalized.chapterCount,
      wpm: pipelineConfig.wpm,
      pacing: normalized.rawConfig?.pacing ?? "balanced",
    });
    const stylePack = await loadStylePack({ language: normalized.language, category: normalized.category });
    const stylePackText = formatStylePackPrompt(stylePack);
    const phaseGates: Array<{ phase: string; success: boolean; schemaValid?: boolean; issues?: any[]; attempts?: number; artifactRef?: any }> = [];
    let validationReport: any | undefined;

    try {
      const variantSeed = normalized.variantSeed ?? crypto.randomInt(0, 2_147_483_647);
      const phase1Start = Date.now();
      const blueprint = await loadStoryBlueprintBase({ normalized, variantSeed });
      await logPhase("phase1-dna", { storyId: normalized.storyId, taleId: "taleId" in blueprint.dna ? blueprint.dna.taleId : (blueprint.dna as any).templateId }, { durationMs: Date.now() - phase1Start, roleCount: blueprint.roles.length, sceneCount: blueprint.scenes.length, title: "title" in blueprint.dna ? blueprint.dna.title : "Template-based" });

      const phase2Start = Date.now();
      const variantPlan = createVariantPlan({ normalized: { ...normalized, variantSeed }, blueprint });
      await logPhase("phase2-variant", { storyId: normalized.storyId, variantSeed }, { durationMs: Date.now() - phase2Start, variantChoices: variantPlan.variantChoices, overrideCount: variantPlan.sceneOverrides?.length || 0 });

      await upsertStoryInstance({
        id: normalized.storyId,
        category: normalized.category,
        taleId: "taleId" in blueprint.dna ? blueprint.dna.taleId : (blueprint.dna as any).templateId,
        language: normalized.language,
        ageMin: normalized.ageMin,
        ageMax: normalized.ageMax,
        lengthHint: normalized.lengthHint,
        selectedMinutes: normalized.wordBudget?.selectedMinutes,
        targetWords: normalized.wordBudget?.targetWords,
        wordBudget: normalized.wordBudget,
        emotionProfile: normalized.emotionProfile,
        variantSeed: variantPlan.variantSeed,
        variantChoices: variantPlan.variantChoices,
        requestHash: normalized.requestHash,
        status: "running",
        error: null,
      });

      await logPhase("phase0-normalization", { storyId: normalized.storyId, category: normalized.category, language: normalized.language, chapterCount: normalized.chapterCount }, { ok: true, durationMs: Date.now() - phase0Start, avatarCount: normalized.avatarCount, ageMin: normalized.ageMin, ageMax: normalized.ageMax });

      const phase3Start = Date.now();
      let castSet = await loadCastSet(normalized.storyId);
      if (!castSet) {
        castSet = await buildCastSet({
          normalized: { ...normalized, variantSeed },
          roles: blueprint.roles,
          variantPlan,
          avatars: input.avatars,
        });
        await saveCastSet(normalized.storyId, castSet);
      }
      const castValidation = validateCastSet(castSet);
      if (!castValidation.valid) {
        const repaired = repairCastSet(castSet);
        const repairedValidation = validateCastSet(repaired);
        castSet = repaired;
        await saveCastSet(normalized.storyId, castSet);
        const gate = {
          phase: "phase3-casting",
          success: repairedValidation.valid,
          schemaValid: repairedValidation.valid,
          attempts: 2,
          issues: repairedValidation.errors.map(message => ({ severity: "ERROR", message })),
        };
        phaseGates.push(gate);
        await logPhase("phase3-casting-validation", { storyId: normalized.storyId }, {
          valid: repairedValidation.valid,
          errors: repairedValidation.errors,
        });

        if (!repairedValidation.valid) {
          throw new Error(`Casting validation failed: ${repairedValidation.errors.join("; ")}`);
        }
      } else {
        phaseGates.push({ phase: "phase3-casting", success: true, schemaValid: true, attempts: 1, issues: [] });
      }
      const artifactMeta = await fetchArtifactMeta(castSet.artifact?.artifactId);
      await logPhase("phase3-casting", { storyId: normalized.storyId }, { slots: Object.keys(castSet.slotAssignments).length, durationMs: Date.now() - phase3Start, avatarCount: castSet.avatars.length, poolCharacterCount: castSet.poolCharacters.length, artifactId: castSet.artifact?.artifactId, artifactName: castSet.artifact?.name });

      const phase25Start = Date.now();
      let storyBible = await loadStoryBible(normalized.storyId);
      if (!storyBible) {
        storyBible = await createStoryBible({
          normalized: { ...normalized, variantSeed },
          blueprint,
          variantPlan,
          cast: castSet,
        });
        await saveStoryBible(normalized.storyId, storyBible);
      }
      await logPhase("phase2.5-storybible", { storyId: normalized.storyId }, {
        durationMs: Date.now() - phase25Start,
        coreGoal: storyBible.coreGoal,
        mystery: storyBible.mysteryOrQuestion,
      });

      const phase26Start = Date.now();
      let worldStates = await loadWorldStates(normalized.storyId);
      let initialWorldState = worldStates.find(state => state.chapter === 0);
      if (!initialWorldState) {
        initialWorldState = createInitialWorldState({
          normalized,
          firstDirective: { chapter: 1, setting: blueprint.scenes[0]?.setting || "", charactersOnStage: [], goal: "", conflict: "", outcome: "", artifactUsage: "", canonAnchorLine: "", imageMustShow: [], imageAvoid: [] } as any,
          cast: castSet,
          storyBible,
        });
        await saveWorldState(normalized.storyId, initialWorldState);
        worldStates = [...worldStates, initialWorldState];
      }
      await logPhase("phase2.6-worldstate", { storyId: normalized.storyId }, {
        durationMs: Date.now() - phase26Start,
        openLoops: initialWorldState.openLoops?.length ?? 0,
        location: initialWorldState.location,
      });

      const phase4Start = Date.now();
      let integrationPlan = await loadIntegrationPlan(normalized.storyId);
      if (!integrationPlan) {
        integrationPlan = buildIntegrationPlan({ normalized, blueprint, cast: castSet, storyBible });
        await saveIntegrationPlan(normalized.storyId, integrationPlan);
      }
      await logPhase("phase4-integration", { storyId: normalized.storyId }, { chapters: integrationPlan.chapters.length, durationMs: Date.now() - phase4Start, avatarPresenceRatio: integrationPlan.avatarsPresenceRatio });

      const phase5Start = Date.now();
      let directives = await loadSceneDirectives(normalized.storyId);
      if (directives.length === 0) {
        directives = buildSceneDirectives({
          normalized,
          blueprint,
          integrationPlan,
          variantPlan,
          cast: castSet,
          storyBible,
        });
        await saveSceneDirectives(normalized.storyId, directives);
      }
      await logPhase("phase5-directives", { storyId: normalized.storyId }, { chapters: directives.length, durationMs: Date.now() - phase5Start, moods: directives.map(d => d.mood) });

      const phase6Start = Date.now();
      const phase60Start = Date.now();
      let outline = await loadStoryOutline(normalized.storyId);
      if (!outline) {
        outline = await createStoryOutline({
          normalized,
          storyBible,
          cast: castSet,
          chapterCount: directives.length,
        });
        await saveStoryOutline(normalized.storyId, outline);
      }
      await logPhase("phase6-outline", { storyId: normalized.storyId }, {
        durationMs: Date.now() - phase60Start,
        chapters: outline.chapters.length,
      });

      const lengthTargets = normalized.wordBudget
        ? buildLengthTargetsFromBudget(normalized.wordBudget)
        : resolveLengthTargets({
            lengthHint: normalized.lengthHint,
            ageRange: { min: normalized.ageMin, max: normalized.ageMax },
            pacing: normalized.rawConfig?.pacing,
          });
      let storyDraft: StoryDraft = { title: "", description: "", chapters: [] };
      let tokenUsage: any;
      const storedText = await loadStoryText(normalized.storyId);
      let storyValidation = { issues: [] as any[], score: 0 };
      let storyAttempts = 0;
      const maxStoryAttempts = Math.max(1, (pipelineConfig.storyRetryMax ?? 0) + 1);
      let shouldRetry = false;
      if (storedText.length === directives.length) {
        storyDraft = {
          title: "",
          description: "",
          chapters: storedText.map((row) => ({
            chapter: row.chapter,
            title: row.title || `Kapitel ${row.chapter}`,
            text: row.text,
          })),
        };
        if (!storyDraft.title) {
          storyDraft.title = storyDraft.chapters[0]?.title || "Neue Geschichte";
          storyDraft.description = (storyDraft.chapters[0]?.text || "").slice(0, 180);
        }
        storyValidation = validateStoryDraft({
          draft: storyDraft,
          directives,
          cast: castSet,
          language: normalized.language,
          lengthTargets,
          storyBible,
        });
      } else {
        do {
          const writeResult = await this.storyWriter.writeStory({
            normalizedRequest: normalized,
            cast: castSet,
            dna: blueprint.dna,
            directives,
            storyBible,
            outline,
            initialWorldState: initialWorldState ?? worldStates[0],
            strict: storyAttempts > 0,
            stylePackText,
          });
          storyDraft = writeResult.draft;
          tokenUsage = writeResult.usage ?? tokenUsage;
          if (writeResult.outline) {
            outline = writeResult.outline;
            await saveStoryOutline(normalized.storyId, outline);
          }
          if (writeResult.worldStates && writeResult.worldStates.length > 0) {
            for (const state of writeResult.worldStates) {
              await saveWorldState(normalized.storyId, state);
            }
            worldStates = writeResult.worldStates;
          }
          storyValidation = validateStoryDraft({
            draft: storyDraft,
            directives,
            cast: castSet,
            language: normalized.language,
            lengthTargets,
            storyBible,
          });
          shouldRetry = shouldRetryStory(storyValidation.issues);
          storyAttempts += 1;
        } while (shouldRetry && storyAttempts < maxStoryAttempts);

        await saveStoryText(normalized.storyId, storyDraft.chapters.map(ch => ({ chapter: ch.chapter, title: ch.title, text: ch.text })));
        await logPhase("phase6-story", { storyId: normalized.storyId, title: storyDraft.title }, {
          chapters: storyDraft.chapters.length,
          durationMs: Date.now() - phase6Start,
          tokens: tokenUsage,
          retry: shouldRetry,
          attempts: storyAttempts,
          issues: storyValidation.issues.length,
          issueDetails: storyValidation.issues.map(i => ({ code: i.code, chapter: i.chapter, message: i.message })),
          wordCount: storyDraft.chapters.reduce((sum, ch) => sum + (ch.text?.split(/\s+/).length || 0), 0),
        });
      }

      if (normalized.wordBudget) {
        const totalWords = storyDraft.chapters.reduce((sum, ch) => sum + (ch.text?.split(/\s+/).length || 0), 0);
        if (totalWords < normalized.wordBudget.minWords) {
          storyValidation.issues.push({
            chapter: 0,
            code: "TOTAL_TOO_SHORT",
            message: `Story too short (${totalWords} words)`,
          });
        } else if (totalWords > normalized.wordBudget.maxWords) {
          storyValidation.issues.push({
            chapter: 0,
            code: "TOTAL_TOO_LONG",
            message: `Story too long (${totalWords} words)`,
          });
        }
      }

      const storyGate = {
        phase: "phase6-story",
        success: storyValidation.issues.length === 0,
        schemaValid: storyValidation.issues.length === 0,
        attempts: storyAttempts || 1,
        issues: storyValidation.issues.map(issue => ({ severity: "ERROR", ...issue })),
      };
      phaseGates.push(storyGate);
      if (storyValidation.issues.length > 0) {
        validationReport = { gates: phaseGates, story: storyValidation, images: [] };
        await saveValidationReport(normalized.storyId, validationReport);
        throw new Error(`Story validation failed: ${storyValidation.issues.map(i => i.code).join(", ")}`);
      }

      const phase7Start = Date.now();
      let imageSpecs = await loadImageSpecs(normalized.storyId);
      const createdImageSpecs = imageSpecs.length === 0;
      if (createdImageSpecs) {
        imageSpecs = await this.imageDirector.createImageSpecs({
          normalizedRequest: normalized,
          cast: castSet,
          directives,
        });
      }

      let imageIssues: any[] = [];
      let imageAttempts = 0;
      const maxImageAttempts = Math.max(1, (pipelineConfig.imageRetryMax ?? 0) + 1);
      do {
        const validation = validateAndFixImageSpecs({
          specs: imageSpecs,
          cast: castSet,
          directives,
          maxPropsVisible: pipelineConfig.maxPropsVisible,
        });
        imageSpecs = validation.specs;
        imageIssues = validation.issues;
        imageAttempts += 1;
      } while (imageIssues.length > 0 && imageAttempts < maxImageAttempts);

      const uniqueCharacters = new Set(imageSpecs.flatMap(s => s.onStageExact || []));
      const hasArtifacts = directives.some(d => d.charactersOnStage.includes("SLOT_ARTIFACT_1"));
      if (createdImageSpecs || imageAttempts > 0) {
        await saveImageSpecs(normalized.storyId, imageSpecs);
        await logPhase("phase7-imagespec", { storyId: normalized.storyId }, {
          specs: imageSpecs.length,
          issues: imageIssues.length,
          issueDetails: imageIssues,
          durationMs: Date.now() - phase7Start,
          characters: uniqueCharacters.size,
          hasArtifacts,
        });
      }

      const imageGate = {
        phase: "phase7-imagespec",
        success: imageIssues.length === 0,
        schemaValid: imageIssues.length === 0,
        attempts: imageAttempts,
        issues: imageIssues.map(issue => ({ severity: "ERROR", ...issue })),
      };
      phaseGates.push(imageGate);
      if (imageIssues.length > 0) {
        validationReport = { gates: phaseGates, story: storyValidation, images: imageIssues };
        await saveValidationReport(normalized.storyId, validationReport);
        throw new Error(`ImageSpec validation failed: ${imageIssues.map(i => i.code).join(", ")}`);
      }

      const phase9Start = Date.now();
      let images = await loadStoryImages(normalized.storyId);
      if (images.length === 0) {
        images = await this.imageGenerator.generateImages({
          normalizedRequest: normalized,
          cast: castSet,
          directives,
          imageSpecs,
          pipelineConfig,
        });
        await saveStoryImages(normalized.storyId, images);
        await logPhase("phase9-imagegen", { storyId: normalized.storyId }, {
          images: images.length,
          durationMs: Date.now() - phase9Start,
          providers: images.map(img => img.provider).filter((v, i, a) => a.indexOf(v) === i),
          successfulImages: images.filter(img => img.imageUrl).length,
          failedImages: images.filter(img => !img.imageUrl).length,
          chapters: images.map(img => img.chapter),
        });
      }

      validationReport = { gates: phaseGates, story: storyValidation, images: [] as any[] };
      if (input.enableVisionValidation) {
        const phase10Start = Date.now();
        const vision = await this.visionValidator.validateImages({
          normalizedRequest: normalized,
          cast: castSet,
          directives,
          imageSpecs,
          images: images.map(img => ({ chapter: img.chapter, imageUrl: img.imageUrl, prompt: img.prompt })),
        });
        validationReport.images = vision.report?.images ?? vision.report ?? [];
        const retryChapters = Object.keys(vision.retryAdvice || {})
          .map((key) => Number(key))
          .filter((chapter) => (vision.retryAdvice?.[chapter] || []).length > 0);

        if (retryChapters.length > 0) {
          const retrySpecs = imageSpecs
            .filter(spec => retryChapters.includes(spec.chapter))
            .map(spec => ({
              ...spec,
              finalPromptText: `${spec.finalPromptText}\nRETRY CONSTRAINTS: ${(vision.retryAdvice?.[spec.chapter] || []).join(", ")}`.trim(),
              negatives: Array.from(new Set([...(spec.negatives || []), "extra characters", "duplicate characters", "looking at camera"])),
            }));

          const retryImages = await this.imageGenerator.generateImages({
            normalizedRequest: normalized,
            cast: castSet,
            directives,
            imageSpecs: retrySpecs,
            pipelineConfig,
          });

          if (retryImages.length > 0) {
            const retryMap = new Map(retryImages.map(img => [img.chapter, img]));
            images = images.map(img => retryMap.get(img.chapter) ?? img);
            await saveStoryImages(normalized.storyId, images);
          }
        }

        await logPhase("phase10-vision", { storyId: normalized.storyId }, {
          validatedChapters: images.length,
          chaptersNeedingRetry: Object.keys(vision.retryAdvice || {}).length,
          retryAdvice: vision.retryAdvice,
          durationMs: Date.now() - phase10Start,
          imagesRetried: retryChapters.length,
          visionIssues: validationReport.images.length,
        });
      }

      if (validationReport) {
        await saveValidationReport(normalized.storyId, validationReport);
      }

      await updateStoryInstanceStatus(normalized.storyId, "complete", null);

      return {
        normalizedRequest: normalized,
        variantPlan,
        castSet,
        sceneDirectives: directives,
        storyDraft,
        imageSpecs,
        images,
        validationReport,
        tokenUsage,
        artifactMeta,
        storyBible,
        outline,
        worldStates,
      };
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      const report = validationReport ?? { gates: phaseGates, error: { message }, images: [] };
      try {
        await saveValidationReport(normalized.storyId, report);
      } catch (saveError) {
        console.warn("[pipeline] Failed to save validation report on error", saveError);
      }
      await updateStoryInstanceStatus(normalized.storyId, "error", message);
      throw error;
    }
  }
}

async function logPhase(source: any, request: any, response: any) {
  await publishWithTimeout(logTopic as any, {
    source,
    timestamp: new Date(),
    request,
    response,
  });
}

async function fetchArtifactMeta(artifactId?: string | null): Promise<any | null> {
  if (!artifactId) return null;
  try {
    const row = await storyDB.queryRow<any>`
      SELECT * FROM artifact_pool WHERE id = ${artifactId}
    `;
    if (!row) return null;
    return {
      id: row.id,
      name: { de: row.name_de, en: row.name_en },
      description: { de: row.description_de, en: row.description_en },
      category: row.category,
      rarity: row.rarity,
      storyRole: row.story_role,
      visualKeywords: row.visual_keywords || [],
      imageUrl: row.image_url || undefined,
    };
  } catch (error) {
    console.warn("[pipeline] Failed to load artifact metadata", error);
    return null;
  }
}

function shouldRetryStory(issues: Array<{ code: string }>): boolean {
  const retryCodes = new Set([
    "MISSING_CHARACTER",
    "MISSING_ARTIFACT",
    "INSTRUCTION_LEAK",
    "CANON_REPETITION",
    "TOO_SHORT",
    "TOO_LONG",
  ]);
  return issues.some(issue => retryCodes.has(issue.code));
}
