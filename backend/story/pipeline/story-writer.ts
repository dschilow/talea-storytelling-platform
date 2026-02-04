import type { NormalizedRequest, CastSet, StoryDNA, TaleDNA, SceneDirective, StoryDraft, StoryWriter, TokenUsage } from "./types";
import { buildChapterExpansionPrompt, buildFullStoryPrompt, buildFullStoryRewritePrompt, buildStoryTitlePrompt, buildTemplatePhraseRewritePrompt, resolveLengthTargets } from "./prompts";
import { buildLengthTargetsFromBudget } from "./word-budget";
import { callChatCompletion, calculateTokenCosts } from "./llm-client";
import { generateWithGemini } from "../gemini-generation";
import { runQualityGates, buildRewriteInstructions } from "./quality-gates";
import { findTemplatePhraseMatches } from "./template-phrases";

const MAX_REWRITE_PASSES = 2;

export class LlmStoryWriter implements StoryWriter {
  async writeStory(input: {
    normalizedRequest: NormalizedRequest;
    cast: CastSet;
    dna: TaleDNA | StoryDNA;
    directives: SceneDirective[];
    strict?: boolean;
    stylePackText?: string;
    fusionSections?: Map<number, string>;
  }): Promise<{ draft: StoryDraft; usage?: TokenUsage; qualityReport?: any }> {
    const { normalizedRequest, cast, dna, directives, strict, stylePackText, fusionSections } = input;
    const model = normalizedRequest.rawConfig?.aiModel ?? "gpt-5-mini";
    const isGeminiModel = model.startsWith("gemini-");
    const isGerman = normalizedRequest.language === "de";
    const targetLanguage = isGerman ? "German" : normalizedRequest.language;
    const languageGuard = isGerman
      ? "WICHTIG: Antworte ausschließlich auf Deutsch. Keine englischen Wörter oder Sätze."
      : "";
    const systemPrompt = `You are an award-winning children's book author. You write complete stories in one go - warm, vivid, rhythmic, and clear. Each chapter builds on the previous one. Your characters remember, evolve, and the narrative thread runs through the entire story. Write the story in ${targetLanguage}.\n${languageGuard}`.trim();
    const editSystemPrompt = `You are a senior children's book editor. You expand and polish chapters while preserving plot, voice, and continuity.\n${languageGuard}`.trim();
    const clampMaxTokens = (maxTokens?: number) => {
      const safeMax = maxTokens ?? 2000;
      return isGeminiModel ? Math.min(safeMax, 8192) : safeMax;
    };

    const callStoryModel = async (input: {
      systemPrompt: string;
      userPrompt: string;
      responseFormat?: "json_object" | "text";
      maxTokens?: number;
      temperature?: number;
      context?: string;
      logSource?: string;
      logMetadata?: Record<string, any>;
      reasoningEffort?: "low" | "medium" | "high";
    }) => {
      if (isGeminiModel) {
        const geminiResponse = await generateWithGemini({
          systemPrompt: input.systemPrompt,
          userPrompt: input.userPrompt,
          maxTokens: clampMaxTokens(input.maxTokens),
          temperature: input.temperature,
        });
        return {
          content: geminiResponse.content,
          usage: {
            promptTokens: geminiResponse.usage.promptTokens,
            completionTokens: geminiResponse.usage.completionTokens,
            totalTokens: geminiResponse.usage.totalTokens,
            model,
          },
        };
      }

      return callChatCompletion({
        model,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userPrompt },
        ],
        responseFormat: input.responseFormat,
        maxTokens: input.maxTokens,
        temperature: input.temperature,
        reasoningEffort: input.reasoningEffort,
        context: input.context,
        logSource: input.logSource,
        logMetadata: input.logMetadata,
      });
    };

    const lengthTargets = normalizedRequest.wordBudget
      ? buildLengthTargetsFromBudget(normalizedRequest.wordBudget)
      : resolveLengthTargets({
          lengthHint: normalizedRequest.lengthHint,
          ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
          pacing: normalizedRequest.rawConfig?.pacing,
        });

    const totalWordTarget = normalizedRequest.wordBudget?.targetWords ?? (lengthTargets.wordMin + lengthTargets.wordMax) / 2 * directives.length;
    const totalWordMin = normalizedRequest.wordBudget?.minWords ?? lengthTargets.wordMin * directives.length;
    const totalWordMax = normalizedRequest.wordBudget?.maxWords ?? lengthTargets.wordMax * directives.length;

    let totalUsage: TokenUsage | undefined;

    // ─── Phase A: Generate full story in one call ────────────────────────────
    const prompt = buildFullStoryPrompt({
      directives,
      cast,
      dna,
      language: normalizedRequest.language,
      ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
      tone: normalizedRequest.requestedTone,
      totalWordTarget: Math.round(totalWordTarget),
      totalWordMin: Math.round(totalWordMin),
      totalWordMax: Math.round(totalWordMax),
      wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
      stylePackText,
      strict,
      fusionSections,
    });

    const maxOutputTokens = Math.max(4000, Math.round(totalWordMax * 2.5));

    const result = await callStoryModel({
      systemPrompt,
      userPrompt: prompt,
      responseFormat: "json_object",
      maxTokens: Math.min(maxOutputTokens, 16000),
      temperature: strict ? 0.4 : 0.7,
      context: "story-writer-full",
      logSource: "phase6-story-llm",
      logMetadata: { storyId: normalizedRequest.storyId, step: "full" },
    });

    if (result.usage) {
      totalUsage = mergeUsage(totalUsage, result.usage, model);
    }

    let parsed = safeJson(result.content);
    let draft = sanitizeDraft(extractDraft(parsed, directives, normalizedRequest.language));

    // ─── Phase B: Quality Gates + Rewrite Passes ─────────────────────────────
    let qualityReport = runQualityGates({
      draft,
      directives,
      cast,
      language: normalizedRequest.language,
      wordBudget: normalizedRequest.wordBudget,
    });

    const applyTargetedEdits = async (draftInput: StoryDraft): Promise<{ draft: StoryDraft; usage?: TokenUsage; changed: boolean }> => {
      const hardMin = getHardMinChapterWords(draftInput, normalizedRequest.wordBudget);
      const updatedChapters = draftInput.chapters.map(ch => ({ ...ch }));
      let changed = false;
      let usage: TokenUsage | undefined;

      for (let i = 0; i < updatedChapters.length; i++) {
        const chapter = updatedChapters[i];
        const directive = directives.find(d => d.chapter === chapter.chapter);
        if (!directive) continue;

        const wordCount = countWords(chapter.text);
        const sentenceCount = splitSentences(chapter.text).length;
        const templateMatches = findTemplatePhraseMatches(chapter.text, normalizedRequest.language);
        const needsExpand = Boolean((hardMin && wordCount < hardMin) || sentenceCount < 3);
        const needsTemplateFix = templateMatches.length > 0;
        if (!needsExpand && !needsTemplateFix) continue;

        const prevContext = i > 0 ? getEdgeContext(updatedChapters[i - 1]?.text || "", "end") : "";
        const nextContext = i < updatedChapters.length - 1 ? getEdgeContext(updatedChapters[i + 1]?.text || "", "start") : "";

        const prompt = needsExpand
          ? buildChapterExpansionPrompt({
              chapter: directive,
              cast,
              dna,
              language: normalizedRequest.language,
              ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
              tone: normalizedRequest.requestedTone,
              lengthTargets,
              stylePackText,
              originalText: chapter.text,
              previousContext: prevContext,
              nextContext,
            })
          : buildTemplatePhraseRewritePrompt({
              chapter: directive,
              cast,
              dna,
              language: normalizedRequest.language,
              ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
              tone: normalizedRequest.requestedTone,
              lengthTargets,
              stylePackText,
              originalText: chapter.text,
              phraseLabels: templateMatches.map(m => m.label),
            });

        const maxTokens = Math.min(2000, Math.round(Math.max(600, lengthTargets.wordMax * 2.5)));
        try {
          const result = await callStoryModel({
            systemPrompt: editSystemPrompt,
            userPrompt: prompt,
            responseFormat: "json_object",
            maxTokens,
            temperature: 0.4,
            context: needsExpand ? `story-writer-expand-chapter-${chapter.chapter}` : `story-writer-template-fix-${chapter.chapter}`,
            logSource: "phase6-story-llm",
            logMetadata: { storyId: normalizedRequest.storyId, step: needsExpand ? "expand" : "template-fix", chapter: chapter.chapter },
          });

          if (result.usage) {
            usage = mergeUsage(usage, result.usage, model);
          }

          const parsed = safeJson(result.content);
          if (parsed?.text) {
            chapter.text = sanitizeMetaStructureFromText(String(parsed.text));
            if (parsed.title) chapter.title = String(parsed.title);
            changed = true;
          }
        } catch (error) {
          console.warn(`[story-writer] Targeted edit failed for chapter ${chapter.chapter}`, error);
        }
      }

      return { draft: { ...draftInput, chapters: updatedChapters }, usage, changed };
    };

    const targetedBefore = await applyTargetedEdits(draft);
    if (targetedBefore.changed) {
      draft = targetedBefore.draft;
      if (targetedBefore.usage) {
        totalUsage = mergeUsage(totalUsage, targetedBefore.usage, model);
      }
      qualityReport = runQualityGates({
        draft,
        directives,
        cast,
        language: normalizedRequest.language,
        wordBudget: normalizedRequest.wordBudget,
      });
    }

    let rewriteAttempt = 0;
    while (qualityReport.failedGates.length > 0 && rewriteAttempt < MAX_REWRITE_PASSES) {
      rewriteAttempt++;
      console.log(`[story-writer] Rewrite pass ${rewriteAttempt}/${MAX_REWRITE_PASSES} - failed gates: ${qualityReport.failedGates.join(", ")}`);

      const errorIssues = qualityReport.issues.filter(i => i.severity === "ERROR");
      const rewriteInstructions = buildRewriteInstructions(errorIssues, normalizedRequest.language);

      const rewritePrompt = buildFullStoryRewritePrompt({
        originalDraft: draft,
        directives,
        cast,
        dna,
        language: normalizedRequest.language,
        ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
        tone: normalizedRequest.requestedTone,
        totalWordMin: Math.round(totalWordMin),
        totalWordMax: Math.round(totalWordMax),
        wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
        qualityIssues: rewriteInstructions,
        stylePackText,
      });

      const rewriteResult = await callStoryModel({
        systemPrompt,
        userPrompt: rewritePrompt,
        responseFormat: "json_object",
        maxTokens: Math.min(maxOutputTokens, 16000),
        temperature: 0.4,
        context: `story-writer-rewrite-${rewriteAttempt}`,
        logSource: "phase6-story-llm",
        logMetadata: { storyId: normalizedRequest.storyId, step: "rewrite", attempt: rewriteAttempt },
      });

      if (rewriteResult.usage) {
        totalUsage = mergeUsage(totalUsage, rewriteResult.usage, model);
      }

      parsed = safeJson(rewriteResult.content);
      const revisedDraft = sanitizeDraft(extractDraft(parsed, directives, normalizedRequest.language));

      const revisedReport = runQualityGates({
        draft: revisedDraft,
        directives,
        cast,
        language: normalizedRequest.language,
        wordBudget: normalizedRequest.wordBudget,
      });

      if (revisedReport.score >= qualityReport.score) {
        draft = revisedDraft;
        qualityReport = revisedReport;
      } else {
        console.log(`[story-writer] Rewrite pass ${rewriteAttempt} scored lower (${revisedReport.score} vs ${qualityReport.score}), keeping original`);
        break;
      }

      if (qualityReport.failedGates.length === 0) {
        console.log(`[story-writer] All quality gates passed after rewrite pass ${rewriteAttempt}`);
        break;
      }
    }

    const needsFinalTargeted = qualityReport.issues.some(issue =>
      issue.code === "CHAPTER_TOO_SHORT_HARD" || issue.code === "CHAPTER_PLACEHOLDER" || issue.code === "TEMPLATE_PHRASE"
    );
    if (needsFinalTargeted) {
      const targetedAfter = await applyTargetedEdits(draft);
      if (targetedAfter.changed) {
        draft = targetedAfter.draft;
        if (targetedAfter.usage) {
          totalUsage = mergeUsage(totalUsage, targetedAfter.usage, model);
        }
        qualityReport = runQualityGates({
          draft,
          directives,
          cast,
          language: normalizedRequest.language,
          wordBudget: normalizedRequest.wordBudget,
        });
      }
    }

    // ─── Phase C: Title generation (if AI didn't return a good one) ──────────
    if (!draft.title || draft.title.length < 3) {
      const storyText = draft.chapters.map(ch => `${ch.title}\n${ch.text}`).join("\n\n");
      try {
        const titleSystem = `You summarize children's stories in ${targetLanguage}.`;
        const titlePrompt = buildStoryTitlePrompt({ storyText, language: normalizedRequest.language });
        const titleResult = await callStoryModel({
          systemPrompt: titleSystem,
          userPrompt: titlePrompt,
          responseFormat: "json_object",
          maxTokens: 800,
          temperature: 0.6,
          context: "story-title",
          logSource: "phase6-story-llm",
          logMetadata: { storyId: normalizedRequest.storyId, step: "title" },
        });
        const titleParsed = safeJson(titleResult.content);
        if (titleParsed?.title) draft.title = titleParsed.title;
        if (titleParsed?.description) draft.description = titleParsed.description;

        if (titleResult.usage) {
          totalUsage = mergeUsage(totalUsage, titleResult.usage, model);
        }
      } catch (error) {
        console.warn("[story-writer] Failed to generate story title", error);
      }
    }

    return {
      draft,
      usage: totalUsage,
      qualityReport: {
        score: qualityReport.score,
        passedGates: qualityReport.passedGates,
        failedGates: qualityReport.failedGates,
        issueCount: qualityReport.issues.length,
        errorCount: qualityReport.issues.filter(i => i.severity === "ERROR").length,
        warningCount: qualityReport.issues.filter(i => i.severity === "WARNING").length,
        rewriteAttempts: rewriteAttempt,
        issues: qualityReport.issues.map(i => ({
          gate: i.gate,
          chapter: i.chapter,
          code: i.code,
          message: i.message,
          severity: i.severity,
        })),
      },
    };
  }
}

function extractDraft(
  parsed: any,
  directives: SceneDirective[],
  language: string,
): StoryDraft {
  if (!parsed) {
    return {
      title: language === "de" ? "Neue Geschichte" : "New Story",
      description: "",
      chapters: directives.map(d => ({
        chapter: d.chapter,
        title: `${language === "de" ? "Kapitel" : "Chapter"} ${d.chapter}`,
        text: "",
      })),
    };
  }

  const title = parsed.title || (language === "de" ? "Neue Geschichte" : "New Story");
  const description = parsed.description || "";

  let chapters: StoryDraft["chapters"] = [];

  if (Array.isArray(parsed.chapters)) {
    chapters = parsed.chapters.map((ch: any, idx: number) => ({
      chapter: ch.chapter ?? idx + 1,
      title: ch.title || `${language === "de" ? "Kapitel" : "Chapter"} ${ch.chapter ?? idx + 1}`,
      text: ch.text || "",
    }));
  }

  if (chapters.length < directives.length) {
    for (const d of directives) {
      if (!chapters.find(ch => ch.chapter === d.chapter)) {
        chapters.push({
          chapter: d.chapter,
          title: `${language === "de" ? "Kapitel" : "Chapter"} ${d.chapter}`,
          text: "",
        });
      }
    }
    chapters.sort((a, b) => a.chapter - b.chapter);
  }

  return { title, description, chapters };
}

function sanitizeDraft(draft: StoryDraft): StoryDraft {
  return {
    ...draft,
    chapters: draft.chapters.map(ch => ({
      ...ch,
      text: sanitizeMetaStructureFromText(ch.text),
    })),
  };
}

function sanitizeMetaStructureFromText(text: string): string {
  if (!text) return text;
  const lines = text.split(/\r?\n/);
  const labelPattern = /^(?:\d+[\).]\s*)?(?:[-\u2022*]\s*)?(?:\*\*|__)?(Ort|Stimmung|Ziel|Hindernis|Handlung|Action|Sichtbare Aktion|Sichtbare Handlung|Visible action|Aktion fortgesetzt|Action continued|Mini[- ]?Problem|Mini[- ]?Aufl(?:oe|\u00f6)sung|Mini[- ]?resolution|Ausblick|Epilog|Hook|Scene|Mood|Goal|Obstacle|Outlook|Epilogue)(?:\*\*|__)?\s*[:\u2212\u2013\u2014-]\s*(.*)$/i;
  const sentenceLabelPattern = /^(?:\*\*|__)?(Ort|Stimmung|Ziel|Hindernis|Handlung|Action|Sichtbare Aktion|Sichtbare Handlung|Visible action|Aktion fortgesetzt|Action continued|Mini[- ]?Problem|Mini[- ]?Aufl(?:oe|\u00f6)sung|Mini[- ]?resolution|Ausblick|Epilog|Hook|Scene|Mood|Goal|Obstacle|Outlook|Epilogue)(?:\*\*|__)?\s*[:\u2212\u2013\u2014-]/i;

  const cleaned = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return "";

    const match = trimmed.match(labelPattern);
    if (!match) return line;

    const label = match[1].toLowerCase();
    const rest = (match[2] || "").trim();

    if (label === "epilog" || label === "epilogue") {
      return rest;
    }

    // For label-prefix patterns, keep the content after the label
    if (rest.length > 10) {
      return rest.charAt(0).toUpperCase() + rest.slice(1);
    }

    return "";
  });

  const sentenceCleaned = cleaned.map(line => {
    if (!line.trim()) return "";
    const parts = line.split(/(?<=[.!?])\s+/);
    const kept = parts.filter(part => {
      const trimmed = part.trim();
      if (!trimmed) return false;
      return !sentenceLabelPattern.test(trimmed);
    });
    return kept.join(" ").trim();
  });

  // Strip inline meta-label prefixes within sentences
  let result = sentenceCleaned
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  // Remove inline label prefixes (keep content after the colon)
  const inlineLabelPrefixes = [
    /Sichtbare Aktion:\s*/gi,
    /Sichtbare Handlung:\s*/gi,
    /Aktion fortgesetzt:\s*/gi,
    /Visible action:\s*/gi,
    /Action continued:\s*/gi,
    /Mini-Problem:\s*/gi,
    /Mini-Aufl(?:oe|ö)sung:\s*/gi,
  ];
  for (const pattern of inlineLabelPrefixes) {
    result = result.replace(pattern, "");
  }

  // Remove meta-narration sentences that describe story beats instead of telling the story
  const metaSentencePatterns = [
    /(?:^|(?<=\.\s))(?:Ihr|Das|Ein) (?:Ziel|Hindernis) war[^.!?]*[.!?]/gm,
    /(?:^|(?<=\.\s))(?:Her|The|An) (?:goal|obstacle) was[^.!?]*[.!?]/gm,
  ];
  for (const pattern of metaSentencePatterns) {
    result = result.replace(pattern, "");
  }

  return result
    .replace(/\.\s*\.\s*/g, ". ")
    .replace(/^\.\s*/, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/  +/g, " ")
    .trim();
}

function safeJson(text: string) {
  if (!text) return null;
  const trimmed = text.trim();

  // Strip markdown code fences if present
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    // Try to recover a JSON object from surrounding text
    const first = candidate.indexOf("{");
    const last = candidate.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      const slice = candidate.slice(first, last + 1);
      try {
        return JSON.parse(slice);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function mergeUsage(existing: TokenUsage | undefined, incoming: TokenUsage, model: string): TokenUsage {
  const merged = {
    promptTokens: (existing?.promptTokens ?? 0) + incoming.promptTokens,
    completionTokens: (existing?.completionTokens ?? 0) + incoming.completionTokens,
    totalTokens: (existing?.totalTokens ?? 0) + incoming.totalTokens,
    model,
  } as TokenUsage;

  const costs = calculateTokenCosts({
    promptTokens: merged.promptTokens,
    completionTokens: merged.completionTokens,
    model,
  });

  return {
    ...merged,
    inputCostUSD: costs.inputCostUSD,
    outputCostUSD: costs.outputCostUSD,
    totalCostUSD: costs.totalCostUSD,
  };
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
}

function getEdgeContext(text: string, edge: "start" | "end", maxSentences = 1): string {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return "";
  if (edge === "start") {
    return sentences.slice(0, maxSentences).join(" ");
  }
  return sentences.slice(Math.max(0, sentences.length - maxSentences)).join(" ");
}

function getHardMinChapterWords(draft: StoryDraft, wordBudget?: import("./word-budget").WordBudget): number | null {
  if (!wordBudget) return null;
  const chapterCount = draft.chapters.length;
  const isMediumOrLong = wordBudget.minMinutes >= 8;
  if (chapterCount >= 4 && isMediumOrLong) return 220;
  if (chapterCount >= 3) return 160;
  return null;
}


