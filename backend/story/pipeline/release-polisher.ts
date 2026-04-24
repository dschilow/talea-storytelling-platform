import { buildStoryChapterRevisionPrompt, resolveLengthTargets } from "./prompts";
import { callChatCompletion } from "./llm-client";
import { buildLlmCostEntry, mergeNormalizedTokenUsage, normalizeTokenUsage } from "./cost-ledger";
import { generateWithGemini } from "../gemini-generation";
import { GEMINI_SUPPORT_MODEL, isMiniMaxFamilyModel } from "./model-routing";
import { generateWithRunwareText, isRunwareConfigured } from "../runware-text-generation";
import type {
  CastSet,
  NormalizedRequest,
  SceneDirective,
  StoryCostEntry,
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
  costEntries?: StoryCostEntry[];
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
  candidateTag?: string;
  // Sprint 2 (QW3): chapters where surgery's patch-only mode is insufficient.
  // For these, the prompt switches to a full hard-rewrite instruction — surgery
  // may restructure sentences aggressively to meet age-fit, not just patch.
  hardRewriteChapters?: Set<number>;
}): Promise<SelectiveSurgeryResult> {
  const maxEdits = Math.max(1, Math.min(5, input.maxEdits ?? 3));
  const model = input.model || GEMINI_SUPPORT_MODEL;
  const chapters = input.draft.chapters.map(ch => ({ ...ch }));
  const editedChapters: number[] = [];
  const hardRewriteSet = input.hardRewriteChapters ?? new Set<number>();
  let usage: TokenUsage | undefined;
  const costEntries: StoryCostEntry[] = [];

  const grouped = groupTasksByChapter(input.patchTasks);
  // Sprint 2 (QW3): if a chapter is marked for hard rewrite but has no patch tasks
  // (e.g. failed AGE_FIT gate with no matching critic issue), synthesize a task so
  // the chapter still gets processed.
  for (const chapterNo of hardRewriteSet) {
    if (!grouped.has(chapterNo)) {
      grouped.set(chapterNo, [{
        chapter: chapterNo,
        priority: 1,
        objective: "Age-fit hard rewrite",
        instruction: "Rewrite the chapter end-to-end so that every sentence is age-appropriate for children 6-8. Preserve plot, characters, and dialogue intent.",
      }]);
    }
  }
  const rankedChapters = [...grouped.entries()]
    .sort((a, b) => compareTaskPriority(a[1], b[1]))
    .slice(0, maxEdits);

  if (rankedChapters.length === 0) {
    return { draft: input.draft, changed: false, editedChapters, usage, costEntries };
  }

  const isReasoningModel = model.includes("gpt-5") || model.includes("o4");
  const isGeminiModel = model.startsWith("gemini-");
  // Sprint 2 (QW3): hard-rewrite mode needs more headroom because it may regenerate
  // the whole chapter prose, not just patch a few sentences.
  const hasHardRewrite = hardRewriteSet.size > 0;
  const maxTokens = hasHardRewrite ? (isReasoningModel ? 2200 : 1800) : (isReasoningModel ? 1200 : 900);
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

    const isHardRewrite = hardRewriteSet.has(chapterNo);
    const issues = tasks
      .slice(0, 4)
      .map(task => `[P${task.priority}] ${task.objective}: ${task.instruction}`);

    // Sprint 2 (QW3): hard-rewrite mode replaces surgery's "only patch" contract
    // with "restructure aggressively for age-fit and readability". Without this,
    // logs 2026-04-23 showed surgery patched only 20% while leaving metaphor-heavy
    // sentences intact because its prompt forbids structural changes.
    if (isHardRewrite) {
      issues.unshift(
        "[P1] HARD REWRITE MANDATE: The chapter fails age-appropriateness or readability gates. You MUST aggressively restructure sentences: break long clauses, remove metaphor fog, keep average sentence length at or below 11 words for ages 6-8. Keep plot, characters, dialogue intent identical but rewrite the prose substantially if needed. This is not a patch — it is a targeted rewrite.",
      );
    }

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
      const systemMessage = input.normalizedRequest.language === "de"
        ? "You are a precise children's-book editor. Revise only the requested chapter, keep natural German children's-book prose, and output JSON only."
        : "You are a precise children's-book editor. Revise only the requested chapter and output JSON only.";

      const result = isMiniMaxFamilyModel(model)
        ? await (async () => {
            if (!isRunwareConfigured()) {
              throw new Error("RunwareApiKey is not configured. MiniMax models run through the Runware API.");
            }
            const runwareResult = await generateWithRunwareText({
              systemPrompt: systemMessage,
              userPrompt: prompt,
              model,
              maxTokens,
              temperature: 0.3,
            });
            return {
              content: runwareResult.content,
              finishReason: runwareResult.finishReason,
              usage: normalizeTokenUsage({
                promptTokens: runwareResult.usage.promptTokens,
                completionTokens: runwareResult.usage.completionTokens,
                totalTokens: runwareResult.usage.totalTokens,
                model: runwareResult.model,
              }, runwareResult.model) as TokenUsage,
            };
          })()
        : isGeminiModel
        ? await (async () => {
            const geminiResult = await generateWithGemini({
              systemPrompt: systemMessage,
              userPrompt: prompt,
              model,
              maxTokens,
              temperature: 0.3,
              thinkingBudget: model.includes("flash") ? 64 : 96,
              logSource: "phase6-story-release-surgery-llm",
              logMetadata: { storyId: input.storyId, chapter: chapterNo, taskCount: tasks.length },
            });
            return {
              content: geminiResult.content,
              finishReason: geminiResult.finishReason,
              usage: normalizeTokenUsage({
                promptTokens: geminiResult.usage.promptTokens,
                completionTokens: geminiResult.usage.completionTokens,
                totalTokens: geminiResult.usage.totalTokens,
                model: geminiResult.model,
              }, geminiResult.model) as TokenUsage,
            };
          })()
        : await callChatCompletion({
            model,
            messages: [
              { role: "system", content: systemMessage },
              { role: "user", content: prompt },
            ],
            responseFormat: "json_object",
            maxTokens,
            reasoningEffort: "minimal",
            temperature: 0.3,
            context: `story-release-surgery-ch${chapterNo}`,
            logSource: "phase6-story-release-surgery-llm",
            logMetadata: { storyId: input.storyId, chapter: chapterNo, taskCount: tasks.length },
          });

      const parsed = safeJson(result.content);
      const revised = extractRevisedChapterText(parsed);
      const originalWordCount = countWords(chapter.text);
      const revisedWordCount = countWords(revised);
      const softLengthFloor = input.normalizedRequest.wordBudget
        ? Math.max(220, input.normalizedRequest.wordBudget.minWordsPerChapter - 20)
        : 220;
      const minAcceptedWords = Math.max(
        Math.floor(originalWordCount * 0.9),
        Math.min(originalWordCount, softLengthFloor),
      );

      if (revised.length > 30 && revised !== chapter.text && revisedWordCount >= minAcceptedWords) {
        chapter.text = revised;
        changed = true;
        editedChapters.push(chapterNo);
      } else if (revised.length > 30 && revised !== chapter.text) {
        console.warn(
          `[release-polisher] Rejecting chapter ${chapterNo} surgery because it shrank from ${originalWordCount} to ${revisedWordCount} words (min accepted ${minAcceptedWords}).`,
        );
      }
      usage = mergeNormalizedTokenUsage(usage, result.usage as TokenUsage | undefined, result.usage?.model || model);
      const costEntry = buildLlmCostEntry({
        phase: "phase6-story",
        step: "release-surgery",
        usage: result.usage as TokenUsage | undefined,
        fallbackModel: result.usage?.model || model,
        candidateTag: input.candidateTag,
        chapter: chapterNo,
        itemCount: tasks.length,
      });
      if (costEntry) costEntries.push(costEntry);
    } catch (error) {
      console.warn(`[release-polisher] Chapter ${chapterNo} surgery failed`, error);
    }
  }

  return {
    draft: changed ? { ...input.draft, chapters } : input.draft,
    changed,
    editedChapters,
    usage,
    costEntries,
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

function extractRevisedChapterText(parsed: any): string {
  if (!parsed || typeof parsed !== "object") return "";
  if (typeof parsed.text === "string" && parsed.text.trim()) {
    return parsed.text.trim();
  }
  if (typeof parsed.chapterText === "string" && parsed.chapterText.trim()) {
    return parsed.chapterText.trim();
  }
  if (Array.isArray(parsed.paragraphs)) {
    const paragraphs = parsed.paragraphs
      .map((p: any) => String(p || "").trim())
      .filter(Boolean);
    if (paragraphs.length > 0) {
      return paragraphs.join("\n\n");
    }
  }
  return "";
}

function countWords(text: string): number {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}
