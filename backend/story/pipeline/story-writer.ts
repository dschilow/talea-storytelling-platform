import type { NormalizedRequest, CastSet, StoryDNA, TaleDNA, SceneDirective, StoryDraft, StoryWriter, TokenUsage } from "./types";
import { buildFullStoryPrompt, buildFullStoryRewritePrompt, buildStoryTitlePrompt, resolveLengthTargets } from "./prompts";
import { buildLengthTargetsFromBudget } from "./word-budget";
import { callChatCompletion, calculateTokenCosts } from "./llm-client";
import { runQualityGates, buildRewriteInstructions } from "./quality-gates";

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
    const model = normalizedRequest.rawConfig.aiModel || "gpt-5-mini";
    const systemPrompt = normalizedRequest.language === "de"
      ? "Du bist eine preisgekroente Kinderbuchautorin. Du schreibst ganze Geschichten am Stueck - warm, bildhaft, rhythmisch und klar, wie in hochwertigen Kinderbuechern. Jedes Kapitel baut auf dem vorherigen auf. Deine Charaktere erinnern sich, entwickeln sich weiter, und der rote Faden zieht sich durch die gesamte Geschichte."
      : "You are an award-winning children's book author. You write complete stories in one go - warm, vivid, rhythmic, and clear. Each chapter builds on the previous one. Your characters remember, evolve, and the narrative thread runs through the entire story.";

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

    const result = await callChatCompletion({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      responseFormat: "json_object",
      maxTokens: Math.min(maxOutputTokens, 16000),
      temperature: strict ? 0.4 : 0.7,
      context: "story-writer-full",
    });

    if (result.usage) {
      totalUsage = mergeUsage(totalUsage, result.usage, model);
    }

    let parsed = safeJson(result.content);
    let draft = extractDraft(parsed, directives, normalizedRequest.language);

    // ─── Phase B: Quality Gates + Rewrite Passes ─────────────────────────────
    let qualityReport = runQualityGates({
      draft,
      directives,
      cast,
      language: normalizedRequest.language,
      wordBudget: normalizedRequest.wordBudget,
    });

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

      const rewriteResult = await callChatCompletion({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: rewritePrompt },
        ],
        responseFormat: "json_object",
        maxTokens: Math.min(maxOutputTokens, 16000),
        temperature: 0.4,
        context: `story-writer-rewrite-${rewriteAttempt}`,
      });

      if (rewriteResult.usage) {
        totalUsage = mergeUsage(totalUsage, rewriteResult.usage, model);
      }

      parsed = safeJson(rewriteResult.content);
      const revisedDraft = extractDraft(parsed, directives, normalizedRequest.language);

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

    // ─── Phase C: Title generation (if AI didn't return a good one) ──────────
    if (!draft.title || draft.title.length < 3) {
      const storyText = draft.chapters.map(ch => `${ch.title}\n${ch.text}`).join("\n\n");
      try {
        const titleSystem = normalizedRequest.language === "de"
          ? "Du fasst Kindergeschichten knapp zusammen."
          : "You summarize children's stories.";
        const titlePrompt = buildStoryTitlePrompt({ storyText, language: normalizedRequest.language });
        const titleResult = await callChatCompletion({
          model,
          messages: [
            { role: "system", content: titleSystem },
            { role: "user", content: titlePrompt },
          ],
          responseFormat: "json_object",
          maxTokens: 800,
          temperature: 0.6,
          context: "story-title",
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

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
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
