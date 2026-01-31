import crypto from "crypto";
import type { AvatarDetail, CastSet, NormalizedRequest, PipelineDependencies, SceneDirective, StoryDraft, StoryVariantPlan, AISceneDescription } from "./types";
import { normalizeRequest } from "./normalizer";
import { loadStoryBlueprintBase } from "./dna-loader";
import { createVariantPlan } from "./variant-planner";
import { buildCastSet } from "./casting-engine";
import { repairCastSet } from "./castset-normalizer";
import { buildIntegrationPlan } from "./integration-planner";
import { buildSceneDirectives } from "./scene-directives";
import { createCanonFusionPlanV2, fusionPlanToPromptSections } from "./canon-fusion";
import { LlmStoryWriter } from "./story-writer";
import { TemplateImageDirector } from "./image-director";
import { RunwareImageGenerator } from "./image-generator";
import { SimpleVisionValidator } from "./vision-validator";
import { validateAndFixImageSpecs } from "./image-prompt-validator";
import { validateCastSet } from "./schema-validator";
import { runQualityGates } from "./quality-gates";
import { computeWordBudget } from "./word-budget";
import { loadPipelineConfig } from "./pipeline-config";
import { loadStylePack, formatStylePackPrompt } from "./style-pack";
import { generateSceneDescriptions } from "./scene-prompt-generator";
import { publishWithTimeout } from "../../helpers/pubsubTimeout";
import { logTopic } from "../../log/logger";
import { storyDB } from "../db";
import {
  loadCastSet,
  loadIntegrationPlan,
  loadSceneDirectives,
  loadStoryText,
  loadImageSpecs,
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
  canonFusionPlan?: any;
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
      // ─── Phase 0.5: Fairy Tale Selection (diversity fix) ───────────────
      // Pick a random tale_dna entry directly for story diversity.
      // The FairyTaleSelector picks from fairy_tales (50 entries) but tale_dna only has ~10,
      // causing mismatches where the selected tale has no DNA and falls back to Froschkönig.
      // Solution: pick directly from available tale_dna entries with random rotation.
      if (normalized.category === "Klassische Märchen" && !normalized.taleId) {
        try {
          const randomTale = await storyDB.queryRow<{ tale_id: string; title: string }>`
            SELECT tale_id, tale_dna->'tale'->>'title' as title
            FROM tale_dna
            ORDER BY RANDOM()
            LIMIT 1
          `;
          if (randomTale) {
            normalized.taleId = randomTale.tale_id;
            console.log(`[pipeline] Phase 0.5: Selected random TaleDNA: "${randomTale.title}" (${randomTale.tale_id})`);
            await logPhase("phase0.5-fairy-tale-selection", { storyId: normalized.storyId }, {
              selectedTaleId: randomTale.tale_id,
              selectedTitle: randomTale.title,
              method: "random-from-tale-dna",
            });
          } else {
            console.warn("[pipeline] No tale_dna entries found, using default");
          }
        } catch (selectorError) {
          console.warn("[pipeline] Phase 0.5 failed, falling back to default tale:", selectorError);
        }
      }

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

      const phase4Start = Date.now();
      let integrationPlan = await loadIntegrationPlan(normalized.storyId);
      if (!integrationPlan) {
        integrationPlan = buildIntegrationPlan({ normalized, blueprint, cast: castSet });
        await saveIntegrationPlan(normalized.storyId, integrationPlan);
      }
      await logPhase("phase4-integration", { storyId: normalized.storyId }, { chapters: integrationPlan.chapters.length, durationMs: Date.now() - phase4Start, avatarsPresenceRatio: integrationPlan.avatarsPresenceRatio });

      const phase5Start = Date.now();
      let directives = await loadSceneDirectives(normalized.storyId);
      if (directives.length === 0) {
        directives = buildSceneDirectives({
          normalized,
          blueprint,
          integrationPlan,
          variantPlan,
          cast: castSet,
        });
        await saveSceneDirectives(normalized.storyId, directives);
      }
      await logPhase("phase5-directives", { storyId: normalized.storyId }, { chapters: directives.length, durationMs: Date.now() - phase5Start, moods: directives.map(d => d.mood) });

      // ─── Phase 5.5: Canon-Fusion V2 ──────────────────────────────────────
      const phase55Start = Date.now();
      const canonFusionPlan = createCanonFusionPlanV2({
        cast: castSet,
        directives,
        language: normalized.language,
        totalChapters: directives.length,
      });
      const fusionSections = fusionPlanToPromptSections(canonFusionPlan, normalized.language);
      await logPhase("phase5.5-canon-fusion", { storyId: normalized.storyId }, {
        durationMs: Date.now() - phase55Start,
        characterCount: canonFusionPlan.fusionSummary.characterCount,
        artifactActive: canonFusionPlan.fusionSummary.artifactActive,
        catchphraseChapters: canonFusionPlan.fusionSummary.chaptersWithCatchphrases,
        totalDialogueCues: canonFusionPlan.fusionSummary.totalDialogueCues,
        bannedPhraseCount: canonFusionPlan.bannedPhrases.length,
      });

      const phase6Start = Date.now();
      let storyDraft: StoryDraft = { title: "", description: "", chapters: [] };
      let tokenUsage: any;
      let qualityReport: any;
      const storedText = await loadStoryText(normalized.storyId);

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
        const cachedQuality = runQualityGates({
          draft: storyDraft,
          directives,
          cast: castSet,
          language: normalized.language,
          wordBudget: normalized.wordBudget,
          artifactArc: canonFusionPlan.artifactArc,
        });
        qualityReport = {
          score: cachedQuality.score,
          passedGates: cachedQuality.passedGates,
          failedGates: cachedQuality.failedGates,
          issueCount: cachedQuality.issues.length,
          errorCount: cachedQuality.issues.filter(i => i.severity === "ERROR").length,
          warningCount: cachedQuality.issues.filter(i => i.severity === "WARNING").length,
          rewriteAttempts: 0,
          issues: cachedQuality.issues,
        };
      } else {
        const writeResult = await this.storyWriter.writeStory({
          normalizedRequest: normalized,
          cast: castSet,
          dna: blueprint.dna,
          directives,
          stylePackText,
          fusionSections,
        });
        storyDraft = writeResult.draft;
        tokenUsage = writeResult.usage ?? tokenUsage;
        qualityReport = writeResult.qualityReport;

        await saveStoryText(normalized.storyId, storyDraft.chapters.map(ch => ({ chapter: ch.chapter, title: ch.title, text: ch.text })));
        await logPhase("phase6-story", { storyId: normalized.storyId, title: storyDraft.title }, {
          chapters: storyDraft.chapters.length,
          durationMs: Date.now() - phase6Start,
          tokens: tokenUsage,
          qualityScore: qualityReport?.score,
          passedGates: qualityReport?.passedGates,
          failedGates: qualityReport?.failedGates,
          rewriteAttempts: qualityReport?.rewriteAttempts,
          errorCount: qualityReport?.errorCount,
          warningCount: qualityReport?.warningCount,
          issues: qualityReport?.issues?.map((i: any) => ({ gate: i.gate, code: i.code, chapter: i.chapter, message: i.message, severity: i.severity })),
          wordCount: storyDraft.chapters.reduce((sum, ch) => sum + (ch.text?.split(/\s+/).length || 0), 0),
        });
      }

      const storyErrors = qualityReport?.issues?.filter((i: any) => i.severity === "ERROR") ?? [];
      const criticalCodes = new Set(["INSTRUCTION_LEAK", "ENGLISH_LEAK"]);
      const criticalErrors = storyErrors.filter((i: any) => criticalCodes.has(i.code));
      const hasContent = storyDraft.chapters.some(ch => ch.text && ch.text.trim().length > 50);
      const storyGate = {
        phase: "phase6-story",
        success: storyErrors.length === 0,
        schemaValid: criticalErrors.length === 0,
        attempts: (qualityReport?.rewriteAttempts ?? 0) + 1,
        issues: storyErrors.map((issue: any) => ({ severity: "ERROR", ...issue })),
      };
      phaseGates.push(storyGate);
      if (criticalErrors.length > 0 || !hasContent) {
        validationReport = { gates: phaseGates, story: qualityReport, images: [] };
        await saveValidationReport(normalized.storyId, validationReport);
        throw new Error(`Story quality gates failed: ${(criticalErrors.length > 0 ? criticalErrors : storyErrors).map((i: any) => i.code).join(", ")}`);
      }
      if (storyErrors.length > 0) {
        console.warn(`[pipeline] Story accepted with ${storyErrors.length} non-critical quality issues: ${storyErrors.map((i: any) => i.code).join(", ")}`);
      }

      // ─── Phase 6.5: AI Scene Description Generator ───────────────────
      const phase65Start = Date.now();
      let aiSceneDescriptions: (AISceneDescription | null)[] = [];
      try {
        const sceneResult = await generateSceneDescriptions({
          chapters: storyDraft.chapters,
          directives,
          cast: castSet,
          language: normalized.language,
        });
        aiSceneDescriptions = sceneResult.descriptions;
        const successCount = aiSceneDescriptions.filter(Boolean).length;
        await logPhase("phase6.5-scene-prompts", { storyId: normalized.storyId }, {
          durationMs: Date.now() - phase65Start,
          totalChapters: storyDraft.chapters.length,
          aiGenerated: successCount,
          fallbackToTemplate: storyDraft.chapters.length - successCount,
        });
      } catch (sceneGenError) {
        console.warn("[pipeline] Phase 6.5 failed entirely, all chapters will use default template prompts:", sceneGenError);
        await logPhase("phase6.5-scene-prompts", { storyId: normalized.storyId }, {
          durationMs: Date.now() - phase65Start,
          error: String((sceneGenError as Error)?.message || sceneGenError),
          fallbackToTemplate: storyDraft.chapters.length,
        });
      }

      const validAiDescriptions = aiSceneDescriptions.filter(Boolean) as AISceneDescription[];

      const phase7Start = Date.now();
      let imageSpecs = await loadImageSpecs(normalized.storyId);
      const createdImageSpecs = imageSpecs.length === 0;
      if (createdImageSpecs) {
        imageSpecs = await this.imageDirector.createImageSpecs({
          normalizedRequest: normalized,
          cast: castSet,
          directives,
          aiSceneDescriptions: validAiDescriptions.length > 0 ? validAiDescriptions : undefined,
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
        validationReport = { gates: phaseGates, story: qualityReport, images: imageIssues };
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

      validationReport = { gates: phaseGates, story: qualityReport, images: [] as any[] };
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
        canonFusionPlan,
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

