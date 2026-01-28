import crypto from "crypto";
import type { AvatarDetail, CastSet, NormalizedRequest, PipelineDependencies, SceneDirective, StoryDraft, StoryVariantPlan } from "./types";
import { normalizeRequest } from "./normalizer";
import { loadStoryBlueprintBase } from "./dna-loader";
import { createVariantPlan } from "./variant-planner";
import { buildCastSet } from "./casting-engine";
import { buildIntegrationPlan } from "./integration-planner";
import { buildSceneDirectives } from "./scene-directives";
import { LlmStoryWriter } from "./story-writer";
import { TemplateImageDirector } from "./image-director";
import { RunwareImageGenerator } from "./image-generator";
import { SimpleVisionValidator } from "./vision-validator";
import { validateAndFixImageSpecs } from "./image-prompt-validator";
import { validateCastSet } from "./schema-validator";
import { validateStoryDraft } from "./story-validator";
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

    const variantSeed = normalized.variantSeed ?? crypto.randomInt(0, 2_147_483_647);
    const phase1Start = Date.now();
    const blueprint = await loadStoryBlueprintBase({ normalized, variantSeed });
    await logPhase("phase1-dna", { storyId: normalized.storyId }, { durationMs: Date.now() - phase1Start });

    const phase2Start = Date.now();
    const variantPlan = createVariantPlan({ normalized: { ...normalized, variantSeed }, blueprint });
    await logPhase("phase2-variant", { storyId: normalized.storyId }, { durationMs: Date.now() - phase2Start });

    await upsertStoryInstance({
      id: normalized.storyId,
      category: normalized.category,
      taleId: "taleId" in blueprint.dna ? blueprint.dna.taleId : (blueprint.dna as any).templateId,
      language: normalized.language,
      ageMin: normalized.ageMin,
      ageMax: normalized.ageMax,
      lengthHint: normalized.lengthHint,
      emotionProfile: normalized.emotionProfile,
      variantSeed: variantPlan.variantSeed,
      variantChoices: variantPlan.variantChoices,
      requestHash: normalized.requestHash,
      status: "running",
      error: null,
    });

    await logPhase("phase0-normalization", { storyId: normalized.storyId, category: normalized.category }, { ok: true, durationMs: Date.now() - phase0Start });

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
      await logPhase("phase3-casting-validation", { storyId: normalized.storyId }, { errors: castValidation.errors });
    }
    const artifactMeta = await fetchArtifactMeta(castSet.artifact?.artifactId);
    await logPhase("phase3-casting", { storyId: normalized.storyId }, { slots: Object.keys(castSet.slotAssignments).length, durationMs: Date.now() - phase3Start });

    const phase4Start = Date.now();
    let integrationPlan = await loadIntegrationPlan(normalized.storyId);
    if (!integrationPlan) {
      integrationPlan = buildIntegrationPlan({ normalized, blueprint, cast: castSet });
      await saveIntegrationPlan(normalized.storyId, integrationPlan);
    }
    await logPhase("phase4-integration", { storyId: normalized.storyId }, { chapters: integrationPlan.chapters.length, durationMs: Date.now() - phase4Start });

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
    await logPhase("phase5-directives", { storyId: normalized.storyId }, { chapters: directives.length, durationMs: Date.now() - phase5Start });

    const phase6Start = Date.now();
    let storyDraft: StoryDraft = { title: "", description: "", chapters: [] };
    let tokenUsage: any;
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
    } else {
      const writeResult = await this.storyWriter.writeStory({
        normalizedRequest: normalized,
        cast: castSet,
        dna: blueprint.dna,
        directives,
      });
      storyDraft = writeResult.draft;
      tokenUsage = writeResult.usage;
      await saveStoryText(normalized.storyId, storyDraft.chapters.map(ch => ({ chapter: ch.chapter, title: ch.title, text: ch.text })));
      await logPhase("phase6-story", { storyId: normalized.storyId }, { chapters: storyDraft.chapters.length, durationMs: Date.now() - phase6Start, tokens: tokenUsage });
    }

    const phase7Start = Date.now();
    let imageSpecs = await loadImageSpecs(normalized.storyId);
    if (imageSpecs.length === 0) {
      imageSpecs = await this.imageDirector.createImageSpecs({
        normalizedRequest: normalized,
        cast: castSet,
        directives,
      });
      const validation = validateAndFixImageSpecs({ specs: imageSpecs, cast: castSet, directives });
      imageSpecs = validation.specs;
      await saveImageSpecs(normalized.storyId, imageSpecs);
      await logPhase("phase7-imagespec", { storyId: normalized.storyId }, { issues: validation.issues.length, durationMs: Date.now() - phase7Start });
    }

    const phase9Start = Date.now();
    let images = await loadStoryImages(normalized.storyId);
    if (images.length === 0) {
      images = await this.imageGenerator.generateImages({
        normalizedRequest: normalized,
        cast: castSet,
        directives,
        imageSpecs,
      });
      await saveStoryImages(normalized.storyId, images);
      await logPhase("phase9-imagegen", { storyId: normalized.storyId }, { images: images.length, durationMs: Date.now() - phase9Start });
    }

    let validationReport: any | undefined;
    const storyValidation = validateStoryDraft({ draft: storyDraft, directives, cast: castSet });
    validationReport = { story: storyValidation, images: [] as any[] };
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
        });

        if (retryImages.length > 0) {
          const retryMap = new Map(retryImages.map(img => [img.chapter, img]));
          images = images.map(img => retryMap.get(img.chapter) ?? img);
          await saveStoryImages(normalized.storyId, images);
        }
      }

      await logPhase("phase10-vision", { storyId: normalized.storyId }, { chapters: Object.keys(vision.retryAdvice).length, durationMs: Date.now() - phase10Start });
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
    };
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
