import crypto from "crypto";
import type {
  AISceneDescription,
  AvatarDetail,
  AvatarMemoryCompressed,
  BlueprintGenerationResult,
  CastSet,
  ImageSpec,
  NormalizedRequest,
  PipelineDependencies,
  SceneDirective,
  StoryBlueprintV8,
  StoryCostEntry,
  StoryDraft,
  StoryVariantPlan,
} from "./types";
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
import { runSemanticCritic, type SemanticCriticPatchTask, type SemanticCriticReport } from "./semantic-critic";
import { applySelectiveSurgery } from "./release-polisher";
import { applySentenceTightening, pickChaptersNeedingTightening } from "./sentence-tightening-pass";
import { computeWordBudget } from "./word-budget";
import { loadPipelineConfig, type PipelineConfig } from "./pipeline-config";
import { loadStylePack, formatStylePackPrompt } from "./style-pack";
import { generateSceneDescriptions } from "./scene-prompt-generator";
import { resolveCriticModelForPipeline, resolveSupportTaskModel, resolveSurgeryModelForPipeline } from "./model-routing";
import { GLOBAL_IMAGE_NEGATIVES } from "./constants";
import { buildImageCostEntry, buildLlmCostEntry, mergeNormalizedTokenUsage } from "./cost-ledger";
import { generateValidatedV8Blueprint, resolvePromptVersionForRequest } from "./blueprint-generator";
import { generateValidatedStorySoul } from "./story-soul-generator";
import { runSoulGate, type SoulGateResult } from "./story-soul-validator";
import type { StorySoul } from "./schemas/story-soul";
import { publishWithTimeout } from "../../helpers/pubsubTimeout";
import { logTopic } from "../../log/logger";
import { storyDB } from "../db";
import { SQLDatabase } from "encore.dev/storage/sqldb";

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
    let qualityReport: any;
    let criticReport: SemanticCriticReport | undefined;
    let blueprintResultV8: BlueprintGenerationResult | undefined;
    let storySoul: StorySoul | undefined;
    let soulGateResult: SoulGateResult | undefined;

    try {
      // ─── Phase 0.5: Fairy Tale Selection (quality/diversity fit) ─────────
      if (normalized.category === "Klassische Märchen" && !normalized.taleId) {
        try {
          const rawConfig = normalized.rawConfig as any;
          const selectedTale = await selectBestFairyTale({
            userId: normalized.userId,
            ageMin: normalized.ageMin,
            ageMax: normalized.ageMax,
            requestedTone: normalized.requestedTone,
            requestHash: normalized.requestHash,
            humorLevel: typeof rawConfig?.humorLevel === "number" ? rawConfig.humorLevel : undefined,
            suspenseLevel: typeof rawConfig?.suspenseLevel === "number" ? rawConfig.suspenseLevel : undefined,
            pacing: typeof rawConfig?.pacing === "string" ? rawConfig.pacing : undefined,
            hasTwist: rawConfig?.hasTwist === true,
            allowRhymes: rawConfig?.allowRhymes === true,
            avatarCount: normalized.avatarCount,
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

      // ─── Phase 5.7: Story Soul (Stage 0 – VOR Blueprint) ─────────────────
      // Erzeugt Premise, Hook, Stakes, Figur-Fingerprints, Welt-Textur,
      // Payoff-Versprechen. Wird vom Soul-Gate bewertet, bevor der Blueprint
      // starten darf. Feature-flagged über `pipelineConfig.soulStageEnabled`.
      if (pipelineConfig.soulStageEnabled) {
        const phase57Start = Date.now();
        try {
          const soulGeneration = await generateValidatedStorySoul({
            normalizedRequest: normalized,
            cast: castSet,
            dna: blueprint.dna,
            directives,
            soulRetryMax: pipelineConfig.soulRetryMax,
            maxOutputTokens: pipelineConfig.soulGeneratorMaxOutputTokens,
            rescueEnabled: pipelineConfig.soulRescueEnabled,
          });
          storySoul = soulGeneration.soul;
          tokenUsage = mergeTokenUsage(tokenUsage, soulGeneration.usage);
          if (soulGeneration.costEntries?.length) {
            costEntries.push(...soulGeneration.costEntries);
          }

          if (soulGeneration.fallbackUsed && !pipelineConfig.soulAllowOnReject) {
            throw new Error("Story Soul generator used deterministic fallback; quality-first mode requires a validated Soul.");
          }

          if (pipelineConfig.soulGateEnabled) {
            soulGateResult = await runSoulGate({
              soul: storySoul,
              normalizedRequest: normalized,
              cast: castSet,
              modelOverride: pipelineConfig.soulGateModel,
            });
            tokenUsage = mergeTokenUsage(tokenUsage, soulGateResult.usage);
            if (soulGateResult.costEntries?.length) {
              costEntries.push(...soulGateResult.costEntries);
            }
          }

          const gateSuccess =
            !pipelineConfig.soulGateEnabled
            || soulGateResult?.verdict === "approved"
            || soulGateResult?.verdict === "acceptable_with_warnings";
          const combinedIssues: any[] = [
            ...(soulGateResult?.schemaIssues ?? soulGeneration.issues).map((issue) => ({ ...issue })),
            ...(soulGateResult?.rubricScores ?? [])
              .filter((s) => s.score < 7)
              .map((s) => ({
                severity: s.score < 5 ? "ERROR" : "WARNING",
                code: `RUBRIC_${s.dimension.toUpperCase()}_LOW`,
                path: `rubric.${s.dimension}`,
                message: `${s.score}/10 – ${s.reason}${s.fix ? ` | FIX: ${s.fix}` : ""}`,
              })),
          ];
          phaseGates.push({
            phase: "phase5.7-soul",
            success: gateSuccess,
            schemaValid: soulGateResult?.schemaValid ?? !soulGeneration.fallbackUsed,
            attempts: soulGeneration.attempts,
            issues: combinedIssues,
            artifactRef: {
              verdict: soulGateResult?.verdict ?? "schema_only",
              overallScore: soulGateResult?.overallScore,
              minDimensionScore: soulGateResult?.minDimensionScore,
              blockingDimensions: soulGateResult?.blockingDimensions ?? [],
              generatorModel: soulGeneration.model,
              generatorFallbackUsed: soulGeneration.fallbackUsed,
              gateModel: pipelineConfig.soulGateEnabled ? soulGateResult?.model : "disabled",
            },
          });

          await logPhase("phase5.7-soul", { storyId: normalized.storyId }, {
            durationMs: Date.now() - phase57Start,
            verdict: soulGateResult?.verdict ?? "schema_only",
            overallScore: soulGateResult?.overallScore,
            minDimensionScore: soulGateResult?.minDimensionScore,
            blockingDimensions: soulGateResult?.blockingDimensions ?? [],
            generatorAttempts: soulGeneration.attempts,
            generatorFallbackUsed: soulGeneration.fallbackUsed,
            generatorModel: soulGeneration.model,
            gateModel: pipelineConfig.soulGateEnabled ? soulGateResult?.model : "disabled",
            rubricScores: (soulGateResult?.rubricScores ?? []).map((s) => ({
              dimension: s.dimension,
              score: s.score,
            })),
            premise: storySoul.premise,
            hookQuestion: storySoul.hookQuestion,
          });

          if (
            !gateSuccess
            && !pipelineConfig.soulAllowOnReject
          ) {
            throw new Error(
              `Story Soul gate rejected (${soulGateResult?.verdict ?? "schema_only"}): ${(soulGateResult?.repairInstruction ?? "Soul schema/rubric failed").slice(0, 240)}`,
            );
          }
        } catch (soulError) {
          const soulSoftFail = pipelineConfig.soulAllowOnReject;
          console.warn(
            soulSoftFail
              ? "[pipeline] ⚠️ Soul stage failed, falling back to pre-soul pipeline:"
              : "[pipeline] ⚠️ Soul stage failed, aborting in quality-first mode:",
            soulError,
          );
          storySoul = undefined;
          soulGateResult = undefined;
          phaseGates.push({
            phase: "phase5.7-soul",
            success: false,
            schemaValid: false,
            attempts: 0,
            issues: [{
              severity: "WARNING",
              code: "SOUL_STAGE_EXCEPTION",
              message: soulError instanceof Error ? soulError.message : String(soulError),
            }],
          });
          await logPhase("phase5.7-soul", { storyId: normalized.storyId }, {
            durationMs: Date.now() - phase57Start,
            error: soulError instanceof Error ? soulError.message : String(soulError),
            softFail: soulSoftFail,
          });
          if (!soulSoftFail) {
            throw soulError;
          }
        }
      }

      const activePromptVersion = resolvePromptVersionForRequest({
        requestedPromptVersion: normalized.rawConfig?.promptVersion,
        defaultPromptVersion: pipelineConfig.defaultPromptVersion,
        language: normalized.language,
        ageMax: normalized.ageMax,
        chapterCount: directives.length,
      });
      const phase6Start = Date.now();
      let storyDraft: StoryDraft = { title: "", description: "", chapters: [] };
      let blueprintV8: StoryBlueprintV8 | undefined;
      let releaseReport: PipelineRunResult["releaseReport"] | undefined;
      const releaseEnabled = (normalized.rawConfig as any)?.releaseMode !== false;
      const configuredCandidateCount = Number(pipelineConfig.releaseCandidateCount ?? 1);
      const explicitCandidateCount = Number((normalized.rawConfig as any)?.releaseCandidateCount);
      const hasExplicitCandidateCount = Number.isFinite(explicitCandidateCount);
      const userRequestsSingleCandidate = hasExplicitCandidateCount && Math.round(explicitCandidateCount) <= 1;
      const configuredDefaultSingleCandidate =
        !hasExplicitCandidateCount
        && Number.isFinite(configuredCandidateCount)
        && Math.round(configuredCandidateCount) <= 1;
      // Quality-first default: keep the baseline at more than one candidate,
      // then let selection + surgery choose the strongest draft.
      const defaultCandidateCount = Number.isFinite(configuredCandidateCount)
        ? Math.max(1, Math.min(3, Math.round(configuredCandidateCount)))
        : 2;
      const qualityFirstV8Lane =
        activePromptVersion === "v8"
        && normalized.language === "de"
        && normalized.ageMax <= 8
        && directives.length === 5;
      const implicitCandidateFloor = hasExplicitCandidateCount
        ? 1
        : configuredDefaultSingleCandidate
          ? 1
          : qualityFirstV8Lane
            ? 2
            : 1;
      const preliminaryCandidateCount = releaseEnabled
        ? Math.max(
            implicitCandidateFloor,
            Math.min(3, hasExplicitCandidateCount ? Math.round(explicitCandidateCount) : defaultCandidateCount),
          )
        : 1;
      // Soul-aware: bei approved Soul reicht 1 Kandidat (die Soul fixiert bereits
      // Premise/Hook/Fingerprints → Varianz zwischen Kandidaten ist kleiner als
      // der Surgery-Gain auf dem einzelnen Kandidaten).
      const soulApprovedForSingleCandidate =
        pipelineConfig.soulApprovedSingleCandidate
        && ((storySoul && !pipelineConfig.soulGateEnabled)
          || soulGateResult?.verdict === "approved"
          || soulGateResult?.verdict === "acceptable_with_warnings")
        && !Number.isFinite(explicitCandidateCount);
      const releaseCandidateCount = soulApprovedForSingleCandidate ? 1 : preliminaryCandidateCount;
      const adaptiveSecondCandidateRaw = (normalized.rawConfig as any)?.enableAdaptiveSecondCandidate;
      const enableAdaptiveSecondCandidate = typeof adaptiveSecondCandidateRaw === "boolean"
        ? adaptiveSecondCandidateRaw
        : Boolean(pipelineConfig.enableAdaptiveSecondCandidate)
          && qualityFirstV8Lane
          && releaseCandidateCount === 1
          && !userRequestsSingleCandidate;
      const adaptiveSecondCandidate =
        releaseEnabled &&
        !hasExplicitCandidateCount &&
        releaseCandidateCount === 1 &&
        enableAdaptiveSecondCandidate;
      const criticModel = resolveCriticModelForPipeline({
        selectedStoryModel: String((normalized.rawConfig as any)?.aiModel || ""),
        explicitCriticModel: String((normalized.rawConfig as any)?.criticModel || ""),
        defaultModel: String(pipelineConfig.criticModel || "gemini-3.1-flash-lite-preview"),
      });
      // Soul-aware: wenn Soul approved, senken wir die Surgery-Schwelle, damit
      // Critic-Ergebnisse im 7.2–8.2-Band noch repariert werden. Ohne Soul
      // bleibt die bisherige pass3TargetScore-Schwelle aktiv.
      const baseMinScore = clampNumber(Number(pipelineConfig.pass3TargetScore ?? 8.0), 5.5, 10);
      const soulAwareMinScore = clampNumber(Number(pipelineConfig.soulAwareCriticMinScore ?? baseMinScore), 5.5, 10);
      const criticMinScore = soulGateResult?.verdict === "approved" || soulGateResult?.verdict === "acceptable_with_warnings"
        ? Math.max(baseMinScore, soulAwareMinScore)
        : baseMinScore;
      const criticWarnFloor = clampNumber(Number(pipelineConfig.pass3WarnFloor ?? 6.5), 5, criticMinScore);
      // Selective surgery is chapter-local and much cheaper than full rewrites.
      // Use the configured default unless the request overrides it.
      const rawSurgeryEdits = (normalized.rawConfig as any)?.maxSelectiveSurgeryEdits;
      const explicitSurgeryEdits = Number(rawSurgeryEdits);
      const hasExplicitSurgeryOverride = rawSurgeryEdits !== undefined && rawSurgeryEdits !== null && rawSurgeryEdits !== "";
      const configuredSurgeryEdits = Number(pipelineConfig.maxSelectiveSurgeryEdits ?? 2);
      const implicitSurgeryEdits = Number.isFinite(configuredSurgeryEdits)
        ? Math.max(0, Math.min(5, Math.round(configuredSurgeryEdits)))
        : 2;
      // Old Railway configs can still contain maxSelectiveSurgeryEdits=0. Treat
      // that as stale config, not a production kill-switch; only an explicit
      // request override may disable surgery.
      const implicitSurgeryFloor = 1;
      const maxSelectiveSurgeryEdits = hasExplicitSurgeryOverride && Number.isFinite(explicitSurgeryEdits)
        ? Math.max(0, Math.min(5, explicitSurgeryEdits))
        : Math.max(implicitSurgeryFloor, implicitSurgeryEdits);
      const surgeryEnabled = releaseEnabled && maxSelectiveSurgeryEdits > 0;
      const humorLevel = typeof (normalized.rawConfig as any)?.humorLevel === "number"
        ? (normalized.rawConfig as any).humorLevel
        : 2;

      // ─── Fetch avatar memories for story continuity ─────────────────────
      // OPTIMIZED: Only 1 memory per avatar - keeps prompt small for reasoning models
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
            const compactMemories = rows
              .map(r => ({
                storyTitle: sanitizeMemoryTitleForPrompt(r.story_title || ""),
                experience: "",
                emotionalImpact: (r.emotional_impact as any) || 'neutral',
              }))
              .filter(memory => Boolean(memory.storyTitle));
            if (compactMemories.length > 0) {
              avatarMemories.set(avatar.id, compactMemories);
              console.log(`[pipeline] 🧠 Fetched ${compactMemories.length} memories for avatar ${avatar.name}`);
            }
          }
        }
      } catch (e) {
        console.warn("[pipeline] ⚠️ Could not fetch avatar memories (non-critical):", e);
      }

      const storedText = await loadStoryText(normalized.storyId);
      if (activePromptVersion === "v8" && storedText.length !== directives.length) {
        const phase58Start = Date.now();
        blueprintResultV8 = await generateValidatedV8Blueprint({
          normalizedRequest: normalized,
          cast: castSet,
          dna: blueprint.dna,
          directives,
          blueprintRetryMax: pipelineConfig.blueprintRetryMax,
          blueprintMode: pipelineConfig.blueprintMode,
          avatarMemories: avatarMemories.size > 0 ? avatarMemories : undefined,
          storySoul,
        });
        blueprintV8 = blueprintResultV8.blueprint;
        tokenUsage = mergeTokenUsage(tokenUsage, blueprintResultV8.usage);
        if (blueprintResultV8.costEntries?.length) {
          costEntries.push(...blueprintResultV8.costEntries);
        }

        const blueprintIssues = blueprintResultV8.issues.map((issue) => ({ ...issue }));
        const blueprintHasErrors = blueprintResultV8.issues.some((issue) => issue.severity === "ERROR");
        phaseGates.push({
          phase: "phase5.8-blueprint",
          success: !blueprintHasErrors,
          schemaValid: !blueprintHasErrors,
          attempts: blueprintResultV8.attempts,
          issues: blueprintIssues,
          artifactRef: {
            version: "v8",
            model: blueprintResultV8.model,
            fallbackUsed: blueprintResultV8.fallbackUsed,
          },
        });

        await logPhase("phase5.8-blueprint", { storyId: normalized.storyId }, {
          durationMs: Date.now() - phase58Start,
          promptVersion: activePromptVersion,
          model: blueprintResultV8.model,
          attempts: blueprintResultV8.attempts,
          fallbackUsed: blueprintResultV8.fallbackUsed,
          issueCount: blueprintResultV8.issues.length,
          issues: blueprintIssues,
          povCharacter: blueprintResultV8.blueprint?.pov_character,
          chapterCount: blueprintResultV8.blueprint?.chapters?.length || 0,
        });

        if (blueprintHasErrors) {
          validationReport = buildValidationReportPayload({
            phaseGates,
            qualityReport,
            imageIssues: [],
            blueprintResult: blueprintResultV8,
            criticReport,
          });
          await saveValidationReport(normalized.storyId, validationReport);
          throw new Error(`V8 blueprint validation failed: ${blueprintResultV8.issues.map((issue) => issue.code).join(", ")}`);
        }

        // Sprint 5 (S5.2): inject iconic_motif into per-chapter imageMustShow.
        // Image-director consumes directive.imageMustShow when assembling
        // propsVisible — this threads the recurring object through every
        // chapter image, matching the text's narrative motif.
        const iconicMotif = (blueprintV8 as any)?.iconic_motif as
          | { object?: string; per_chapter_position?: string[] }
          | undefined;
        if (iconicMotif?.object) {
          const motifTokenLower = iconicMotif.object.toLowerCase().slice(0, 12);
          let motifInjected = false;
          directives = directives.map((directive, idx) => {
            const positions = iconicMotif.per_chapter_position || [];
            const positionHint = positions[idx];
            const motifWithContext = positionHint
              ? `${iconicMotif.object} (${positionHint})`
              : (iconicMotif.object as string);
            const existing = directive.imageMustShow || [];
            if (existing.some(p => p.toLowerCase().includes(motifTokenLower))) {
              return directive;
            }
            motifInjected = true;
            return { ...directive, imageMustShow: [...existing, motifWithContext] };
          });
          if (motifInjected) {
            await saveSceneDirectives(normalized.storyId, directives);
          }
        }
      }

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
          storySoul,
          concreteAnchors: (blueprintV8 as any)?.concrete_anchors as Record<string, string> | undefined,
          endingPattern: (blueprintV8 as any)?.ending_pattern as string | undefined,
          refrainLine: (blueprintV8 as any)?.refrain_line as string | undefined,
          antagonistName: (blueprintV8 as any)?.antagonist_dna?.name as string | undefined,
          iconicMotif: (blueprintV8 as any)?.iconic_motif as { object: string; per_chapter_position?: ReadonlyArray<string> } | undefined,
        });
        qualityReport = toQualitySummary(cachedQuality, 0);
        criticReport = await runSemanticCritic({
          storyId: normalized.storyId,
          draft: storyDraft,
          directives,
          cast: castSet,
          blueprint: blueprintV8,
          language: normalized.language,
          ageRange: { min: normalized.ageMin, max: normalized.ageMax },
          humorLevel,
          model: criticModel,
          targetMinScore: criticMinScore,
          warnFloor: criticWarnFloor,
        });
        await logPass3Phase({
          storyId: normalized.storyId,
          criticReport,
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
        const storyWriterRequest = withPipelineStoryCostControls(normalized, pipelineConfig);
        for (let candidateIdx = 0; candidateIdx < targetCandidateCount; candidateIdx += 1) {
          const candidateSeed = (variantSeed + candidateIdx * 7919) >>> 0;
          const candidateTag = `cand-${candidateIdx + 1}`;
          const writeResult = await this.storyWriter.writeStory({
            normalizedRequest: storyWriterRequest,
            cast: castSet,
            dna: blueprint.dna,
            directives,
            promptVersion: activePromptVersion,
            blueprintV8,
            stylePackText,
            fusionSections,
            avatarMemories: avatarMemories.size > 0 ? avatarMemories : undefined,
            generationSeed: candidateSeed,
            candidateTag,
            storySoul,
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
              storySoul,
              concreteAnchors: (blueprintV8 as any)?.concrete_anchors as Record<string, string> | undefined,
              endingPattern: (blueprintV8 as any)?.ending_pattern as string | undefined,
              refrainLine: (blueprintV8 as any)?.refrain_line as string | undefined,
              antagonistName: (blueprintV8 as any)?.antagonist_dna?.name as string | undefined,
              iconicMotif: (blueprintV8 as any)?.iconic_motif as { object: string; per_chapter_position?: ReadonlyArray<string> } | undefined,
            }),
            0,
          );

          let candidateUsage = writeResult.usage;
          if (writeResult.costEntries?.length) {
            costEntries.push(...writeResult.costEntries);
          }

          // Sprint 4 (S4.5): cheap nano-tier tightening pass. Runs ONLY on chapters
          // where the AGE_FIT_SENTENCE_LENGTH gate flagged ERROR. Splits long
          // sentences, removes subjunctives, caps clauses — without touching plot,
          // dialogue, or refrain/iconic-motif. ~$0.001-0.003 per pass and replaces
          // a large chunk of more expensive hard-rewrite surgery work.
          const ageMaxForTightening = normalized.ageMax ?? 99;
          const candidateIssuesForTightening =
            ((candidateQuality as any)?.issues as Array<{ gate: string; chapter: number; severity: string; code: string }> | undefined) ?? [];
          const tighteningTargets = limitChapterSet(
            pickChaptersNeedingTightening(candidateIssuesForTightening),
            pipelineConfig.maxSentenceTighteningChapters,
          );
          if (ageMaxForTightening <= 8 && tighteningTargets.size > 0) {
            try {
              const tightening = await applySentenceTightening({
                storyId: normalized.storyId,
                language: normalized.language,
                ageMax: ageMaxForTightening,
                draft: candidateDraft,
                chaptersNeedingTightening: tighteningTargets,
                model: resolveSupportTaskModel(String(normalized.rawConfig?.aiModel || "")),
              });
              if (tightening.changed) {
                candidateDraft = tightening.draft;
                if (tightening.usage) {
                  candidateUsage = mergeTokenUsage(candidateUsage, tightening.usage);
                }
                if (tightening.costEntries?.length) {
                  costEntries.push(...tightening.costEntries);
                }
                // Re-run gates so downstream surgery/critic see the tightened state.
                candidateQuality = toQualitySummary(
                  runQualityGates({
                    draft: candidateDraft,
                    directives,
                    cast: castSet,
                    language: normalized.language,
                    ageRange: { min: normalized.ageMin, max: normalized.ageMax },
                    wordBudget: normalized.wordBudget,
                    artifactArc: canonFusionPlan.artifactArc,
                    humorLevel,
                    storySoul,
                    concreteAnchors: (blueprintV8 as any)?.concrete_anchors as Record<string, string> | undefined,
                    endingPattern: (blueprintV8 as any)?.ending_pattern as string | undefined,
                    refrainLine: (blueprintV8 as any)?.refrain_line as string | undefined,
                    antagonistName: (blueprintV8 as any)?.antagonist_dna?.name as string | undefined,
                    iconicMotif: (blueprintV8 as any)?.iconic_motif as { object: string; per_chapter_position?: ReadonlyArray<string> } | undefined,
                  }),
                  candidateQuality?.rewriteAttempts ?? 0,
                );
              }
            } catch (tighteningErr) {
              console.warn(
                "[orchestrator] sentence-tightening pass failed, continuing with original draft:",
                (tighteningErr as Error)?.message || tighteningErr,
              );
            }
          }

          let candidateCritic: SemanticCriticReport;
          if (shouldSkipSemanticCritic(candidateQuality)) {
            candidateCritic = buildSkippedCriticReport(criticModel);
            await logPass3Phase({
              storyId: normalized.storyId,
              candidate: candidateIdx + 1,
              criticReport: candidateCritic,
            });
          } else {
            candidateCritic = await runSemanticCritic({
              storyId: normalized.storyId,
              draft: candidateDraft,
              directives,
              cast: castSet,
              blueprint: blueprintV8,
              language: normalized.language,
              ageRange: { min: normalized.ageMin, max: normalized.ageMax },
              humorLevel,
              model: criticModel,
              targetMinScore: criticMinScore,
              warnFloor: criticWarnFloor,
            });
            await logPass3Phase({
              storyId: normalized.storyId,
              candidate: candidateIdx + 1,
              criticReport: candidateCritic,
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
          const qualityPatchTasks = derivePatchTasksFromQualityGates({
            quality: candidateQuality,
            cast: castSet,
            directives,
            blueprint: blueprintV8,
            storySoul,
            chapterCount: normalized.chapterCount,
          });
          const patchTasks = mergePatchTasks(candidateCritic.patchTasks, qualityPatchTasks);
          const hasLocalPatchTask = patchTasks.some(task => task.chapter > 0);
          const surgeryEligibleVerdict = candidateCritic.verdict === "publish" || candidateCritic.verdict === "acceptable";
          const preciseLocalRescue =
            hasLocalPatchTask
            && patchTasks.length <= 3
            && patchTasks.every(task => task.chapter > 0 && task.priority <= 2);
          const criticalLocalRepair = qualityPatchTasks.some(task => task.priority === 1);
          // Cheap rescue mode: allow surgery for clearly salvageable near-release drafts,
          // especially when the critic sees a publishable core or gives a small set of precise local fixes.
          const nearReleaseBand =
            surgeryEligibleVerdict
            || preciseLocalRescue
            || criticalLocalRepair
            || candidateCritic.overallScore >= Math.max(6.0, criticWarnFloor - 0.5);
          const rescueableQualityBand =
            qualityErrors <= 6
            || preciseLocalRescue
            || criticalLocalRepair
            || candidateCritic.overallScore >= Math.max(6.3, criticWarnFloor - 0.2);
          const candidateSurgeryEdits = maxSelectiveSurgeryEdits;
          // Sprint 2 (QW3): determine chapters that need HARD REWRITE rather than
          // patch-only surgery. Trigger conditions (OR):
          //   - critic rubric age_appropriateness < 6
          //   - critic rubric readability < 6
          //   - quality gate AGE_FIT_SENTENCE_LENGTH fired ERROR on this chapter
          // When any condition is true, all chapters with AGE_FIT/readability issues
          // are rewritten with the aggressive-restructure prompt. Root cause (logs
          // 2026-04-23): surgery patched only the English fragment, left Metaphor-fog.
          const ageFitLow =
            (candidateCritic.rubricScores?.age_appropriateness?.score ?? 10) < 6
            || (candidateCritic.rubricScores?.readability?.score ?? 10) < 6;
          const hardRewriteChapters = new Set<number>();
          if (ageFitLow) {
            const candidateIssues = (candidateQuality as any)?.issues as Array<{ gate: string; chapter: number; severity: string }> | undefined;
            if (Array.isArray(candidateIssues)) {
              for (const issue of candidateIssues) {
                if (
                  issue.severity === "ERROR"
                  && (issue.gate === "AGE_FIT_SENTENCE_LENGTH"
                    || issue.gate === "READABILITY_COMPLEXITY"
                    || issue.gate === "LAST_SENTENCE_PIPELINE_ARTIFACT")
                  && issue.chapter > 0
                ) {
                  hardRewriteChapters.add(issue.chapter);
                }
              }
            }
            // Fallback: if rubric is low but no specific chapter issues, rewrite
            // all chapters that currently have local patch tasks.
            if (hardRewriteChapters.size === 0) {
              for (const task of patchTasks) {
                if (task.chapter > 0) hardRewriteChapters.add(task.chapter);
              }
            }
          }

          if (
            surgeryEnabled
            && (patchTasks.length > 0 || hardRewriteChapters.size > 0)
            && (hasLocalPatchTask || hardRewriteChapters.size > 0)
            && nearReleaseBand
            && rescueableQualityBand
            && (!candidateCritic.releaseReady || qualityErrors > 0)
          ) {
            const preSurgeryDraft = candidateDraft;
            const surgery = await applySelectiveSurgery({
              storyId: normalized.storyId,
              normalizedRequest: normalized,
              cast: castSet,
              dna: blueprint.dna,
              directives,
              draft: candidateDraft,
              patchTasks,
              stylePackText,
              maxEdits: candidateSurgeryEdits,
              model: resolveSurgeryModelForPipeline(normalized.rawConfig?.aiModel),
              candidateTag,
              hardRewriteChapters,
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
                  storySoul,
                  concreteAnchors: (blueprintV8 as any)?.concrete_anchors as Record<string, string> | undefined,
                  endingPattern: (blueprintV8 as any)?.ending_pattern as string | undefined,
                }),
                candidateQuality?.rewriteAttempts ?? 0,
              );
              const preScore = scoreReleaseCandidate(candidateQuality, candidateCritic, releaseEnabled);
              let postScore = scoreReleaseCandidate(postSurgeryQuality, candidateCritic, releaseEnabled);
              let postSurgeryCritic = candidateCritic;

              if (pipelineConfig.enablePostSurgeryCritic) {
                postSurgeryCritic = await runSemanticCritic({
                  storyId: normalized.storyId,
                  draft: candidateDraft,
                  directives,
                  cast: castSet,
                  blueprint: blueprintV8,
                  language: normalized.language,
                  ageRange: { min: normalized.ageMin, max: normalized.ageMax },
                  humorLevel,
                  model: criticModel,
                  targetMinScore: criticMinScore,
                  warnFloor: criticWarnFloor,
                });
                await logPass3Phase({
                  storyId: normalized.storyId,
                  candidate: candidateIdx + 1,
                  suffix: "post-surgery",
                  criticReport: postSurgeryCritic,
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
                postScore = scoreReleaseCandidate(postSurgeryQuality, postSurgeryCritic, releaseEnabled);
              }

              if (postScore >= preScore) {
                candidateQuality = postSurgeryQuality;
                candidateCritic = postSurgeryCritic;
              } else {
                candidateDraft = preSurgeryDraft;
                surgeryApplied = false;
                editedChapters = [];
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
            criticVerdict: candidateCritic?.verdict,
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
            // Sprint 2 (QW5): honest candidate-fallback. Root cause (logs 2026-04-23):
            // previous gates of "goodEnough at 7.3" accepted mediocre first drafts and
            // never spawned a second candidate, so Surgery had to carry all the load
            // alone. Policy now: score < 7.5 ⇒ always try a second candidate, provided
            // the first is in the rescueable band (≥ 6.0) — otherwise giving up is
            // cheaper than burning a second run on a hopeless draft.
            const HONEST_FALLBACK_FLOOR = 7.5;
            const firstCandidateStrong =
              candidateCritic.releaseReady &&
              candidateCritic.overallScore >= Math.max(HONEST_FALLBACK_FLOOR, criticMinScore) &&
              candidateErrors === 0;
            if (firstCandidateStrong) {
              break;
            }
            // Second candidate WORTH IT band: weak-but-readable drafts with a real
            // chance to beat the first attempt. This is cheaper than pushing a
            // known failing candidate into images/TTS, but avoids endless retries.
            const firstCandidateRetryWorthIt =
              candidateCritic.overallScore >= 5.8
              && candidateCritic.overallScore < Math.max(HONEST_FALLBACK_FLOOR, criticMinScore)
              && candidateErrors <= 10;
            if (!firstCandidateRetryWorthIt) {
              break;
            }
            console.log(
              `[orchestrator] QW5 honest-fallback: first candidate score=${candidateCritic.overallScore.toFixed(2)} errors=${candidateErrors} → spawning second candidate.`,
            );
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
            criticVerdict: c.critic?.verdict,
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
          criticVerdict: criticReport?.verdict,
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

      const strictQualityGatesRaw = (normalized.rawConfig as any)?.strictQualityGates;
      // Sprint 4 (S4.1): default strict-mode ON for ages ≤ 8. Children-book quality
      // requires hard enforcement of AGE_FIT/length/dialogue gates — accepting "7
      // non-critical issues" as we did before drops sub-7 stories into production.
      // Adults / older readers can still opt out via explicit false.
      const ageMaxForStrict = normalized.ageMax ?? 99;
      const strictQualityGates = typeof strictQualityGatesRaw === "boolean"
        ? strictQualityGatesRaw
        : ageMaxForStrict <= 8;
      const strictReleaseGateModeRaw = (normalized.rawConfig as any)?.strictReleaseGateMode
        ?? pipelineConfig.strictReleaseGateMode;
      const strictReleaseGateMode = strictReleaseGateModeRaw === "block" ? "block" : "warn";
      if (
        qualityReport?.issues?.some((i: any) => (
          i.code === "MISSING_EXPLICIT_STAKES"
          || i.code === "CH1_ABSTRACT_STAKES_BEFORE_CONTEXT"
          || i.code === "CH1_MISSION_UNCLEAR"
          || i.code === "CH1_GENERIC_CLUE_ENGINE"
          || i.code === "CH1_ARTIFACT_RULE_UNCLEAR"
        ))
      ) {
        const repairedStakes = applyExplicitStakesRepair(storyDraft, {
          language: normalized.language,
          blueprint: blueprintV8,
          storySoul,
          cast: castSet,
        });
        if (repairedStakes) {
          qualityReport = toQualitySummary(
            runQualityGates({
              draft: storyDraft,
              directives,
              cast: castSet,
              language: normalized.language,
              ageRange: { min: normalized.ageMin, max: normalized.ageMax },
              wordBudget: normalized.wordBudget,
              artifactArc: canonFusionPlan.artifactArc,
              humorLevel,
              storySoul,
              concreteAnchors: (blueprintV8 as any)?.concrete_anchors as Record<string, string> | undefined,
              endingPattern: (blueprintV8 as any)?.ending_pattern as string | undefined,
              refrainLine: (blueprintV8 as any)?.refrain_line as string | undefined,
              antagonistName: (blueprintV8 as any)?.antagonist_dna?.name as string | undefined,
              iconicMotif: (blueprintV8 as any)?.iconic_motif as { object: string; per_chapter_position?: ReadonlyArray<string> } | undefined,
            }),
            qualityReport?.rewriteAttempts ?? 0,
          );
          await saveStoryText(normalized.storyId, storyDraft.chapters.map(ch => ({
            chapter: ch.chapter,
            title: ch.title?.trim() || undefined,
            text: ch.text,
          })));
          await logPhase("phase6-story-local-repair", { storyId: normalized.storyId }, {
            code: "MISSING_EXPLICIT_STAKES",
            repaired: true,
            remainingIssues: qualityReport?.issues?.map((i: any) => i.code),
          });

          if (pipelineConfig.enablePostLocalRepairCritic && releaseEnabled && criticReport && !isCriticSkipped(criticReport)) {
            const repairedCritic = await runSemanticCritic({
              storyId: normalized.storyId,
              draft: storyDraft,
              directives,
              cast: castSet,
              blueprint: blueprintV8,
              language: normalized.language,
              ageRange: { min: normalized.ageMin, max: normalized.ageMax },
              humorLevel,
              model: criticModel,
              targetMinScore: criticMinScore,
              warnFloor: criticWarnFloor,
            });
            await logPass3Phase({
              storyId: normalized.storyId,
              suffix: "post-local-repair",
              criticReport: repairedCritic,
            });
            tokenUsage = mergeTokenUsage(tokenUsage, repairedCritic.usage);
            if (repairedCritic.usage) {
              const criticCost = buildLlmCostEntry({
                phase: "phase6-story",
                step: "critic-post-local-repair",
                usage: repairedCritic.usage,
                fallbackModel: criticModel,
              });
              if (criticCost) costEntries.push(criticCost);
            }
            criticReport = repairedCritic;
          }
        }
      }
      const storyErrors = [...(qualityReport?.issues?.filter((i: any) => i.severity === "ERROR") ?? [])];

      // Critic floor: mark weak drafts clearly in validation metadata. The stable
      // user-facing path still returns a generated story unless safety/content fails.
      const criticActive = releaseEnabled && criticReport && !isCriticSkipped(criticReport);
      const criticHardBlock = criticActive && (
        criticReport.verdict === "reject"
        || (criticReport.verdict === "revision_needed" && criticReport.overallScore < criticWarnFloor)
      );
      if (criticHardBlock) {
        storyErrors.push({
          gate: "SEMANTIC_CRITIC",
          chapter: 0,
          code: "CRITIC_HARD_FLOOR",
          message: `Critic ${criticReport.verdict} below hard floor (${criticReport.overallScore.toFixed(2)}<${criticWarnFloor.toFixed(2)})`,
          severity: "ERROR",
        });
      } else if (
        releaseEnabled
        && strictQualityGates
        && criticReport
        && !isCriticSkipped(criticReport)
        && (criticReport.verdict === "revision_needed" || criticReport.verdict === "reject")
      ) {
        storyErrors.push({
          gate: "SEMANTIC_CRITIC",
          chapter: 0,
          code: "CRITIC_VERDICT_BELOW_RELEASE",
          message: `Critic verdict ${criticReport.verdict} below release bar (${criticReport.overallScore.toFixed(2)}/${criticMinScore.toFixed(2)})`,
          severity: "ERROR",
        });
      }
      if (
        releaseEnabled
        && strictQualityGates
        && criticReport
        && !isCriticSkipped(criticReport)
        && criticReport.overallScore < criticMinScore
      ) {
        storyErrors.push({
          gate: "SEMANTIC_CRITIC",
          chapter: 0,
          code: "CRITIC_SCORE_BELOW_RELEASE",
          message: `Critic score below release bar (${criticReport.overallScore.toFixed(2)}<${criticMinScore.toFixed(2)})`,
          severity: "ERROR",
        });
      }

      // Always-blocking errors: instruction leaks/placeholders/language leaks.
      // DUPLICATE_SENTENCE and CRITIC_HARD_FLOOR are NOT unconditional blockers —
      // they move to strictReleaseCodes so default-mode stories still get delivered.
      const hardSafetyCodes = new Set([
        "INSTRUCTION_LEAK",
        "ENGLISH_LEAK",
        "FILTER_PLACEHOLDER",
        "CHAPTER_PLACEHOLDER",
        "META_LABEL_PHRASE",
        "META_NARRATION",
      ]);

      // Strict release gates are quality signals for ages <= 8. They must not make
      // the user-facing generation path flaky; only safety/content failures abort.
      const strictReleaseCodes = new Set([
        "DUPLICATE_SENTENCE",
        "CRITIC_HARD_FLOOR",
        "MISSING_CHARACTER",
        "TOTAL_TOO_SHORT",
        "CHAPTER_TOO_SHORT_HARD",
        "VOICE_INDISTINCT",
        "VOICE_TAG_FORMULA_OVERUSE",
        "MISSING_EXPLICIT_STAKES",
        "CH1_ABSTRACT_STAKES_BEFORE_CONTEXT",
        "CH1_GENERIC_CLUE_ENGINE",
        "CH1_MISSION_UNCLEAR",
        "CH1_ARTIFACT_RULE_UNCLEAR",
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
        "CRITIC_VERDICT_BELOW_RELEASE",
        "CRITIC_SCORE_BELOW_RELEASE",
        // Sprint 4 (S4.1): age-fit hard gates. Logs of "Angstbannstab" 2026-04-27
        // showed all three firing simultaneously but story was published anyway.
        "AVG_SENTENCE_TOO_LONG_HARD",
        "SENTENCE_HARD_CAP_EXCEEDED",
        "COMPLEX_CLAUSE_OVERUSE",
        // Sprint 4 (S4.2/S4.3): refrain + antagonist showdown enforcement
        "REFRAIN_MISSING",
        "REFRAIN_ENDING_MISSING",
        "ANTAGONIST_TOO_FEW_APPEARANCES",
        "ANTAGONIST_NO_SHOWDOWN",
        // Sprint 5 (S5.2): iconic motif must thread through chapters
        "ICONIC_MOTIF_SPARSE",
      ]);
      const releaseQualityBlocks = strictQualityGates && strictReleaseGateMode === "block";
      const blockingCodes = new Set([
        ...hardSafetyCodes,
        ...(releaseQualityBlocks ? strictReleaseCodes : []),
      ]);
      const blockingErrors = storyErrors.filter((i: any) => blockingCodes.has(i.code));
      const strictReleaseErrors = strictQualityGates
        ? storyErrors.filter((i: any) => strictReleaseCodes.has(i.code))
        : [];
      const hasContent = storyDraft.chapters.some(ch => ch.text && ch.text.trim().length > 50);
      const storyGate = {
        phase: "phase6-story",
        success: storyErrors.length === 0,
        schemaValid: blockingErrors.length === 0,
        attempts: (qualityReport?.rewriteAttempts ?? 0) + 1,
        issues: storyErrors.map((issue: any) => ({ ...issue })),
      };
      phaseGates.push(storyGate);
      if (strictReleaseErrors.length > 0 && hasContent) {
        validationReport = buildValidationReportPayload({
          phaseGates,
          qualityReport,
          imageIssues: [],
          blueprintResult: blueprintResultV8,
          criticReport,
        });
        await saveValidationReport(normalized.storyId, validationReport);
        await logPhase(
          releaseQualityBlocks ? "phase6-story-strict-quality-blocked" : "phase6-story-strict-quality-warning",
          { storyId: normalized.storyId },
          {
            strictQualityGates,
            strictReleaseGateMode,
            releaseCodes: strictReleaseErrors.map((issue: any) => issue.code),
            safetyBlockingCodes: blockingErrors.map((issue: any) => issue.code),
            reason: releaseQualityBlocks
              ? "generated_story_below_release_bar"
              : "generated_story_below_release_bar_but_content_available",
          },
        );
      }
      if (blockingErrors.length > 0 || !hasContent) {
        validationReport = buildValidationReportPayload({
          phaseGates,
          qualityReport,
          imageIssues: [],
          blueprintResult: blueprintResultV8,
          criticReport,
        });
        await saveValidationReport(normalized.storyId, validationReport);
        throw new Error(`Story quality gates failed: ${(blockingErrors.length > 0 ? blockingErrors : storyErrors).map((i: any) => i.code).join(", ")}`);
      }
      if (storyErrors.length > 0) {
        console.warn(`[pipeline] Story accepted with ${storyErrors.length} non-critical quality issues (strictQualityGates=${strictQualityGates}): ${storyErrors.map((i: any) => i.code).join(", ")}`);
      }

      // ─── Phase 6.5: AI Scene Description Generator ───────────────────
      const phase65Start = Date.now();
      let aiSceneDescriptions: (AISceneDescription | null)[] = [];
      const aiScenePromptOverride = (normalized.rawConfig as any)?.aiScenePromptEnabled
        ?? (normalized.rawConfig as any)?.useAiScenePrompts;
      const aiScenePromptEnabled = typeof aiScenePromptOverride === "boolean"
        ? aiScenePromptOverride
        : Boolean(pipelineConfig.aiScenePromptEnabled);
      try {
        if (aiScenePromptEnabled) {
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
        }
        const successCount = aiSceneDescriptions.filter(Boolean).length;
        await logPhase("phase6.5-scene-prompts", { storyId: normalized.storyId }, {
          durationMs: Date.now() - phase65Start,
          totalChapters: storyDraft.chapters.length,
          aiGenerated: successCount,
          fallbackToTemplate: storyDraft.chapters.length - successCount,
          aiScenePromptEnabled,
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
        validationReport = buildValidationReportPayload({
          phaseGates,
          qualityReport,
          imageIssues,
          blueprintResult: blueprintResultV8,
          criticReport,
        });
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

      validationReport = buildValidationReportPayload({
        phaseGates,
        qualityReport,
        imageIssues: [],
        blueprintResult: blueprintResultV8,
        criticReport,
      });
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
      const report = validationReport ?? {
        ...buildValidationReportPayload({
          phaseGates,
          qualityReport,
          imageIssues: [],
          blueprintResult: blueprintResultV8,
          criticReport,
        }),
        error: { message },
      };
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

function buildValidationReportPayload(input: {
  phaseGates: Array<{ phase: string; success: boolean; schemaValid?: boolean; issues?: any[]; attempts?: number; artifactRef?: any }>;
  qualityReport?: any;
  imageIssues: any[];
  blueprintResult?: BlueprintGenerationResult;
  criticReport?: SemanticCriticReport;
}): any {
  return {
    gates: input.phaseGates,
    story: input.qualityReport,
    images: input.imageIssues,
    blueprint: buildBlueprintValidationPayload(input.blueprintResult),
    pass3: buildPass3ValidationPayload(input.criticReport),
  };
}

function buildBlueprintValidationPayload(result?: BlueprintGenerationResult): any | undefined {
  if (!result) return undefined;
  return {
    version: "v8",
    model: result.model,
    attempts: result.attempts,
    fallbackUsed: result.fallbackUsed,
    issues: result.issues,
    blueprint: result.blueprint,
  };
}

function buildPass3ValidationPayload(report?: SemanticCriticReport): any | undefined {
  if (!report || isCriticSkipped(report)) return undefined;
  return {
    overallScore: report.overallScore,
    verdict: report.verdict,
    rubricScores: report.rubricScores,
    revisionHints: report.revisionHints,
  };
}

async function logPass3Phase(input: {
  storyId: string;
  candidate?: number;
  suffix?: string;
  criticReport: SemanticCriticReport;
}): Promise<void> {
  await logPhase("phase6-pass3", { storyId: input.storyId, candidate: input.candidate }, {
    suffix: input.suffix,
    overallScore: input.criticReport.overallScore,
    verdict: input.criticReport.verdict,
    releaseReady: input.criticReport.releaseReady,
    summary: input.criticReport.summary,
    rubricScores: input.criticReport.rubricScores,
    criticalFailures: input.criticReport.criticalFailures,
    revisionHints: input.criticReport.revisionHints,
    skipped: isCriticSkipped(input.criticReport),
  });
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

function applyExplicitStakesRepair(
  draft: StoryDraft,
  input: {
    language: string;
    blueprint?: StoryBlueprintV8;
    storySoul?: StorySoul;
    cast?: CastSet;
  },
): boolean {
  const firstChapter = draft.chapters.find(chapter => chapter.chapter === 1) || draft.chapters[0];
  if (!firstChapter?.text) return false;

  const orientation = buildConcreteChapter1Orientation(input);
  if (!orientation) return false;

  const cleanedOriginal = removeGenericAbstractOpening(firstChapter.text, input.language).trim();
  if (cleanedOriginal.toLowerCase().startsWith(orientation.toLowerCase().slice(0, 80))) return false;

  firstChapter.text = `${orientation}\n\n${cleanedOriginal}`;
  if (!draft.description || draft.description.trim().length < 20) {
    draft.description = firstChapter.text.slice(0, 180);
  }
  return true;
}

function buildConcreteChapter1Orientation(input: {
  language: string;
  blueprint?: StoryBlueprintV8;
  storySoul?: StorySoul;
  cast?: CastSet;
}): string {
  const isGerman = input.language === "de";
  const blueprintContract = (input.blueprint as any)?.reader_contract || {};
  const soulContract = (input.storySoul as any)?.readerContract || {};
  const childNames = input.cast
    ? input.cast.avatars.map(a => a.displayName).filter(Boolean)
    : [];
  const lead = childNames[0] || (isGerman ? "das Kind" : "the child");
  const companion = childNames.find(name => name !== lead) || childNames[1] || (isGerman ? "sein Begleiter" : "their friend");
  const artifactName = input.cast?.artifact?.name || (isGerman ? "das besondere Fundstück" : "the special object");

  const normalWorld = meaningfulText(
    blueprintContract.normal_world,
    soulContract.normalWorld,
    isGerman
      ? `${lead} und ${companion} standen an einem vertrauten Ort, bevor das Problem begann.`
      : `${lead} and ${companion} stood in a familiar place before the problem began.`,
  );
  const mission = sanitizeConcreteMission(meaningfulText(
    blueprintContract.mission_in_child_words,
    soulContract.missionInChildWords,
    isGerman
      ? `${lead} und ${companion} mussten ${artifactName} rechtzeitig an den richtigen Platz bringen.`
      : `${lead} and ${companion} had to bring ${artifactName} to the right place in time.`,
  ), { isGerman, lead, companion, artifactName });
  const why = meaningfulText(
    blueprintContract.why_it_matters,
    soulContract.whyItMattersNow,
    isGerman
      ? "Sonst blieb heute ein wichtiger Platz leer und jemand wurde enttäuscht."
      : "Otherwise an important place would stay empty today and someone would be disappointed.",
  );
  const rule = meaningfulText(
    blueprintContract.special_rule,
    soulContract.magicOrArtifactRule,
    input.cast?.artifact?.storyUseRule
      ? `${artifactName} ${input.cast.artifact.storyUseRule}; ${isGerman ? "entscheiden mussten die Kinder selbst." : "the children still had to decide themselves."}`
      : isGerman
        ? `${artifactName} zeigte nur, was anders war; lösen mussten ${lead} und ${companion} es selbst.`
        : `${artifactName} only showed what was different; ${lead} and ${companion} had to solve it themselves.`,
  );

  return [normalWorld, mission, why, rule]
    .map(ensureSentence)
    .filter(Boolean)
    .join(" ");
}

function meaningfulText(...values: Array<unknown>): string {
  for (const value of values) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (text.length >= 8) return text;
  }
  return "";
}

function sanitizeConcreteMission(
  mission: string,
  input: { isGerman: boolean; lead: string; companion: string; artifactName: string },
): string {
  const lower = mission.toLowerCase();
  const clueOnly = /\b(naechsten|nächsten|ersten|letzten)?\s*(hinweis|spur|zeichen|weg)\s*(finden|folgen|erreichen|lesen|suchen)\b/.test(lower)
    || /\b(next|first|last)?\s*(clue|trail|sign|path)\s*(find|follow|reach|read|search)\b/.test(lower);
  const concreteTask = /\b(bringen|retten|reparieren|zurueckbringen|zurückbringen|zurueckgeben|zurückgeben|befreien|beschuetzen|beschützen|oeffnen|öffnen|schliessen|schließen|aufhalten|holen|abgeben|ersetzen|bauen|bring|save|fix|return|protect|open|close|stop|deliver)\b/.test(lower);
  if (!clueOnly || concreteTask) return mission;
  return input.isGerman
    ? `${input.lead} und ${input.companion} mussten ${input.artifactName} rechtzeitig an den richtigen Platz bringen.`
    : `${input.lead} and ${input.companion} had to bring ${input.artifactName} to the right place in time.`;
}

function ensureSentence(text: string): string {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function removeGenericAbstractOpening(text: string, language: string): string {
  const isGerman = language === "de";
  const pattern = isGerman
    ? /^\s*Wenn die Kinder den wichtigen Hinweis verlieren,\s*bleibt der Weg zum Ziel verschlossen\.\s*/i
    : /^\s*If the children do not protect the clue,\s*they lose the path to the goal\.\s*/i;
  return String(text || "").replace(pattern, "");
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
    rubricScores: {
      character_voice: { score: 0, reasoning: "" },
      scenic_presence: { score: 0, reasoning: "" },
      tension_arc: { score: 0, reasoning: "" },
      humor: { score: 0, reasoning: "" },
      age_appropriateness: { score: 0, reasoning: "" },
      chapter_coherence: { score: 0, reasoning: "" },
      readability: { score: 0, reasoning: "" },
      emotional_arc: { score: 0, reasoning: "" },
      iconic_scene: { score: 0, reasoning: "" },
      chapter5_quality: { score: 0, reasoning: "" },
      concrete_anchor_density: { score: 0, reasoning: "" },
      antagonist_motivation_clarity: { score: 0, reasoning: "" },
      reader_orientation: { score: 0, reasoning: "" },
      artifact_rule_clarity: { score: 0, reasoning: "" },
    },
    verdict: "reject",
    releaseReady: false,
    summary: "Semantic critic skipped for severely broken draft (cost guard).",
    issues: [],
    patchTasks: [],
    criticalFailures: [],
    strengths: [],
    revisionHints: [],
  };
}

function mergePatchTasks(
  criticTasks: SemanticCriticPatchTask[],
  qualityTasks: SemanticCriticPatchTask[],
): SemanticCriticPatchTask[] {
  const seen = new Set<string>();
  const merged: SemanticCriticPatchTask[] = [];
  for (const task of [...qualityTasks, ...criticTasks]) {
    if (!task || task.chapter <= 0) continue;
    const key = `${task.chapter}:${task.objective.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(task);
  }
  return merged
    .sort((a, b) => a.priority - b.priority || a.chapter - b.chapter)
    .slice(0, 5);
}

function derivePatchTasksFromQualityGates(input: {
  quality: any;
  cast: CastSet;
  directives: SceneDirective[];
  blueprint?: StoryBlueprintV8;
  storySoul?: StorySoul;
  chapterCount: number;
}): SemanticCriticPatchTask[] {
  const issues = Array.isArray(input.quality?.issues) ? input.quality.issues : [];
  const failedGates = new Set((Array.isArray(input.quality?.failedGates) ? input.quality.failedGates : []).map(String));
  const tasks: SemanticCriticPatchTask[] = [];
  const artifactName = input.cast.artifact?.name?.trim() || "the artifact";
  const artifactRule = input.cast.artifact?.storyUseRule?.trim()
    || input.storySoul?.readerContract?.magicOrArtifactRule
    || "it points at the truth but never solves the choice for the children";
  const finalChapter = Math.max(1, input.chapterCount || input.directives.length || 5);
  const antagonistName = String((input.blueprint as any)?.antagonist_dna?.name || findAntagonistName(input.cast) || "").trim();

  const addTask = (
    chapter: number,
    priority: 1 | 2 | 3,
    objective: string,
    instruction: string,
  ) => {
    const normalizedChapter = Math.max(1, Math.min(finalChapter, Math.round(Number(chapter) || 1)));
    tasks.push({
      chapter: normalizedChapter,
      priority,
      objective,
      instruction,
    });
  };

  const addArtifactArcTasks = () => {
    addTask(
      1,
      1,
      "Put artifact rule into Chapter 1",
      `Name ${artifactName} by paragraph 2, explain one child-readable rule (${artifactRule}), and tie it to the visible mission.`,
    );
    addTask(
      findArtifactChapter(input.directives, "discovery") || 2,
      1,
      "Stage artifact discovery",
      `Show ${artifactName} being discovered or chosen on page. Let a child touch/use it once; no clue-only summary.`,
    );
    addTask(
      findArtifactChapter(input.directives, "success") || Math.min(4, finalChapter),
      1,
      "Stage artifact payoff",
      `Use ${artifactName} in the scene to reveal/confirm truth, but the child must make the brave decision.`,
    );
  };

  for (const issue of issues) {
    const code = String(issue?.code || "").toUpperCase();
    const gate = String(issue?.gate || "").toUpperCase();
    const chapter = Number(issue?.chapter || 0);
    const severity = issue?.severity === "ERROR" ? "ERROR" : "WARNING";

    if (
      code === "ARTIFACT_UNDERUSED"
      || code === "ARTIFACT_UNDERMENTIONED"
      || code === "MISSING_DISCOVERY"
      || code === "MISSING_SUCCESS"
    ) {
      addArtifactArcTasks();
      continue;
    }

    if (chapter > 0 && (gate === "DIALOGUE_QUOTE" || code.includes("DIALOGUE_RATIO"))) {
      addTask(
        chapter,
        severity === "ERROR" ? 1 : 2,
        "Add purposeful dialogue",
        "Add 2-3 short dialogue lines with friction, warmth, or humor. Each line must reveal character, not explain plot.",
      );
      continue;
    }

    if (chapter > 0 && code === "VOICE_MARKERS_TOO_FEW") {
      addTask(
        chapter,
        2,
        "Sharpen character voice",
        "Give the named child one recognizable body tell, one favorite-word rhythm, and one distinct short line.",
      );
      continue;
    }

    if (chapter === 1 && (code.startsWith("CH1_") || gate === "READER_CONTRACT")) {
      addTask(
        1,
        1,
        "Fix Chapter 1 orientation",
        "Open with who, where, mission, why now, and one concrete consequence before clues, chase, or abstract stakes.",
      );
      continue;
    }

    if (
      code === "ENDING_PATTERN_NOT_REALIZED"
      || code === "ENDING_PAYOFF_ABSTRACT"
      || code === "ENDING_WARMTH_MISSING"
      || code === "GOAL_THREAD_WEAK_ENDING"
    ) {
      addTask(
        finalChapter,
        1,
        "Make ending concrete",
        "End with a visible changed action, a small price paid, a Chapter 1 callback, and a warm final image.",
      );
      continue;
    }

    if (code === "ANTAGONIST_TOO_FEW_APPEARANCES" || code === "ANTAGONIST_NO_SHOWDOWN") {
      addTask(
        Math.max(1, finalChapter - 1),
        1,
        "Put antagonist on stage",
        antagonistName
          ? `Put ${antagonistName} or its visible damage on stage and force a child choice; avoid mere mention.`
          : "Put the opposing force or its visible damage on stage and force a child choice; avoid mere mention.",
      );
    }
  }

  if (failedGates.has("DIALOGUE_QUOTE") && !tasks.some(task => task.objective === "Add purposeful dialogue")) {
    addTask(2, 2, "Add purposeful dialogue", "Add 2-3 short dialogue lines with friction, warmth, or humor.");
  }

  const seen = new Set<string>();
  return tasks
    .filter(task => task.chapter > 0)
    .sort((a, b) => a.priority - b.priority || a.chapter - b.chapter)
    .filter(task => {
      const key = `${task.chapter}:${task.objective}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

function findArtifactChapter(directives: SceneDirective[], kind: "discovery" | "success"): number | undefined {
  const pattern = kind === "discovery"
    ? /\b(discover|find|found|first|entdeck|erst|bekomm|erhalt)\b/i
    : /\b(use|uses|success|solve|reveal|setz|nutz|benutz|loes|lös|rett|bring)\b/i;
  const match = directives.find(directive => pattern.test(String(directive.artifactUsage || "")));
  return match?.chapter;
}

function findAntagonistName(cast: CastSet): string {
  const antagonist = cast.poolCharacters.find(character => {
    const values = [
      character.roleType,
      character.role,
      character.archetype,
      character.species,
    ].map(value => String(value || "").toLowerCase());
    return values.some(value => value.includes("antagonist") || value.includes("villain") || value.includes("boes") || value.includes("böse"));
  });
  return antagonist?.displayName || "";
}

function scoreReleaseCandidate(quality: any, critic: SemanticCriticReport | undefined, releaseEnabled: boolean): number {
  const qualityScore = clampNumber(Number(quality?.score ?? 0), 0, 10);
  const criticSkipped = isCriticSkipped(critic);
  const criticScore = clampNumber(Number(criticSkipped ? qualityScore : (critic?.overallScore ?? qualityScore)), 0, 10);
  const errorCount = Math.max(0, Number(quality?.errorCount ?? 0));
  const warningCount = Math.max(0, Number(quality?.warningCount ?? 0));
  const criticalIssueCount = countCriticalSelectionIssues(quality);

  // Quality-gate score often collapses to 0 for otherwise salvageable prose.
  // But for release selection we still need to punish hard craft failures more than the critic's prose impression.
  const qualitySignalCollapsed = qualityScore <= 0.05;
  const qualitySignalWeak = qualityScore <= 2.5;
  const effectiveQualityScore = qualitySignalCollapsed
    ? Math.min(criticScore, 4.8)
    : qualitySignalWeak
      ? Math.max(qualityScore, criticScore - 2.0)
      : qualityScore;
  const blend = qualitySignalWeak
    ? effectiveQualityScore * 0.42 + criticScore * 0.58
    : effectiveQualityScore * 0.4 + criticScore * 0.6;
  const errorPenaltyWeight = qualitySignalWeak ? 1.05 : 1.2;
  const warningPenaltyCap = qualitySignalWeak ? 1.5 : 1.8;
  const penalties =
    errorCount * errorPenaltyWeight
    + Math.min(warningPenaltyCap, warningCount * 0.04)
    + criticalIssueCount * (qualitySignalWeak ? 0.34 : 0.3);
  const releasePenalty = releaseEnabled && critic && !criticSkipped && !critic.releaseReady ? 0.9 : 0;
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
    const aCritical = countCriticalSelectionIssues(a.quality);
    const bCritical = countCriticalSelectionIssues(b.quality);
    const criticGap = Number(b.critic?.overallScore ?? 0) - Number(a.critic?.overallScore ?? 0);
    if (Math.abs(criticGap) >= 0.5 && Math.abs(aErrors - bErrors) <= 1 && aCritical === bCritical) {
      return criticGap;
    }
    if (Math.abs(criticGap) < 0.35) {
      if (aCritical !== bCritical) return aCritical - bCritical;
      if (aErrors !== bErrors) return aErrors - bErrors;
    }
    if (b.compositeScore !== a.compositeScore) return b.compositeScore - a.compositeScore;
    if (aErrors !== bErrors) return aErrors - bErrors;
    if (aCritical !== bCritical) return aCritical - bCritical;
    return Number(b.critic?.overallScore ?? 0) - Number(a.critic?.overallScore ?? 0);
  })[0];
}

function countCriticalSelectionIssues(quality: any): number {
  const issues = Array.isArray(quality?.issues) ? quality.issues : [];
  const failedGates = new Set(Array.isArray(quality?.failedGates) ? quality.failedGates : []);
  const criticalCodes = new Set([
    "UNLOCKED_CHARACTER_ACTOR",
    "TOTAL_TOO_SHORT",
    "CHAPTER_TOO_SHORT_HARD",
    "DIALOGUE_RATIO_CRITICAL",
    "MISSING_EXPLICIT_STAKES",
    "CHILD_MISTAKE_MISSING",
    "MISTAKE_BODY_REACTION_MISSING",
    "INTERNAL_TURN_MISSING",
    "COMPARISON_CLUSTER",
    "ENDING_PAYOFF_ABSTRACT",
    "GOAL_THREAD_WEAK_ENDING",
    "MISSING_CHARACTER",
  ]);

  let count = 0;
  for (const issue of issues) {
    if (!issue || issue.severity !== "ERROR") continue;
    if (criticalCodes.has(String(issue.code || ""))) count += 1;
  }

  if (failedGates.has("LENGTH_PACING")) count += 2;
  if (failedGates.has("DIALOGUE_QUOTE")) count += 2;
  if (failedGates.has("STAKES_LOWPOINT")) count += 2;
  if (failedGates.has("IMAGERY_BALANCE")) count += 1;
  if (failedGates.has("CAST_LOCK")) count += 2;
  if (failedGates.has("CHILD_MISTAKE_ARC")) count += 2;
  if (failedGates.has("ENDING_PAYOFF")) count += 1;

  return count;
}

function mergeTokenUsage(current: any, next: any): any {
  return mergeNormalizedTokenUsage(current, next);
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
  humorLevel?: number;
  suspenseLevel?: number;
  pacing?: string;
  hasTwist?: boolean;
  allowRhymes?: boolean;
  avatarCount?: number;
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
    const storyFitScore = scoreCommercialSeriesFit(candidate, input, toneText);

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
    if (input.ageMax <= 8 && hasMelancholyToneMarkers(toneText)) {
      score -= 3.2;
    }

    const childFitScore = input.ageMax <= 8 ? scoreYoungReaderTaleFit(candidate) : 0;
    score += childFitScore;
    score += storyFitScore;

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
    `story-fit=${scoreCommercialSeriesFit(best.candidate, input).toFixed(1)}`,
    hardAvoid.size > 0 ? `recent-avoid=${hardAvoid.size}` : "recent-avoid=0",
  ].filter(Boolean);
  return {
    taleId: best.candidate.tale_id,
    title: best.candidate.title,
    score: best.score,
    method: "scored-age-tone-story-fit-anti-repeat",
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
  const corpus = buildTaleSelectionCorpus(candidate);
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
  if (hasMelancholyToneMarkers(corpus)) {
    score -= 2.8;
  }
  if (/\b(?:mystery|mysterious|secret|geheim|rätsel|raetsel|clue|hinweis|detective|detektiv|spur|hidden|versteckt)\b/i.test(corpus)) {
    score += 0.8;
  }
  if (/\b(?:friends|friendship|team|teamwork|together|gemeinsam|duo|pair|helper|companion|companions)\b/i.test(corpus)) {
    score += 0.7;
  }

  return score;
}

function buildTaleSelectionCorpus(candidate: TaleSelectionCandidate): string {
  return [
    candidate.title,
    candidate.tone || "",
    candidate.coreConflict,
    ...(candidate.tags || []),
    ...(candidate.fixedElements || []),
    ...(candidate.iconicBeats || []),
    ...(candidate.contentRules || []),
    ...(candidate.protagonistConstraints || []),
  ].join(" ").toLowerCase();
}

function scoreCommercialSeriesFit(
  candidate: TaleSelectionCandidate,
  input: {
    requestedTone?: string;
    humorLevel?: number;
    suspenseLevel?: number;
    pacing?: string;
    hasTwist?: boolean;
    allowRhymes?: boolean;
    avatarCount?: number;
  },
  corpusOverride?: string,
): number {
  const corpus = corpusOverride || buildTaleSelectionCorpus(candidate);
  const humorLevel = clampNumber(Number(input.humorLevel ?? 0), 0, 3);
  const suspenseLevel = clampNumber(Number(input.suspenseLevel ?? 0), 0, 3);
  const avatarCount = Math.max(0, Number(input.avatarCount ?? 0));
  const wantsFastPace = String(input.pacing || "").toLowerCase() === "fast";
  const wantsWittyTone = /\b(witty|witzig|lustig|funny|humorvoll|humorous|quirky|frech)\b/i.test(String(input.requestedTone || ""));

  const humorFriendlyPattern = /\b(?:funny|humorous|lighthearted|playful|chaos|cheeky|quirky|witty|mischief|comic|kicher|schmunzel|animal|pony|friendship|teamwork|helper|companion)\b/i;
  const mysteryPattern = /\b(?:mystery|mysterious|secret|geheim|rätsel|raetsel|clue|hinweis|detective|detektiv|case|spur|map|message|note|package|paket|hidden|versteckt|locked|mask|disguise|reveal)\b/i;
  const teamPattern = /\b(?:friends|friendship|team|teamwork|together|gemeinsam|duo|pair|group|crew|helper|companions?)\b/i;
  const lonelyPattern = /\b(?:alone|lonely|einsam|orphan|ignored|abandoned|solitary|widow|poverty|poor child)\b/i;
  const fastPattern = /\b(?:chase|run|running|rennen|search|suchen|hunt|rescue|escape|hide|hurry|urgent|quick|fast|wild|adventure|detektiv|spur|raetsel|rätsel|secret|geheim)\b/i;
  const slowPoeticPattern = /\b(?:poetic|lyrical|meditative|vision|visions|heavenly|mourning|lament|elegiac|dreamlike|bittersweet)\b/i;
  const rhymePattern = /\b(?:repeat|repetitive|rhythmic|rhyme|chant|cumulative)\b/i;

  let score = 0;

  if (humorLevel >= 2 || wantsWittyTone) {
    if (humorFriendlyPattern.test(corpus)) score += 1.9;
    if (hasMelancholyToneMarkers(corpus)) score -= 3.6;
  } else if (humorLevel >= 1) {
    if (humorFriendlyPattern.test(corpus)) score += 0.9;
    if (hasMelancholyToneMarkers(corpus)) score -= 1.4;
  }

  if (suspenseLevel >= 2 || input.hasTwist) {
    if (mysteryPattern.test(corpus)) score += 2.1;
    if (slowPoeticPattern.test(corpus)) score -= 1.2;
  } else if (suspenseLevel >= 1 && mysteryPattern.test(corpus)) {
    score += 0.9;
  }

  if (wantsFastPace) {
    if (fastPattern.test(corpus)) score += 1.4;
    if (hasMelancholyToneMarkers(corpus) || slowPoeticPattern.test(corpus)) score -= 1.8;
  }

  if (avatarCount >= 2) {
    if (teamPattern.test(corpus)) score += 1.3;
    if (lonelyPattern.test(corpus)) score -= 1.8;
  }

  if (input.allowRhymes && rhymePattern.test(corpus)) {
    score += 0.4;
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

function hasMelancholyToneMarkers(text: string): boolean {
  if (!text) return false;
  return /\b(?:sad|traurig|sorrow|grief|lonely|einsam|orphan|abandoned|ignored|freezing|frozen|cold street|poverty|weeping|tears|crying|heaven|heavenly|visions?|bittersweet|suffering|sterben|death|tod)\b/i.test(text);
}

function rangesOverlap(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return aMin <= bMax && bMin <= aMax;
}

function deterministicJitter(seed: string): number {
  const digest = crypto.createHash("sha256").update(seed).digest();
  const value = (digest[0] << 8) | digest[1];
  return value / 65535;
}

function sanitizeMemoryTitleForPrompt(value?: string): string {
  const normalized = String(value || "")
    .replace(/["']/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized || normalized.length < 6) return "";
  if (/[:;,/-]$/.test(normalized)) return "";
  const words = normalized.split(/\s+/);
  const lastWord = words[words.length - 1] || "";
  if (lastWord.length <= 1) return "";
  if (/\b(?:warum|wieso|weshalb|why)\s+[a-z]$/i.test(normalized)) return "";
  return normalized.length <= 120 ? normalized : `${normalized.slice(0, 117).trimEnd()}...`;
}

function withPipelineStoryCostControls(
  normalized: NormalizedRequest,
  pipelineConfig: PipelineConfig,
): NormalizedRequest {
  const raw = normalized.rawConfig as any;
  return {
    ...normalized,
    rawConfig: {
      ...raw,
      maxRewritePasses: raw?.maxRewritePasses ?? pipelineConfig.maxRewritePasses,
      maxExpandCalls: raw?.maxExpandCalls ?? pipelineConfig.maxExpandCalls,
      maxWarningPolishCalls: raw?.maxWarningPolishCalls ?? pipelineConfig.maxWarningPolishCalls,
      maxStoryTokens: raw?.maxStoryTokens ?? pipelineConfig.maxStoryTokens,
    },
  };
}

function limitChapterSet(chapters: ReadonlySet<number>, maxChapters: number): Set<number> {
  const max = Math.max(0, Math.floor(Number(maxChapters) || 0));
  if (max === 0 || chapters.size === 0) return new Set<number>();
  return new Set([...chapters].sort((a, b) => a - b).slice(0, max));
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
