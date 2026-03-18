import { callChatCompletion } from "./llm-client";
import { generateWithGemini } from "../gemini-generation";
import { resolveSupportTaskModel } from "./model-routing";
import { buildLengthTargetsFromBudget } from "./word-budget";
import { buildLlmCostEntry, mergeNormalizedTokenUsage } from "./cost-ledger";
import { buildV8BlueprintPrompt, buildV8BlueprintSystemPrompt, resolveLengthTargets } from "./prompts";
import { formatBlueprintValidationIssues, validateV8Blueprint } from "./blueprint-validator";
import { getChildFocusNames, getCoreChapterCharacterNames } from "./character-focus";
import type {
  AvatarMemoryCompressed,
  BlueprintGenerationResult,
  CastSet,
  NormalizedRequest,
  SceneDirective,
  StoryBlueprintV8,
  StoryCostEntry,
  StoryDNA,
  TaleDNA,
  TokenUsage,
} from "./types";

export function resolvePromptVersionForRequest(input: {
  requestedPromptVersion?: string;
  defaultPromptVersion: "v7" | "v8";
  language: string;
  ageMax: number;
  chapterCount: number;
}): "v6" | "v7" | "v8" {
  const explicit = String(input.requestedPromptVersion || "").trim().toLowerCase();
  if (explicit === "v6" || explicit === "v7" || explicit === "v8") {
    return explicit;
  }

  if (
    input.defaultPromptVersion === "v8"
    && input.language === "de"
    && input.ageMax <= 8
    && input.chapterCount === 5
  ) {
    return "v8";
  }

  return "v7";
}

export async function generateValidatedV8Blueprint(input: {
  normalizedRequest: NormalizedRequest;
  cast: CastSet;
  dna: TaleDNA | StoryDNA;
  directives: SceneDirective[];
  blueprintRetryMax: number;
  candidateTag?: string;
  avatarMemories?: Map<string, AvatarMemoryCompressed[]>;
}): Promise<BlueprintGenerationResult> {
  const { normalizedRequest, cast, dna, directives } = input;
  const supportModel = resolveSupportTaskModel(String(normalizedRequest.rawConfig?.aiModel || ""));
  const lengthTargets = normalizedRequest.wordBudget
    ? buildLengthTargetsFromBudget(normalizedRequest.wordBudget)
    : resolveLengthTargets({
        lengthHint: normalizedRequest.lengthHint,
        ageRange: { min: normalizedRequest.ageMin, max: normalizedRequest.ageMax },
        pacing: normalizedRequest.rawConfig?.pacing,
      });

  let usage: TokenUsage | undefined;
  const costEntries: StoryCostEntry[] = [];
  let retryPrompt = "";

  for (let attempt = 1; attempt <= Math.max(1, input.blueprintRetryMax + 1); attempt += 1) {
    const userPrompt = [
      buildV8BlueprintPrompt({
        chapterCount: normalizedRequest.chapterCount,
        genre: normalizedRequest.rawConfig?.genre || normalizedRequest.category,
        setting: normalizedRequest.rawConfig?.setting || normalizedRequest.category,
        ageGroup: normalizedRequest.rawConfig?.ageGroup || `${normalizedRequest.ageMin}-${normalizedRequest.ageMax}`,
        cast,
        dna,
        directives,
        customStoryBeats: normalizedRequest.rawConfig?.customPrompt,
        previousAdventure: buildPreviousAdventureLine(input.avatarMemories),
      }),
      retryPrompt,
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = await callBlueprintModel({
      model: supportModel,
      systemPrompt: buildV8BlueprintSystemPrompt(normalizedRequest.language),
      userPrompt,
      storyId: normalizedRequest.storyId,
      candidateTag: input.candidateTag,
      attempt,
    });

    usage = mergeNormalizedTokenUsage(usage, result.usage, supportModel);
    const costEntry = buildLlmCostEntry({
      phase: "phase5.8-blueprint",
      step: "blueprint",
      usage: result.usage,
      fallbackModel: supportModel,
      candidateTag: input.candidateTag,
      attempt,
    });
    if (costEntry) costEntries.push(costEntry);

    const parsed = safeJson(result.content);
    const blueprint = normalizeBlueprintEnvelope(parsed);
    const validation = validateV8Blueprint({
      blueprint,
      chapterCount: normalizedRequest.chapterCount,
      ageMax: normalizedRequest.ageMax,
      wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
    });

    if (validation.valid && blueprint) {
      return {
        blueprint,
        model: supportModel,
        attempts: attempt,
        fallbackUsed: false,
        issues: validation.issues,
        usage,
        costEntries,
      };
    }

    retryPrompt = `Der Blueprint hat folgende Probleme:\n${formatBlueprintValidationIssues(validation.issues)}\n\nKorrigiere NUR diese Probleme und gib den vollstaendigen Blueprint erneut als JSON zurueck.`;
  }

  const fallback = buildDeterministicV8Blueprint({
    normalizedRequest,
    cast,
    directives,
    wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
  });
  const fallbackValidation = validateV8Blueprint({
    blueprint: fallback,
    chapterCount: normalizedRequest.chapterCount,
    ageMax: normalizedRequest.ageMax,
    wordsPerChapter: { min: lengthTargets.wordMin, max: lengthTargets.wordMax },
  });

  return {
    blueprint: fallback,
    model: supportModel,
    attempts: Math.max(1, input.blueprintRetryMax + 1),
    fallbackUsed: true,
    issues: fallbackValidation.issues,
    usage,
    costEntries,
  };
}

async function callBlueprintModel(input: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  storyId: string;
  candidateTag?: string;
  attempt: number;
}): Promise<{ content: string; usage?: Partial<TokenUsage> }> {
  if (input.model.startsWith("gemini-")) {
    const geminiResult = await generateWithGemini({
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      model: input.model,
      maxTokens: 2200,
      temperature: 0.2,
      thinkingBudget: 96,
      logSource: "phase5.8-blueprint-llm",
      logMetadata: { storyId: input.storyId, attempt: input.attempt, candidateTag: input.candidateTag },
    });

    return {
      content: geminiResult.content,
      usage: {
        promptTokens: geminiResult.usage.promptTokens,
        completionTokens: geminiResult.usage.completionTokens,
        totalTokens: geminiResult.usage.totalTokens,
        model: geminiResult.model,
      },
    };
  }

  return callChatCompletion({
    model: input.model,
    messages: [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: input.userPrompt },
    ],
    responseFormat: "json_object",
    maxTokens: 2200,
    reasoningEffort: "low",
    temperature: 0.2,
    context: "story-v8-blueprint",
    logSource: "phase5.8-blueprint-llm",
    logMetadata: { storyId: input.storyId, attempt: input.attempt, candidateTag: input.candidateTag },
  });
}

function normalizeBlueprintEnvelope(raw: any): StoryBlueprintV8 | null {
  if (!raw || typeof raw !== "object") return null;
  if (raw.blueprint && typeof raw.blueprint === "object") return raw.blueprint as StoryBlueprintV8;
  return raw as StoryBlueprintV8;
}

function buildPreviousAdventureLine(memories?: Map<string, AvatarMemoryCompressed[]>): string {
  if (!memories || memories.size === 0) return "";
  for (const entries of memories.values()) {
    const first = entries?.[0];
    if (!first?.storyTitle || !first?.experience) continue;
    return `Im letzten Abenteuer "${first.storyTitle}" passierte: ${first.experience}`;
  }
  return "";
}

function buildDeterministicV8Blueprint(input: {
  normalizedRequest: NormalizedRequest;
  cast: CastSet;
  directives: SceneDirective[];
  wordsPerChapter: { min: number; max: number };
}): StoryBlueprintV8 {
  const childNames = getChildFocusNames(input.cast);
  const lead = childNames[0] || input.cast.avatars[0]?.displayName || "Das Kind";
  const companion = childNames.find(name => name !== lead) || input.cast.avatars[1]?.displayName || lead;
  const activeFallback = [lead, companion].filter(Boolean).slice(0, 2);
  const midpointWords = Math.round((input.wordsPerChapter.min + input.wordsPerChapter.max) / 2);
  const chapterArcs = ["SETUP", "DISCOVERY", "TURNING_POINT", "DARKEST_MOMENT", "LANDING"] as const;

  const chapters = input.directives.slice(0, 5).map((directive, index) => {
    const activeCharacters = getCoreChapterCharacterNames({
      directive,
      cast: input.cast,
      ageMax: input.normalizedRequest.ageMax,
    }).slice(0, 2);
    const chapterNo = index + 1;
    const focusPair = activeCharacters.length > 0 ? activeCharacters : activeFallback;

    return {
      chapter: chapterNo,
      arc_label: chapterArcs[index],
      location: directive.setting,
      goal: directive.goal,
      obstacle: directive.conflict,
      active_characters: focusPair,
      supporting_characters: [],
      key_emotion: buildFallbackEmotion(chapterNo),
      key_scene: {
        what_happens: `${focusPair.join(" und ")} muessen auf das reagieren, was in ${directive.setting} schiefgeht.`,
        playable_moment: chapterNo === 3
          ? `${lead} ruft seine Idee zu frueh heraus und erschrickt sofort.`
          : `${focusPair[0] || lead} macht einen deutlichen Schritt oder eine Geste, die Kinder nachspielen koennen.`,
        quotable_line: chapterNo === 3
          ? `"Wartet! Ich weiss es!"`
          : `"Nicht weglaufen. Erst hinschauen."`,
      },
      chapter_hook: directive.outcome,
      word_target: midpointWords,
      dialogue_percentage: chapterNo === 4 ? 25 : 30,
    } satisfies StoryBlueprintV8["chapters"][number];
  });

  return {
    title: input.cast.artifact?.name ? `Das Geheimnis von ${input.cast.artifact.name}` : "Die falsche Spur",
    teaser: "Warum fuehrt die erste Spur genau dorthin, wo sie nicht hinwollen?",
    setting_type: "fantasy_familiar",
    narrative_perspective: "personal_third",
    tense: "preterite",
    pov_character: lead,
    chapters,
    humor_beats: [
      { chapter: 1, type: "character_behavior", description: `${companion} interpretiert eine Spur uebertrieben falsch und sorgt fuer ein erstes Schmunzeln.` },
      { chapter: 5, type: "warm_callback", description: `Ein frueher Satz taucht am Ende leicht veraendert wieder auf.` },
    ],
    error_and_repair: {
      who: lead,
      error_chapter: 3,
      error: `${lead} handelt aktiv zu frueh und macht den Plan kaputt.`,
      inner_reason: `${lead} will unbedingt beweisen, dass er die richtige Idee zuerst erkennt.`,
      body_signal: `${lead} spuert einen Knoten im Bauch und kalte Haende.`,
      repair_chapter: 5,
      repair: `${lead} haelt kurz inne, laesst den anderen zuerst sprechen und entscheidet dann bewusster.`,
    },
    arc_checkpoints: {
      ch1_feeling: "neugierig und leicht uebermuetig",
      ch2_feeling: "mutig, aber wacher als vorher",
      ch3_feeling: "Scham und Druck nach dem Fehler",
      ch4_feeling: "fast aufgeben, dann neuer innerer Halt",
      ch5_feeling: "Erleichterung, Waerme und kleine Reife",
    },
    iconic_scene: {
      chapter: 3,
      description: `${lead} reisst die Arme hoch, ruft seine Idee hinaus und merkt im selben Augenblick, dass genau das falsch war.`,
    },
  };
}

function buildFallbackEmotion(chapter: number): string {
  switch (chapter) {
    case 1: return "Neugier mit leichtem Kitzeln";
    case 2: return "Mut mit wachsender Spannung";
    case 3: return "Scham und Unruhe";
    case 4: return "Mutlosigkeit vor der Wende";
    case 5: return "Erleichterung und stille Freude";
    default: return "Spannung";
  }
}

function safeJson(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
