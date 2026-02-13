import { buildStoryChapterRevisionPrompt, resolveLengthTargets } from "./prompts";
import { callChatCompletion } from "./llm-client";
import type {
  CastSet,
  NormalizedRequest,
  SceneDirective,
  StoryDraft,
  StoryDNA,
  TaleDNA,
  TokenUsage,
} from "./types";
import type { SemanticCriticPatchTask } from "./semantic-critic";

export interface SelectiveSurgeryResult {
  draft: StoryDraft;
  changed: boolean;
  editedChapters: number[];
  usage?: TokenUsage;
}

export async function applySelectiveSurgery(input: {
  storyId: string;
  normalizedRequest: NormalizedRequest;
  cast: CastSet;
  dna: TaleDNA | StoryDNA;
  directives: SceneDirective[];
  draft: StoryDraft;
  patchTasks: SemanticCriticPatchTask[];
  stylePackText?: string;
  maxEdits?: number;
  model?: string;
}): Promise<SelectiveSurgeryResult> {
  const maxEdits = Math.max(1, Math.min(5, input.maxEdits ?? 3));
  const model = input.model || "gpt-5-mini";
  const chapters = input.draft.chapters.map(ch => ({ ...ch }));
  const editedChapters: number[] = [];
  let usage: TokenUsage | undefined;

  const grouped = groupTasksByChapter(input.patchTasks);
  const rankedChapters = [...grouped.entries()]
    .sort((a, b) => compareTaskPriority(a[1], b[1]))
    .slice(0, maxEdits);

  if (rankedChapters.length === 0) {
    return { draft: input.draft, changed: false, editedChapters, usage };
  }

  const isReasoningModel = model.includes("gpt-5") || model.includes("o4");
  const maxTokens = isReasoningModel ? 4200 : 2200;
  const lengthTargets = input.normalizedRequest.wordBudget
    ? {
        wordMin: input.normalizedRequest.wordBudget.minWordsPerChapter,
        wordMax: input.normalizedRequest.wordBudget.maxWordsPerChapter,
        sentenceMin: Math.max(6, Math.round(input.normalizedRequest.wordBudget.minWordsPerChapter / 18)),
        sentenceMax: Math.max(8, Math.round(input.normalizedRequest.wordBudget.maxWordsPerChapter / 14)),
      }
    : resolveLengthTargets({
        lengthHint: input.normalizedRequest.lengthHint,
        ageRange: { min: input.normalizedRequest.ageMin, max: input.normalizedRequest.ageMax },
        pacing: input.normalizedRequest.rawConfig?.pacing,
      });

  let changed = false;

  for (const [chapterNo, tasks] of rankedChapters) {
    const chapter = chapters.find(ch => ch.chapter === chapterNo);
    const directive = input.directives.find(d => d.chapter === chapterNo);
    if (!chapter || !directive) continue;
    const chapterIdx = chapters.findIndex(ch => ch.chapter === chapterNo);
    const previousContext = chapterIdx > 0 ? getEdgeContext(chapters[chapterIdx - 1]?.text || "", "end") : "";
    const nextContext = chapterIdx >= 0 && chapterIdx < chapters.length - 1
      ? getEdgeContext(chapters[chapterIdx + 1]?.text || "", "start")
      : "";

    const issues = tasks
      .slice(0, 4)
      .map(task => `[P${task.priority}] ${task.objective}: ${task.instruction}`);

    const prompt = buildStoryChapterRevisionPrompt({
      chapter: directive,
      cast: input.cast,
      dna: input.dna,
      language: input.normalizedRequest.language,
      ageRange: { min: input.normalizedRequest.ageMin, max: input.normalizedRequest.ageMax },
      tone: input.normalizedRequest.requestedTone,
      lengthTargets,
      stylePackText: input.stylePackText,
      issues,
      originalText: chapter.text,
      previousContext,
      nextContext,
    });

    try {
      const result = await callChatCompletion({
        model,
        messages: [
          {
            role: "system",
            content: input.normalizedRequest.language === "de"
              ? "Du bist ein sehr praeziser Kinderbuch-Lektor. Gib nur JSON aus."
              : "You are a precise children's-book editor. Output JSON only.",
          },
          { role: "user", content: prompt },
        ],
        responseFormat: "json_object",
        maxTokens,
        reasoningEffort: "low",
        temperature: 0.3,
        context: `story-release-surgery-ch${chapterNo}`,
        logSource: "phase6-story-release-surgery-llm",
        logMetadata: { storyId: input.storyId, chapter: chapterNo, taskCount: tasks.length },
      });

      const parsed = safeJson(result.content);
      const revised = typeof parsed?.text === "string" ? parsed.text.trim() : "";
      if (revised.length > 30 && revised !== chapter.text) {
        chapter.text = revised;
        changed = true;
        editedChapters.push(chapterNo);
      }
      usage = mergeUsage(usage, result.usage as TokenUsage | undefined, model);
    } catch (error) {
      console.warn(`[release-polisher] Chapter ${chapterNo} surgery failed`, error);
    }
  }

  return {
    draft: changed ? { ...input.draft, chapters } : input.draft,
    changed,
    editedChapters,
    usage,
  };
}

function getEdgeContext(text: string, side: "start" | "end"): string {
  const sentences = String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
  if (sentences.length === 0) return "";
  if (side === "start") {
    return sentences.slice(0, 2).join(" ").slice(0, 220);
  }
  return sentences.slice(Math.max(0, sentences.length - 2)).join(" ").slice(0, 220);
}

function groupTasksByChapter(tasks: SemanticCriticPatchTask[]): Map<number, SemanticCriticPatchTask[]> {
  const map = new Map<number, SemanticCriticPatchTask[]>();
  for (const task of tasks) {
    if (!Number.isFinite(task.chapter) || task.chapter <= 0) continue;
    const list = map.get(task.chapter) ?? [];
    list.push(task);
    map.set(task.chapter, list);
  }
  return map;
}

function compareTaskPriority(a: SemanticCriticPatchTask[], b: SemanticCriticPatchTask[]): number {
  const aMin = Math.min(...a.map(x => x.priority));
  const bMin = Math.min(...b.map(x => x.priority));
  if (aMin !== bMin) return aMin - bMin;
  return b.length - a.length;
}

function safeJson(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function mergeUsage(current: TokenUsage | undefined, next: TokenUsage | undefined, model: string): TokenUsage | undefined {
  if (!next) return current;
  if (!current) {
    return {
      promptTokens: next.promptTokens || 0,
      completionTokens: next.completionTokens || 0,
      totalTokens: next.totalTokens || 0,
      model: next.model || model,
      inputCostUSD: next.inputCostUSD || 0,
      outputCostUSD: next.outputCostUSD || 0,
      totalCostUSD: next.totalCostUSD || 0,
    };
  }
  return {
    promptTokens: (current.promptTokens || 0) + (next.promptTokens || 0),
    completionTokens: (current.completionTokens || 0) + (next.completionTokens || 0),
    totalTokens: (current.totalTokens || 0) + (next.totalTokens || 0),
    model: current.model || next.model || model,
    inputCostUSD: (current.inputCostUSD || 0) + (next.inputCostUSD || 0),
    outputCostUSD: (current.outputCostUSD || 0) + (next.outputCostUSD || 0),
    totalCostUSD: (current.totalCostUSD || 0) + (next.totalCostUSD || 0),
  };
}
