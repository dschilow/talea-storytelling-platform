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
  GEMINI_SUPPORT_MODEL,
  isMiniMaxFamilyModel,
  isOpenRouterFamilyModel,
  resolveConfiguredStoryModel,
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
  rescueEnabled?: boolean;
}

export async function generateValidatedStorySoul(
  input: StorySoulGenerationInput,
): Promise<StorySoulGenerationResult> {
  const { normalizedRequest, cast } = input;
  const selectedStoryModel = resolveConfiguredStoryModel(normalizedRequest.rawConfig as any);
  const supportModel = resolveSupportTaskModel(selectedStoryModel);
  const soulModel = resolveSoulPrimaryModel(
    selectedStoryModel,
    supportModel,
  );

  const expectedAvatarNames = cast.avatars
    .map((a) => a.displayName)
    .filter(Boolean);
  const requiredCoverCastNames = cast.poolCharacters
    .map((c) => c.displayName)
    .filter(Boolean);

  const rawConfig = normalizedRequest.rawConfig as any;
  if (
    isAnimalWorldSoulRequest(normalizedRequest)
    && rawConfig?.storySoulMode !== "llm"
    && !rawConfig?.customPrompt
  ) {
    return {
      soul: buildDeterministicSoulFallback({
        normalizedRequest,
        cast,
        providerFailure: null,
      }),
      model: "deterministic-animal-story-soul",
      attempts: 0,
      fallbackUsed: false,
      issues: [],
      usage: undefined,
      costEntries: [],
    };
  }

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
  const rescueModel = input.rescueEnabled
    ? resolveSoulRescueModel(
        selectedStoryModel,
        soulModel,
      )
    : undefined;
  if (rescueModel) {
    const rescueAttempt = Math.max(1, totalAttempts + 1);
    attemptsMade = rescueAttempt;
    const rescuePrompt = [
      baseUserPrompt,
      retryInstruction,
      "Denke strukturiert. Liefere konkrete, riechbare Details statt abstrakter Begriffe ('Abenteuer', 'geheimnisvoll', 'magisch' sind verboten). Gib nur ein KOMPAKTES StorySoul-JSON zurück.",
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
      "ORIGINALITY FIRST — your #1 job is to AVOID CLICHÉS.",
      "Before writing the JSON, brainstorm 3 premise angles internally, then pick the most SURPRISING one.",
      "",
      "Forbidden premise shapes (NEVER use these setups):",
      "- Two kids lost in a forest meet a witch in a candy/gingerbread house (Hansel & Gretel).",
      "- A magic amulet / crystal / compass that 'points the way home'.",
      "- A 'chosen one' who must save a kingdom.",
      "- A wolf disguising as grandma / stepmother schemes.",
      "- Generic 'adventure with a treasure map' plots.",
      "- Villain is a witch/wizard with pure evil motives.",
      "",
      "Originality constraints:",
      "- The antagonism should come from a MODERN, mundane, or emotionally-charged source (e.g. a",
      "  forgotten birthday, a misunderstood neighbor, a machine that broke, a rule nobody checked),",
      "  not a medieval fairy-tale villain archetype.",
      "- The conflict must contain at least ONE twist the child reader does NOT see coming in chapter 1.",
      "- The setting should be specific and unusual: not 'a forest', not 'a castle' — think",
      "  'the stairwell of a 12-story apartment building after the power went out',",
      "  'the lost-and-found room of the swimming pool that nobody ever unlocks',",
      "  'the attic above Grandpa's tool shop where the radios still whisper'.",
      "",
      "Hard rules:",
      "- Forbidden abstract words: 'adventure', 'mysterious', 'magical', 'must find out', 'somehow'.",
      "- Every premise must be retellable by a 7-year-old at dinner in ONE sentence — but it must make an adult go 'oh, interesting angle'.",
      "- Every character needs a fingerprint: one macke, one running gag, one body tell, one taboo word.",
      "- Include readerContract: Chapter 1 must clearly establish normal world, who we meet, mission in child words, why it matters now, and the one magic/artifact rule before conflict starts.",
      "- The mission may NEVER be just 'find/follow the next clue/trail'. It must be a concrete child task: bring, fix, save, return, open, stop, protect, repair, or deliver something visible.",
      "- Cover cast (dragons, squirrels, etc.) MUST be in the supportingCast array with a firstAppearanceChapter AND signaturAction.",
      "- World must have smell, sound, and a real place name.",
      "- Payoff must echo chapter 1 concretely, not just thematically.",
      "- Cliffhangers are EMOTIONAL (relational tension), not informational.",
      "- Keep the JSON compact: short fields, no long prose, no rationale text.",
      "- Do not output the internal brainstorm.",
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
    "ORIGINALITÄT ZUERST — deine WICHTIGSTE Aufgabe ist KLISCHEES ZU VERMEIDEN.",
    "Bevor du das JSON schreibst: brainstorme intern 3 Premise-Winkel und wähle den ÜBERRASCHENDSTEN.",
    "",
    "Verbotene Premise-Formen (NIEMALS diese Setups):",
    "- Zwei Kinder verlaufen sich im Wald und treffen eine Hexe im Lebkuchen-/Süßigkeitenhaus (Hänsel & Gretel).",
    "- Ein magisches Amulett / Kristall / Kompass, der 'den Weg nach Hause weist'.",
    "- Ein 'Auserwählter', der ein Königreich retten muss.",
    "- Ein Wolf, der sich als Großmutter / Stiefmutter verkleidet.",
    "- Generische 'Abenteuer mit Schatzkarte' Plots.",
    "- Bösewicht ist eine Hexe/Zauberer mit rein bösen Motiven.",
    "- 'Der verlorene Drache/Einhorn muss heim', wenn nicht mit echtem Twist.",
    "",
    "Originalitäts-Constraints:",
    "- Der Antagonismus sollte aus einer MODERNEN, alltäglichen oder emotional aufgeladenen Quelle kommen",
    "  (z.B. ein vergessener Geburtstag, ein missverstandener Nachbar, eine kaputte Maschine, eine Regel,",
    "  die niemand geprüft hat), NICHT aus einem mittelalterlichen Märchen-Bösewicht-Archetyp.",
    "- Der Konflikt MUSS mindestens EINEN Twist enthalten, den das Kind in Kapitel 1 NICHT kommen sieht.",
    "- Das Setting muss spezifisch und ungewöhnlich sein: nicht 'ein Wald', nicht 'ein Schloss' — denk an",
    "  'das Treppenhaus eines 12-Stockwerk-Hauses nach dem Stromausfall',",
    "  'die Fundsachen-Kammer des Schwimmbads, die niemand je aufschließt',",
    "  'der Dachboden über Opas Werkzeugladen, wo die alten Radios noch flüstern'.",
    "",
    "Harte Regeln:",
    "- Fuege readerContract ein: Kapitel 1 muss Normalwelt, zuerst erkennbare Figuren, Mission in Kinderworten, Warum-jetzt und die eine Magie-/Artefakt-Regel klar machen, bevor Konflikt startet.",
    "- Die Mission darf NIE nur 'naechsten Hinweis/Spur finden' sein. Es braucht eine konkrete Kinder-Aufgabe: bringen, reparieren, retten, zurueckgeben, oeffnen, aufhalten, schuetzen oder abliefern.",
    "- Verbotene Abstraktionen: 'Abenteuer', 'geheimnisvoll', 'magisch', 'müssen herausfinden', 'irgendwie'.",
    "- Die Premise muss ein 7-Jähriger beim Abendessen in EINEM Satz nacherzählen können – UND ein Erwachsener soll denken 'oh, interessanter Winkel'.",
    "- Jede Hauptfigur braucht einen Fingerabdruck: eine Macke, einen Running-Gag, ein Körper-Tell, ein Tabu-Wort.",
    "- Cover-Cast (Drachen, Eichhörnchen, etc.) MUSS in supportingCast auftauchen – mit firstAppearanceChapter UND signaturAction.",
    "- Die Welt braucht Geruch, Ton und einen echten Ortsnamen (nicht 'der Wald', sondern 'Krümelwald hinter Omas Bäckerei').",
    "- Der Payoff muss ein KONKRETES Element aus Kapitel 1 in Kapitel 5 anders wiederholen (callbackFromChapter1).",
    "- Cliffhanger sind EMOTIONAL (Beziehungsspannung), nicht informativ ('sie fanden einen Hinweis').",
    "",
    "- Halte das JSON kompakt: kurze Felder, keine lange Prosa, keine Begruendungstexte.",
    "- Gib das interne Brainstorming nicht aus.",
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
  const artifactLine = cast.artifact?.name
    ? (isGerman
      ? `Artefakt (MUSS zentral in Mission, Regel, Payoff vorkommen): ${cast.artifact.name}${cast.artifact.storyUseRule ? ` - ${cast.artifact.storyUseRule}` : ""}`
      : `Artifact (MUST be central to mission, rule, payoff): ${cast.artifact.name}${cast.artifact.storyUseRule ? ` - ${cast.artifact.storyUseRule}` : ""}`)
    : "";
  const heading = isGerman
    ? [
        "AUFGABE: Schreibe die StorySoul für genau diese Geschichte.",
        "",
        "VORGEHEN (intern denken, nicht ins JSON schreiben):",
        "1. Skizziere 3 mögliche Premise-Varianten mit jeweils UNTERSCHIEDLICHEM Konflikt-Typ:",
        "   (a) Beziehungskonflikt (Streit, Missverständnis, Eifersucht, Enttäuschung)",
        "   (b) Alltagsrätsel mit überraschendem Hintergrund (etwas Alltägliches entpuppt sich als anders)",
        "   (c) Entdeckung/Verantwortung (Kind findet etwas Lebendiges/Kaputtes/Verlorenes, das Fürsorge braucht)",
        "2. Prüfe jede Variante gegen die verbotenen Premise-Formen im System-Prompt.",
        "3. Wähle die Variante, die am meisten OVERRASCHT und am wenigsten wie ein Märchen-Remake klingt.",
        "4. Nur diese eine Variante als StorySoul-JSON ausgeben.",
      ].join("\n")
    : [
        "TASK: Write the StorySoul for exactly this story.",
        "",
        "PROCESS (think internally, don't write into the JSON):",
        "1. Sketch 3 candidate premises, each with a DIFFERENT conflict type:",
        "   (a) Relational conflict (argument, misunderstanding, jealousy, disappointment)",
        "   (b) Everyday puzzle with surprising backstory (something mundane turns out to be different)",
        "   (c) Discovery/responsibility (child finds something alive/broken/lost that needs care)",
        "2. Check each against the forbidden premise shapes in the system prompt.",
        "3. Pick the one that SURPRISES most and feels least like a fairy-tale remake.",
        "4. Output only that one variant as StorySoul JSON.",
      ].join("\n");

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
      '  "readerContract": { "normalWorld": string, "whoWeMeetFirst": string, "missionInChildWords": string, "whyItMattersNow": string, "magicOrArtifactRule": string, "chapter1Question": string },',
      '  "characterFingerprints": [ { name, role, coreMacke, runningGag, favoriteWords[], tabooWords[], bodyTell, wantIneedle, fearInternal, voiceExample } ... ],',
      '  "supportingCast": [ { name, purpose, firstAppearanceChapter, signaturAction, description } ... ],',
      '  "payoffPromise": { emotionalLanding, transformationOfChild, finalImage, callbackFromChapter1 },',
      '  "antagonism": { type: "internal"|"external"|"social"|"nature", specific, resolvesHow, appearsInChapters: [int,int,...] (>=2 chapters where antagonist is physically present OR its effect is directly visible — footprint, sound, smell, damage; mere mention does NOT count), threatRealizedOnce: { chapter: int, what: string } (one concrete scene where the threatened danger actually happens, age-appropriate) },',
      '  "benchmarkBook": { title, whyMatch, voiceReference },',
      '  "humorBeats": [ { chapter, type, what, exactLine } ... ] (exactLine: verbatim line <=140 chars the writer MUST use — dialogue or present-tense physical beat),',
      '  "chapterEndings": [ { chapter, type, what } ... ] (chapters 1..N-1),',
      '  "iconicScenes": [string, string, string]',
      "}",
      "Compactness rules: max 2 characterFingerprints, max 3 supportingCast, max 3 humorBeats, max 2 iconicScenes.",
      "Every string <=90 chars unless the schema says otherwise. No synonyms, no explanations.",
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
    '  "readerContract": { "normalWorld": string, "whoWeMeetFirst": string, "missionInChildWords": string, "whyItMattersNow": string, "magicOrArtifactRule": string, "chapter1Question": string },',
    '  "characterFingerprints": [ { name, role, coreMacke, runningGag, favoriteWords[], tabooWords[], bodyTell, wantIneedle, fearInternal, voiceExample } ... ],',
    '  "supportingCast": [ { name, purpose, firstAppearanceChapter, signaturAction, description } ... ],',
    '  "payoffPromise": { emotionalLanding, transformationOfChild, finalImage, callbackFromChapter1 },',
    '  "antagonism": { type: "internal"|"external"|"social"|"nature", specific, resolvesHow, appearsInChapters: [int,int,...] (>=2 Kapitel, in denen der Antagonist physisch auftritt ODER seine Wirkung sichtbar ist – Spur, Geräusch, Geruch, Zeuge, Schaden; reine Erwähnung zählt NICHT), threatRealizedOnce: { chapter: int, what: string } (EINE konkrete Szene, in der die angedrohte Bedrohung tatsächlich einmal eintritt – altersgerecht, aber spürbar) },',
    '  "benchmarkBook": { title, whyMatch, voiceReference },',
    '  "humorBeats": [ { chapter, type, what, exactLine } ... ] (exactLine: wörtlicher Satz <=140 Zeichen, den der Writer verwenden MUSS – Dialog oder physischer Beat im Präsens),',
    '  "chapterEndings": [ { chapter, type, what } ... ] (Kapitel 1..N-1),',
    '  "iconicScenes": [string, string, string]',
    "}",
    "Kompakt-Regeln: max. 2 characterFingerprints, max. 3 supportingCast, max. 3 humorBeats, max. 2 iconicScenes.",
    "Jeder String <=90 Zeichen, ausser das Schema verlangt mehr. Keine Synonyme, keine Erklaerungen.",
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

  if (isOpenRouterFamilyModel(selected)) {
    return GEMINI_SUPPORT_MODEL;
  }

  if (isOpenRouterFamilyModel(supportModel)) {
    return GEMINI_SUPPORT_MODEL;
  }

  // MiniMax ist kein guter Soul-Generator (zu schwach in struktur. JSON) → Support-Model nutzen
  if (normalizedSelected.startsWith("minimax-")) {
    return supportModel || "gpt-5.4-mini";
  }

  if (normalizedSelected.startsWith("gpt-") || normalizedSelected.startsWith("o4-")) {
    return GEMINI_SUPPORT_MODEL;
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
  if (isOpenRouterFamilyModel(selectedStoryModel) || isOpenRouterFamilyModel(primaryModel)) {
    return undefined;
  }
  if (selected.startsWith("gemini-") || current.startsWith("gemini-")) {
    return current === "gpt-5.4-mini" ? undefined : "gpt-5.4-mini";
  }
  if (selected.startsWith("gpt-") || selected.startsWith("o4-")) {
    if (current.startsWith("gemini-")) {
      return selected.includes("nano") ? "gpt-5.4-mini" : (selected || "gpt-5.4-mini");
    }
    return current === GEMINI_MAIN_STORY_MODEL ? undefined : GEMINI_MAIN_STORY_MODEL;
  }
  return current === GEMINI_MAIN_STORY_MODEL ? undefined : GEMINI_MAIN_STORY_MODEL;
}

function resolveSoulMaxTokens(model?: string, override?: number): number {
  if (Number.isFinite(override) && (override as number) > 600) {
    return Math.min(3200, Math.round(override as number));
  }
  const normalized = String(model || "").trim().toLowerCase();
  if (normalized.startsWith("gpt-5.4-mini")) return 1600;
  if (normalized.startsWith("gpt-5") || normalized.startsWith("o4-")) return 1500;
  if (normalized.startsWith("gemini-")) return 1600;
  return 1500;
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
  const artifactName = cast.artifact?.name?.trim() || "das besondere Fundstueck";
  const artifactObject = formatArtifactForGermanObject(artifactName);
  const artifactRule = cast.artifact?.storyUseRule?.trim()
    || `${artifactName} zeigt nur, was wahr oder falsch liegt; entscheiden muessen die Kinder selbst`;
  const antagonist = findFallbackAntagonist(cast);
  const antagonistName = antagonist?.displayName || "";

  if (isAnimalWorldSoulRequest(req)) {
    return buildAnimalWorldSoulFallback({
      req,
      cast,
      lead,
      companion,
      artifactName,
      artifactObject,
      artifactRule,
      antagonistName,
    });
  }

  // Varied body-tells, want-needles and fear-internals to avoid every
  // generated story sharing the same gestures and emotional defaults.
  const BODY_TELLS = [
    (n: string) => `kratzt sich am Hinterkopf, wenn ${n} unsicher ist`,
    (n: string) => `ballt heimlich die Faust in der Hosentasche, wenn ${n} sich anstrengt`,
    (n: string) => `kaut auf der Unterlippe, wenn ${n} nachdenkt`,
    (n: string) => `tippt mit dem Schuh leise auf den Boden, wenn ${n} wartet`,
    (n: string) => `schiebt das Kinn vor und atmet einmal tief, wenn ${n} Angst hat`,
    (n: string) => `dreht einen Knopf am Ärmel, wenn ${n} aufgeregt ist`,
  ];
  const WANTS = [
    (n: string) => `will, dass jemand ${n} wirklich zuhört`,
    (n: string) => `will einmal etwas ohne Hilfe zu Ende bringen`,
    (n: string) => `will von ${n} selbst stolz sein dürfen`,
    (n: string) => `will, dass die anderen ${n} nicht mehr für klein halten`,
  ];
  const FEARS = [
    "hat Angst, dass alle merken, dass etwas nicht stimmt",
    "hat Angst, etwas Wichtiges falsch zu machen",
    "hat Angst, im entscheidenden Moment leise zu werden",
    "hat Angst, später zu denken: hätte ich nur",
  ];

  const VOICE_EXAMPLES = [
    (n: string) => `${n} sagt: "Moment, ich muss das einmal kurz nachdenken."`,
    (n: string) => `${n} sagt: "Das ist nicht so gemeint, wie es klingt, ehrlich."`,
    (n: string) => `${n} murmelt: "Wenn das jetzt schiefgeht, war ich nie hier."`,
    (n: string) => `${n} fragt leise: "Hast du das auch gerade gehört?"`,
  ];

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
        .slice(0, 3),
      tabooWords: ["irgendwie", "vielleicht"],
      bodyTell: BODY_TELLS[idx % BODY_TELLS.length](a.displayName),
      wantIneedle: WANTS[idx % WANTS.length](a.displayName),
      fearInternal: FEARS[idx % FEARS.length],
      voiceExample: VOICE_EXAMPLES[idx % VOICE_EXAMPLES.length](a.displayName),
    }));

  if (fingerprints.length === 0) {
    fingerprints.push({
      name: lead,
      role: "protagonist",
      coreMacke: "merkt sich kleine Geräusche, die andere überhören",
      runningGag: "wiederholt für sich, was gerade gesagt wurde, um es zu sortieren",
      favoriteWords: [],
      tabooWords: ["irgendwie", "vielleicht"],
      bodyTell: BODY_TELLS[0](lead),
      wantIneedle: WANTS[0](lead),
      fearInternal: FEARS[0],
      voiceExample: VOICE_EXAMPLES[0](lead),
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

  // Varied humor beats per chapter so that the soul does not enforce a
  // single recurring punchline across the whole book.
  const HUMOR_BEAT_TEMPLATES: Array<{
    type: "misunderstanding" | "slapstick" | "dry-observation" | "callback" | "absurd-literal";
    what: (l: string, c: string) => string;
  }> = [
    { type: "slapstick", what: (l, c) => `${c} stolpert über etwas, das eigentlich gar nicht im Weg lag, und tut so, als wäre das Absicht gewesen.` },
    { type: "misunderstanding", what: (l, c) => `${c} versteht eine einfache Anweisung absichtlich falsch, und ${l} merkt erst nach drei Sätzen, dass es ein Witz war.` },
    { type: "dry-observation", what: (l, c) => `${l} denkt etwas Verbotenes laut zu Ende, hält dann erschrocken die Hand vor den Mund — ${c} grinst.` },
    { type: "slapstick", what: (l, c) => `${c} versucht, lässig auszusehen, und macht dabei genau das Geräusch, das ${c} vermeiden wollte.` },
    { type: "misunderstanding", what: (l, c) => `${l} erklärt etwas Ernstes; ${c} nickt, fragt dann doch nach, weil ${c} an etwas ganz anderes gedacht hat.` },
  ];
  const humorBeats = Array.from({ length: Math.max(1, req.chapterCount) }, (_, i) => {
    const template = HUMOR_BEAT_TEMPLATES[i % HUMOR_BEAT_TEMPLATES.length];
    return {
      chapter: i + 1,
      type: template.type,
      what: template.what(lead, companion),
      exactLine: "",
    };
  });

  // Fallback premise is derived from the cast/artifact so that the deterministic
  // path does not always force the same "wrong-accusation-at-the-dinner-table"
  // plot. Choose a varied premise template based on stable inputs.
  const PREMISE_TEMPLATES: Array<(l: string, c: string, an: string, ao: string) => {
    premise: string;
    hookQuestion: string;
    stakesWhat: string;
    stakesWhy: string;
    placeName: string;
    senseDetails: string;
    anchors: [string, string, string];
    missionInChildWords: string;
    whyItMattersNow: string;
    chapter1Question: string;
  }> = [
    (l, c, an, ao) => ({
      premise: `${l} und ${c} müssen ${ao} bis zum Abend wieder an seinen Platz bringen, bevor jemand merkt, dass es überhaupt weg war.`,
      hookQuestion: `Schaffen sie es zurück, ohne dass jemand die richtige Frage stellt — oder müssen sie am Ende selbst antworten?`,
      stakesWhat: `${an} ist nicht dort, wo es hingehört, und ein anderer wartet jetzt umsonst.`,
      stakesWhy: "weil das Vertrauen einer Person hängt davon ab, ob sie morgen wieder kommt — oder nicht",
      placeName: "Die Werkstatt am Ende der Straße",
      senseDetails: "Riecht nach Sägespänen und kaltem Eisen. Klingt nach einem Wasserhahn, der zwei Räume weiter tropft.",
      anchors: [
        "die schiefe Werkbank, auf der nichts liegen bleibt",
        `${an} zwischen einer Schraube und einem leeren Becher`,
        "das Fenster, durch das man die Straßenlaterne flackern hört",
      ],
      missionInChildWords: `${l} und ${c} müssen ${ao} zurückbringen, bevor der, dem es gehört, von der Arbeit kommt.`,
      whyItMattersNow: "Sonst denkt er, dass er es selbst verlegt hat, und das ist heute genau das, was er nicht braucht.",
      chapter1Question: `Wissen ${l} und ${c}, wo es hingehört — oder müssen sie das erst herausfinden?`,
    }),
    (l, c, an, ao) => ({
      premise: `${l} und ${c} entdecken in ${ao} eine kleine Spur, die nicht von ihnen ist — und müssen herausfinden, wer sie hinterlassen hat, bevor diese Person verschwindet.`,
      hookQuestion: `Trauen sie sich zu fragen, oder rätseln sie lieber so lange, bis es zu spät ist?`,
      stakesWhat: `Jemand war hier — und wenn ${l} und ${c} jetzt nichts sagen, denkt diese Person morgen, niemand habe sie bemerkt.`,
      stakesWhy: "weil unsichtbar zu sein das Schlimmste ist, was einem an einem ohnehin schweren Tag passieren kann",
      placeName: "Der Innenhof zwischen den drei Häusern",
      senseDetails: "Riecht nach Linde und feuchtem Stein. Klingt nach einem Fahrrad, das jemand schiebt, ohne aufzusteigen.",
      anchors: [
        "die Bank mit dem abgesplitterten Lack",
        `${an}, das halb unter der Bank liegt`,
        "der Mülleimer, an dem ein Zettel im Wind klappert",
      ],
      missionInChildWords: `${l} und ${c} müssen herausfinden, wer ${an} verloren hat, und es ihm zurückgeben — heute noch.`,
      whyItMattersNow: "Sonst zieht die Person morgen weg, und die Chance ist vorbei.",
      chapter1Question: `Folgen sie der Spur — oder warten sie, bis sich jemand anderes kümmert?`,
    }),
    (l, c, an, ao) => ({
      premise: `${l} und ${c} wollen ${ao} ein einziges Mal richtig benutzen — aber sie haben die Regel nur halb verstanden, und Halb-Verstehen ist hier gefährlicher als gar nichts wissen.`,
      hookQuestion: `Geben sie zu, dass sie etwas nicht wissen — oder probieren sie weiter, bis es kaputt ist?`,
      stakesWhat: `${an} verträgt nur einen einzigen Versuch, und der erste lief schon nicht ganz richtig.`,
      stakesWhy: "weil danach jemand anders die Schuld bekommt, der gerade nicht da ist und sich nicht wehren kann",
      placeName: "Die Dachkammer hinter Opas Bäckerei",
      senseDetails: "Riecht nach altem Mehl, Holz und warmer Sonne durchs schräge Fenster. Klingt nach Tauben auf dem Dach.",
      anchors: [
        "die Kiste mit dem losen Henkel, in der alles Wichtige immer landet",
        `${an} im Stoffbeutel, schon einmal benutzt`,
        "die Treppe, die genau in der Mitte ein Stück nachgibt",
      ],
      missionInChildWords: `${l} und ${c} müssen ${ao} ein zweites Mal benutzen, ohne dass jemand merkt, dass das erste Mal nicht geklappt hat.`,
      whyItMattersNow: "Sonst muss heute Abend ein anderer die Erklärung geben, und es war nicht sein Fehler.",
      chapter1Question: `Lesen sie die Regel noch einmal nach — oder erinnern sie sich nur daran, was sie davon im Kopf haben?`,
    }),
  ];

  const templateIndex = (lead.length + companion.length + artifactName.length) % PREMISE_TEMPLATES.length;
  const tpl = PREMISE_TEMPLATES[templateIndex](lead, companion, artifactName, artifactObject);

  return {
    premise: tpl.premise,
    hookQuestion: tpl.hookQuestion,
    emotionalStakes: {
      what: tpl.stakesWhat,
      why: tpl.stakesWhy,
      whoCares: `${lead}, weil ${lead} merkt, dass das eigene Wort hier wirklich zählt. ${companion}, weil ${companion} sonst denkt, immer der Nebenmann zu sein.`,
    },
    worldTexture: {
      anchors: tpl.anchors,
      senseDetails: tpl.senseDetails,
      placeName: tpl.placeName,
    },
    readerContract: {
      normalWorld: `${lead} und ${companion} sind in ${tpl.placeName.toLowerCase()}, bevor sie merken, dass ${artifactName} eine Rolle spielt, die sie noch nicht ganz verstanden haben.`,
      whoWeMeetFirst: `${lead} prüft langsam, ${companion} will schon los — beide haben recht, aber nicht zur selben Zeit.`,
      missionInChildWords: tpl.missionInChildWords,
      whyItMattersNow: tpl.whyItMattersNow,
      magicOrArtifactRule: artifactRule,
      chapter1Question: tpl.chapter1Question,
    },
    characterFingerprints: fingerprints,
    supportingCast,
    payoffPromise: {
      emotionalLanding:
        "warm, still stolz, mit einem Kloß im Hals – als hätten zwei Kinder zum ersten Mal ein echtes Geheimnis geteilt",
      transformationOfChild: `${lead} lernt, dass ${companion} nicht immer alles vermasselt, sondern manchmal genau das Richtige tut.`,
      finalImage:
        `${lead} und ${companion} stehen zusammen vor ${artifactName} und atmen einmal tief — das Schwere ist nicht weg, aber es liegt jetzt offen da.`,
      callbackFromChapter1:
        `Eine kleine Geste aus Kapitel 1 bekommt am Ende eine neue Bedeutung — kein großes Wort, ein Detail.`,
    },
    antagonism: {
      type: antagonistName ? "external" : "internal",
      specific: antagonistName
        ? `${antagonistName} hat ein eigenes Ziel und steht ${lead} und ${companion} im Weg, ohne offen feindlich zu sein.`
        : `${lead} und ${companion} sind sich uneinig — beide haben recht, aber nicht gleichzeitig, und keiner mag das laut sagen.`,
      resolvesHow: `Eine ehrliche Geste in Kapitel 4 löst die Spannung; nicht ein Sieg, sondern ein Eingeständnis.`,
      appearsInChapters: Array.from(
        { length: Math.min(3, Math.max(2, req.chapterCount - 1)) },
        (_, i) => i + 2,
      ),
      threatRealizedOnce: {
        chapter: Math.min(3, req.chapterCount),
        what: `Eine Entscheidung läuft falsch, und für einen Moment glaubt einer der beiden, alles selbst kaputt gemacht zu haben.`,
      },
    },
    benchmarkBook: {
      title: "Schule der magischen Tiere – Endlich Ferien (Margit Auer)",
      whyMatch:
        "warmer Tonfall, zwei gegensätzliche Kinder-Charaktere, konkrete Welt, tierischer Nebencast, emotionale Geheimnisse statt abstrakter Rätsel",
      voiceReference: "",
    },
    humorBeats,
    chapterEndings,
    iconicScenes: [
      `Eine Szene, in der ${lead} und ${companion} schweigen und beide das Gleiche denken, ohne es zu sagen.`,
      `Eine Szene, in der ${companion} versucht, lässig zu wirken, und genau das Gegenteil passiert.`,
      `Eine Szene, in der ${lead} eine kleine, mutige Sache tut, von der niemand außer ${companion} etwas mitbekommt.`,
    ],
  };
}

function buildAnimalWorldSoulFallback(input: {
  req: NormalizedRequest;
  cast: CastSet;
  lead: string;
  companion: string;
  artifactName: string;
  artifactObject: string;
  artifactRule: string;
  antagonistName: string;
}): StorySoul {
  const { req, cast, lead, companion, artifactName, artifactObject, antagonistName } = input;
  const helper = findAnimalSoulHelper(cast);
  const helperName = helper?.displayName || "das kleine Tier";
  const placeName = resolveAnimalSoulPlace(req);
  const sickAnimal = helper?.displayName || "das Fuchskind";
  const rule = `${artifactName} zeigt nur echte Tier-Spuren: Duft, Pfote, Blatt. Entscheiden muessen ${lead} und ${companion}.`;
  const fingerprints: StorySoulCharacterFingerprint[] = cast.avatars.slice(0, 2).map((a, idx) => ({
    name: a.displayName,
    role: (idx === 0 ? "protagonist" : "partner") as any,
    coreMacke: idx === 0 ? "prüft jedes Blatt erst mit der Nase" : "will mutig los, bevor die Füße gefragt wurden",
    runningGag: idx === 0 ? "sagt 'Erst schnuppern, dann handeln'" : "nennt jeden Fehltritt eine Messmethode",
    favoriteWords: idx === 0 ? ["bitter", "Spur", "langsam"] : ["mutig", "zack", "Messmethode"],
    tabooWords: ["irgendwie", "vielleicht"],
    bodyTell: idx === 0 ? "drückt die Hände auf die Knie" : "zieht die Schultern hoch und grinst zu früh",
    wantIneedle: idx === 0 ? "will ernst genommen werden, ohne laut zu werden" : "will beweisen, dass Mut auch hilft",
    fearInternal: idx === 0 ? "Angst, zu langsam zu sein" : "Angst, nur Quatsch beizutragen",
    voiceExample: idx === 0
      ? `"Erst schnuppern, dann handeln", sagt ${a.displayName}.`
      : `"Das war eine Messmethode", sagt ${a.displayName} und zieht eine Beere aus dem Haar.`,
  }));

  const supportingCast: StorySoulSupportingCharacter[] = cast.poolCharacters.slice(0, 3).map((p, idx) => ({
    name: p.displayName,
    purpose: (String(p.roleType).toUpperCase() === "ANTAGONIST" ? "trickster" : idx === 0 ? "comic-relief" : "emotional-mirror") as any,
    firstAppearanceChapter: idx === 0 ? 1 : Math.min(2 + idx, req.chapterCount),
    signaturAction: String(p.roleType).toUpperCase() === "ANTAGONIST"
      ? "legt zu glänzende Beeren auf den falschen Pfad"
      : "tippt mit Pfote, Schnabel oder Nase genau auf den falschen Duft",
    description: p.species || p.archetype || "ein Tier aus der Waldgemeinschaft",
  }));

  const chapterEndings = Array.from({ length: Math.max(1, req.chapterCount - 1) }, (_, i) => ({
    chapter: i + 1,
    type: "emotional-cliffhanger" as const,
    what: i === 0
      ? `${lead} riecht die falsche Spur und sagt es nicht sofort.`
      : i === 2
        ? `${lead} merkt: Der Fehler am Bach war wirklich seiner.`
        : `${companion} wartet auf ${lead}s Antwort, aber ${lead} schaut nur auf das Blatt.`,
  }));

  return {
    premise: `${lead} und ${companion} müssen ${artifactObject} durch den Mooswald bringen, damit ${sickAnimal} rechtzeitig das echte Heilkraut bekommt.`,
    hookQuestion: `Traut sich ${lead}, langsam zu sein, obwohl ein Tier jetzt Hilfe braucht?`,
    emotionalStakes: {
      what: `${sickAnimal} braucht vor dem Abend das echte Kraut, nicht die glänzende falsche Spur`,
      why: "weil die Tiergemeinschaft sonst den einzigen sicheren Krautplatz verliert",
      whoCares: `${lead}, weil er richtig liegen will; ${companion}, weil Mut allein nicht reicht.`,
    },
    worldTexture: {
      anchors: [
        "der Moosstein, der unter nackten Knien kühl wird",
        `${artifactName} mit drei gezackten Blättern`,
        "die feuchte Pfotenspur am Bachrand",
      ],
      senseDetails: "Riecht nach Moos, bitterem Kraut und nassem Fell. Klingt nach Bach, Pfoten und leisem Husten.",
      placeName,
    },
    readerContract: {
      normalWorld: `${lead} und ${companion} kennen den Pfad am ${placeName}; dort helfen Kinder und Tiere einander.`,
      whoWeMeetFirst: `${lead} prüft still; ${companion} will schneller los und macht daraus fast einen Witz.`,
      missionInChildWords: `${lead} und ${companion} müssen ${artifactObject} zum kranken Tier bringen und den Krautplatz schützen.`,
      whyItMattersNow: `Wenn sie zu spät sind, bleibt ${sickAnimal} matt und die Tiere verlieren den Krautplatz.`,
      magicOrArtifactRule: rule,
      chapter1Question: `Erkennen sie die echte Krautspur, bevor die falsche alle weglockt?`,
    },
    characterFingerprints: fingerprints,
    supportingCast,
    payoffPromise: {
      emotionalLanding: "ruhig, warm, mit kleinem Stolz statt lautem Sieg",
      transformationOfChild: `${lead} wartet sichtbar, lässt ${companion} prüfen und repariert seinen Fehler.`,
      finalImage: `${lead}, ${companion} und ${helperName} lassen einen kleinen Krautplatz für morgen stehen.`,
      callbackFromChapter1: `"Erst schnuppern, dann handeln" klingt am Ende nicht streng, sondern freundlich.`,
    },
    antagonism: {
      type: antagonistName ? "external" : "nature",
      specific: antagonistName
        ? `${antagonistName} lenkt die Kinder weg, weil er den Krautplatz allein behalten will.`
        : `Die falsche Duftspur lockt alle vom echten Heilkraut weg.`,
      resolvesHow: `${lead} wartet in Kapitel 5, ${companion} prüft zuerst, und alle teilen den Krautplatz.`,
      appearsInChapters: antagonistName ? [2, 3, 5] : [1, 2, 5],
      threatRealizedOnce: {
        chapter: Math.min(3, req.chapterCount),
        what: `${lead} nimmt fast das falsche Blatt, und der echte Stiel knickt in den Bach.`,
      },
    },
    benchmarkBook: {
      title: "Der Grüffelo",
      whyMatch: "klare Waldlogik, wiederholbarer Satz, kleine Gefahr, viel Körperkomik",
      voiceReference: `"Erst schnuppern, dann handeln", sagte ${lead}. ${companion} schnupperte und nieste ins Moos.`,
    },
    humorBeats: [
      {
        chapter: 1,
        type: "misunderstanding",
        what: `${companion} hält ein Schneckenknacken für ein riesiges Warnsignal.`,
        exactLine: `${companion} flüstert: "Das war bestimmt ein sehr kleines Donnern."`,
      },
      {
        chapter: 2,
        type: "slapstick",
        what: `${companion} findet eine Beere im Haar und nennt sie Beweisstück.`,
        exactLine: `${companion} sagt: "Das ist eine Messmethode."`,
      },
      {
        chapter: 5,
        type: "callback",
        what: `${lead} macht einen übertrieben langsamen Vortritt.`,
        exactLine: `${lead} sagt: "Erst schnuppern, dann handeln."`,
      },
    ],
    chapterEndings,
    iconicScenes: [
      `${lead} hält ${artifactName} flach in der Hand, während ${companion} fast ins Moos fällt.`,
      `${lead} steht mit nassen Ärmeln auf der Wurzelbrücke und sagt: "Ich war zu schnell."`,
      `${lead}, ${companion} und ${helperName} lassen am Ende einen Krautplatz stehen.`,
    ],
  };
}

// ────────────────────────── Helpers ──────────────────────────

function formatArtifactForGermanObject(name: string): string {
  const normalized = String(name || "").trim();
  if (!normalized) return "das besondere Fundstueck";
  const lower = normalized.toLowerCase();
  if (lower.includes("schuhe") || lower.endsWith("schuhe")) return `die ${normalized}`;
  if (lower.includes("krone")) return `die ${normalized}`;
  if (lower.includes("kugel")) return `die ${normalized}`;
  if (lower.includes("kristall") || lower.includes("spiegel") || lower.includes("schluessel") || lower.includes("schlüssel")) {
    return `den ${normalized}`;
  }
  return `das Artefakt ${normalized}`;
}

function isAnimalWorldSoulRequest(req: NormalizedRequest): boolean {
  const text = [
    req.category,
    req.rawConfig?.genre,
    req.rawConfig?.setting,
  ].filter(Boolean).join(" ").toLowerCase();
  return text.includes("tierwelten") || text.includes("animals") || text.includes("animal") || /\btiere?\b/.test(text);
}

function findAnimalSoulHelper(cast: CastSet) {
  return cast.poolCharacters.find(character =>
    String(character.roleType || "").toUpperCase() === "HELPER" && isAnimalSoulCharacter(character),
  ) || cast.poolCharacters.find(isAnimalSoulCharacter) || cast.poolCharacters[0];
}

function isAnimalSoulCharacter(character: { species?: string; archetype?: string; role?: string; visualSignature?: string[] }): boolean {
  const text = [
    character.species,
    character.archetype,
    character.role,
    ...(character.visualSignature || []),
  ].filter(Boolean).join(" ").toLowerCase();
  if (/\b(human|mensch|kind|child|person)\b/.test(text)) return false;
  return /\b(animal|tier|fuchs|fox|maus|mouse|igel|hedgehog|hase|rabbit|eule|owl|vogel|bird|biber|beaver|dachs|badger|frosch|frog|kroete|kröte|squirrel|eichhoernchen|eichhörnchen|otter|reh|deer|katze|cat|hund|dog)\b/.test(text);
}

function resolveAnimalSoulPlace(req: NormalizedRequest): string {
  const text = String(req.rawConfig?.setting || "").toLowerCase();
  if (/\b(ocean|meer|riff|seegras|koralle|coral)\b/.test(text)) return "Seegrasriff hinter der Muschelbank";
  if (/\b(farm|bauernhof|stall|scheune)\b/.test(text)) return "Apfelgarten hinter dem Stall";
  if (/\b(pond|teich|lake|see|bach|river|fluss)\b/.test(text)) return "Biberbach unter der Weide";
  if (/\b(wiese|meadow|field)\b/.test(text)) return "Kleewiese am Mooswald";
  return "Mooswald am Biberbach";
}

function findFallbackAntagonist(cast: CastSet): { displayName: string } | undefined {
  return cast.poolCharacters.find((character) => {
    const values = [
      character.roleType,
      character.role,
      character.archetype,
      character.species,
    ].map(value => String(value || "").toLowerCase());
    return values.some(value => value.includes("antagonist") || value.includes("villain") || value.includes("boes") || value.includes("böse"));
  });
}

function toSoulProviderError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
