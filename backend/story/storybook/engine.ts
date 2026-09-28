/**
 * Storybook Pipeline — the text engine (storybook-v2).
 *
 *   concept  (support)  three pitches on three different proven engines
 *   plan     (support)  pick the strongest, fix it, plan page by page
 *   ─ deterministic plan check → at most one plan repair
 *   draft    (writer)   one call, plain text
 *   ─ deterministic prose check → at most one structural retry
 *   review   (critic)   a different model family reads it cold and edits it
 *   revision (writer)   the whole story once more, with every note
 *   final-ab (critic)   draft vs revision, blind order — the better one ships
 *
 * Pure: no Encore, no database. The LLM arrives as a port.
 */

import { createHash } from "node:crypto";
import { checkPlan, checkProse, issuesToNotes } from "./checks";
import { runConceptStage } from "./concept-stage";
import { isLean, type StoryBrief } from "./context";
import { runDraftStage, runRevisionStage, renderPlanForWriter } from "./draft-stage";
import type { CostLedger, LlmRole, StorybookLlm, StorybookModels } from "./llm";
import { runOneShotEngine } from "./oneshot-stage";
import { runPlanStage } from "./plan-stage";
import { runPlanReviewStage } from "./plan-review-stage";
import { comprehensionGaps, needsRevision, runPairwiseStage, runReviewStage } from "./review-stage";
import type { CheckReport, EditorialReview, PairwiseVerdict, StoryPitch, StoryPlan, StorybookPage } from "./types";

export const STORYBOOK_PIPELINE_ID = "storybook-v2";

export type StageObserver = (stage: string, payload: Record<string, unknown>) => void | Promise<void>;

export interface TextEngineResult {
  title: string;
  description: string;
  pages: StorybookPage[];
  plan: StoryPlan;
  pitches: StoryPitch[];
  engineIds: string[];
  review: EditorialReview | null;
  pairwise: (PairwiseVerdict & { winnerScore: number | null }) | null;
  chosen: "draft" | "revision";
  finalChecks: CheckReport;
  /** 0-10 against published top picture books, from the independent critic. */
  benchmarkScore: number | null;
  draftScore: number | null;
  planRepaired: boolean;
  draftRetried: boolean;
}

const STRUCTURAL = new Set(["wrong_page_count", "too_short", "serialization_artifact"]);

export async function runStorybookTextEngine(input: {
  llm: StorybookLlm;
  brief: StoryBrief;
  models: StorybookModels;
  ledger: CostLedger;
  observe?: StageObserver;
}): Promise<TextEngineResult> {
  const { llm, brief, models, ledger } = input;
  // Standard since 2026-09-28: the writer invents, plans and writes in one call.
  if (!brief.experiment?.legacy) return runOneShotEngine(input);
  const observe: StageObserver = async (stage, payload) => {
    try {
      await input.observe?.(stage, payload);
    } catch {
      // Observers never change the story.
    }
  };
  const record = (stage: string, role: LlmRole, call: Parameters<CostLedger["recordCall"]>[1]) => ledger.recordCall(stage, call, role);

  // 1) Concept ---------------------------------------------------------------
  // Concept and plan decide whether a story works; the experiment may hand them to another model.
  const planner = brief.experiment?.plannerModel || models.support;
  const lean = isLean(brief);
  // Lean: the planner invents, chooses and plans in one call (no pitch step).
  let concept: { pitches: StoryPitch[]; engines: Array<{ id: string }> } = { pitches: [], engines: [] };
  if (!lean) {
    let conceptRun = await runConceptStage(llm, brief, planner);
    record("concept", "support", conceptRun.call);
    if (conceptRun.pitches.length === 0) {
      conceptRun = await runConceptStage(llm, brief, models.critic);
      record("concept-retry", "support", conceptRun.call);
    }
    if (conceptRun.pitches.length === 0) throw new Error("[storybook] Es konnten keine Geschichtenideen entwickelt werden.");
    concept = conceptRun;
  }
  await observe("concept", { engines: concept.engines.map((engine) => engine.id), pitches: concept.pitches });

  // 2) Plan ------------------------------------------------------------------
  let planned = await runPlanStage(llm, brief, concept.pitches, planner);
  record("plan", "support", planned.call);
  let planReport = checkPlan(planned.plan, brief);
  let planRepaired = false;
  if (!planReport.ok) {
    planRepaired = true;
    const notes = issuesToNotes([...planReport.hard, ...planReport.soft], 8);
    await observe("plan-repair", { issues: notes });
    const repaired = await runPlanStage(llm, brief, concept.pitches, planner, notes);
    record("plan-repair", "support", repaired.call);
    const repairedReport = checkPlan(repaired.plan, brief);
    if (repaired.plan && repairedReport.hard.length <= planReport.hard.length) {
      planned = repaired;
      planReport = repairedReport;
    }
  }
  if (!planned.plan || planned.plan.pages.length === 0) throw new Error("[storybook] Der Seitenplan konnte nicht erstellt werden.");

  // 2b) Plan read by the critic — structural defects are cheap to fix here.
  try {
    if (brief.experiment?.spar) throw new Error("plan review skipped (spar)");
    // Lean: the support model reads the (other family's) plan — cheap and unbiased.
    const planReview = await runPlanReviewStage(llm, brief, planned.plan, lean ? models.support : models.critic);
    record("plan-review", "critic", planReview.call);
    await observe("plan-review", { review: planReview.review });
    if (planReview.review?.verdict === "fix") {
      planRepaired = true;
      // Lean: the support model works the findings into the planner's plan (0.4 ¢ instead of 1.3 ¢).
      const repaired = await runPlanStage(llm, brief, concept.pitches, lean ? models.support : planner, planReview.review.problems, renderPlanForWriter(planned.plan, brief));
      record("plan-repair-review", "support", repaired.call);
      const repairedReport = checkPlan(repaired.plan, brief);
      if (repaired.plan && repaired.plan.pages.length > 0 && repairedReport.hard.length <= planReport.hard.length) {
        planned = repaired;
        planReport = repairedReport;
      }
    }
  } catch (err) {
    if (!brief.experiment?.spar) console.warn("[storybook] plan review failed; writing from the checked plan:", (err as Error)?.message || err);
  }
  const plan: StoryPlan = planned.plan!;
  await observe("plan", { ok: planReport.ok, hard: planReport.hard.map((i) => i.message), soft: planReport.soft.map((i) => i.message), plan });

  // 3) Draft -----------------------------------------------------------------
  let draft = await runDraftStage(llm, brief, plan, models.writer);
  record("draft", "writer", draft.call);
  let draftReport = checkProse({ pages: draft.pages, budget: brief.budget, plan, brief });
  let draftRetried = false;
  if (draftReport.hard.some((issue) => STRUCTURAL.has(issue.code)) || draft.pages.length === 0) {
    draftRetried = true;
    const retry = await runDraftStage(llm, brief, plan, models.writer, issuesToNotes(draftReport.hard, 6));
    record("draft-retry", "writer", retry.call);
    const retryReport = checkProse({ pages: retry.pages, budget: brief.budget, plan, brief });
    if (retry.pages.length > 0 && retryReport.hard.length <= draftReport.hard.length) {
      draft = retry;
      draftReport = retryReport;
    }
  }
  if (draft.pages.length === 0) throw new Error("[storybook] Der Entwurf enthielt keine lesbaren Seiten.");
  await observe("draft", { title: draft.title, hard: draftReport.hard.map((i) => i.message), soft: draftReport.soft.map((i) => i.message) });

  // 4) Review ----------------------------------------------------------------
  const castNames = plan.cast.map((member) => member.name);
  let review: EditorialReview | null = null;
  try {
    const reviewed = await runReviewStage(llm, brief, draft.title, draft.pages, castNames, brief.experiment?.spar ? models.support : models.critic);
    if (reviewed.failedCall) record("review-unusable", "critic", reviewed.failedCall);
    record("review", "critic", reviewed.call);
    review = reviewed.review;
  } catch (err) {
    console.warn("[storybook] review failed; revising from the deterministic checks only:", (err as Error)?.message || err);
  }
  await observe("review", { review });

  // 5) Revision --------------------------------------------------------------
  const hardNotes = [...issuesToNotes(draftReport.hard, 6), ...(review ? comprehensionGaps(review) : [])];
  let chosen: "draft" | "revision" = "draft";
  let final = { title: draft.title, description: draft.description, pages: draft.pages };
  let finalReport = draftReport;
  let pairwise: TextEngineResult["pairwise"] = null;

  if (needsRevision(review, hardNotes, { strict: lean })) {
    const checkNotes = [...hardNotes, ...issuesToNotes(draftReport.soft, 4)];
    try {
      const revision = await runRevisionStage(llm, { brief, plan, title: draft.title, pages: draft.pages, review, checkNotes }, models.writer);
      record("revision", "writer", revision.call);
      const revisionReport = checkProse({ pages: revision.pages, budget: brief.budget, plan, brief });
      const structurallyBroken = revision.pages.length !== brief.budget.pages || revisionReport.hard.some((issue) => STRUCTURAL.has(issue.code));
      await observe("revision", { hard: revisionReport.hard.map((i) => i.message), soft: revisionReport.soft.map((i) => i.message), structurallyBroken });

      if (!structurallyBroken && revisionReport.hard.length <= draftReport.hard.length) {
        // Blind order: position bias must not decide which version a child hears.
        const revisionFirst = parseInt(createHash("sha256").update(brief.seed).digest("hex").slice(0, 2), 16) % 2 === 0;
        const a = revisionFirst ? revision : draft;
        const b = revisionFirst ? draft : revision;
        try {
          // Lean: no A/B — the revision ships unless the checks found more hard defects.
          if (lean) throw new Error("final A/B skipped (lean)");
          const ab = await runPairwiseStage(llm, brief, a, b, models.critic);
          record("final-ab", "critic", ab.call);
          pairwise = ab.verdict;
        } catch (err) {
          if (!lean) console.warn("[storybook] final A/B read failed; keeping the revision:", (err as Error)?.message || err);
        }
        const revisionWon = !pairwise || (pairwise.winner === "A") === revisionFirst;
        // A revision that fixed hard defects wins regardless of taste.
        if (revisionWon || revisionReport.hard.length < draftReport.hard.length) {
          chosen = "revision";
          final = { title: revision.title || draft.title, description: revision.description || draft.description, pages: revision.pages };
          finalReport = revisionReport;
        }
        await observe("final-ab", { pairwise, revisionFirst, chosen });
      }
    } catch (err) {
      console.warn("[storybook] revision failed; shipping the reviewed draft:", (err as Error)?.message || err);
    }
  }

  const draftScore = review ? review.scores.overall : null;
  const benchmarkScore = chosen === "revision" && pairwise?.winnerScore != null ? pairwise.winnerScore : draftScore;

  return {
    title: final.title,
    description: final.description,
    pages: final.pages,
    plan,
    pitches: concept.pitches,
    engineIds: concept.engines.map((engine) => engine.id),
    review,
    pairwise,
    chosen,
    finalChecks: finalReport,
    benchmarkScore,
    draftScore,
    planRepaired,
    draftRetried,
  };
}
