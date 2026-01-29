import type { NormalizedRequest, CastSet, StoryDNA, TaleDNA, SceneDirective, StoryDraft, StoryWriter, TokenUsage } from "./types";
import { buildStoryChapterPrompt, buildStoryChapterRevisionPrompt, buildStoryTitlePrompt, resolveLengthTargets } from "./prompts";
import { buildLengthTargetsFromBudget } from "./word-budget";
import { callChatCompletion, calculateTokenCosts } from "./llm-client";

export class LlmStoryWriter implements StoryWriter {
  async writeStory(input: {
    normalizedRequest: NormalizedRequest;
    cast: CastSet;
    dna: TaleDNA | StoryDNA;
    directives: SceneDirective[];
    strict?: boolean;
    stylePackText?: string;
  }): Promise<{ draft: StoryDraft; usage?: TokenUsage }> {
    const { normalizedRequest, cast, dna, directives, strict, stylePackText } = input;
    const model = normalizedRequest.rawConfig.aiModel || "gpt-5-mini";
    const systemPrompt = normalizedRequest.language === "de"
      ? "Du bist eine erfahrene Kinderbuchautorin. Schreibe warm, bildhaft, rhythmisch und klar, wie in hochwertigen Kinderbuechern."
      : "You are an experienced children's book author. Write warm, vivid, rhythmic, and clear prose.";
    const lengthTargets = normalizedRequest.wordBudget
      ? buildLengthTargetsFromBudget(normalizedRequest.wordBudget)
      : resolveLengthTargets({
          lengthHint: normalizedRequest.lengthHint,
          ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
          pacing: normalizedRequest.rawConfig?.pacing,
        });

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
        lengthHint: normalizedRequest.lengthHint,
        pacing: normalizedRequest.rawConfig?.pacing,
        lengthTargets,
        stylePackText,
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

      let parsed = safeJson(result.content);
      let title = parsed?.title || `Kapitel ${directive.chapter}`;
      let text = parsed?.text || result.content;

      const issues = validateChapterText({
        directive,
        cast,
        text,
        language: normalizedRequest.language,
        lengthTargets,
      });

      if (issues.length > 0) {
        const revisionPrompt = buildStoryChapterRevisionPrompt({
          chapter: directive,
          cast,
          dna,
          language: normalizedRequest.language,
          ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
          tone: normalizedRequest.requestedTone,
          lengthHint: normalizedRequest.lengthHint,
          pacing: normalizedRequest.rawConfig?.pacing,
          lengthTargets,
          stylePackText,
          issues,
          originalText: text,
        }) + finalLine;

        const revisionResult = await callChatCompletion({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: revisionPrompt },
          ],
          responseFormat: "json_object",
          maxTokens: 2400,
          temperature: 0.4,
          context: "story-writer-revision",
        });

        parsed = safeJson(revisionResult.content);
        title = parsed?.title || title;
        text = parsed?.text || text;

        if (revisionResult.usage) {
          totalUsage = mergeUsage(totalUsage, revisionResult.usage, model);
        }
      }

      chapters.push({
        chapter: directive.chapter,
        title,
        text,
      });

      if (result.usage) {
        totalUsage = mergeUsage(totalUsage, result.usage, model);
      }
    }

    if (normalizedRequest.wordBudget) {
      const totalWords = chapters.reduce((sum, ch) => sum + countWords(ch.text), 0);
      const budget = normalizedRequest.wordBudget;
      if (totalWords < budget.minWords || totalWords > budget.maxWords) {
        const adjustMode = totalWords < budget.minWords ? "expand" : "trim";
        const factorRaw = budget.targetWords / Math.max(1, totalWords);
        const factor = adjustMode === "expand"
          ? Math.min(1.3, Math.max(1.05, factorRaw))
          : Math.max(0.75, Math.min(0.95, factorRaw));

        const adjustedTargets = scaleLengthTargets(lengthTargets, factor);

        const revisedChapters: StoryDraft["chapters"] = [];
        for (const directive of directives) {
          const current = chapters.find(ch => ch.chapter === directive.chapter);
          if (!current) continue;

          const issues = [
            adjustMode === "expand"
              ? (normalizedRequest.language === "de"
                ? "Kapitel zu kurz, erweitere mit sinnlichen Details und Dialog"
                : "Chapter too short, expand with sensory detail and dialogue")
              : (normalizedRequest.language === "de"
                ? "Kapitel zu lang, straffe ohne Plotverlust"
                : "Chapter too long, trim without losing plot"),
          ];

          const revisionPrompt = buildStoryChapterRevisionPrompt({
            chapter: directive,
            cast,
            dna,
            language: normalizedRequest.language,
            ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
            tone: normalizedRequest.requestedTone,
            lengthHint: normalizedRequest.lengthHint,
            pacing: normalizedRequest.rawConfig?.pacing,
            lengthTargets: adjustedTargets,
            stylePackText,
            issues,
            originalText: current.text,
          });

          const revisionResult = await callChatCompletion({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: revisionPrompt },
            ],
            responseFormat: "json_object",
            maxTokens: 2600,
            temperature: 0.4,
            context: "story-writer-length-adjust",
          });

          const parsed = safeJson(revisionResult.content);
          revisedChapters.push({
            chapter: current.chapter,
            title: parsed?.title || current.title,
            text: parsed?.text || current.text,
          });

          if (revisionResult.usage) {
            totalUsage = mergeUsage(totalUsage, revisionResult.usage, model);
          }
        }

        if (revisedChapters.length === chapters.length) {
          chapters.splice(0, chapters.length, ...revisedChapters);
        }
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

function validateChapterText(input: {
  directive: SceneDirective;
  cast: CastSet;
  text: string;
  language: string;
  lengthTargets: { wordMin: number; wordMax: number };
}): string[] {
  const { directive, cast, text, language, lengthTargets } = input;
  const textLower = text.toLowerCase();
  const issues: string[] = [];

  const characterSlots = directive.charactersOnStage.filter(slot => !slot.includes("ARTIFACT"));
  for (const slot of characterSlots) {
    const name = findCharacterName(cast, slot);
    if (!name) continue;
    if (!textLower.includes(name.toLowerCase())) {
      issues.push(language === "de"
        ? `Figur fehlt: ${name}`
        : `Missing character: ${name}`);
    }
  }

  if (directive.charactersOnStage.some(slot => slot.includes("ARTIFACT"))) {
    const artifactName = cast.artifact?.name?.toLowerCase();
    if (artifactName && !textLower.includes(artifactName)) {
      issues.push(language === "de" ? "Artefaktname fehlt" : "Artifact name missing");
    }
  }

  const banned = language === "de"
    ? ["gehoeren seit jeher", "ganz selbstverstaendlich dabei", "gehören seit jeher", "ganz selbstverständlich dabei"]
    : ["have always been part of this tale", "always been part of this tale", "naturally belongs here"];
  if (banned.some(phrase => textLower.includes(phrase))) {
    issues.push(language === "de"
      ? "Verbotene Kanon-Formulierung verwendet"
      : "Forbidden canon phrasing used");
  }

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < lengthTargets.wordMin) {
    issues.push(language === "de"
      ? `Kapitel zu kurz (${wordCount} Woerter)`
      : `Chapter too short (${wordCount} words)`);
  } else if (wordCount > lengthTargets.wordMax) {
    issues.push(language === "de"
      ? `Kapitel zu lang (${wordCount} Woerter)`
      : `Chapter too long (${wordCount} words)`);
  }

  return issues;
}

function findCharacterName(cast: CastSet, slotKey: string): string | null {
  const sheet = cast.avatars.find(a => a.slotKey === slotKey) || cast.poolCharacters.find(c => c.slotKey === slotKey);
  return sheet?.displayName ?? null;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function scaleLengthTargets(
  targets: { wordMin: number; wordMax: number; sentenceMin: number; sentenceMax: number },
  factor: number
): { wordMin: number; wordMax: number; sentenceMin: number; sentenceMax: number } {
  const wordMin = Math.max(80, Math.round(targets.wordMin * factor));
  const wordMax = Math.max(wordMin + 40, Math.round(targets.wordMax * factor));
  const sentenceMin = Math.max(6, Math.round(wordMin / 18));
  const sentenceMax = Math.max(sentenceMin + 2, Math.round(wordMax / 14));
  return { wordMin, wordMax, sentenceMin, sentenceMax };
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
