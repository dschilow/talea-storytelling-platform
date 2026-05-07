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
  const maxTokens = hasHardRewrite ? (isReasoningModel ? 1500 : 1200) : (isReasoningModel ? 900 : 700);
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
      const hardLengthCeiling = input.normalizedRequest.wordBudget
        ? input.normalizedRequest.wordBudget.maxWordsPerChapter
        : lengthTargets.wordMax;
      const originalWasTooLong = originalWordCount > hardLengthCeiling + 25;
      const minAcceptedWords = originalWasTooLong
        ? Math.max(160, Math.min(hardLengthCeiling, Math.floor(originalWordCount * 0.72)))
        : Math.max(
            Math.floor(originalWordCount * 0.9),
            Math.min(originalWordCount, softLengthFloor),
          );
      const maxAcceptedWords = originalWasTooLong
        ? Math.max(hardLengthCeiling + 70, Math.floor(originalWordCount * 1.02))
        : Number.POSITIVE_INFINITY;

      if (
        revised.length > 30
        && revised !== chapter.text
        && revisedWordCount >= minAcceptedWords
        && revisedWordCount <= maxAcceptedWords
      ) {
        chapter.text = revised;
        changed = true;
        editedChapters.push(chapterNo);
      } else if (revised.length > 30 && revised !== chapter.text) {
        console.warn(
          `[release-polisher] Rejecting chapter ${chapterNo} surgery because word count ${originalWordCount}->${revisedWordCount} is outside accepted range ${minAcceptedWords}-${Number.isFinite(maxAcceptedWords) ? maxAcceptedWords : "inf"}.`,
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

// ────────────────────────── Whole-Story Self-Edit ──────────────────────────
//
// Replaces per-chapter surgery with a single LLM pass that reads the entire
// story together with all critic findings. The model can keep voice and
// continuity coherent across chapters because it sees them all at once.
//
// Trade-offs vs applySelectiveSurgery:
// + Voice and continuity stay consistent (no per-chapter drift).
// + Truncated mid-sentence rewrites are far less likely.
// + One LLM call instead of up to N calls. Lower latency, lower cost.
// - Larger context window per call. The function uses the support model so
//   the absolute token spend stays close to the chapter-by-chapter path.
// - One bad output rejects the whole edit instead of a single chapter.
export async function applyWholeStoryEdit(input: {
  storyId: string;
  normalizedRequest: NormalizedRequest;
  cast: CastSet;
  dna: TaleDNA | StoryDNA;
  directives: SceneDirective[];
  draft: StoryDraft;
  patchTasks: SemanticCriticPatchTask[];
  qualityIssues?: ReadonlyArray<{ chapter?: number; code?: string; message?: string }>;
  stylePackText?: string;
  model?: string;
  candidateTag?: string;
}): Promise<SelectiveSurgeryResult> {
  const model = input.model || GEMINI_SUPPORT_MODEL;
  const isReasoningModel = model.includes("gpt-5") || model.includes("o4");
  const isGeminiModel = model.startsWith("gemini-");
  const totalChapters = input.draft.chapters.length;
  const language = input.normalizedRequest.language;

  const tasksByChapter = groupTasksByChapter(input.patchTasks);
  const targetedChapters = new Set<number>(tasksByChapter.keys());
  for (const issue of input.qualityIssues || []) {
    if (typeof issue?.chapter === "number" && issue.chapter > 0) {
      targetedChapters.add(issue.chapter);
    }
  }
  if (targetedChapters.size === 0) {
    return { draft: input.draft, changed: false, editedChapters: [], usage: undefined, costEntries: [] };
  }

  const lengthTargets = input.normalizedRequest.wordBudget
    ? {
        wordMin: input.normalizedRequest.wordBudget.minWordsPerChapter,
        wordMax: input.normalizedRequest.wordBudget.maxWordsPerChapter,
      }
    : resolveLengthTargets({
        lengthHint: input.normalizedRequest.lengthHint,
        ageRange: { min: input.normalizedRequest.ageMin, max: input.normalizedRequest.ageMax },
        pacing: input.normalizedRequest.rawConfig?.pacing,
      });

  // The whole-story prompt is intentionally lean: full story text, target chapters
  // listed plainly, all problems grouped by chapter, and a strict JSON output
  // contract. We avoid stacking the V8 constraints again — the writer already
  // applied them; we now read like an editor.
  const fullStoryBlock = input.draft.chapters
    .map(ch => `=== Kapitel ${ch.chapter}${ch.title ? ` — ${ch.title}` : ""} ===\n${ch.text.trim()}`)
    .join("\n\n");

  const issuesByChapter: string[] = [];
  for (const ch of input.draft.chapters) {
    const tasks = tasksByChapter.get(ch.chapter) || [];
    const gateIssues = (input.qualityIssues || []).filter(q => q.chapter === ch.chapter);
    if (tasks.length === 0 && gateIssues.length === 0) continue;
    const lines: string[] = [];
    for (const task of tasks.slice(0, 4)) {
      lines.push(`  - [P${task.priority}] ${task.objective}: ${task.instruction}`);
    }
    for (const issue of gateIssues.slice(0, 3)) {
      lines.push(`  - [GATE${issue.code ? ` ${issue.code}` : ""}] ${issue.message ?? ""}`);
    }
    issuesByChapter.push(`Kapitel ${ch.chapter}:\n${lines.join("\n")}`);
  }

  const isGerman = language === "de";
  const ageHint = `${input.normalizedRequest.ageMin}-${input.normalizedRequest.ageMax}`;
  const targetList = [...targetedChapters].sort((a, b) => a - b).join(", ");

  const systemMessage = isGerman
    ? "Du bist eine erfahrene Kinderbuch-Lektorin. Du liest die ganze Geschichte als Einheit und überarbeitest nur die markierten Kapitel. Stimme, Figuren, roter Faden und Setup-Details bleiben identisch. Antworte ausschließlich mit JSON."
    : "You are an experienced children's-book editor. You read the whole story as a single piece and revise only the marked chapters. Voice, characters, narrative through-line and setup details stay identical. Output JSON only.";

  const userPrompt = [
    isGerman
      ? `Zielalter: ${ageHint}. Sprache: Deutsch. Kapitel pro Story: ${totalChapters}.`
      : `Target age: ${ageHint}. Language: ${language}. Chapters: ${totalChapters}.`,
    isGerman
      ? `Längen-Ziel pro Kapitel: ${lengthTargets.wordMin}-${lengthTargets.wordMax} Wörter. Sätze für 6-8 sollen im Schnitt unter 11 Wörter bleiben.`
      : `Per-chapter length: ${lengthTargets.wordMin}-${lengthTargets.wordMax} words.`,
    "",
    isGerman ? "GANZE GESCHICHTE (alle Kapitel zusammen lesen):" : "FULL STORY (read all chapters as a single piece):",
    fullStoryBlock,
    "",
    isGerman ? `ZU ÜBERARBEITENDE KAPITEL: ${targetList}` : `CHAPTERS TO REVISE: ${targetList}`,
    "",
    isGerman ? "PROBLEME (genau diese beheben — nichts darüber hinaus):" : "PROBLEMS (fix exactly these — nothing more):",
    issuesByChapter.join("\n\n"),
    "",
    isGerman
      ? "REGELN:\n"
        + "- Nur die markierten Kapitel umschreiben. Kapitel, die nicht in der Liste stehen, bleiben Wort für Wort gleich.\n"
        + "- Stimme der Figuren, Macken, Running-Gags, Artefakt-Regel und Welt-Anker beibehalten.\n"
        + "- Keine neuen Figuren, keine neuen Schauplätze.\n"
        + "- Sätze für die Altersgruppe brechen, wenn sie zu lang sind.\n"
        + "- Keine abgeschnittenen Sätze, keine Subjekt-losen Anfänge ('drang eine Stimme...').\n"
        + "- Kein Cliffhanger-Reset; das letzte Wort jedes Kapitels bleibt sinngemäß gleich, wo möglich.\n"
        + "- Keine Floskeln: 'plötzlich', 'irgendwie', 'wie eine Gurke', 'zupfte am Ohrläppchen'."
      : "RULES:\n"
        + "- Only revise the marked chapters. Other chapters stay word-for-word identical.\n"
        + "- Preserve character voices, quirks, running gags, artifact rule and world anchors.\n"
        + "- No new characters, no new settings.\n"
        + "- Break long sentences for the target age range.\n"
        + "- No truncated or subject-less sentence starts.\n"
        + "- Do not reset cliffhangers; the closing beat of each chapter stays meaning-equivalent where possible.\n"
        + "- No filler phrases.",
    "",
    isGerman
      ? "AUSGABE-FORMAT (strikt):\n{\n  \"chapters\": [\n    { \"chapter\": <Nummer>, \"title\": \"<Kapiteltitel>\", \"text\": \"<vollständiger Kapiteltext>\" },\n    ...\n  ]\n}\nGib alle Kapitel der Geschichte zurück (auch unveränderte). Kein Markdown, keine Kommentare."
      : "OUTPUT FORMAT (strict):\n{\n  \"chapters\": [\n    { \"chapter\": <number>, \"title\": \"<title>\", \"text\": \"<full chapter text>\" },\n    ...\n  ]\n}\nReturn every chapter (including unchanged ones). No markdown, no comments.",
  ].join("\n");

  const totalInputWords = countWords(fullStoryBlock);
  const tokenCeiling = isReasoningModel ? 7000 : 6000;
  const maxTokens = Math.min(tokenCeiling, Math.max(2400, Math.round(totalInputWords * 1.4)));

  let usage: TokenUsage | undefined;
  const costEntries: StoryCostEntry[] = [];

  try {
    const result = isMiniMaxFamilyModel(model)
      ? await (async () => {
          if (!isRunwareConfigured()) {
            throw new Error("RunwareApiKey is not configured. MiniMax models run through the Runware API.");
          }
          const runwareResult = await generateWithRunwareText({
            systemPrompt: systemMessage,
            userPrompt,
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
            userPrompt,
            model,
            maxTokens,
            temperature: 0.3,
            thinkingBudget: model.includes("flash") ? 64 : 96,
            logSource: "phase6-story-whole-edit-llm",
            logMetadata: { storyId: input.storyId, targetedChapters: [...targetedChapters], totalChapters },
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
            { role: "user", content: userPrompt },
          ],
          responseFormat: "json_object",
          maxTokens,
          reasoningEffort: "minimal",
          temperature: 0.3,
          context: `story-whole-edit`,
          logSource: "phase6-story-whole-edit-llm",
          logMetadata: { storyId: input.storyId, targetedChapters: [...targetedChapters], totalChapters },
        });

    const parsed = safeJson(result.content);
    const revisedChapters = extractWholeStoryChapters(parsed);
    if (!revisedChapters || revisedChapters.length !== totalChapters) {
      console.warn(`[release-polisher] Whole-story edit returned ${revisedChapters?.length ?? 0}/${totalChapters} chapters — keeping original draft.`);
      return { draft: input.draft, changed: false, editedChapters: [], usage: undefined, costEntries };
    }

    // Validate per chapter: revised chapters must satisfy length sanity. If
    // any non-targeted chapter was changed unexpectedly, reject the edit and
    // fall back to the original. This protects against the editor "helpfully"
    // rewriting chapters we did not ask it to touch.
    const newChapters = input.draft.chapters.map(ch => ({ ...ch }));
    const editedChapters: number[] = [];
    let hadAnyChange = false;
    for (const original of input.draft.chapters) {
      const revised = revisedChapters.find(r => r.chapter === original.chapter);
      if (!revised) {
        console.warn(`[release-polisher] Whole-story edit missed chapter ${original.chapter} — abort.`);
        return { draft: input.draft, changed: false, editedChapters: [], usage: undefined, costEntries };
      }
      const cleanRevisedText = String(revised.text || "").trim();
      const isTargeted = targetedChapters.has(original.chapter);
      const targetIdx = newChapters.findIndex(c => c.chapter === original.chapter);
      if (targetIdx < 0) continue;

      if (cleanRevisedText.length === 0) {
        return { draft: input.draft, changed: false, editedChapters: [], usage: undefined, costEntries };
      }

      if (isTargeted) {
        const originalWords = countWords(original.text);
        const revisedWords = countWords(cleanRevisedText);
        const minWords = Math.max(150, Math.floor(originalWords * 0.6));
        const maxWords = Math.max(originalWords + 90, Math.ceil(originalWords * 1.25));
        if (revisedWords < minWords || revisedWords > maxWords) {
          console.warn(`[release-polisher] Whole-story edit chapter ${original.chapter} word count ${revisedWords} outside ${minWords}-${maxWords} — abort.`);
          return { draft: input.draft, changed: false, editedChapters: [], usage: undefined, costEntries };
        }
        if (cleanRevisedText !== original.text) {
          newChapters[targetIdx].text = cleanRevisedText;
          if (typeof revised.title === "string" && revised.title.trim().length > 0) {
            newChapters[targetIdx].title = revised.title.trim();
          }
          editedChapters.push(original.chapter);
          hadAnyChange = true;
        }
      } else if (cleanRevisedText !== original.text) {
        // The model rewrote a chapter we did NOT mark for editing. Keep the
        // original text — the prompt explicitly forbade this.
        console.warn(`[release-polisher] Whole-story edit modified non-targeted chapter ${original.chapter} — reverting to original.`);
        // newChapters[targetIdx].text already has original.text via the spread above
      }
    }

    usage = mergeNormalizedTokenUsage(usage, result.usage as TokenUsage | undefined, result.usage?.model || model);
    const costEntry = buildLlmCostEntry({
      phase: "phase6-story",
      step: "whole-story-edit",
      usage: result.usage as TokenUsage | undefined,
      fallbackModel: result.usage?.model || model,
      candidateTag: input.candidateTag,
      itemCount: targetedChapters.size,
    });
    if (costEntry) costEntries.push(costEntry);

    return {
      draft: hadAnyChange ? { ...input.draft, chapters: newChapters } : input.draft,
      changed: hadAnyChange,
      editedChapters,
      usage,
      costEntries,
    };
  } catch (error) {
    console.warn(`[release-polisher] Whole-story edit failed`, error);
    return { draft: input.draft, changed: false, editedChapters: [], usage: undefined, costEntries };
  }
}

function extractWholeStoryChapters(parsed: any): Array<{ chapter: number; title?: string; text: string }> | null {
  if (!parsed || typeof parsed !== "object") return null;
  const arr = Array.isArray(parsed.chapters) ? parsed.chapters : null;
  if (!arr) return null;
  const out: Array<{ chapter: number; title?: string; text: string }> = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const chapter = Number(item.chapter);
    const text = typeof item.text === "string" ? item.text : "";
    if (!Number.isFinite(chapter) || chapter <= 0 || !text) continue;
    out.push({
      chapter,
      title: typeof item.title === "string" ? item.title : undefined,
      text,
    });
  }
  return out;
}
