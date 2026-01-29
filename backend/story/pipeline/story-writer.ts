import type { NormalizedRequest, CastSet, StoryBible, StoryDNA, StoryOutline, TaleDNA, SceneDirective, StoryDraft, StoryWriter, TokenUsage, WorldState } from "./types";
import { buildStoryChapterPrompt, buildStoryChapterRevisionPrompt, buildStoryTitlePrompt, resolveLengthTargets } from "./prompts";
import { buildLengthTargetsFromBudget } from "./word-budget";
import { callChatCompletion, calculateTokenCosts } from "./llm-client";
import { createStoryOutline } from "./outline-lock";
import { createInitialWorldState, updateWorldStateFromChapter } from "./world-state";

export class LlmStoryWriter implements StoryWriter {
  async writeStory(input: {
    normalizedRequest: NormalizedRequest;
    cast: CastSet;
    dna: TaleDNA | StoryDNA;
    directives: SceneDirective[];
    storyBible?: StoryBible;
    outline?: StoryOutline;
    initialWorldState?: WorldState;
    strict?: boolean;
    stylePackText?: string;
  }): Promise<{ draft: StoryDraft; usage?: TokenUsage; outline?: StoryOutline; worldStates?: WorldState[] }> {
    const { normalizedRequest, cast, dna, directives, strict, stylePackText, storyBible } = input;
    let outline = input.outline;
    let worldState = input.initialWorldState;
    const model = normalizedRequest.rawConfig.aiModel || "gpt-5-mini";
    const isReasoningModel = model.includes("gpt-5") || model.includes("o4");
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
    const worldStates: WorldState[] = [];
    let totalUsage: TokenUsage | undefined;

    if (!outline && storyBible) {
      outline = await createStoryOutline({
        normalized: normalizedRequest,
        storyBible,
        cast,
        chapterCount: directives.length,
      });
    }

    if (!worldState && storyBible) {
      worldState = createInitialWorldState({
        normalized: normalizedRequest,
        firstDirective: directives[0],
        cast,
        storyBible,
      });
    }

    for (const directive of directives) {
      const outlineChapter = outline?.chapters?.find(ch => ch.chapter === directive.chapter);
      const lastSummary = chapters.length > 0 ? summarizeChapter(chapters[chapters.length - 1]?.text || "", normalizedRequest.language) : undefined;
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
        storyBible,
        outlineChapter,
        worldState,
        lastChapterSummary: lastSummary,
      }) + finalLine;

      const result = await callChatCompletion({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        responseFormat: "json_object",
        maxTokens: isReasoningModel ? 5000 : 2000,
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
          storyBible,
          outlineChapter,
          worldState,
        }) + finalLine;

        const revisionResult = await callChatCompletion({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: revisionPrompt },
          ],
          responseFormat: "json_object",
          maxTokens: isReasoningModel ? 6000 : 2400,
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

      if (storyBible && worldState) {
        try {
          const updated = await updateWorldStateFromChapter({
            normalized: normalizedRequest,
            storyBible,
            directive,
            previousState: worldState,
            chapterText: text,
            cast,
          });
          worldStates.push(updated);
          worldState = updated;
        } catch (error) {
          console.warn("[pipeline] WorldState update failed", error);
        }
      }

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
            storyBible,
            outlineChapter: outline?.chapters?.find(ch => ch.chapter === directive.chapter),
            worldState: worldStates.find(ws => ws.chapter === directive.chapter) ?? worldState,
          });

          const revisionResult = await callChatCompletion({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: revisionPrompt },
            ],
            responseFormat: "json_object",
            maxTokens: isReasoningModel ? 6500 : 2600,
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

    if (storyBible && outline) {
      const cohesive = await runCohesionPass({
        normalizedRequest,
        storyBible,
        outline,
        chapters,
      });
      if (cohesive) {
        chapters.splice(0, chapters.length, ...cohesive);
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
        maxTokens: isReasoningModel ? 2000 : 800,
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
      outline,
      worldStates,
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

  if (directive.continuityMust?.length) {
    directive.continuityMust.forEach((item) => {
      if (item.startsWith("ENTRY:") || item.startsWith("EXIT:")) {
        const parts = item.split(":")[1]?.trim() || "";
        const name = parts.split(" - ")[0]?.trim();
        if (name && !textLower.includes(name.toLowerCase())) {
          issues.push(language === "de"
            ? `Entry/Exit fehlt: ${name}`
            : `Entry/Exit missing: ${name}`);
        }
      }
    });
  }

  if (directive.openLoopsToAddress?.length) {
    const hasLoop = directive.openLoopsToAddress.some(loop => containsKeyword(textLower, loop));
    if (!hasLoop) {
      issues.push(language === "de"
        ? "Offene Schleife wurde nicht aufgegriffen"
        : "Open loop not addressed");
    }
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

function containsKeyword(textLower: string, phrase: string): boolean {
  const tokens = phrase.toLowerCase().split(/\s+/).filter(t => t.length >= 4);
  if (tokens.length === 0) return false;
  return tokens.some(token => textLower.includes(token));
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

function summarizeChapter(text: string, language: string): string {
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  const maxSentences = 3;
  const summary = sentences.slice(0, maxSentences).join(". ");
  return summary ? summary + "." : (language === "de" ? "Kein vorheriges Kapitel." : "No previous chapter.");
}

async function runCohesionPass(input: {
  normalizedRequest: NormalizedRequest;
  storyBible: StoryBible;
  outline: StoryOutline;
  chapters: StoryDraft["chapters"];
}): Promise<StoryDraft["chapters"] | null> {
  const { normalizedRequest, storyBible, outline, chapters } = input;
  const model = normalizedRequest.rawConfig.aiModel || "gpt-5-mini";
  const isGerman = normalizedRequest.language === "de";
  const chapterBlock = chapters.map(ch => `Kapitel ${ch.chapter}: ${ch.title}\n${ch.text}`).join("\n\n");

  const prompt = isGerman
    ? `Fasse die Geschichte zu einer kohärenten, durchgehenden Erzaehlung zusammen, ohne neue Figuren zu erfinden.

StoryBible:
Ziel: ${storyBible.coreGoal}
Problem: ${storyBible.coreProblem}
Mystery: ${storyBible.mysteryOrQuestion}
EntryContracts: ${JSON.stringify(storyBible.entryContracts)}
ExitContracts: ${JSON.stringify(storyBible.exitContracts)}

Outline:
${outline.chapters.map(ch => `Kapitel ${ch.chapter}: ${ch.title} | ${ch.subgoal} | ${ch.reversal} | ${ch.hook}`).join("\n")}

REGELN:
1) Keine neuen Namen.
2) Entry/Exit Begruendungen muessen im Text erkennbar sein.
3) Jedes Kapitel muss das Kernziel oder Mystery beruehren.
4) Behalte Titel bei oder verbessere sie minimal.

Geschichte:
${chapterBlock}

Gib JSON:
{ "chapters": [ { "chapter": 1, "title": "...", "text": "..." } ] }`
    : `Make the story globally coherent without adding new characters.

StoryBible:
Goal: ${storyBible.coreGoal}
Problem: ${storyBible.coreProblem}
Mystery: ${storyBible.mysteryOrQuestion}
EntryContracts: ${JSON.stringify(storyBible.entryContracts)}
ExitContracts: ${JSON.stringify(storyBible.exitContracts)}

Outline:
${outline.chapters.map(ch => `Chapter ${ch.chapter}: ${ch.title} | ${ch.subgoal} | ${ch.reversal} | ${ch.hook}`).join("\n")}

RULES:
1) No new names.
2) Entry/Exit reasons must be reflected in text.
3) Each chapter must touch the core goal or mystery.
4) Keep titles or adjust minimally.

Story:
${chapters.map(ch => `Chapter ${ch.chapter}: ${ch.title}\n${ch.text}`).join("\n\n")}

Return JSON:
{ "chapters": [ { "chapter": 1, "title": "...", "text": "..." } ] }`;

  const result = await callChatCompletion({
    model,
    messages: [
      { role: "system", content: isGerman ? "Du bist eine strenge Lektorin fuer Kontinuitaet." : "You are a strict cohesion editor." },
      { role: "user", content: prompt },
    ],
    responseFormat: "json_object",
    maxTokens: isReasoningModel ? 5500 : 2200,
    temperature: 0.3,
    context: "story-cohesion",
  });

  const parsed = safeJson(result.content);
  if (!parsed || !Array.isArray(parsed.chapters) || parsed.chapters.length !== chapters.length) {
    throw new Error("Cohesion pass failed: invalid chapter count");
  }
  const normalized = parsed.chapters.map((ch: any, idx: number) => ({
    chapter: typeof ch.chapter === "number" ? ch.chapter : idx + 1,
    title: typeof ch.title === "string" && ch.title.trim().length > 0 ? ch.title : chapters[idx].title,
    text: typeof ch.text === "string" && ch.text.trim().length > 0 ? ch.text : chapters[idx].text,
  }));
  return normalized;
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
