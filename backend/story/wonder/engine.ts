import type { StoryBrief } from "../storybook/context";
import { parseJsonObject, type CostLedger, type LlmRequest, type StorybookLlm, type StorybookModels } from "../storybook/llm";
import type { CastCandidate, StoryPlan } from "../storybook/types";
import { draftProblems, editorialBlockers, mergeRevision, planProblems, readDraft, reviewProblems } from "./checks";
import { selectWonderPackages } from "./library";
import { planPrompt, planReviewPrompt, reviewPrompt, setupRepairPrompt, writerPrompt } from "./prompts";
import { WONDER_PIPELINE_ID, type WonderDraft, type WonderPlan, type WonderResult, type WonderReview } from "./types";

export { WONDER_PIPELINE_ID };

export function toStoryPlan(p: WonderPlan): StoryPlan {
  return {
    title: p.title, logline: p.logline, engine: p.packageId || "wonder:original", chosenPitch: p.chosenIdea, whyChosen: p.ideas[p.chosenIdea - 1].whyTheseHeroes,
    want: p.want, stakes: p.stakes, worldRule: p.worldRule, ruleIntro: p.ruleDemonstration, solutionWhy: p.ending.resolution,
    refrain: null, runningGag: { what: p.ideas[p.chosenIdea - 1].comicEngine, beats: p.scenes.map(s => s.humor) }, dramaticIrony: "",
    setups: p.setups, obstacleMotive: p.stakes, props: [],
    heroes: p.heroes.map(h => ({ id: h.id, name: h.name, strength: h.choice, voice: h.voice, contribution: h.contribution })),
    cast: p.guests.map(g => ({ id: g.id, name: g.name, role: g.role, want: g.want, voice: g.voice, signature: g.appearance })),
    artifact: p.artifact,
    pages: p.scenes.map(s => ({ page: s.chapter, place: s.place, action: s.action, heroMoment: s.change, humor: s.humor, emotion: s.change, turn: s.end, picture: s.action, onPage: s.onStage, after: s.after })),
    ending: { resolution: p.ending.resolution, callback: p.ending.callback, lastLine: p.ending.emotionalAction }, learningCore: p.learningCore,
  };
}

export async function runWonderTextEngine(input: {
  llm: StorybookLlm; brief: StoryBrief; models: StorybookModels; ledger: CostLedger;
  observe?: (stage: string, payload: Record<string, unknown>) => Promise<void>;
}): Promise<WonderResult> {
  const { brief, models, ledger } = input;
  const packages = selectWonderPackages(brief);
  const observe = async (stage: string, payload: Record<string, unknown>) => { try { await input.observe?.(stage, payload); } catch { /* telemetry is best effort */ } };
  const call = async (stage: string, prompt: { system: string; user: string }, role: LlmRequest["role"], json: boolean, maxTokens: number) => {
    const setupRepair = stage.includes("setups-repair");
    const result = await input.llm({ stage, ...prompt, role, model: models[role], json, maxTokens, effort: role === "writer" && !setupRepair ? "medium" : "low", temperature: role === "writer" ? 0.8 : 0.3, timeoutMs: setupRepair ? 90_000 : 360_000 });
    ledger.recordCall(stage, result, role);
    await observe(stage, { model: result.modelUsed, durationMs: result.durationMs, usage: result.usage });
    if (!result.text.trim() || /length|max_tokens/i.test(result.finishReason || "")) throw new Error(`[${WONDER_PIPELINE_ID}] ${stage}: unvollständige Antwort.`);
    return result.text;
  };
  const jsonCall = async <T>(stage: string, prompt: { system: string; user: string }, role: LlmRequest["role"], validate: (raw: unknown) => string[]): Promise<T> => {
    let issues: string[] = [];
    let previousOutput: unknown = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await call(attempt ? `${stage}-format-retry` : stage, attempt ? { ...prompt, user: `${prompt.user}\n${JSON.stringify({ task: "Korrigiere die konkrete vorherige Ausgabe. Behalte alle gültigen Teile und gib das vollständige korrigierte JSON aus.", validationErrors: issues, previousOutput })}` } : prompt, role, true, stage.includes("plan") ? 7000 : 5000);
      const parsed = parseJsonObject<unknown>(text);
      issues = validate(parsed);
      if (!issues.length) return parsed as T;
      previousOutput = parsed ?? text;
      await observe(`${stage}-validation-failed`, { attempt: attempt + 1, issues, output: previousOutput });
      // A faulty chapter index is not a reason to throw away several minutes
      // of valid story planning. Repair only that directory, then validate the
      // WHOLE unchanged plan and pass it through the independent plan reader.
      if (role === "writer" && stage.startsWith("wonder-plan") && parsed && issues.every(i => /^setups(?:\[|:)/.test(i))) {
        const repairedText = await call(`${stage}-setups-repair${attempt ? "-2" : ""}`, setupRepairPrompt(parsed as WonderPlan, brief.budget.pages, issues), role, true, 1600);
        const patch = parseJsonObject<{ setups?: unknown }>(repairedText);
        const candidate = { ...parsed as WonderPlan, setups: patch?.setups };
        issues = validate(candidate);
        if (!issues.length) return candidate as T;
        previousOutput = candidate;
        await observe(`${stage}-setups-repair-invalid`, { attempt: attempt + 1, issues, output: candidate });
      }
    }
    throw new Error(`[${WONDER_PIPELINE_ID}] ${stage}: ${issues.join(" ")}`);
  };
  const validatePlan = (raw: unknown) => planProblems(raw, brief, packages.map(p => p.id));
  let plan = await jsonCall<WonderPlan>("wonder-plan", planPrompt(brief, packages), "writer", validatePlan);
  const validatePlanReview = (raw: unknown) => {
    const r = raw as { issues?: unknown; keep?: unknown } | null;
    return r && [r.issues, r.keep].every(a => Array.isArray(a) && a.every(s => typeof s === "string" && s.trim())) ? [] : ["issues und keep müssen Arrays von Text sein."];
  };
  let planReview = await jsonCall<{ issues: string[]; keep: string[] }>("wonder-plan-read", planReviewPrompt(brief, plan), "critic", validatePlanReview);
  let planRepaired = false;
  for (let repair = 1; planReview.issues.length && repair <= 2; repair++) {
    planRepaired = true;
    const suffix = repair === 1 ? "" : `-${repair}`;
    plan = await jsonCall<WonderPlan>(`wonder-plan-repair${suffix}`, planPrompt(brief, packages, { plan, issues: planReview.issues }), "writer", validatePlan);
    planReview = await jsonCall(`wonder-plan-reread${suffix}`, planReviewPrompt(brief, plan), "critic", validatePlanReview);
  }
  if (planReview.issues.length) throw new Error(`[${WONDER_PIPELINE_ID}] Der Plan hat nach dem Lektorat offene Probleme: ${planReview.issues.join(" ")}`);
  await observe("wonder-plan-ready", { plan, planReview, planRepaired });

  const maxDraftTokens = Math.ceil(brief.budget.totalWordsMax * 3.2 + 5000);
  let draft!: WonderDraft;
  let draftRetried = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await call(attempt ? "wonder-draft-format-retry" : "wonder-draft", writerPrompt(brief, plan, packages), "writer", false, maxDraftTokens);
    try { draft = readDraft(raw, plan, brief.config.language); break; }
    catch (error) { if (attempt) throw error; draftRetried = true; }
  }
  const read = (d: WonderDraft, stage: string) => jsonCall<WonderReview>(stage, reviewPrompt(brief, d), "critic", raw => reviewProblems(raw, d, brief));
  const draftReview = await read(draft, "wonder-cold-read");
  await observe("wonder-draft-ready", { draft, review: draftReview });
  let review = draftReview;
  let final = draft;
  let chosen: "draft" | "revision" = "draft";
  let revisedChapters: number[] = [];
  const mechanical = draftProblems(draft, brief);
  const blockers = editorialBlockers(draftReview, brief);
  const expectsHumor = (brief.config.humorLevel ?? 1) >= 2;
  const needsHumor = expectsHumor && draftReview.laughs.length === 0;
  // One bounded editing pass. Every retained word in untouched chapters stays byte-for-byte intact.
  if (mechanical.length || blockers.length || needsHumor || draftReview.issues.length) {
    const crossChapter = mechanical.length || blockers.length || needsHumor || draftReview.issues.some(i => i.kind === "logic" && !i.affectedPages?.length);
    const chapters = crossChapter ? draft.pages.map(p => p.order) : [...new Set(draftReview.issues.flatMap(i => i.affectedPages || [i.page]))].sort((a, b) => a - b);
    const prompt = writerPrompt(brief, plan, packages, { draft, review: draftReview, chapters, mechanical: [...mechanical, ...blockers, ...(needsHumor ? ["Gewünschter Humor ist nicht durch eine einzige komische Stelle belegt. Entwickle Situationskomik in den vorhandenen Szenen."] : [])] });
    let revised: WonderDraft | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await call(attempt ? "wonder-revision-format-retry" : "wonder-revision", prompt, "writer", false, maxDraftTokens);
      try { revised = mergeRevision(draft, raw, chapters, brief.config.language); break; }
      catch (error) { if (attempt) throw error; }
    }
    if (!revised) throw new Error("Überarbeitung fehlt.");
    const reread = await read(revised, "wonder-reread");
    const revisionDefects = [...draftProblems(revised, brief), ...editorialBlockers(reread, brief)];
    const originalDefects = mechanical.length + blockers.length;
    // Never replace a clean story with one that gained a contradiction or lost all its humour.
    if (revisionDefects.length === 0 && (!expectsHumor || reread.laughs.length > 0)
      && (originalDefects > 0 || needsHumor || reread.issues.length <= draftReview.issues.length)) {
      final = revised; review = reread; chosen = "revision"; revisedChapters = chapters;
    }
    await observe("wonder-revision-compared", { chosen, revisionDefects, draft, revised, draftReview, revisionReview: reread });
  }
  const finalDefects = [...draftProblems(final, brief), ...editorialBlockers(review, brief)];
  if (expectsHumor && review.laughs.length === 0) finalDefects.push("Die gewünschte lustige Geschichte hat noch keine belegte komische Stelle.");
  if (finalDefects.length) throw new Error(`[${WONDER_PIPELINE_ID}] Nach der Überarbeitung offen: ${finalDefects.join(" ")}`);

  const guests: CastCandidate[] = plan.guests.map(g => brief.candidates.find(c => c.id === g.id) || {
    id: g.id, name: g.name, species: g.species, whoTheyAre: g.role, want: g.want, speechStyle: [g.voice], personality: [], physicalDescription: g.appearance,
    visualProfile: { description: g.appearance, imagePrompt: g.appearance, species: g.species },
  });
  return {
    ...final, plan: toStoryPlan(plan), pitches: [], engineIds: [plan.packageId || "wonder:original"], review: null, pairwise: null, chosen,
    finalChecks: { ok: true, hard: [], soft: review.issues.map(i => ({ code: `wonder_${i.kind}`, severity: "soft" as const, page: i.page, message: i.problem })) },
    benchmarkScore: null, draftScore: null, planRepaired, draftRetried, textQuality: { status: "passed", issues: review.issues.map(i => i.problem) },
    wonder: { packageId: plan.packageId, plan, planReview, review, draftReview, guests, revisedChapters },
  };
}
