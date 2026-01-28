import type { NormalizedRequest, CastSet, StoryDNA, TaleDNA, SceneDirective, StoryDraft, StoryWriter, TokenUsage } from "./types";
import { buildStoryChapterPrompt, buildStoryTitlePrompt } from "./prompts";
import { callChatCompletion, calculateTokenCosts } from "./llm-client";

export class LlmStoryWriter implements StoryWriter {
  async writeStory(input: {
    normalizedRequest: NormalizedRequest;
    cast: CastSet;
    dna: TaleDNA | StoryDNA;
    directives: SceneDirective[];
    strict?: boolean;
  }): Promise<{ draft: StoryDraft; usage?: TokenUsage }> {
    const { normalizedRequest, cast, dna, directives, strict } = input;
    const model = normalizedRequest.rawConfig.aiModel || "gpt-5-mini";
    const systemPrompt = normalizedRequest.language === "de"
      ? "Du schreibst praezise, lebendige Kapitel fuer Kindergeschichten."
      : "You write precise, vivid chapters for children's stories.";

    const chapters = [] as StoryDraft["chapters"];
    let totalUsage: TokenUsage | undefined;

    for (const directive of directives) {
      const isFinal = directive.chapter === directives[directives.length - 1]?.chapter;
      const finalLine = isFinal
        ? (normalizedRequest.language === "de"
          ? "\nLetztes Kapitel: Kein Cliffhanger, ein sanfter Abschluss."
          : "\nFinal chapter: do NOT end on a cliffhanger.")
        : "";

      const prompt = buildStoryChapterPrompt({
        chapter: directive,
        cast,
        dna,
        language: normalizedRequest.language,
        ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
        tone: normalizedRequest.requestedTone,
        strict,
      }) + finalLine;

      const result = await callChatCompletion({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        responseFormat: "json_object",
        maxTokens: 2000,
        temperature: strict ? 0.4 : 0.7,
        context: "story-writer",
      });

      const parsed = safeJson(result.content);
      const title = parsed?.title || `Kapitel ${directive.chapter}`;
      const text = parsed?.text || result.content;

      chapters.push({
        chapter: directive.chapter,
        title,
        text,
      });

      if (result.usage) {
        totalUsage = mergeUsage(totalUsage, result.usage, model);
      }
    }

    const storyText = chapters.map(ch => `${ch.title}\n${ch.text}`).join("\n\n");

    const titlePrompt = buildStoryTitlePrompt({ storyText, language: normalizedRequest.language });
    let storyTitle = chapters[0]?.title || "Neue Geschichte";
    let storyDescription = chapters[0]?.text?.slice(0, 140) || "";

    try {
      const titleSystem = normalizedRequest.language === "de"
        ? "Du fasst Kindergeschichten knapp zusammen."
        : "You summarize children's stories.";
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
      const parsed = safeJson(titleResult.content);
      storyTitle = parsed?.title || storyTitle;
      storyDescription = parsed?.description || storyDescription;

      if (titleResult.usage) {
        totalUsage = mergeUsage(totalUsage, titleResult.usage, model);
      }
    } catch (error) {
      console.warn("[pipeline] Failed to generate story title", error);
    }

    return {
      draft: {
        title: storyTitle,
        description: storyDescription,
        chapters,
      },
      usage: totalUsage,
    };
  }
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
