/**
 * Story Soul Generator (Stage 0 – vor Blueprint)
 *
 * Erzeugt die "Seele" einer Kindergeschichte VOR dem Blueprint. Die Soul
 * trägt die emotionalen und strukturellen Weichen: Premise, Hook, Stakes,
 * Figur-Fingerprints, Welt-Textur, Payoff-Versprechen. Der Generator
 * - ruft ein LLM (Gemini bevorzugt, sonst OpenAI / Runware-MiniMax)
 * - parst die Antwort zu einem rohen JSON
 * - validiert gegen das StorySoul-Schema
 * - retried mit gezieltem Reparatur-Prompt, wenn der Validator meckert
 *
 * Gibt immer entweder eine valide Soul zurück – oder eine valide Fallback-Soul,
 * die aus dem Cast rückseitig abgeleitet ist (damit die Pipeline nicht bricht,
 * wenn das LLM katastrophal kippt). Die Fallback-Soul ist bewusst schmal
 * gehalten; der Orchestrator kann über `fallbackUsed` entscheiden, ob er den
 * Lauf abbrechen oder weitermachen möchte.
 *
 * Siehe STORY_QUALITY_RADICAL_PLAN.md Abschnitt 4 für Hintergrund.
 */

import { callChatCompletion } from "./llm-client";
import { generateWithGemini } from "../gemini-generation";
import {
  GEMINI_MAIN_STORY_MODEL,
  isMiniMaxFamilyModel,
  resolveSupportTaskModel,
} from "./model-routing";
import {
  generateWithRunwareText,
  isRunwareConfigured,
} from "../runware-text-generation";
import { buildLlmCostEntry, mergeNormalizedTokenUsage } from "./cost-ledger";
import { getChildFocusNames } from "./character-focus";
import {
  formatStorySoulIssues,
  parseStorySoulFromLLM,
  validateStorySoul,
  type StorySoul,
  type StorySoulCharacterFingerprint,
  type StorySoulSupportingCharacter,
  type StorySoulValidationIssue,
  type StorySoulValidationResult,
} from "./schemas/story-soul";
import type {
  CastSet,
  NormalizedRequest,
  SceneDirective,
  StoryCostEntry,
  StoryDNA,
  TaleDNA,
  TokenUsage,
} from "./types";

// ────────────────────────── Public API ──────────────────────────

export interface StorySoulGenerationResult {
  soul: StorySoul;
  model: string;
  attempts: number;
  fallbackUsed: boolean;
  issues: StorySoulValidationIssue[];
  usage?: TokenUsage;
  costEntries: StoryCostEntry[];
}

export interface StorySoulGenerationInput {
  normalizedRequest: NormalizedRequest;
  cast: CastSet;
  dna?: TaleDNA | StoryDNA;
  directives?: SceneDirective[];
  soulRetryMax?: number;
  candidateTag?: string;
  maxOutputTokens?: number;
}

export async function generateValidatedStorySoul(
  input: StorySoulGenerationInput,
): Promise<StorySoulGenerationResult> {
  const { normalizedRequest, cast } = input;
  const supportModel = resolveSupportTaskModel(
    String(normalizedRequest.rawConfig?.aiModel || ""),
  );
  const soulModel = resolveSoulPrimaryModel(
    normalizedRequest.rawConfig?.aiModel,
    supportModel,
  );

  const expectedAvatarNames = cast.avatars
    .map((a) => a.displayName)
    .filter(Boolean);
  const requiredCoverCastNames = cast.poolCharacters
    .map((c) => c.displayName)
    .filter(Boolean);

  const systemPrompt = buildStorySoulSystemPrompt(normalizedRequest.language);
  const baseUserPrompt = buildStorySoulUserPrompt({
    normalizedRequest,
    cast,
    dna: input.dna,
    directives: input.directives,
    expectedAvatarNames,
    requiredCoverCastNames,
  });

  const maxRetries = Math.max(0, input.soulRetryMax ?? 2);
  const totalAttempts = maxRetries + 1;

  let usage: TokenUsage | undefined;
  const costEntries: StoryCostEntry[] = [];
  let retryInstruction = "";
  let lastIssues: StorySoulValidationIssue[] = [];
  let attemptsMade = 0;
  let providerFailure: Error | null = null;

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    attemptsMade = attempt;

    const userPrompt = [baseUserPrompt, retryInstruction]
      .filter(Boolean)
      .join("\n\n");

    let result: { content: string; usage?: Partial<TokenUsage> };
    try {
      result = await callSoulModel({
        model: soulModel,
        systemPrompt,
        userPrompt,
        storyId: normalizedRequest.storyId,
        candidateTag: input.candidateTag,
        attempt,
        maxOutputTokensOverride: input.maxOutputTokens,
      });
      providerFailure = null;
    } catch (error) {
      providerFailure = toSoulProviderError(error);
      break;
    }

    const actualModel = result.usage?.model || soulModel;
    usage = mergeNormalizedTokenUsage(usage, result.usage, actualModel);
    const costEntry = buildLlmCostEntry({
      phase: "phase5.7-soul",
      step: "story-soul",
      usage: result.usage,
      fallbackModel: actualModel,
      candidateTag: input.candidateTag,
      attempt,
    });
    if (costEntry) costEntries.push(costEntry);

    const parsed = parseStorySoulFromLLM(result.content);
    const validation: StorySoulValidationResult = validateStorySoul(parsed, {
      chapterCount: normalizedRequest.chapterCount,
      expectedAvatarNames,
      requiredCoverCastNames,
    });

    if (validation.valid && validation.soul) {
      return {
        soul: validation.soul,
        model: actualModel,
        attempts: attempt,
        fallbackUsed: false,
        issues: validation.issues,
        usage,
        costEntries,
      };
    }

    lastIssues = validation.issues;
    retryInstruction = buildRetryInstruction(validation.issues);
  }

  // Rescue: ein anderer starker Model-Pfad (Cross-Provider Fallback)
  const rescueModel = resolveSoulRescueModel(
    normalizedRequest.rawConfig?.aiModel,
    soulModel,
  );
  if (rescueModel) {
    const rescueAttempt = Math.max(1, totalAttempts + 1);
    attemptsMade = rescueAttempt;
    const rescuePrompt = [
      baseUserPrompt,
      retryInstruction,
      "Denke strukturiert. Liefere konkrete, riechbare Details statt abstrakter Begriffe ('Abenteuer', 'geheimnisvoll', 'magisch' sind verboten). Gib nur das StorySoul-JSON zurück.",
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      const rescueResult = await callSoulModel({
        model: rescueModel,
        systemPrompt,
        userPrompt: rescuePrompt,
        storyId: normalizedRequest.storyId,
        candidateTag: input.candidateTag,
        attempt: rescueAttempt,
        maxOutputTokensOverride: input.maxOutputTokens,
      });
      providerFailure = null;

      const actualRescueModel = rescueResult.usage?.model || rescueModel;
      usage = mergeNormalizedTokenUsage(usage, rescueResult.usage, actualRescueModel);
      const rescueCost = buildLlmCostEntry({
        phase: "phase5.7-soul",
        step: "story-soul-rescue",
        usage: rescueResult.usage,
        fallbackModel: actualRescueModel,
        candidateTag: input.candidateTag,
        attempt: rescueAttempt,
      });
      if (rescueCost) costEntries.push(rescueCost);

      const rescueParsed = parseStorySoulFromLLM(rescueResult.content);
      const rescueValidation = validateStorySoul(rescueParsed, {
        chapterCount: normalizedRequest.chapterCount,
        expectedAvatarNames,
        requiredCoverCastNames,
      });

      if (rescueValidation.valid && rescueValidation.soul) {
        return {
          soul: rescueValidation.soul,
          model: actualRescueModel,
          attempts: rescueAttempt,
          fallbackUsed: false,
          issues: rescueValidation.issues,
          usage,
          costEntries,
        };
      }

      lastIssues = rescueValidation.issues;
    } catch (error) {
      providerFailure = toSoulProviderError(error);
    }
  }

  // Deterministischer Fallback – erlaubt der Pipeline weiterzulaufen
  const fallbackSoul = buildDeterministicSoulFallback({
    normalizedRequest,
    cast,
    providerFailure,
  });

  const fallbackIssues: StorySoulValidationIssue[] = [
    ...lastIssues,
    {
      path: "$",
      code: "SOUL_FALLBACK_USED",
      severity: "WARNING",
      message: providerFailure
        ? `Provider-Fehler, deterministischer Soul-Fallback aktiv: ${providerFailure.message}`
        : "Soul-Validierung fehlgeschlagen, deterministischer Fallback aktiv.",
    },
  ];

  return {
    soul: fallbackSoul,
    model: soulModel,
    attempts: attemptsMade || totalAttempts,
    fallbackUsed: true,
    issues: fallbackIssues,
    usage,
    costEntries,
  };
}

// ────────────────────────── Prompts ──────────────────────────

function buildStorySoulSystemPrompt(language: string): string {
  const isGerman = String(language || "").toLowerCase().startsWith("de");
  if (!isGerman) {
    return [
      "You are a senior children's book editor in the tradition of Oetinger/Carlsen,",
      "working like Margit Auer and Paul Maar. You write the SOUL of a book –",
      "premise, hook, emotional stakes, character fingerprints, world texture, payoff –",
      "BEFORE anyone writes a single line of prose.",
      "",
      "Hard rules:",
      "- Forbidden abstract words: 'adventure', 'mysterious', 'magical', 'must find out', 'somehow'.",
      "- Every premise must be retellable by a 7-year-old at dinner in ONE sentence.",
      "- Every character needs a fingerprint: one macke, one running gag, one body tell, one taboo word.",
      "- Cover cast (dragons, squirrels, etc.) MUST be in the supportingCast array with a firstAppearanceChapter.",
      "- World must have smell, sound, and a real place name (not 'the forest' but 'Crumb Forest behind Grandma's bakery').",
      "- Payoff must echo chapter 1 concretely, not just thematically.",
      "",
      "Return a single StorySoul JSON object. No prose, no markdown fences, no comments.",
    ].join("\n");
  }

  return [
    "Du bist eine erfahrene Kinderbuch-Lektorin in der Tradition von Oetinger/Carlsen,",
    "arbeitest wie Margit Auer und Paul Maar. Du schreibst die SEELE eines Buches –",
    "Premise, Hook, emotionale Stakes, Figur-Fingerabdrücke, Welt-Textur, Payoff-Versprechen –",
    "BEVOR irgendwer eine Zeile Prosa schreibt.",
    "",
    "Harte Regeln:",
    "- Verbotene Abstraktionen: 'Abenteuer', 'geheimnisvoll', 'magisch', 'müssen herausfinden', 'irgendwie'.",
    "- Die Premise muss ein 7-Jähriger beim Abendessen in EINEM Satz nacherzählen können.",
    "- Jede Hauptfigur braucht einen Fingerabdruck: eine Macke, einen Running-Gag, ein Körper-Tell, ein Tabu-Wort.",
    "- Cover-Cast (Drachen, Eichhörnchen, etc.) MUSS in supportingCast auftauchen – mit firstAppearanceChapter.",
    "- Die Welt braucht Geruch, Ton und einen echten Ortsnamen (nicht 'der Wald', sondern 'Krümelwald hinter Omas Bäckerei').",
    "- Der Payoff muss ein KONKRETES Element aus Kapitel 1 in Kapitel 5 anders wiederholen (callbackFromChapter1).",
    "- Cliffhanger sind EMOTIONAL (Beziehungsspannung), nicht informativ ('sie fanden einen Hinweis').",
    "",
    "Gib genau ein StorySoul-JSON zurück. Keine Prosa, keine Markdown-Fences, keine Kommentare.",
  ].join("\n");
}

function buildStorySoulUserPrompt(args: {
  normalizedRequest: NormalizedRequest;
  cast: CastSet;
  dna?: TaleDNA | StoryDNA;
  directives?: SceneDirective[];
  expectedAvatarNames: string[];
  requiredCoverCastNames: string[];
}): string {
  const { normalizedRequest: req, cast } = args;
  const ageLabel = `${req.ageMin}-${req.ageMax}`;
  const lang = String(req.language || "de").toLowerCase();
  const childNames = getChildFocusNames(cast);
  const lead = childNames[0] || cast.avatars[0]?.displayName || "das Kind";
  const companion =
    childNames.find((n) => n !== lead) || cast.avatars[1]?.displayName || "";

  const avatarLines = cast.avatars
    .map((a) => {
      const age = (a as any)?.age;
      const personalityTags = Array.isArray(a.personalityTags)
        ? a.personalityTags.filter(Boolean).slice(0, 5).join(", ")
        : "";
      const speech = Array.isArray(a.speechStyleHints)
        ? a.speechStyleHints.filter(Boolean).slice(0, 3).join(", ")
        : "";
      return [
        `- ${a.displayName}${age ? ` (${age} J.)` : ""}`,
        personalityTags ? `  Persönlichkeit: ${personalityTags}` : "",
        speech ? `  Sprache: ${speech}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const coverLines = cast.poolCharacters
    .map((p) => {
      const archetype = p.archetype ? ` [${p.archetype}]` : "";
      const species = p.species ? ` – ${p.species}` : "";
      return `- ${p.displayName}${species}${archetype}`;
    })
    .join("\n");

  const artifactLine = cast.artifact?.name
    ? `Artefakt: ${cast.artifact.name}${cast.artifact.storyUseRule ? ` – ${cast.artifact.storyUseRule}` : ""}`
    : "";

  const dnaBlock = args.dna
    ? buildDnaBlock(args.dna)
    : "";

  const directiveBlock = args.directives && args.directives.length > 0
    ? buildDirectivesBlock(args.directives)
    : "";

  const genre = req.rawConfig?.genre || req.category;
  const setting = req.rawConfig?.setting || "";
  const customPrompt = req.rawConfig?.customPrompt
    ? `\nZusatzwunsch des Users: ${req.rawConfig.customPrompt}`
    : "";

  const isGerman = lang.startsWith("de");
  const heading = isGerman
    ? "AUFGABE: Schreibe die StorySoul für genau diese Geschichte."
    : "TASK: Write the StorySoul for exactly this story.";

  const parameterBlock = isGerman
    ? [
        `Sprache: ${lang}`,
        `Altersgruppe: ${ageLabel}`,
        `Kapitelzahl: ${req.chapterCount}`,
        `Genre: ${genre}`,
        setting ? `Setting-Hinweis: ${setting}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : [
        `Language: ${lang}`,
        `Age: ${ageLabel}`,
        `Chapters: ${req.chapterCount}`,
        `Genre: ${genre}`,
        setting ? `Setting hint: ${setting}` : "",
      ]
        .filter(Boolean)
        .join("\n");

  const cover = cast.poolCharacters.length > 0
    ? (isGerman
      ? `\nCover-Cast (MUSS in supportingCast auftauchen – sonst wird der junge Leser betrogen):\n${coverLines}`
      : `\nCover cast (MUST appear in supportingCast – otherwise we cheat the young reader):\n${coverLines}`)
    : "";

  const schemaHint = buildSchemaHint(isGerman);

  const focusHint = companion
    ? (isGerman
      ? `\nHauptfiguren im Vordergrund: ${lead} und ${companion}.`
      : `\nMain focus: ${lead} and ${companion}.`)
    : (isGerman ? `\nHauptfigur: ${lead}.` : `\nMain focus: ${lead}.`);

  return [
    heading,
    "",
    parameterBlock,
    "",
    isGerman ? "Hauptfiguren (Avatare):" : "Main characters (avatars):",
    avatarLines,
    cover,
    artifactLine,
    focusHint,
    customPrompt,
    dnaBlock,
    directiveBlock,
    "",
    schemaHint,
  ]
    .filter((part) => part !== undefined && part !== null && String(part).length > 0)
    .join("\n");
}

function buildDnaBlock(dna: TaleDNA | StoryDNA): string {
  const title = (dna as TaleDNA).title || "";
  const themes = Array.isArray((dna as any).themeTags)
    ? (dna as any).themeTags.slice(0, 6).join(", ")
    : "";
  const conflict = (dna as any).coreConflict || "";
  const iconic = Array.isArray((dna as TaleDNA).iconicBeats)
    ? (dna as TaleDNA).iconicBeats.slice(0, 4).join(" | ")
    : "";
  const lines = [
    "",
    "Referenz-DNA (darf inspirieren, nicht kopieren):",
    title ? `- Titel: ${title}` : "",
    themes ? `- Themen: ${themes}` : "",
    conflict ? `- Kernkonflikt: ${conflict}` : "",
    iconic ? `- Ikonische Beats: ${iconic}` : "",
  ].filter(Boolean);
  return lines.length > 1 ? lines.join("\n") : "";
}

function buildDirectivesBlock(directives: SceneDirective[]): string {
  const top = directives.slice(0, 5).map((d) => {
    const parts = [
      `Ch${d.chapter}:`,
      d.setting ? `Ort="${d.setting}"` : "",
      d.goal ? `Ziel="${d.goal}"` : "",
      d.conflict ? `Konflikt="${d.conflict}"` : "",
    ].filter(Boolean);
    return `- ${parts.join(" ")}`;
  });
  if (top.length === 0) return "";
  return [
    "",
    "Bestehende Szenen-Direktiven (sollen in Soul widergespiegelt, aber NICHT mechanisch kopiert werden):",
    ...top,
  ].join("\n");
}

function buildSchemaHint(isGerman: boolean): string {
  if (!isGerman) {
    return [
      "Output: single JSON object with this exact top-level shape:",
      "{",
      '  "premise": string (>=20 chars, retellable by a 7yo),',
      '  "hookQuestion": string (emotional question after chapter 1),',
      '  "emotionalStakes": { "what": string, "why": string, "whoCares": string },',
      '  "worldTexture": { "anchors": [string, string, string], "senseDetails": string, "placeName": string },',
      '  "characterFingerprints": [ { name, role, coreMacke, runningGag, favoriteWords[], tabooWords[], bodyTell, wantIneedle, fearInternal, voiceExample } ... ],',
      '  "supportingCast": [ { name, purpose, firstAppearanceChapter, signaturAction, description } ... ],',
      '  "payoffPromise": { emotionalLanding, transformationOfChild, finalImage, callbackFromChapter1 },',
      '  "antagonism": { type: "internal"|"external"|"social"|"nature", specific, resolvesHow, appearsInChapters: [int,int,...] (>=2 chapters where antagonist is physically present OR its effect is directly visible — footprint, sound, smell, damage; mere mention does NOT count), threatRealizedOnce: { chapter: int, what: string } (one concrete scene where the threatened danger actually happens, age-appropriate) },',
      '  "benchmarkBook": { title, whyMatch, voiceReference },',
      '  "humorBeats": [ { chapter, type, what, exactLine } ... ] (exactLine: verbatim line <=140 chars the writer MUST use — dialogue or present-tense physical beat),',
      '  "chapterEndings": [ { chapter, type, what } ... ] (chapters 1..N-1),',
      '  "iconicScenes": [string, string, string]',
      "}",
      "Return JSON only. No prose around it.",
    ].join("\n");
  }
  return [
    "Ausgabe: genau ein JSON-Objekt mit dieser Struktur:",
    "{",
    '  "premise": string (>=20 Zeichen, nacherzählbar von 7-Jährigem),',
    '  "hookQuestion": string (emotionale Frage nach Kapitel 1),',
    '  "emotionalStakes": { "what": string, "why": string, "whoCares": string },',
    '  "worldTexture": { "anchors": [string, string, string], "senseDetails": string, "placeName": string },',
    '  "characterFingerprints": [ { name, role, coreMacke, runningGag, favoriteWords[], tabooWords[], bodyTell, wantIneedle, fearInternal, voiceExample } ... ],',
    '  "supportingCast": [ { name, purpose, firstAppearanceChapter, signaturAction, description } ... ],',
    '  "payoffPromise": { emotionalLanding, transformationOfChild, finalImage, callbackFromChapter1 },',
    '  "antagonism": { type: "internal"|"external"|"social"|"nature", specific, resolvesHow, appearsInChapters: [int,int,...] (>=2 Kapitel, in denen der Antagonist physisch auftritt ODER seine Wirkung sichtbar ist – Spur, Geräusch, Geruch, Zeuge, Schaden; reine Erwähnung zählt NICHT), threatRealizedOnce: { chapter: int, what: string } (EINE konkrete Szene, in der die angedrohte Bedrohung tatsächlich einmal eintritt – altersgerecht, aber spürbar) },',
    '  "benchmarkBook": { title, whyMatch, voiceReference },',
    '  "humorBeats": [ { chapter, type, what, exactLine } ... ] (exactLine: wörtlicher Satz <=140 Zeichen, den der Writer verwenden MUSS – Dialog oder physischer Beat im Präsens),',
    '  "chapterEndings": [ { chapter, type, what } ... ] (Kapitel 1..N-1),',
    '  "iconicScenes": [string, string, string]',
    "}",
    "Antwort: nur JSON, keine Prosa drumherum.",
  ].join("\n");
}

function buildRetryInstruction(issues: StorySoulValidationIssue[]): string {
  const formatted = formatStorySoulIssues(issues);
  return [
    "Die vorherige Soul hatte folgende Validator-Probleme:",
    formatted,
    "",
    "Behebe NUR diese Probleme und gib die vollständige, korrigierte Soul als JSON zurück.",
    "Wenn der Validator Cover-Cast vermisst: supportingCast erweitern, nicht weglassen.",
    "Wenn Cliffhanger als info-cliffhanger markiert sind: mach sie emotional (Beziehung, Scham, Mut, Geheimnis).",
  ].join("\n");
}

// ────────────────────────── LLM Dispatcher ──────────────────────────

async function callSoulModel(input: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  storyId: string;
  candidateTag?: string;
  attempt: number;
  maxOutputTokensOverride?: number;
}): Promise<{ content: string; usage?: Partial<TokenUsage> }> {
  const maxTokens = resolveSoulMaxTokens(input.model, input.maxOutputTokensOverride);

  if (isMiniMaxFamilyModel(input.model)) {
    if (!isRunwareConfigured()) {
      throw new Error(
        "RunwareApiKey is not configured. MiniMax models run through the Runware API.",
      );
    }
    const runwareResult = await generateWithRunwareText({
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      model: input.model,
      maxTokens,
      temperature: 0.3,
    });
    return {
      content: runwareResult.content,
      usage: {
        promptTokens: runwareResult.usage.promptTokens,
        completionTokens: runwareResult.usage.completionTokens,
        totalTokens: runwareResult.usage.totalTokens,
        model: runwareResult.model,
      },
    };
  }

  if (input.model.startsWith("gemini-")) {
    const geminiResult = await generateWithGemini({
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      model: input.model,
      maxTokens,
      temperature: 0.3,
      thinkingBudget: 96,
      logSource: "phase5.7-soul-llm",
      logMetadata: {
        storyId: input.storyId,
        attempt: input.attempt,
        candidateTag: input.candidateTag,
      },
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
    maxTokens,
    reasoningEffort: "low",
    temperature: 0.3,
    context: "story-soul",
    logSource: "phase5.7-soul-llm",
    logMetadata: {
      storyId: input.storyId,
      attempt: input.attempt,
      candidateTag: input.candidateTag,
    },
  });
}

// ────────────────────────── Model Routing ──────────────────────────

function resolveSoulPrimaryModel(
  selectedStoryModel?: string,
  supportModel?: string,
): string {
  const selected = String(selectedStoryModel || "").trim();
  const normalizedSelected = selected.toLowerCase();
  const normalizedSupport = String(supportModel || "").trim().toLowerCase();

  // MiniMax ist kein guter Soul-Generator (zu schwach in struktur. JSON) → Support-Model nutzen
  if (normalizedSelected.startsWith("minimax-")) {
    return supportModel || "gpt-5.4-mini";
  }

  // gpt-5.4-nano ist zu schwach für Soul → auf mini hochziehen
  if (normalizedSupport.startsWith("gpt-5.4-nano")) {
    return "gpt-5.4-mini";
  }

  return selected || supportModel || GEMINI_MAIN_STORY_MODEL;
}

function resolveSoulRescueModel(
  selectedStoryModel?: string,
  primaryModel?: string,
): string | undefined {
  const selected = String(selectedStoryModel || "").trim().toLowerCase();
  const current = String(primaryModel || "").trim().toLowerCase();
  if (selected.startsWith("gemini-") || current.startsWith("gemini-")) {
    return current === "gpt-5.4-mini" ? undefined : "gpt-5.4-mini";
  }
  if (selected.startsWith("gpt-") || selected.startsWith("o4-")) {
    return current === GEMINI_MAIN_STORY_MODEL ? undefined : GEMINI_MAIN_STORY_MODEL;
  }
  return current === GEMINI_MAIN_STORY_MODEL ? undefined : GEMINI_MAIN_STORY_MODEL;
}

function resolveSoulMaxTokens(model?: string, override?: number): number {
  if (Number.isFinite(override) && (override as number) > 800) {
    return Math.min(6000, Math.round(override as number));
  }
  const normalized = String(model || "").trim().toLowerCase();
  if (normalized.startsWith("gpt-5.4-mini")) return 2600;
  if (normalized.startsWith("gpt-5") || normalized.startsWith("o4-")) return 2400;
  if (normalized.startsWith("gemini-")) return 2500;
  return 2400;
}

// ────────────────────────── Fallback ──────────────────────────

/**
 * Deterministisch abgeleitete Soul – wird nur gezogen, wenn das LLM
 * mehrmals hintereinander versagt. Diese Soul ist bewusst konservativ:
 * sie bricht die Pipeline nicht, ist aber klar als "Fallback" markiert,
 * damit der Orchestrator den Lauf abbrechen kann, wenn Qualität Pflicht ist.
 */
function buildDeterministicSoulFallback(input: {
  normalizedRequest: NormalizedRequest;
  cast: CastSet;
  providerFailure: Error | null;
}): StorySoul {
  const { normalizedRequest: req, cast } = input;
  const childNames = getChildFocusNames(cast);
  const lead = childNames[0] || cast.avatars[0]?.displayName || "das Kind";
  const companion =
    childNames.find((n) => n !== lead) || cast.avatars[1]?.displayName || lead;

  const fingerprints: StorySoulCharacterFingerprint[] = cast.avatars
    .slice(0, 4)
    .map((a, idx) => ({
      name: a.displayName,
      role: (idx === 0 ? "protagonist" : "partner") as any,
      coreMacke:
        a.enhancedPersonality?.quirk
        || `sammelt kleine Dinge und legt sie ordentlich in die Tasche`,
      runningGag:
        a.enhancedPersonality?.catchphrase
        || `wiederholt leise einen eigenen Lieblingssatz, wenn es aufregend wird`,
      favoriteWords: (a.personalityTags || [])
        .slice(0, 3)
        .map((t) => String(t))
        .filter((s) => s.length > 0)
        .concat(["eigentlich"])
        .slice(0, 3),
      tabooWords: ["irgendwie", "vielleicht"],
      bodyTell:
        `zupft am Ohrläppchen, wenn ${a.displayName} nachdenkt`,
      wantIneedle:
        `will, dass die Familie ${a.displayName} ernst nimmt`,
      fearInternal:
        `hat Angst, jemanden zu enttäuschen`,
      voiceExample:
        `„Das ist eigentlich gar nicht so schlimm", sagte ${a.displayName} und drehte einen kleinen Stein in der Hand.`,
    }));

  if (fingerprints.length === 0) {
    fingerprints.push({
      name: lead,
      role: "protagonist",
      coreMacke: "sammelt schiefe Steine und gibt ihnen Namen",
      runningGag: "sagt 'eigentlich gar nicht so schlimm' – und meint das Gegenteil",
      favoriteWords: ["eigentlich", "ordentlich", "genau"],
      tabooWords: ["irgendwie", "vielleicht"],
      bodyTell: "zupft am rechten Ohrläppchen",
      wantIneedle: "ernst genommen werden wie ein Großer",
      fearInternal: "die Familie zu enttäuschen",
      voiceExample: `„Das ist Bummel", sagte ${lead} und hielt einen runden Stein hoch.`,
    });
  }

  const supportingCast: StorySoulSupportingCharacter[] = cast.poolCharacters
    .slice(0, 4)
    .map((p, idx) => ({
      name: p.displayName,
      purpose: ((idx === 0 ? "comic-relief" : "trickster") as any),
      firstAppearanceChapter: idx === 0 ? 2 : 1,
      signaturAction: `taucht auf, wenn ${lead} am nervösesten ist, und bringt mit einer kleinen Geste alles durcheinander`,
      description:
        p.species || p.archetype || `eine Figur mit eigenem kleinen Tick`,
    }));

  const chapterEndings = Array.from({ length: Math.max(1, req.chapterCount - 1) }, (_, i) => ({
    chapter: i + 1,
    type: "emotional-cliffhanger" as const,
    what:
      i === 0
        ? `${lead} weiß, was passiert ist – und ${companion} weiß nicht, dass ${lead} es weiß.`
        : `${lead} schaut ${companion} an. Keiner sagt etwas. Die Sonne steht schon tief.`,
  }));

  const humorBeats = Array.from({ length: Math.max(1, req.chapterCount) }, (_, i) => ({
    chapter: i + 1,
    type: "misunderstanding" as const,
    what: `${companion} erklärt etwas mit einem schiefen Vergleich, und ${lead} schweigt zuerst, bevor er leise lacht.`,
    exactLine: `${companion} sagt: „Das ist wie bei einer Gurke, nur ohne Gurke.\u201C`,
  }));

  return {
    premise: `${lead} und ${companion} müssen vor Sonnenuntergang etwas Verlorenes zurückbringen, bevor ein geliebter Mensch enttäuscht wird – ohne dass er es je merkt.`,
    hookQuestion: `Trauen sich die beiden, ehrlich zu sein, auch wenn sie zugeben müssen, dass etwas ihre Schuld war?`,
    emotionalStakes: {
      what: "ein kleines Ritual in der Familie, das nur dann funktioniert, wenn alle ihre Rolle spielen",
      why: "weil das Ritual bedeutet, dass jemand wichtig ist – und wenn es ausfällt, fühlt sich dieser Mensch unsichtbar",
      whoCares: `${lead}, weil ${lead} gesehen werden will. ${companion}, weil ${companion} den Fehler gemacht hat.`,
    },
    worldTexture: {
      anchors: [
        "der kleine Hof mit dem Kiesweg, der unter jeder Sohle knirscht",
        "ein Zettel mit schiefer Schrift, der in der Hosentasche knistert",
        "der Weg hinter dem Haus, wo es immer etwas feuchter ist als vorne",
      ],
      senseDetails:
        "Riecht nach warmem Holz, nassem Laub und manchmal nach Brot. Klingt nach knackenden Zweigen und der leisen Tür, die immer ein bisschen quietscht.",
      placeName: "Der Hof hinter dem Haus",
    },
    characterFingerprints: fingerprints,
    supportingCast,
    payoffPromise: {
      emotionalLanding:
        "warm, still stolz, mit einem Kloß im Hals – als hätten zwei Kinder zum ersten Mal ein echtes Geheimnis geteilt",
      transformationOfChild: `${lead} lernt, dass ${companion} nicht immer alles vermasselt, sondern manchmal genau das Richtige tut.`,
      finalImage:
        `${lead} und ${companion} sitzen nebeneinander. ${lead} zieht einen kleinen Stein aus der Tasche und drückt ihn einen Moment in die Hand.`,
      callbackFromChapter1:
        "die leise Tür quietscht in Ch5 anders – jemand hat sie geölt, ohne ein Wort zu sagen.",
    },
    antagonism: {
      type: "internal",
      specific: `${lead} vertraut ${companion} nicht mehr ganz, seit letzte Woche etwas kaputtging und ${companion} nicht sofort die Wahrheit sagte.`,
      resolvesHow: `${companion} entschuldigt sich in Kapitel 4 leise und ehrlich. ${lead} reicht ${companion} einen der gesammelten Steine.`,
      appearsInChapters: Array.from(
        { length: Math.min(3, Math.max(2, req.chapterCount - 1)) },
        (_, i) => i + 2,
      ),
      threatRealizedOnce: {
        chapter: Math.min(3, req.chapterCount),
        what: `Das Ritual fällt tatsächlich einmal kurz aus – jemand sitzt mit enttäuschtem Gesicht am leeren Platz, bevor ${lead} und ${companion} zurück sind.`,
      },
    },
    benchmarkBook: {
      title: "Schule der magischen Tiere – Endlich Ferien (Margit Auer)",
      whyMatch:
        "warmer Tonfall, zwei gegensätzliche Kinder-Charaktere, konkrete Welt, tierischer Nebencast, emotionale Geheimnisse statt abstrakter Rätsel",
      voiceReference:
        "„Ida fand, dass der erste Ferientag wie ein frisch gepellter Orangenschnitz schmeckte: süß und klebrig. Aber auf ihrem Kopfkissen saß eine Schildkröte.\u201C",
    },
    humorBeats,
    chapterEndings,
    iconicScenes: [
      `${lead} hält ${companion} einen kleinen Stein hin – kein Wort – und ${companion} weiß genau, was das heißt.`,
      `${companion} stolpert über etwas Weiches und landet lachend mit Mehl im Gesicht.`,
      `${lead} und ${companion} stehen vor der quietschenden Tür und hören, dass sie zum ersten Mal anders klingt.`,
    ],
  };
}

// ────────────────────────── Helpers ──────────────────────────

function toSoulProviderError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
