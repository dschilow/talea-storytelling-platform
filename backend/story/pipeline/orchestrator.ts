import crypto from "crypto";
import type { AvatarDetail, CastSet, ImageSpec, NormalizedRequest, PipelineDependencies, SceneDirective, StoryDraft, StoryVariantPlan, AISceneDescription, StoryCostEntry } from "./types";
import { normalizeRequest } from "./normalizer";
import { loadStoryBlueprintBase } from "./dna-loader";
import { createVariantPlan } from "./variant-planner";
import { buildCastSet } from "./casting-engine";
import { repairCastSet } from "./castset-normalizer";
import { buildIntegrationPlan } from "./integration-planner";
import { buildSceneDirectives } from "./scene-directives";
import { createCanonFusionPlanV2, fusionPlanToPromptSections } from "./canon-fusion";
import { LlmStoryWriter } from "./story-writer";
import { TemplateImageDirector, buildCoverSpec } from "./image-director";
import { RunwareImageGenerator } from "./image-generator";
import { SimpleVisionValidator } from "./vision-validator";
import { validateAndFixImageSpecs } from "./image-prompt-validator";
import { buildSupplementalScenicNegatives, buildSupplementalScenicPrompt } from "./image-prompt-builder";
// import { cleanupCollages } from "./sprite-collage"; // TEMPORARILY DISABLED for testing
import { validateCastSet } from "./schema-validator";
import { runQualityGates } from "./quality-gates";
import { runSemanticCritic, type SemanticCriticReport } from "./semantic-critic";
import { applySelectiveSurgery } from "./release-polisher";
import { computeWordBudget } from "./word-budget";
import { loadPipelineConfig } from "./pipeline-config";
import { loadStylePack, formatStylePackPrompt } from "./style-pack";
import { generateSceneDescriptions } from "./scene-prompt-generator";
import { GLOBAL_IMAGE_NEGATIVES } from "./constants";
import { buildImageCostEntry, buildLlmCostEntry, mergeNormalizedTokenUsage } from "./cost-ledger";
import { publishWithTimeout } from "../../helpers/pubsubTimeout";
import { logTopic } from "../../log/logger";
import { storyDB } from "../db";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import type { AvatarMemoryCompressed } from "./types";

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

// Top-level DB reference required by Encore compiler
const avatarDB = SQLDatabase.named("avatar");

const BLOCKING_IMAGE_ISSUE_CODES = new Set(["SCHEMA", "REF_COUNT", "REF_EXTRA", "TOO_MANY_PROPS"]);

export interface PipelineRunResult {
  normalizedRequest: NormalizedRequest;
  variantPlan: StoryVariantPlan;
  castSet: CastSet;
  sceneDirectives: SceneDirective[];
  storyDraft: StoryDraft;
  imageSpecs: any[];
  images: Array<{
    chapter: number;
    imageUrl?: string;
    prompt: string;
    provider?: string;
    model?: string;
    providerCostUSD?: number | null;
    providerCostCredits?: number | null;
    promptChars?: number;
    negativePromptChars?: number;
    referenceCount?: number;
    success?: boolean;
    metadata?: Record<string, any>;
    scenicImageUrl?: string;
    scenicPrompt?: string;
  }>;
  coverImage?: {
    imageUrl?: string;
    prompt: string;
    provider?: string;
    model?: string;
    providerCostUSD?: number | null;
    providerCostCredits?: number | null;
    promptChars?: number;
    negativePromptChars?: number;
    referenceCount?: number;
    success?: boolean;
    metadata?: Record<string, any>;
  };
  validationReport?: any;
  tokenUsage?: any;
  costEntries?: StoryCostEntry[];
  artifactMeta?: any;
  canonFusionPlan?: any;
  criticReport?: SemanticCriticReport;
  releaseReport?: {
    enabled: boolean;
    candidateCount: number;
    selectedCandidateIndex: number;
    selectedCompositeScore: number;
    criticMinScore: number;
    criticScore: number;
  };
}

interface TaleSelectionCandidate {
  tale_id: string;
  title: string;
  age_min: number | null;
  age_max: number | null;
  tone: string | null;
  tags: string[];
  coreConflict: string;
  fixedElements: string[];
  iconicBeats: string[];
  contentRules: string[];
  protagonistConstraints: string[];
}

function buildSupplementalScenicImageSpecs(input: {
  imageSpecs: ImageSpec[];
  directives: SceneDirective[];
  storyDraft: StoryDraft;
  language: string;
}): ImageSpec[] {
  const directiveByChapter = new Map(input.directives.map((directive) => [directive.chapter, directive]));
  const chapterTextByChapter = new Map(input.storyDraft.chapters.map((chapter) => [chapter.chapter, chapter.text]));

  return input.imageSpecs.map((spec) => {
    const directive = directiveByChapter.get(spec.chapter);
    const chapterText = chapterTextByChapter.get(spec.chapter) || "";
    const scenicPrompt = buildSupplementalScenicPrompt({
      chapterText,
      setting: directive?.setting || spec.setting,
      mood: directive?.mood || "COZY",
      style: spec.style,
      chapterNumber: spec.chapter,
      language: input.language,
    });

    return {
      chapter: spec.chapter,
      style: spec.style,
      composition: "wide establishing shot, environment-only scene, no characters",
      blocking: "Environment and props only. No characters, animals, or silhouettes.",
      actions: "Show subtle traces of recent story action only through environment and objects.",
      propsVisible: [],
      lighting: spec.lighting || "soft atmospheric lighting",
      setting: directive?.setting || spec.setting,
      sceneDescription: directive
        ? `${directive.goal || ""} ${directive.conflict || ""} ${directive.outcome || ""}`.trim()
        : "",
      refs: {},
      negatives: buildSupplementalScenicNegatives([
        ...GLOBAL_IMAGE_NEGATIVES,
        ...(spec.negatives || []),
        ...(directive?.imageAvoid || []),
      ]),
      onStageExact: [],
      finalPromptText: scenicPrompt,
    };
  });
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
      ageMax: normalized.ageMax,
      releaseMode: (normalized.rawConfig as any)?.releaseMode,
    });
    const stylePack = await loadStylePack({ language: normalized.language, category: normalized.category });
    const parentalGuidance =
      typeof normalized.rawConfig?.parentalGuidance === "string"
        ? normalized.rawConfig.parentalGuidance.trim()
        : "";
    const stylePackText = [
      formatStylePackPrompt(stylePack),
      parentalGuidance
        ? `PARENTAL SAFETY RULES:\n${parentalGuidance}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const phaseGates: Array<{ phase: string; success: boolean; schemaValid?: boolean; issues?: any[]; attempts?: number; artifactRef?: any }> = [];
    let validationReport: any | undefined;
    let tokenUsage: any;
    const costEntries: StoryCostEntry[] = [];

    try {
      // ─── Phase 0.5: Fairy Tale Selection (quality/diversity fit) ─────────
      if (normalized.category === "Klassische Märchen" && !normalized.taleId) {
        try {
          const selectedTale = await selectBestFairyTale({
            userId: normalized.userId,
            ageMin: normalized.ageMin,
            ageMax: normalized.ageMax,
            requestedTone: normalized.requestedTone,
            requestHash: normalized.requestHash,
          });
          if (selectedTale) {
            normalized.taleId = selectedTale.taleId;
            console.log(`[pipeline] Phase 0.5: Selected TaleDNA: "${selectedTale.title}" (${selectedTale.taleId}) score=${selectedTale.score.toFixed(2)}`);
            await logPhase("phase0.5-fairy-tale-selection", { storyId: normalized.storyId }, {
              selectedTaleId: selectedTale.taleId,
              selectedTitle: selectedTale.title,
              method: selectedTale.method,
              score: Number(selectedTale.score.toFixed(3)),
              reasoning: selectedTale.reasoning,
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
        const castBuildResult = await buildCastSet({
          normalized: { ...normalized, variantSeed },
          roles: blueprint.roles,
          variantPlan,
          blueprint,
          avatars: input.avatars,
        });
        castSet = castBuildResult.castSet;
        tokenUsage = mergeTokenUsage(tokenUsage, castBuildResult.usage);
        if (castBuildResult.costEntries?.length) {
          costEntries.push(...castBuildResult.costEntries);
        }
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
      let qualityReport: any;
      let criticReport: SemanticCriticReport | undefined;
      let releaseReport: PipelineRunResult["releaseReport"] | undefined;
      const releaseEnabled = (normalized.rawConfig as any)?.releaseMode !== false;
      const configuredCandidateCount = Number(pipelineConfig.releaseCandidateCount ?? 1);
      const explicitCandidateCount = Number((normalized.rawConfig as any)?.releaseCandidateCount);
      // Production default: invest in one strong candidate first.
      // A second candidate is a fallback tool, not the baseline path.
      const defaultCandidateCount = Number.isFinite(configuredCandidateCount)
        ? Math.max(1, Math.min(3, Math.round(configuredCandidateCount)))
        : 1;
      const releaseCandidateCount = releaseEnabled
        ? Math.max(1, Math.min(3, Number.isFinite(explicitCandidateCount) ? Math.round(explicitCandidateCount) : defaultCandidateCount))
        : 1;
      const adaptiveSecondCandidateRaw = (normalized.rawConfig as any)?.enableAdaptiveSecondCandidate;
      const enableAdaptiveSecondCandidate = typeof adaptiveSecondCandidateRaw === "boolean"
        ? adaptiveSecondCandidateRaw
        : releaseCandidateCount === 1;
      const adaptiveSecondCandidate =
        releaseEnabled &&
        !Number.isFinite(explicitCandidateCount) &&
        releaseCandidateCount === 1 &&
        enableAdaptiveSecondCandidate;
      const criticModel = String((normalized.rawConfig as any)?.criticModel || pipelineConfig.criticModel || "gpt-4.1-mini");
      const criticMinScore = clampNumber(Number((normalized.rawConfig as any)?.criticMinScore ?? pipelineConfig.criticMinScore ?? 8.2), 5.5, 10);
      // Selective surgery is chapter-local and much cheaper than full rewrites.
      // For 6-8 stories, default to one edit unless explicitly overridden.
      const explicitSurgeryEdits = Number((normalized.rawConfig as any)?.maxSelectiveSurgeryEdits);
      const implicitSurgeryEdits = 1;
      const maxSelectiveSurgeryEdits = Number.isFinite(explicitSurgeryEdits)
        ? Math.max(0, Math.min(5, explicitSurgeryEdits))
        : implicitSurgeryEdits;
      const surgeryEnabled = releaseEnabled && maxSelectiveSurgeryEdits > 0;
      const humorLevel = typeof (normalized.rawConfig as any)?.humorLevel === "number"
        ? (normalized.rawConfig as any).humorLevel
        : 2;

      // ─── Fetch avatar memories for story continuity ─────────────────────
      // OPTIMIZED: Only 1 memory per avatar, short titles only - keeps prompt small
      // for reasoning models (gpt-5-mini) where extra context → more reasoning tokens
      const avatarMemories = new Map<string, AvatarMemoryCompressed[]>();
      try {
        for (const avatar of input.avatars) {
          const rows: Array<{ story_title: string; emotional_impact: string }> = [];
          const gen = await avatarDB.query<{ story_title: string; emotional_impact: string }>`
            SELECT story_title, emotional_impact
            FROM avatar_memories
            WHERE avatar_id = ${avatar.id}
            ORDER BY created_at DESC
            LIMIT 1
          `;
          for await (const row of gen) {
            rows.push(row);
          }
          if (rows.length > 0) {
            avatarMemories.set(avatar.id, rows.map(r => ({
              storyTitle: (r.story_title || "").substring(0, 32),
              experience: "",
              emotionalImpact: (r.emotional_impact as any) || 'neutral',
            })));
            console.log(`[pipeline] 🧠 Fetched ${rows.length} memories for avatar ${avatar.name}`);
          }
        }
      } catch (e) {
        console.warn("[pipeline] ⚠️ Could not fetch avatar memories (non-critical):", e);
      }

      const storedText = await loadStoryText(normalized.storyId);

      if (storedText.length === directives.length) {
        storyDraft = {
          title: "",
          description: "",
          chapters: storedText.map((row) => ({
            chapter: row.chapter,
            title: row.title || "",
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
          ageRange: { min: normalized.ageMin, max: normalized.ageMax },
          wordBudget: normalized.wordBudget,
          artifactArc: canonFusionPlan.artifactArc,
          humorLevel,
        });
        qualityReport = toQualitySummary(cachedQuality, 0);
        criticReport = await runSemanticCritic({
          storyId: normalized.storyId,
          draft: storyDraft,
          directives,
          cast: castSet,
          language: normalized.language,
          ageRange: { min: normalized.ageMin, max: normalized.ageMax },
          humorLevel,
          model: criticModel,
          targetMinScore: criticMinScore,
        });
        tokenUsage = mergeTokenUsage(tokenUsage, criticReport.usage);
        if (criticReport.usage) {
          const criticCost = buildLlmCostEntry({
            phase: "phase6-story",
            step: "critic",
            usage: criticReport.usage,
            fallbackModel: criticModel,
          });
          if (criticCost) costEntries.push(criticCost);
        }
        releaseReport = {
          enabled: releaseEnabled,
          candidateCount: 1,
          selectedCandidateIndex: 1,
          selectedCompositeScore: scoreReleaseCandidate(qualityReport, criticReport, releaseEnabled),
          criticMinScore,
          criticScore: criticReport.overallScore,
        };
      } else {
        type CandidateBundle = {
          index: number;
          seed: number;
          draft: StoryDraft;
          quality: any;
          critic: SemanticCriticReport;
          usage?: any;
          compositeScore: number;
          surgeryApplied: boolean;
          editedChapters: number[];
        };

        const candidateBundles: CandidateBundle[] = [];
        const targetCandidateCount = adaptiveSecondCandidate ? 2 : releaseCandidateCount;
        for (let candidateIdx = 0; candidateIdx < targetCandidateCount; candidateIdx += 1) {
          const candidateSeed = (variantSeed + candidateIdx * 7919) >>> 0;
          const candidateTag = `cand-${candidateIdx + 1}`;
          const writeResult = await this.storyWriter.writeStory({
            normalizedRequest: normalized,
            cast: castSet,
            dna: blueprint.dna,
            directives,
            stylePackText,
            fusionSections,
            avatarMemories: avatarMemories.size > 0 ? avatarMemories : undefined,
            generationSeed: candidateSeed,
            candidateTag,
          });

          let candidateDraft = writeResult.draft;
          let candidateQuality = writeResult.qualityReport ?? toQualitySummary(
            runQualityGates({
              draft: candidateDraft,
              directives,
              cast: castSet,
              language: normalized.language,
              ageRange: { min: normalized.ageMin, max: normalized.ageMax },
              wordBudget: normalized.wordBudget,
              artifactArc: canonFusionPlan.artifactArc,
              humorLevel,
            }),
            0,
          );

          let candidateUsage = writeResult.usage;
          if (writeResult.costEntries?.length) {
            costEntries.push(...writeResult.costEntries);
          }
          let candidateCritic: SemanticCriticReport;
          if (shouldSkipSemanticCritic(candidateQuality)) {
            candidateCritic = buildSkippedCriticReport(criticModel);
          } else {
            candidateCritic = await runSemanticCritic({
              storyId: normalized.storyId,
              draft: candidateDraft,
              directives,
              cast: castSet,
              language: normalized.language,
              ageRange: { min: normalized.ageMin, max: normalized.ageMax },
              humorLevel,
              model: criticModel,
              targetMinScore: criticMinScore,
            });
            candidateUsage = mergeTokenUsage(candidateUsage, candidateCritic.usage);
            if (candidateCritic.usage) {
              const criticCost = buildLlmCostEntry({
                phase: "phase6-story",
                step: "critic",
                usage: candidateCritic.usage,
                fallbackModel: criticModel,
                candidateTag,
              });
              if (criticCost) costEntries.push(criticCost);
            }
          }

          let surgeryApplied = false;
          let editedChapters: number[] = [];
          const qualityErrors = Number(candidateQuality?.errorCount ?? 0);
          const hasPriorityOneLocalTask = candidateCritic.patchTasks.some(task => task.chapter > 0 && task.priority === 1);
          // Cheap rescue mode: allow surgery for clearly salvageable near-release drafts,
          // but still block hopeless candidates that would burn tokens without upside.
          const nearReleaseBand = candidateCritic.overallScore >= Math.max(7.0, criticMinScore - 1.1);
          const rescueableQualityBand = qualityErrors <= 6 || candidateCritic.overallScore >= Math.max(7.4, criticMinScore - 0.5);
          const candidateSurgeryEdits =
            candidateCritic.overallScore >= 7.0 && qualityErrors <= 4
              ? Math.max(maxSelectiveSurgeryEdits, 2)
              : maxSelectiveSurgeryEdits;
          if (
            surgeryEnabled
            && candidateCritic.patchTasks.length > 0
            && hasPriorityOneLocalTask
            && nearReleaseBand
            && rescueableQualityBand
            && (!candidateCritic.releaseReady || qualityErrors > 0)
          ) {
            const surgery = await applySelectiveSurgery({
              storyId: normalized.storyId,
              normalizedRequest: normalized,
              cast: castSet,
              dna: blueprint.dna,
              directives,
              draft: candidateDraft,
              patchTasks: candidateCritic.patchTasks,
              stylePackText,
              maxEdits: candidateSurgeryEdits,
              model: resolveSurgeryModel(normalized.rawConfig?.aiModel),
              candidateTag,
            });

            if (surgery.changed) {
              surgeryApplied = true;
              editedChapters = surgery.editedChapters;
              candidateDraft = surgery.draft;
              candidateUsage = mergeTokenUsage(candidateUsage, surgery.usage);
              if (surgery.costEntries?.length) {
                costEntries.push(...surgery.costEntries);
              }

              const postSurgeryQuality = toQualitySummary(
                runQualityGates({
                  draft: candidateDraft,
                  directives,
                  cast: castSet,
                  language: normalized.language,
                  ageRange: { min: normalized.ageMin, max: normalized.ageMax },
                  wordBudget: normalized.wordBudget,
                  artifactArc: canonFusionPlan.artifactArc,
                  humorLevel,
                }),
                candidateQuality?.rewriteAttempts ?? 0,
              );
              const postSurgeryCritic = await runSemanticCritic({
                storyId: normalized.storyId,
                draft: candidateDraft,
                directives,
                cast: castSet,
                language: normalized.language,
                ageRange: { min: normalized.ageMin, max: normalized.ageMax },
                humorLevel,
                model: criticModel,
                targetMinScore: criticMinScore,
              });
              candidateUsage = mergeTokenUsage(candidateUsage, postSurgeryCritic.usage);
              if (postSurgeryCritic.usage) {
                const criticCost = buildLlmCostEntry({
                  phase: "phase6-story",
                  step: "critic-post-surgery",
                  usage: postSurgeryCritic.usage,
                  fallbackModel: criticModel,
                  candidateTag,
                });
                if (criticCost) costEntries.push(criticCost);
              }

              const preScore = scoreReleaseCandidate(candidateQuality, candidateCritic, releaseEnabled);
              const postScore = scoreReleaseCandidate(postSurgeryQuality, postSurgeryCritic, releaseEnabled);
              if (postScore >= preScore) {
                candidateQuality = postSurgeryQuality;
                candidateCritic = postSurgeryCritic;
              }
            }
          }

          const compositeScore = scoreReleaseCandidate(candidateQuality, candidateCritic, releaseEnabled);
          candidateBundles.push({
            index: candidateIdx + 1,
            seed: candidateSeed,
            draft: candidateDraft,
            quality: candidateQuality,
            critic: candidateCritic,
            usage: candidateUsage,
            compositeScore,
            surgeryApplied,
            editedChapters,
          });
          tokenUsage = mergeTokenUsage(tokenUsage, candidateUsage);

          await logPhase("phase6-story-candidate", { storyId: normalized.storyId, candidate: candidateIdx + 1 }, {
            seed: candidateSeed,
            qualityScore: candidateQuality?.score,
            criticScore: candidateCritic?.overallScore,
            criticReleaseReady: candidateCritic?.releaseReady,
            issueCount: candidateQuality?.issueCount,
            errorCount: candidateQuality?.errorCount,
            warningCount: candidateQuality?.warningCount,
            compositeScore,
            surgeryApplied,
            editedChapters,
          });

          if (adaptiveSecondCandidate && candidateIdx === 0) {
            const candidateErrors = Number(candidateQuality?.errorCount ?? 0);
            const firstCandidateStrong =
              candidateCritic.releaseReady &&
              candidateCritic.overallScore >= criticMinScore &&
              candidateErrors === 0;
            if (firstCandidateStrong) {
              break;
            }
            const firstCandidateRetryWorthIt =
              candidateCritic.overallScore >= Math.max(7.0, criticMinScore - 1.2)
              || (candidateCritic.overallScore >= Math.max(6.6, criticMinScore - 1.6) && candidateErrors <= 2);
            if (!firstCandidateRetryWorthIt) {
              break;
            }
          }
        }

        const bestCandidate = pickBestCandidate(candidateBundles);
        storyDraft = bestCandidate.draft;
        qualityReport = bestCandidate.quality;
        criticReport = bestCandidate.critic;
        releaseReport = {
          enabled: releaseEnabled,
          candidateCount: candidateBundles.length,
          selectedCandidateIndex: bestCandidate.index,
          selectedCompositeScore: bestCandidate.compositeScore,
          criticMinScore,
          criticScore: bestCandidate.critic.overallScore,
        };

        await logPhase("phase6-story-selection", { storyId: normalized.storyId }, {
          candidateCount: candidateBundles.length,
          selectedCandidate: bestCandidate.index,
          scores: candidateBundles.map(c => ({
            candidate: c.index,
            qualityScore: c.quality?.score,
            criticScore: c.critic?.overallScore,
            compositeScore: c.compositeScore,
            surgeryApplied: c.surgeryApplied,
            editedChapters: c.editedChapters,
          })),
        });

        await logPhase("phase6.2-segmentation", { storyId: normalized.storyId }, {
          strategy: "continuous-story-then-segmentation",
          chapters: storyDraft.chapters.length,
          chapterWordCounts: storyDraft.chapters.map(ch => (ch.text?.split(/\s+/).filter(Boolean).length || 0)),
          totalWords: storyDraft.chapters.reduce((sum, ch) => sum + (ch.text?.split(/\s+/).filter(Boolean).length || 0), 0),
        });

        await saveStoryText(normalized.storyId, storyDraft.chapters.map(ch => ({
          chapter: ch.chapter,
          title: ch.title?.trim() || undefined,
          text: ch.text,
        })));
        await logPhase("phase6-story", { storyId: normalized.storyId, title: storyDraft.title }, {
          chapters: storyDraft.chapters.length,
          durationMs: Date.now() - phase6Start,
          tokens: tokenUsage,
          releaseCandidateCount: candidateBundles.length,
          surgeryEnabled,
          maxSelectiveSurgeryEdits,
          qualityScore: qualityReport?.score,
          criticScore: criticReport?.overallScore,
          criticReleaseReady: criticReport?.releaseReady,
          passedGates: qualityReport?.passedGates,
          failedGates: qualityReport?.failedGates,
          rewriteAttempts: qualityReport?.rewriteAttempts,
          errorCount: qualityReport?.errorCount,
          warningCount: qualityReport?.warningCount,
          issues: qualityReport?.issues?.map((i: any) => ({ gate: i.gate, code: i.code, chapter: i.chapter, message: i.message, severity: i.severity })),
          criticSummary: criticReport?.summary,
          wordCount: storyDraft.chapters.reduce((sum, ch) => sum + (ch.text?.split(/\s+/).length || 0), 0),
        });
      }
      if (criticReport) {
        qualityReport = { ...qualityReport, critic: criticReport };
      }

      const storyErrors = [...(qualityReport?.issues?.filter((i: any) => i.severity === "ERROR") ?? [])];
      if (releaseEnabled && criticReport && !isCriticSkipped(criticReport) && criticReport.overallScore < criticMinScore) {
        storyErrors.push({
          gate: "SEMANTIC_CRITIC",
          chapter: 0,
          code: "CRITIC_SCORE_BELOW_RELEASE",
          message: `Critic score ${criticReport.overallScore.toFixed(2)} below target ${criticMinScore.toFixed(2)}`,
          severity: "ERROR",
        });
      }
      const strictQualityGatesRaw = (normalized.rawConfig as any)?.strictQualityGates;
      const strictQualityGates = typeof strictQualityGatesRaw === "boolean" ? strictQualityGatesRaw : false;

      // Always-blocking errors: instruction leaks/placeholders/language leaks.
      const hardSafetyCodes = new Set([
        "INSTRUCTION_LEAK",
        "ENGLISH_LEAK",
        "FILTER_PLACEHOLDER",
        "CHAPTER_PLACEHOLDER",
        "META_LABEL_PHRASE",
        "META_NARRATION",
      ]);

      // Optional strict release gates. Disabled by default to avoid hard generation failures
      // when only narrative quality errors remain after rewrite.
      const strictReleaseCodes = new Set([
        "MISSING_CHARACTER",
        "TOTAL_TOO_SHORT",
        "CHAPTER_TOO_SHORT_HARD",
        "VOICE_INDISTINCT",
        "VOICE_TAG_FORMULA_OVERUSE",
        "MISSING_EXPLICIT_STAKES",
        "MISSING_LOWPOINT",
        "LOWPOINT_TOO_SOFT",
        "ENDING_UNRESOLVED",
        "CLIFFHANGER_ENDING",
        "MISSING_INNER_CHILD_MOMENT",
        "NO_CHILD_ERROR_CORRECTION_ARC",
        "COMPARISON_CLUSTER",
        "META_FORESHADOW_PHRASE",
        "META_SUMMARY_SENTENCE",
        "RULE_EXPOSITION_TELL",
        "ABRUPT_SCENE_SHIFT",
        "HUMOR_TOO_LOW",
        "GIMMICK_LOOP_OVERUSE",
        "CRITIC_SCORE_BELOW_RELEASE",
      ]);
      const criticalCodes = new Set([
        ...hardSafetyCodes,
        ...(strictQualityGates ? [...strictReleaseCodes] : []),
      ]);
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
        console.warn(`[pipeline] Story accepted with ${storyErrors.length} non-critical quality issues (strictQualityGates=${strictQualityGates}): ${storyErrors.map((i: any) => i.code).join(", ")}`);
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
          storyId: normalized.storyId,
          selectedStoryModel: String(normalized.rawConfig?.aiModel || ""),
        });
        aiSceneDescriptions = sceneResult.descriptions;
        tokenUsage = mergeTokenUsage(tokenUsage, sceneResult.usage);
        if (sceneResult.costEntries?.length) {
          costEntries.push(...sceneResult.costEntries);
        }
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
      const blockingImageIssues = imageIssues.filter(issue => BLOCKING_IMAGE_ISSUE_CODES.has(issue.code));
      const nonBlockingImageIssues = imageIssues.filter(issue => !BLOCKING_IMAGE_ISSUE_CODES.has(issue.code));
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
        success: blockingImageIssues.length === 0,
        schemaValid: !imageIssues.some(issue => issue.code === "SCHEMA"),
        attempts: imageAttempts,
        issues: imageIssues.map(issue => ({
          severity: BLOCKING_IMAGE_ISSUE_CODES.has(issue.code) ? "ERROR" : "WARN",
          ...issue,
        })),
      };
      phaseGates.push(imageGate);
      if (nonBlockingImageIssues.length > 0) {
        console.warn("[phase7-imagespec] Continuing with non-blocking issues", {
          storyId: normalized.storyId,
          issues: nonBlockingImageIssues,
        });
      }
      if (blockingImageIssues.length > 0) {
        validationReport = { gates: phaseGates, story: qualityReport, images: imageIssues };
        await saveValidationReport(normalized.storyId, validationReport);
        throw new Error(`ImageSpec validation failed: ${blockingImageIssues.map(i => i.code).join(", ")}`);
      }

      const phase8Start = Date.now();
      let coverImage: PipelineRunResult["coverImage"] | undefined;
      try {
        const coverSpec = await buildCoverSpec({
          normalizedRequest: normalized,
          cast: castSet,
          directives,
          storyDraft,
        });
        const coverImages = await this.imageGenerator.generateImages({
          normalizedRequest: normalized,
          cast: castSet,
          directives,
          imageSpecs: [coverSpec],
          pipelineConfig,
          logContext: { storyId: normalized.storyId, phase: "phase8-cover" },
        });
        coverImage = coverImages[0];
        if (coverImage) {
          costEntries.push(buildImageCostEntry({
            phase: "phase8-cover",
            step: "image-generation",
            provider: coverImage.provider || "runware",
            model: coverImage.model,
            chapter: 0,
            success: Boolean(coverImage.imageUrl),
            prompt: coverImage.prompt,
            providerCostUSD: coverImage.providerCostUSD,
            providerCostCredits: coverImage.providerCostCredits,
            referenceCount: coverImage.referenceCount,
            metadata: coverImage.metadata,
          }));
        }
        await logPhase("phase8-cover", { storyId: normalized.storyId }, {
          durationMs: Date.now() - phase8Start,
          success: !!coverImage?.imageUrl,
        });
      } catch (coverError) {
        console.warn("[pipeline] Cover image generation failed", coverError);
      }

      const phase9Start = Date.now();
      let images = await loadStoryImages(normalized.storyId);
      if (images.length === 0) {
        const primaryImages = await this.imageGenerator.generateImages({
          normalizedRequest: normalized,
          cast: castSet,
          directives,
          imageSpecs,
          pipelineConfig,
          logContext: { storyId: normalized.storyId, phase: "phase9-imagegen" },
        });
        for (const image of primaryImages) {
          costEntries.push(buildImageCostEntry({
            phase: "phase9-imagegen",
            step: "image-generation",
            provider: image.provider || "runware",
            model: image.model,
            chapter: image.chapter,
            success: Boolean(image.imageUrl),
            prompt: image.prompt,
            providerCostUSD: image.providerCostUSD,
            providerCostCredits: image.providerCostCredits,
            referenceCount: image.referenceCount,
            metadata: image.metadata,
          }));
        }

        const supplementalSpecs = buildSupplementalScenicImageSpecs({
          imageSpecs,
          directives,
          storyDraft,
          language: normalized.language,
        });

        let supplementalImages: PipelineRunResult["images"] = [];
        let supplementalError: string | undefined;
        try {
          supplementalImages = await this.imageGenerator.generateImages({
            normalizedRequest: normalized,
            cast: castSet,
            directives,
            imageSpecs: supplementalSpecs,
            pipelineConfig,
            logContext: { storyId: normalized.storyId, phase: "phase9-imagegen-scenic" },
          });
          for (const image of supplementalImages) {
            costEntries.push(buildImageCostEntry({
              phase: "phase9-imagegen-scenic",
              step: "image-generation",
              provider: image.provider || "runware",
              model: image.model,
              chapter: image.chapter,
              success: Boolean(image.imageUrl),
              prompt: image.prompt,
              providerCostUSD: image.providerCostUSD,
              providerCostCredits: image.providerCostCredits,
              referenceCount: image.referenceCount,
              metadata: image.metadata,
            }));
          }
        } catch (err) {
          supplementalError = String((err as Error)?.message || err);
          console.warn("[pipeline] Supplemental scenic image generation failed", err);
        }

        const supplementalByChapter = new Map(supplementalImages.map((img) => [img.chapter, img]));
        const supplementalPromptByChapter = new Map(
          supplementalSpecs.map((spec) => [spec.chapter, spec.finalPromptText || ""])
        );
        images = primaryImages.map((img) => {
          const supplemental = supplementalByChapter.get(img.chapter);
          return {
            ...img,
            scenicImageUrl: supplemental?.imageUrl,
            scenicPrompt: supplemental?.prompt || supplementalPromptByChapter.get(img.chapter),
          };
        });

        await saveStoryImages(normalized.storyId, images);
        await logPhase("phase9-imagegen", { storyId: normalized.storyId }, {
          images: images.length,
          durationMs: Date.now() - phase9Start,
          providers: images.map(img => img.provider).filter((v, i, a) => a.indexOf(v) === i),
          successfulImages: images.filter(img => img.imageUrl).length,
          failedImages: images.filter(img => !img.imageUrl).length,
          supplementalImagesGenerated: images.filter(img => img.scenicImageUrl).length,
          supplementalImagesMissing: images.filter(img => !img.scenicImageUrl).length,
          supplementalError,
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
            logContext: { storyId: normalized.storyId, phase: "phase10-vision-retry-imagegen" },
          });
          for (const image of retryImages) {
            costEntries.push(buildImageCostEntry({
              phase: "phase10-vision-retry-imagegen",
              step: "image-generation",
              provider: image.provider || "runware",
              model: image.model,
              chapter: image.chapter,
              success: Boolean(image.imageUrl),
              prompt: image.prompt,
              providerCostUSD: image.providerCostUSD,
              providerCostCredits: image.providerCostCredits,
              referenceCount: image.referenceCount,
              metadata: image.metadata,
            }));
          }

          if (retryImages.length > 0) {
            const retryMap = new Map(retryImages.map(img => [img.chapter, img]));
            images = images.map(img => {
              const retry = retryMap.get(img.chapter);
              if (!retry) return img;
              return {
                ...img,
                imageUrl: retry.imageUrl,
                prompt: retry.prompt,
                provider: retry.provider,
              };
            });
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

      // Clean up temporary collage images from bucket storage
      // TEMPORARILY DISABLED for testing
      // await cleanupCollages(imageSpecs).catch(err =>
      //   console.warn("[pipeline] Collage cleanup failed (non-critical):", err)
      // );

      await updateStoryInstanceStatus(normalized.storyId, "complete", null);

      return {
        normalizedRequest: normalized,
        variantPlan,
        castSet,
        sceneDirectives: directives,
        storyDraft,
        imageSpecs,
        images,
        coverImage,
        validationReport,
        tokenUsage,
        costEntries,
        artifactMeta,
        canonFusionPlan,
        criticReport,
        releaseReport,
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

function toQualitySummary(report: any, rewriteAttempts: number): any {
  if (!report) {
    return {
      score: 0,
      passedGates: [],
      failedGates: [],
      issueCount: 0,
      errorCount: 0,
      warningCount: 0,
      rewriteAttempts,
      issues: [],
    };
  }

  if (
    typeof report.score === "number" &&
    typeof report.issueCount === "number" &&
    typeof report.errorCount === "number" &&
    typeof report.warningCount === "number"
  ) {
    return {
      ...report,
      rewriteAttempts: typeof report.rewriteAttempts === "number" ? report.rewriteAttempts : rewriteAttempts,
      issues: Array.isArray(report.issues) ? report.issues : [],
      passedGates: Array.isArray(report.passedGates) ? report.passedGates : [],
      failedGates: Array.isArray(report.failedGates) ? report.failedGates : [],
    };
  }

  const issues = Array.isArray(report.issues) ? report.issues : [];
  return {
    score: typeof report.score === "number" ? report.score : 0,
    passedGates: Array.isArray(report.passedGates) ? report.passedGates : [],
    failedGates: Array.isArray(report.failedGates) ? report.failedGates : [],
    issueCount: issues.length,
    errorCount: issues.filter((i: any) => i?.severity === "ERROR").length,
    warningCount: issues.filter((i: any) => i?.severity === "WARNING").length,
    rewriteAttempts,
    issues,
  };
}

function shouldSkipSemanticCritic(quality: any): boolean {
  if (!quality) return false;
  const issues = Array.isArray(quality.issues) ? quality.issues : [];
  const hasPlaceholder = issues.some((issue: any) => issue?.code === "CHAPTER_PLACEHOLDER");
  // Only skip critic for truly unsalvageable drafts (placeholder chapters).
  // TOTAL_TOO_SHORT alone is recoverable via expand — critic feedback is still valuable.
  return hasPlaceholder;
}

function buildSkippedCriticReport(model: string): SemanticCriticReport {
  return {
    model,
    overallScore: 0,
    dimensionScores: {
      craft: 0,
      narrative: 0,
      childFit: 0,
      humor: 0,
      warmth: 0,
    },
    releaseReady: false,
    summary: "Semantic critic skipped for severely broken draft (cost guard).",
    issues: [],
    patchTasks: [],
  };
}

function scoreReleaseCandidate(quality: any, critic: SemanticCriticReport | undefined, releaseEnabled: boolean): number {
  const qualityScore = clampNumber(Number(quality?.score ?? 0), 0, 10);
  const criticSkipped = isCriticSkipped(critic);
  const criticScore = clampNumber(Number(criticSkipped ? qualityScore : (critic?.overallScore ?? qualityScore)), 0, 10);
  const errorCount = Math.max(0, Number(quality?.errorCount ?? 0));
  const warningCount = Math.max(0, Number(quality?.warningCount ?? 0));

  // Quality-gate score often collapses to 0 for otherwise salvageable prose.
  // In that regime, trust the semantic critic more and soften structural penalties.
  const qualitySignalCollapsed = qualityScore <= 0.05;
  const effectiveQualityScore = qualitySignalCollapsed ? criticScore : qualityScore;
  const blend = effectiveQualityScore * 0.28 + criticScore * 0.72;
  const errorPenaltyWeight = qualitySignalCollapsed ? 0.75 : 1.15;
  const warningPenaltyCap = qualitySignalCollapsed ? 1.2 : 1.6;
  const penalties = errorCount * errorPenaltyWeight + Math.min(warningPenaltyCap, warningCount * 0.04);
  const releasePenalty = releaseEnabled && critic && !criticSkipped && !critic.releaseReady ? 0.6 : 0;
  return Number((blend - penalties - releasePenalty).toFixed(4));
}

function isCriticSkipped(critic: SemanticCriticReport | undefined): boolean {
  if (!critic) return false;
  return String(critic.summary || "").toLowerCase().startsWith("semantic critic skipped");
}

function pickBestCandidate<T extends { compositeScore: number; quality: any; critic: SemanticCriticReport }>(candidates: T[]): T {
  if (candidates.length === 0) {
    throw new Error("No story candidates available for selection");
  }
  return [...candidates].sort((a, b) => {
    const aErrors = Number(a.quality?.errorCount ?? 0);
    const bErrors = Number(b.quality?.errorCount ?? 0);
    const criticGap = Number(b.critic?.overallScore ?? 0) - Number(a.critic?.overallScore ?? 0);
    if (Math.abs(criticGap) >= 0.5 && Math.abs(aErrors - bErrors) <= 1) {
      return criticGap;
    }
    if (b.compositeScore !== a.compositeScore) return b.compositeScore - a.compositeScore;
    if (aErrors !== bErrors) return aErrors - bErrors;
    return Number(b.critic?.overallScore ?? 0) - Number(a.critic?.overallScore ?? 0);
  })[0];
}

function mergeTokenUsage(current: any, next: any): any {
  return mergeNormalizedTokenUsage(current, next);
}

function resolveSurgeryModel(model?: string): string {
  if (!model) return "gpt-5-mini";
  if (model.startsWith("gpt-5.4")) return "gpt-5.4";
  return "gpt-5-mini";
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

async function selectBestFairyTale(input: {
  userId: string;
  ageMin: number;
  ageMax: number;
  requestedTone?: string;
  requestHash: string;
}): Promise<{ taleId: string; title: string; score: number; method: string; reasoning: string } | null> {
  const rawCandidates = await storyDB.queryAll<{
    tale_id: string;
    title: string;
    age_min: number | null;
    age_max: number | null;
    tone: string | null;
    tags_json: any;
    core_conflict: string | null;
    fixed_json: any;
    iconic_json: any;
    content_rules_json: any;
    roles_json: any;
  }>`
    SELECT
      tale_id,
      COALESCE(tale_dna->'tale'->>'title', tale_id) AS title,
      NULLIF(tale_dna->'tale'->'age'->>'min', '')::int AS age_min,
      NULLIF(tale_dna->'tale'->'age'->>'max', '')::int AS age_max,
      LOWER(COALESCE(tale_dna->'tale'->'toneBounds'->>'targetTone', '')) AS tone,
      COALESCE(tale_dna->'tale'->'themeTags', '[]'::jsonb) AS tags_json,
      COALESCE(tale_dna->'tale'->>'coreConflict', '') AS core_conflict,
      COALESCE(tale_dna->'tale'->'fixedElements', '[]'::jsonb) AS fixed_json,
      COALESCE(tale_dna->'tale'->'iconicBeats', '[]'::jsonb) AS iconic_json,
      COALESCE(tale_dna->'tale'->'toneBounds'->'contentRules', '[]'::jsonb) AS content_rules_json,
      COALESCE(tale_dna->'roles', '[]'::jsonb) AS roles_json
    FROM tale_dna
  `;
  if (rawCandidates.length === 0) return null;

  const candidates: TaleSelectionCandidate[] = rawCandidates.map(row => ({
    tale_id: row.tale_id,
    title: row.title || row.tale_id,
    age_min: row.age_min,
    age_max: row.age_max,
    tone: row.tone,
    tags: parseThemeTags(row.tags_json),
    coreConflict: String(row.core_conflict || "").toLowerCase(),
    fixedElements: parseStringArray(row.fixed_json),
    iconicBeats: parseStringArray(row.iconic_json),
    contentRules: parseStringArray(row.content_rules_json),
    protagonistConstraints: extractProtagonistConstraints(row.roles_json),
  }));

  const recentRows = await storyDB.queryAll<{ tale_id: string | null }>`
    SELECT si.tale_id
    FROM story_instances si
    JOIN stories s ON s.id = si.id
    WHERE s.user_id = ${input.userId}
      AND si.category = 'Klassische Märchen'
      AND si.tale_id IS NOT NULL
    ORDER BY si.created_at DESC
    LIMIT 8
  `;
  const recentIds = recentRows
    .map(row => row.tale_id)
    .filter((value): value is string => Boolean(value));
  const hardAvoid = new Set(recentIds.slice(0, 3));
  const scoredPool = candidates.filter(candidate => !hardAvoid.has(candidate.tale_id));
  const pool = scoredPool.length > 0 ? scoredPool : candidates;

  const toneTokens = tokenizeTone(input.requestedTone);
  const targetMid = (input.ageMin + input.ageMax) / 2;

  let best: { candidate: TaleSelectionCandidate; score: number } | null = null;
  for (const candidate of pool) {
    const ageMin = candidate.age_min ?? input.ageMin;
    const ageMax = candidate.age_max ?? input.ageMax;
    const candidateMid = (ageMin + ageMax) / 2;
    const toneText = [
      candidate.tone || "",
      ...(candidate.tags || []),
      candidate.coreConflict,
      ...(candidate.fixedElements || []),
      ...(candidate.iconicBeats || []),
      ...(candidate.contentRules || []),
    ].join(" ").toLowerCase();

    let score = 0;
    if (rangesOverlap(ageMin, ageMax, input.ageMin, input.ageMax)) score += 2.2;
    else score -= 4.0;

    if (ageMin <= input.ageMin && ageMax >= input.ageMax) score += 1.2;
    score -= Math.min(2.5, Math.abs(candidateMid - targetMid) * 0.4);

    if (toneTokens.length > 0) {
      const toneMatches = toneTokens.filter(token => toneText.includes(token)).length;
      score += toneMatches * 1.1;
      if (toneMatches === 0) score -= 0.6;
    }

    if (input.ageMax <= 8 && hasDarkToneMarkers(toneText)) {
      score -= 2.5;
    }

    const childFitScore = input.ageMax <= 8 ? scoreYoungReaderTaleFit(candidate) : 0;
    score += childFitScore;

    const repeatCount = recentIds.filter(id => id === candidate.tale_id).length;
    score -= repeatCount * 1.5;

    // Deterministic tie-breaker: keeps outputs diverse across requests without pure randomness.
    score += deterministicJitter(`${input.requestHash}:${candidate.tale_id}`) * 0.8;

    if (!best || score > best.score) {
      best = { candidate, score };
    }
  }

  if (!best) return null;
  const reasonParts = [
    `pool=${pool.length}/${candidates.length}`,
    `age=${best.candidate.age_min ?? "?"}-${best.candidate.age_max ?? "?"}`,
    `tone=${best.candidate.tone || "n/a"}`,
    input.ageMax <= 8 ? `child-fit=${scoreYoungReaderTaleFit(best.candidate).toFixed(1)}` : "",
    hardAvoid.size > 0 ? `recent-avoid=${hardAvoid.size}` : "recent-avoid=0",
  ].filter(Boolean);
  return {
    taleId: best.candidate.tale_id,
    title: best.candidate.title,
    score: best.score,
    method: "scored-age-tone-anti-repeat",
    reasoning: reasonParts.join(", "),
  };
}

function parseThemeTags(tagsJson: any): string[] {
  return parseStringArray(tagsJson);
}

function parseStringArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(entry => String(entry).toLowerCase()).filter(Boolean);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(entry => String(entry).toLowerCase()).filter(Boolean);
    } catch {
      return value.split(/[,\s]+/).map(entry => entry.toLowerCase()).filter(Boolean);
    }
  }
  return [];
}

function parseJsonArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function extractProtagonistConstraints(rolesJson: any): string[] {
  const roles = parseJsonArray(rolesJson);
  return roles
    .filter(role => String(role?.roleType || "").toUpperCase() === "PROTAGONIST")
    .flatMap(role => parseStringArray(role?.constraints));
}

function scoreYoungReaderTaleFit(candidate: TaleSelectionCandidate): number {
  const corpus = [
    candidate.title,
    candidate.tone || "",
    candidate.coreConflict,
    ...(candidate.tags || []),
    ...(candidate.fixedElements || []),
    ...(candidate.iconicBeats || []),
    ...(candidate.contentRules || []),
  ].join(" ").toLowerCase();
  const constraints = candidate.protagonistConstraints.map(value => value.toLowerCase());

  let score = 0;
  if (constraints.some(value => value.includes("age=child"))) score += 2.4;
  if (constraints.some(value => value.includes("species=animal"))) score += 0.6;
  if (constraints.some(value => value.includes("age=young_adult") || value.includes("age=adult"))) score -= 2.2;

  if (/\b(?:epic|legendary|tragic|haunting|revenge|treachery|betray|sacrifice|kingdom|throne|sorcerer|war|battle|impossible\s+quests?|quests?)\b/i.test(corpus)) {
    score -= 1.8;
  }
  if (/\b(?:prince|princess|tsar|zar|king|queen)\b/i.test(corpus)) {
    score -= 1.2;
  }
  if (/\b(?:playful|simple|gentle|warm|cozy|cosy|funny|humorous|lighthearted|friendship|teamwork|kindness|encouraging|joyful)\b/i.test(corpus)) {
    score += 1.4;
  }
  if (/\b(?:repeat|repetitive|cumulative|rhythmic)\b/i.test(corpus)) {
    score += 0.6;
  }

  return score;
}

function tokenizeTone(tone?: string): string[] {
  if (!tone) return [];
  return tone
    .toLowerCase()
    .split(/[^a-zA-ZäöüÄÖÜß]+/)
    .map(token => token.trim())
    .filter(token => token.length >= 3);
}

function hasDarkToneMarkers(text: string): boolean {
  if (!text) return false;
  return /dark|dunkel|tragic|tragisch|horror|grausam|death|tod|bitter|dread|schrecken|haunted/i.test(text);
}

function rangesOverlap(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return aMin <= bMax && bMin <= aMax;
}

function deterministicJitter(seed: string): number {
  const digest = crypto.createHash("sha256").update(seed).digest();
  const value = (digest[0] << 8) | digest[1];
  return value / 65535;
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
