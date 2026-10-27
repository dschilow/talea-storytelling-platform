/** Candidate for the common short-story / picture-book text path. Not live until evaluated. */
import { runEpisodeTextEngine } from "../episode/engine";
import type { EpisodeResult } from "../episode/types";
import type { StoryBrief } from "../storybook/context";
import type { CostLedger, StorybookLlm, StorybookModels } from "../storybook/llm";
import { unifiedSystemPrompt, unifiedUserPrompt } from "./prompts";
import { coldReadPrompt, validateColdRead, type ColdRead } from "./review";
import { UNIFIED_PIPELINE_ID } from "./config";

export { UNIFIED_PIPELINE_ID };
export type UnifiedFormat = "read-aloud" | "picture-book";
export interface UnifiedResult extends EpisodeResult {
  unified: { format: UnifiedFormat; read: ColdRead | null; invalidEvidence: string[]; repairAccepted: boolean; repairFailure?: string };
}

/** Repairs may fix events; they may not win by replacing the story's contract. */
export function sameStoryContract(a: EpisodeResult, b: EpisodeResult): boolean {
  const key = (r: EpisodeResult) => JSON.stringify({ title: r.title, rule: r.episode.plan.wonder.rule, artifact: r.episode.plan.artifact?.id || null,
    cast: r.episode.plan.cast.map(c => [c.id, c.name, c.from]).sort((x, y) => x.join("|").localeCompare(y.join("|"))) });
  return key(a) === key(b);
}

export function keepsStrongLines(read: ColdRead | null, candidate: EpisodeResult): boolean {
  const text = candidate.pages.map(p => p.content).join("\n").replace(/\s+/g, " ");
  return (read?.keep || []).every(e => text.includes(e.quote.replace(/\s+/g, " ")));
}

export async function runUnifiedTextEngine(input: { brief: StoryBrief; llm: StorybookLlm; models: StorybookModels; ledger: CostLedger; format?: UnifiedFormat; observe?: (stage: string, payload: Record<string, unknown>) => void | Promise<void> }): Promise<UnifiedResult> {
  const { brief, models, ledger } = input;
  const format = input.format || "read-aloud";
  const observe = async (stage: string, payload: Record<string, unknown>) => { try { await input.observe?.(stage, payload); } catch { /* telemetry */ } };
  const authoring = { system: unifiedSystemPrompt(brief, format), user: (revision?: { raw: string; notes: string[] }) => unifiedUserPrompt(brief, format, revision) };
  let result = await runEpisodeTextEngine({ ...input, options: { mode: "one-shot", authoring } });
  const read = async (candidate: EpisodeResult, stage: string) => {
    const response = await input.llm({ stage, role: "critic", model: models.critic, ...coldReadPrompt(brief, candidate.pages), json: true, effort: "low", maxTokens: 4200, timeoutMs: 240_000 });
    ledger.recordCall(stage, response, "critic");
    const checked = validateColdRead(response.text, candidate.pages);
    await observe(stage, { ...checked, model: response.modelUsed });
    return checked;
  };
  let checked = await read(result, "unified-cold-read");
  const blockers = (r: typeof checked) => r.read?.issues.filter(i => i.severity === "blocker") || [];
  let repairAccepted = false;
  let repairFailure: string | undefined;
  if (blockers(checked).length) {
    try {
    const previous = JSON.stringify({ title: result.title, plan: result.episode.plan, pages: result.pages.map(p => ({ chapter: p.order, title: p.title, text: p.content })) });
    const notes = JSON.stringify({ issues: blockers(checked), keep: checked.read?.keep });
    const repair: StorybookLlm = request => input.llm({ ...request, stage: `unified-${request.stage}-repair`, user: `${request.user}\n\nREPAIR THE EXISTING MANUSCRIPT, not a new story. Keep its premise, cast, title, voice and unaffected scenes. Return the required header and all chapters. Resolve these evidence-checked blockers with the smallest sufficient changes:\n${notes}\nEXISTING MANUSCRIPT:\n${previous}` });
    const candidate = await runEpisodeTextEngine({ ...input, llm: repair, options: { mode: "one-shot", authoring } });
    const reread = await read(candidate, "unified-repair-read");
    if (sameStoryContract(result, candidate) && keepsStrongLines(checked.read, candidate) && candidate.finalChecks.hard.length <= result.finalChecks.hard.length && reread.read && !reread.invalid.length && blockers(reread).length < blockers(checked).length) {
      result = candidate; checked = reread; repairAccepted = true;
    }
    await observe("unified-repair-choice", { repairAccepted, remainingBlockers: blockers(checked), invalidEvidence: reread.invalid });
    } catch (error) {
      repairFailure = String(error);
      await observe("unified-repair-unavailable", { error: repairFailure, keptOriginal: true });
    }
  }
  const unresolved = [...result.finalChecks.hard.map(i => i.message), ...blockers(checked).map(i => i.problem), ...checked.invalid];
  return { ...result, engineIds: [UNIFIED_PIPELINE_ID], chosen: repairAccepted ? "revision" : result.chosen,
    benchmarkScore: null, draftScore: null,
    textQuality: { status: unresolved.length ? "failed" : checked.read ? "passed" : "unverified", issues: unresolved },
    unified: { format, read: checked.read, invalidEvidence: checked.invalid, repairAccepted, ...(repairFailure ? { repairFailure } : {}) } };
}
