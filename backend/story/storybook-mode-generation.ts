/**
 * Storybook Mode Story Generation (storybook-v1)
 *
 * A third, fully independent generation lane. It does not import, wrap or
 * modify `dev-mode-generation.ts` or `standard-mode-generation.ts`; the only
 * shared surface is infrastructure every lane uses anyway (character pool,
 * artifact pool, image service, cost ledger shape).
 *
 * Why it exists — measured against the previous engine on a real run:
 *
 *   • 17 LLM calls, 104,876 input tokens for 1,048 output words (100 input
 *     tokens per written word), $0.123 per story, 4m41s, and the resulting
 *     story was not understood by an actual seven-year-old.
 *   • 67% of that spend was rework: the story was written or rewritten seven
 *     times and still failed its own gate. Three validation rounds raised the
 *     score from 7.8 to 8.2 while the same defect survived, renamed each time.
 *
 * This lane is built the other way round:
 *
 *   0. Premise comes from a hand-written bank of child-playable situations,
 *      redrawn through five variation axes so no family sees the same telling
 *      twice. No LLM spend, no "be original under 39 banned words".
 *   1. PLAN (gpt-5.6-luna) — the Kinderlogik-Karte: the story as a causal chain
 *      in six connected sentences. Cheap, and it kills unwriteable premises
 *      before any writer call is paid for.
 *   2. Deterministic plan gate — free.
 *   3. DRAFT (wizard-selected model) — ONE call, ~2.5k token prompt, story
 *      language only, no screenplay jargon.
 *   4. Deterministic prose gate — free. Counts causal connectives, fragment
 *      staccato, new names per page, refrain, anchor object.
 *   5. JUDGE (gpt-5.6-luna) — reads ONLY the story with zero context and
 *      answers the questions a child would have to be able to answer.
 *   6. At most ONE scoped line edit, three pages maximum.
 *
 * Every support task runs on gpt-5.6-luna. The prose model stays a wizard
 * setting.
 */

import { createHash } from "crypto";
import type { StoryConfig } from "./generate";
import { recordStoryArtifact } from "./artifact-matcher";
import { getOwnedPoolIdsUnion, loadCrownArtifactIds } from "./artifact-treasury";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { logTopic } from "../log/logger";

import { PREMISE_BANK, countDistinctTellings, resolvePremiseVariant, selectPremise } from "./storybook/premise-bank";
import { loadStorybookHistory, recentlyUsedPremiseIds } from "./storybook/history";
import { castArtifact, castSupportingCharacters, recordCastUsage } from "./storybook/casting";
import { CostLedger, resolveWriterModel, STORYBOOK_SUPPORT_MODEL } from "./storybook/llm";
import { normalizeAgeBand, resolveLengthBudget } from "./storybook/style-contract";
import { runPlanStage, styleContractFor } from "./storybook/plan-stage";
import { checkPlan, checkProse, issuesToRepairNotes } from "./storybook/checks";
import { runDraftStage } from "./storybook/draft-stage";
import { runJudgeStage } from "./storybook/judge-stage";
import { resolveTargetPages, runEditStage } from "./storybook/edit-stage";
import { generateStorybookImages, type StorybookImageResult } from "./storybook/images";
import { runDevelopmentStage } from "./storybook/developments";
import type {
  CheckIssue,
  KidLogicCard,
  StorybookGeneratedStory,
  StorybookGenerationInput,
  StorybookPage,
} from "./storybook/types";

export const STORYBOOK_PIPELINE_ID = "storybook-v1";

export type {
  StorybookGenerationInput,
  StorybookGeneratedStory,
  StorybookHero,
} from "./storybook/types";

function stableSeed(input: StorybookGenerationInput): string {
  return createHash("sha256")
    .update(
      [
        input.storyId || "",
        input.userId || "",
        input.heroes.map((hero) => hero.name).join("|"),
        input.config.genre || "",
        input.config.setting || "",
      ].join("::")
    )
    .digest("hex")
    .slice(0, 16);
}

async function logStage(storyId: string | undefined, stage: string, payload: Record<string, any>): Promise<void> {
  try {
    await publishWithTimeout(logTopic as any, {
      source: "storybook-generation-stage",
      timestamp: new Date(),
      request: { pipeline: STORYBOOK_PIPELINE_ID, stage, storyId },
      response: payload,
      metadata: { pipeline: STORYBOOK_PIPELINE_ID, stage, storyId },
    });
  } catch {
    // Logging must never take generation down.
  }
}

export async function generateStoryStorybookMode(
  input: StorybookGenerationInput
): Promise<StorybookGeneratedStory> {
  const startedAt = Date.now();
  const { config, heroes } = input;
  const ledger = new CostLedger();

  const band = normalizeAgeBand(config.ageGroup);
  const budget = resolveLengthBudget(config.length, band);
  const styleContract = styleContractFor(band, budget, config);
  const writerModel = resolveWriterModel(config);
  const seed = stableSeed(input);

  // ---------------------------------------------------------------------
  // 0) Premise + variant. Zero LLM cost, and the repeat protection lives here.
  // ---------------------------------------------------------------------
  const history = await loadStorybookHistory({ userId: input.userId, currentStoryId: input.storyId });
  const selection = selectPremise({
    genre: config.genre,
    setting: config.setting,
    ageGroup: config.ageGroup,
    recentPremiseIds: recentlyUsedPremiseIds(history, PREMISE_BANK.length),
    customPrompt: config.customPrompt,
    seed,
  });
  const resolved = resolvePremiseVariant(selection.premise, seed, history.variantKeys);

  // ---------------------------------------------------------------------
  // 1) Cast. The premise declares which slots it can use; empty stays empty.
  // ---------------------------------------------------------------------
  const heroNames = new Set(heroes.map((hero) => hero.name.toLowerCase()));
  const casting = await castSupportingCharacters({
    premise: selection.premise,
    setting: config.setting,
    genre: config.genre,
    ageGroup: config.ageGroup,
    excludeNames: heroNames,
    userId: input.userId,
  });

  let ownedArtifactIds: string[] = [];
  try {
    const [owned, crowns] = await Promise.all([
      getOwnedPoolIdsUnion(config.avatarIds || []),
      loadCrownArtifactIds(),
    ]);
    ownedArtifactIds = [...new Set<string>([...owned, ...crowns])];
  } catch {
    ownedArtifactIds = [];
  }

  const { artifact } = await castArtifact({
    premise: selection.premise,
    genre: config.genre,
    setting: config.setting,
    ageGroup: config.ageGroup,
    language: config.language,
    storyId: input.storyId,
    excludeIds: ownedArtifactIds,
  });

  await logStage(input.storyId, "premise-and-cast", {
    premiseId: selection.premise.id,
    premiseReason: selection.reason,
    variantKey: resolved.variant.key,
    variant: resolved.variant,
    distinctTellingsAvailable: countDistinctTellings(),
    cast: casting.cast.map((member) => ({ name: member.name, roleNeed: member.roleNeed })),
    unfilledRoles: casting.unfilled,
    artifact: artifact?.name,
    writerModel,
    supportModel: STORYBOOK_SUPPORT_MODEL,
  });

  // ---------------------------------------------------------------------
  // 2) Plan — with at most one repair. A bad plan is cheap to fix here and
  //    ruinous to fix after the draft.
  // ---------------------------------------------------------------------
  let planResult = await runPlanStage({
    config,
    resolved,
    heroes,
    cast: casting.cast,
    artifact,
    band,
    budget,
  });
  ledger.recordCall("plan", "support", planResult.call);

  let planReport = checkPlan(planResult.card, budget);
  let planRepaired = false;

  if (!planReport.ok) {
    planRepaired = true;
    const notes = issuesToRepairNotes([...planReport.hard, ...planReport.soft], 6);
    await logStage(input.storyId, "plan-repair", { issues: notes });
    planResult = await runPlanStage({
      config,
      resolved,
      heroes,
      cast: casting.cast,
      artifact,
      band,
      budget,
      repairNotes: notes,
    });
    ledger.recordCall("plan-repair", "support", planResult.call);
    planReport = checkPlan(planResult.card, budget);
  }

  if (!planResult.card) {
    throw new Error("[storybook] Planungskarte konnte nicht erzeugt werden.");
  }
  const card: KidLogicCard = planResult.card;

  await logStage(input.storyId, "plan", {
    ok: planReport.ok,
    repaired: planRepaired,
    hard: planReport.hard.map((issue) => issue.message),
    soft: planReport.soft.map((issue) => issue.message),
    card,
  });

  // ---------------------------------------------------------------------
  // 3) Draft — ONE call.
  // ---------------------------------------------------------------------
  let draft = await runDraftStage({
    config,
    card,
    heroes,
    cast: casting.cast,
    artifact,
    band,
    budget,
    styleContract,
    writerModel,
  });
  ledger.recordCall("draft", "selected-story", draft.call);

  const knownNames = [...heroes.map((hero) => hero.name), ...casting.cast.map((member) => member.name)];

  // A draft that came back structurally unusable (wrong page count, far too
  // short) gets exactly one more attempt. Anything beyond that is the rework
  // spiral this pipeline exists to avoid.
  let proseReport = checkProse({ pages: draft.pages, budget, card, knownNames });
  let draftRetried = false;
  const structuralFailure = proseReport.hard.some((issue) =>
    ["too_short", "wrong_page_count", "serialization_artifact"].includes(issue.code)
  );

  if (structuralFailure) {
    draftRetried = true;
    const notes = issuesToRepairNotes(proseReport.hard, 4);
    await logStage(input.storyId, "draft-retry", { issues: notes, pages: draft.pages.length });
    const retry = await runDraftStage({
      config,
      card,
      heroes,
      cast: casting.cast,
      artifact,
      band,
      budget,
      styleContract,
      writerModel,
      repairNotes: notes,
    });
    ledger.recordCall("draft-retry", "selected-story", retry.call);
    const retryReport = checkProse({ pages: retry.pages, budget, card, knownNames });
    // Keep whichever attempt is actually better rather than blindly the newer.
    if (retryReport.hard.length <= proseReport.hard.length && retry.pages.length > 0) {
      draft = retry;
      proseReport = retryReport;
    }
  }

  if (draft.pages.length === 0) {
    throw new Error("[storybook] Der Entwurf enthielt keine lesbaren Seiten.");
  }

  // ---------------------------------------------------------------------
  // 4) Judge — zero-context comprehension test on gpt-5.6-luna.
  // ---------------------------------------------------------------------
  const judge = await runJudgeStage({ pages: draft.pages, card, title: draft.title });
  ledger.recordCall("judge", "support", judge.call);

  await logStage(input.storyId, "judge", {
    passed: judge.report.passed,
    answers: judge.report.answers,
    issues: judge.report.issues.map((issue) => issue.message),
    proseHard: proseReport.hard.map((issue) => issue.message),
    proseSoft: proseReport.soft.map((issue) => issue.message),
  });

  // ---------------------------------------------------------------------
  // 5) One scoped edit, max three pages, only when something hard is broken.
  // ---------------------------------------------------------------------
  let pages: StorybookPage[] = draft.pages;
  let editedPages: number[] = [];
  const combinedIssues: CheckIssue[] = [...proseReport.hard, ...judge.report.issues.filter((i) => i.severity === "hard")];
  const softIssues: CheckIssue[] = [...proseReport.soft, ...judge.report.issues.filter((i) => i.severity === "soft")];

  if (combinedIssues.length > 0) {
    const targetPages = resolveTargetPages(combinedIssues, pages.length);
    if (targetPages.length > 0) {
      const edit = await runEditStage({
        config,
        card,
        pages,
        issues: combinedIssues,
        styleContract,
        writerModel,
        targetPages,
      });
      if (edit.call) ledger.recordCall("line-edit", "selected-story", edit.call);
      pages = edit.pages;
      editedPages = edit.changedPages;
      await logStage(input.storyId, "line-edit", {
        targetPages,
        changedPages: editedPages,
        issues: combinedIssues.map((issue) => issue.message),
      });
    }
  }

  const finalReport = checkProse({ pages, budget, card, knownNames });
  const releaseReady = finalReport.hard.length === 0;

  // ---------------------------------------------------------------------
  // 6) Images + developments, in parallel. Both are best-effort.
  // ---------------------------------------------------------------------
  const [images, development] = await Promise.all([
    generateStorybookImages({
      storyId: input.storyId,
      title: draft.title,
      card,
      pages,
      heroes,
      cast: casting.cast,
      enabled: releaseReady || finalReport.hard.length <= 1,
    }).catch((err): StorybookImageResult => {
      console.warn("[storybook] image stage failed:", err);
      return {
        pageImages: new Map<number, { imageUrl?: string; prompt: string }>(),
        imagesGenerated: 0,
        imageCalls: 0,
        imageCostUSD: 0,
      };
    }),
    runDevelopmentStage({ heroes, title: draft.title, pages }),
  ]);

  if (images.promptCall) ledger.recordCall("image-prompts", "support", images.promptCall);
  if (development.call) ledger.recordCall("avatar-development", "support", development.call);

  // ---------------------------------------------------------------------
  // 7) Persist side effects, assemble the result.
  // ---------------------------------------------------------------------
  await recordCastUsage({ storyId: input.storyId, cast: casting.cast });

  let pendingArtifact: StorybookGeneratedStory["pendingArtifact"];
  if (artifact && input.storyId) {
    const discoveryChapter = Math.min(2, pages.length);
    const usageChapter = Math.max(discoveryChapter + 1, Math.min(pages.length, pages.length - 1));
    try {
      await recordStoryArtifact(input.storyId, artifact.id, discoveryChapter, usageChapter);
      pendingArtifact = {
        id: artifact.id,
        name: artifact.name,
        nameEn: artifact.nameEn,
        description: artifact.description,
        category: artifact.category,
        rarity: artifact.rarity,
        storyRole: artifact.storyRole,
        visualKeywords: artifact.visualKeywords,
        emoji: artifact.emoji,
        imageUrl: artifact.imageUrl,
        discoveryChapter,
        usageChapter,
        locked: true,
      };
    } catch (err) {
      console.warn("[storybook] could not record story artifact:", err);
    }
  }

  const totals = ledger.totals();
  const chapters = pages.map((page) => {
    const image = images.pageImages.get(page.order);
    return {
      id: `storybook-${page.order}`,
      title: page.title,
      content: page.content,
      order: page.order,
      imageUrl: image?.imageUrl,
      imagePrompt: image?.prompt,
      imageModel: image?.imageUrl ? "runware" : undefined,
    };
  });

  const durationMs = Date.now() - startedAt;
  const wordCount = pages.reduce((sum, page) => sum + page.content.trim().split(/\s+/).filter(Boolean).length, 0);

  const metadata: Record<string, any> = {
    pipeline: STORYBOOK_PIPELINE_ID,
    generationMode: STORYBOOK_PIPELINE_ID,
    model: writerModel,
    storyModel: writerModel,
    supportModel: STORYBOOK_SUPPORT_MODEL,
    processingTime: durationMs,
    displayMode: "reading_pages",
    imagesGenerated: images.imagesGenerated,
    imageCalls: images.imageCalls,
    imageCostUSD: images.imageCostUSD,
    tokensUsed: {
      prompt: totals.prompt,
      completion: totals.completion,
      total: totals.total,
      totalCostUSD: totals.costUSD,
      modelUsed: writerModel,
    },
    devModeStages: ledger.all(),
    releaseReady,
    // Everything the anti-repeat layer needs on the next run. `history.ts`
    // reads exactly these two fields.
    storybook: {
      premiseId: selection.premise.id,
      variantKey: resolved.variant.key,
      variant: resolved.variant,
      premiseReason: selection.reason,
      distinctTellingsAvailable: countDistinctTellings(),
      band,
      pages: pages.length,
      wordCount,
      inputTokensPerWord: wordCount > 0 ? Number((totals.prompt / wordCount).toFixed(2)) : null,
      llmCalls: totals.calls,
      planRepaired,
      draftRetried,
      editedPages,
      castUsed: casting.cast.map((member) => ({ name: member.name, roleNeed: member.roleNeed })),
      unfilledRoles: casting.unfilled,
      comprehension: {
        score: judge.report.answers.verstaendlichkeit,
        passed: judge.report.passed,
        answers: judge.report.answers,
      },
      hardIssues: finalReport.hard.map((issue) => issue.message),
      softIssues: softIssues.map((issue) => issue.message),
      card,
    },
  };

  await logStage(input.storyId, "complete", {
    title: draft.title,
    pages: pages.length,
    wordCount,
    llmCalls: totals.calls,
    inputTokens: totals.prompt,
    outputTokens: totals.completion,
    textCostUSD: totals.costUSD,
    imageCostUSD: images.imageCostUSD,
    totalCostUSD: Number((totals.costUSD + images.imageCostUSD).toFixed(6)),
    inputTokensPerWord: wordCount > 0 ? Number((totals.prompt / wordCount).toFixed(2)) : null,
    releaseReady,
    durationMs,
  });

  return {
    title: draft.title,
    description: draft.description,
    coverImageUrl: images.coverImageUrl,
    displayMode: "reading_pages",
    chapters,
    avatarDevelopments: development.developments,
    pendingArtifact,
    metadata,
  };
}
